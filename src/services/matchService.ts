import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  createInitialMatchState,
  getDefaultBotName,
  MATCH_PRESETS,
} from '../engine/gameEngine';
import { mulberry32, normalizeSeed } from '../engine/prng';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  FirestoreMatchDocument,
  MatchPreset,
  MatchState,
  PlayerCount,
  TeamMode,
} from '../types/game';

export const STALE_LOBBY_AGE_MS = 2 * 60 * 60 * 1000;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function requireDb(): Firestore {
  if (!db) {
    throw new Error('Online rooms are unavailable in this build.');
  }
  return db;
}

export function generateMatchId(seed: number): string {
  const timePart = Date.now().toString(36);
  const seedPart = normalizeSeed(seed).toString(36).slice(0, 6);
  return `match-${timePart}-${seedPart}`;
}

export function generateRoomCode(seed: number, salt = Date.now()): string {
  const mixed = normalizeSeed((normalizeSeed(seed) ^ (Math.trunc(salt) >>> 0)) >>> 0);
  const rng = mulberry32(mixed);
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function sanitizeDisplayName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ').slice(0, 48);
  return cleaned.length > 0 ? cleaned : 'Oracle';
}

export interface CreateRoomParams {
  hostUid: string;
  hostName: string;
  matchSeed: number;
  maxPlayers?: PlayerCount;
  teamMode?: TeamMode;
  fillWithBots?: boolean;
  matchPreset?: MatchPreset;
}

export interface CreateRoomResultPayload {
  matchId: string;
  payload: Omit<FirestoreMatchDocument, 'turnStartedAt' | 'createdAt' | 'updatedAt'> & {
    turnStartedAt: unknown;
    createdAt: unknown;
    updatedAt: unknown;
  };
}

export function buildCreateMatchPayload({
  hostUid,
  hostName,
  matchSeed,
  maxPlayers = 2,
  teamMode = 'ffa',
  fillWithBots = false,
  matchPreset = 'blitz',
}: CreateRoomParams): CreateRoomResultPayload {
  const seed = normalizeSeed(matchSeed);
  const matchId = generateMatchId(seed);
  const roomCode = generateRoomCode(seed);

  const playerConfigs = Array.from({ length: maxPlayers }, (_, idx) =>
    idx === 0
      ? {
          name: sanitizeDisplayName(hostName),
          isBot: false,
          uid: hostUid,
          ready: true,
        }
      : {
          name: 'Open Seat',
          isBot: false,
          uid: null,
          ready: false,
        },
  );

  const initialState = createInitialMatchState(seed, {
    playerCount: maxPlayers,
    teamMode,
    matchPreset,
    players: playerConfigs,
  });

  return {
    matchId,
    payload: {
      ...initialState,
      matchId,
      roomCode,
      status: 'waiting' as const,
      hostUid,
      maxPlayers,
      fillWithBots,
      activePlayers: [hostUid],
      turnStartedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  };
}

export async function createMatchLobby(params: CreateRoomParams): Promise<string> {
  const firestore = requireDb();
  const { matchId, payload } = buildCreateMatchPayload(params);
  const path = `matches/${matchId}`;

  try {
    await setDoc(doc(firestore, 'matches', matchId), payload);
    return matchId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function resolveMatchIdFromInput(codeOrId: string): Promise<string> {
  const cleaned = codeOrId.trim();
  if (!cleaned) {
    throw new Error('Enter a 6-character room code or match ID.');
  }

  const upper = cleaned.toUpperCase();
  if (/^[A-Z0-9]{6}$/.test(upper)) {
    const firestore = requireDb();
    const q = query(
      collection(firestore, 'matches'),
      where('status', '==', 'waiting'),
      where('roomCode', '==', upper),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error(`No open room found with code ${upper}.`);
    }
    return snap.docs[0].id;
  }

  return cleaned;
}

export async function joinMatchLobby(
  matchIdOrCode: string,
  guestUid: string,
  guestName: string,
): Promise<string> {
  const firestore = requireDb();
  const matchId = await resolveMatchIdFromInput(matchIdOrCode);
  const path = `matches/${matchId}`;
  const matchRef = doc(firestore, 'matches', matchId);

  try {
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) {
        throw new Error('Match lobby no longer exists.');
      }
      const data = snap.data() as FirestoreMatchDocument;

      // Allow rejoining an active match (or returning to a waiting seat) if user already holds a seat
      const existingSeatIdx = data.players.findIndex((p) => p.uid === guestUid);
      if (existingSeatIdx >= 0) {
        if (data.status === 'waiting') {
          return;
        }
        const nextPlayers = data.players.map((p, idx) =>
          idx === existingSeatIdx ? { ...p, away: false } : p,
        );
        const nextActive = Array.from(new Set([...data.activePlayers, guestUid]));
        tx.update(matchRef, {
          players: nextPlayers,
          activePlayers: nextActive,
          updatedAt: serverTimestamp(),
        });
        return;
      }

      if (data.status !== 'waiting') {
        throw new Error('This match has already started.');
      }

      const openSeatIdx = data.players.findIndex((p) => p.uid === null && !p.isBot);
      if (openSeatIdx < 0) {
        throw new Error('This match room is already full.');
      }

      const nextPlayers = data.players.map((p, idx) =>
        idx === openSeatIdx
          ? {
              ...p,
              uid: guestUid,
              name: sanitizeDisplayName(guestName),
              isBot: false,
              away: false,
              ready: false,
            }
          : p,
      );

      const nextActive = Array.from(new Set([...data.activePlayers, guestUid]));

      tx.update(matchRef, {
        players: nextPlayers,
        activePlayers: nextActive,
        updatedAt: serverTimestamp(),
      });
    });

    return matchId;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('no longer exists') ||
        error.message.includes('already started') ||
        error.message.includes('already full') ||
        error.message.includes('No open room'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleSeatReady(matchId: string, uid: string): Promise<void> {
  const firestore = requireDb();
  const matchRef = doc(firestore, 'matches', matchId);
  const path = `matches/${matchId}`;

  try {
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) return;
      const data = snap.data() as FirestoreMatchDocument;
      if (data.status !== 'waiting') return;

      const idx = data.players.findIndex((p) => p.uid === uid);
      if (idx < 0) return;

      const nextPlayers = data.players.map((p, i) =>
        i === idx ? { ...p, ready: !p.ready } : p,
      );

      tx.update(matchRef, {
        players: nextPlayers,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateWaitingRoomOptions(
  matchId: string,
  hostUid: string,
  updates: { fillWithBots?: boolean; teamMode?: TeamMode; matchPreset?: MatchPreset },
): Promise<void> {
  const firestore = requireDb();
  const matchRef = doc(firestore, 'matches', matchId);
  const path = `matches/${matchId}`;

  try {
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) return;
      const data = snap.data() as FirestoreMatchDocument;
      if (data.status !== 'waiting' || data.hostUid !== hostUid) return;

      const nextFill = updates.fillWithBots ?? data.fillWithBots;
      const nextTeamMode: TeamMode =
        data.maxPlayers === 4 && (updates.teamMode ?? data.teamMode) === 'teams'
          ? 'teams'
          : 'ffa';
      const nextPreset: MatchPreset = updates.matchPreset ?? data.matchPreset ?? 'blitz';
      const presetCfg = MATCH_PRESETS[nextPreset];

      tx.update(matchRef, {
        fillWithBots: nextFill,
        teamMode: nextTeamMode,
        matchPreset: nextPreset,
        gameMode: presetCfg.gameMode,
        maxRounds: presetCfg.maxRounds,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function kickPlayerSeat(
  matchId: string,
  hostUid: string,
  targetSeatIndex: number,
): Promise<void> {
  const firestore = requireDb();
  const matchRef = doc(firestore, 'matches', matchId);
  const path = `matches/${matchId}`;

  try {
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) return;
      const data = snap.data() as FirestoreMatchDocument;
      if (data.status !== 'waiting' || data.hostUid !== hostUid) return;
      if (targetSeatIndex <= 0 || targetSeatIndex >= data.players.length) return;

      const targetUid = data.players[targetSeatIndex].uid;
      const nextPlayers = data.players.map((p, i) =>
        i === targetSeatIndex
          ? { ...p, uid: null, name: 'Open Seat', isBot: false, ready: false, away: false }
          : p,
      );
      const nextActive = targetUid
        ? data.activePlayers.filter((id) => id !== targetUid)
        : data.activePlayers;

      tx.update(matchRef, {
        players: nextPlayers,
        activePlayers: nextActive,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function startWaitingMatch(matchId: string, hostUid: string): Promise<void> {
  const firestore = requireDb();
  const matchRef = doc(firestore, 'matches', matchId);
  const path = `matches/${matchId}`;

  try {
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) {
        throw new Error('Match lobby no longer exists.');
      }
      const data = snap.data() as FirestoreMatchDocument;
      if (data.status !== 'waiting') return;
      if (data.hostUid !== hostUid) {
        throw new Error('Only the room host can start the match.');
      }

      const seatedHumans = data.players.filter((p) => p.uid !== null);
      if (!data.fillWithBots && seatedHumans.length < 2) {
        throw new Error('Need at least 2 players or enable Fill with Bots to start.');
      }
      const unreadyHuman = seatedHumans.find((p) => !p.ready && p.uid !== hostUid);
      if (unreadyHuman) {
        throw new Error(`Waiting for ${unreadyHuman.name} to mark Ready.`);
      }

      const finalConfigs = data.fillWithBots
        ? data.players.map((p, idx) =>
            p.uid !== null
              ? { name: p.name, isBot: false, uid: p.uid, ready: true }
              : { name: getDefaultBotName(idx), isBot: true, uid: null, ready: true },
          )
        : seatedHumans.map((p) => ({
            name: p.name,
            isBot: false,
            uid: p.uid,
            ready: true,
          }));

      const playerCount = finalConfigs.length as PlayerCount;
      const freshState = createInitialMatchState(data.matchSeed, {
        playerCount,
        teamMode: playerCount === 4 ? data.teamMode : 'ffa',
        matchPreset: data.matchPreset ?? 'blitz',
        players: finalConfigs,
      });

      tx.update(matchRef, {
        ...freshState,
        maxPlayers: playerCount,
        status: 'active',
        turnStartedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('host') ||
        error.message.includes('Need at least 2') ||
        error.message.includes('Waiting for') ||
        error.message.includes('no longer exists'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setSeatAwayStatus(
  matchId: string,
  uid: string,
  away: boolean,
): Promise<void> {
  const firestore = requireDb();
  const matchRef = doc(firestore, 'matches', matchId);
  const path = `matches/${matchId}`;

  try {
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) return;
      const data = snap.data() as FirestoreMatchDocument;
      if (data.status !== 'active') return;
      const idx = data.players.findIndex((p) => p.uid === uid);
      if (idx < 0) return;

      const isAlreadyInActive = data.activePlayers.includes(uid);
      if (data.players[idx].away === away && isAlreadyInActive) return;

      const nextPlayers = data.players.map((p, i) =>
        i === idx ? { ...p, away } : p,
      );
      const nextActive = Array.from(new Set([...data.activePlayers, uid]));

      tx.update(matchRef, {
        players: nextPlayers,
        activePlayers: nextActive,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function commitMatchState(
  matchId: string,
  nextState: MatchState,
): Promise<void> {
  const firestore = requireDb();
  const path = `matches/${matchId}`;
  const matchRef = doc(firestore, 'matches', matchId);

  try {
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) {
        throw new Error('Match document was closed.');
      }
      const current = snap.data() as FirestoreMatchDocument;
      const isRematchReset =
        current.status === 'finished' &&
        nextState.round === 1 &&
        nextState.winner === 'NONE';
      if (!isRematchReset && (current.status !== 'active' || current.winner !== 'NONE')) {
        return;
      }

      const turnChanged =
        nextState.round !== current.round ||
        nextState.activeTurnIndex !== current.activeTurnIndex ||
        nextState.roundPhase !== current.roundPhase ||
        isRematchReset;

      tx.update(matchRef, {
        status: nextState.winner === 'NONE' ? 'active' : 'finished',
        round: nextState.round,
        roundPhase: nextState.roundPhase,
        activeTurnIndex: nextState.activeTurnIndex,
        activeRealm: nextState.activeRealm,
        players: nextState.players,
        warPot: nextState.warPot,
        pendingClash: nextState.pendingClash,
        gambitArmed: nextState.gambitArmed,
        prophecyTarget: nextState.prophecyTarget,
        statWins: nextState.statWins,
        bestWin: nextState.bestWin,
        winner: nextState.winner,
        lastOutcome: nextState.lastOutcome,
        ...(turnChanged ? { turnStartedAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Removes `uid` from `activePlayers` inside a Firestore transaction.
 * Deletes `matches/{matchId}` atomically if `activePlayers` becomes empty.
 */
export async function leaveMatchSession(matchId: string, uid: string): Promise<void> {
  if (!matchId || !uid || !db) return;
  const firestore = db;
  const path = `matches/${matchId}`;
  const matchRef = doc(firestore, 'matches', matchId);

  try {
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) {
        return;
      }
      const data = snap.data() as FirestoreMatchDocument;
      const currentPlayers = Array.isArray(data.activePlayers) ? data.activePlayers : [];
      if (!currentPlayers.includes(uid)) {
        return;
      }
      const remaining = currentPlayers.filter((playerUid) => playerUid !== uid);
      if (remaining.length === 0) {
        tx.delete(matchRef);
      } else {
        const updatePayload: Record<string, unknown> = {
          activePlayers: remaining,
          updatedAt: serverTimestamp(),
        };

        if (Array.isArray(data.players)) {
          if (data.status === 'waiting') {
            updatePayload.players = data.players.map((p) =>
              p.uid === uid && p.seatIndex > 0
                ? { ...p, uid: null, name: 'Open Seat', ready: false, away: false }
                : p,
            );
          } else if (data.status === 'active') {
            updatePayload.players = data.players.map((p) =>
              p.uid === uid ? { ...p, away: true } : p,
            );
          }
        }

        tx.update(matchRef, updatePayload);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function getTimestampMillis(ts: unknown): number | null {
  if (ts instanceof Timestamp) {
    return ts.toMillis();
  }
  if (
    ts &&
    typeof ts === 'object' &&
    'toMillis' in ts &&
    typeof (ts as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return null;
}

export function getCreatedAtMillis(createdAt: unknown): number | null {
  return getTimestampMillis(createdAt);
}

export function isLobbyStale(createdAt: unknown, nowMs = Date.now()): boolean {
  const createdMs = getCreatedAtMillis(createdAt);
  if (createdMs === null) return false;
  return nowMs - createdMs > STALE_LOBBY_AGE_MS;
}

/**
 * Client-side sweep removing waiting lobbies older than 2 hours.
 */
export async function sweepStaleLobbies(nowMs = Date.now()): Promise<number> {
  if (!db) return 0;
  const matchesCol = collection(db, 'matches');
  const waitingQuery = query(matchesCol, where('status', '==', 'waiting'));
  let removed = 0;

  try {
    const snapshot = await getDocs(waitingQuery);
    const deletions: Promise<void>[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as FirestoreMatchDocument;
      if (isLobbyStale(data.createdAt, nowMs)) {
        deletions.push(
          deleteDoc(docSnap.ref)
            .then(() => {
              removed += 1;
            })
            .catch(() => {
              // Another client or rule boundary may have already swept this doc.
            }),
        );
      }
    }

    await Promise.all(deletions);
    return removed;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'matches');
  }
}

export function subscribeWaitingLobbies(
  onUpdate: (lobbies: FirestoreMatchDocument[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const firestore = requireDb();
  const waitingQuery = query(collection(firestore, 'matches'), where('status', '==', 'waiting'));
  return onSnapshot(
    waitingQuery,
    (snapshot) => {
      const now = Date.now();
      const lobbies = snapshot.docs
        .map((docSnap) => docSnap.data() as FirestoreMatchDocument)
        .filter((item) => !isLobbyStale(item.createdAt, now))
        .sort((a, b) => {
          const ta = getCreatedAtMillis(a.createdAt) ?? 0;
          const tb = getCreatedAtMillis(b.createdAt) ?? 0;
          return tb - ta;
        });
      onUpdate(lobbies);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'matches');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribeMatch(
  matchId: string,
  onUpdate: (match: FirestoreMatchDocument | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const firestore = requireDb();
  const path = `matches/${matchId}`;
  return onSnapshot(
    doc(firestore, 'matches', matchId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(snapshot.data() as FirestoreMatchDocument);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}
