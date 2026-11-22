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
  type Unsubscribe,
} from 'firebase/firestore';
import { createInitialMatchState } from '../engine/gameEngine';
import { normalizeSeed } from '../engine/prng';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { FirestoreMatchDocument, MatchState } from '../types/game';

export const STALE_LOBBY_AGE_MS = 2 * 60 * 60 * 1000;

export function generateMatchId(seed: number): string {
  const timePart = Date.now().toString(36);
  const seedPart = normalizeSeed(seed).toString(36).slice(0, 6);
  return `match-${timePart}-${seedPart}`;
}

export function sanitizeDisplayName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ').slice(0, 48);
  return cleaned.length > 0 ? cleaned : 'Oracle';
}

export async function createMatchLobby(
  hostUid: string,
  hostName: string,
  matchSeed: number,
): Promise<string> {
  const seed = normalizeSeed(matchSeed);
  const matchId = generateMatchId(seed);
  const path = `matches/${matchId}`;
  const initialState = createInitialMatchState(seed);

  const payload = {
    ...initialState,
    matchId,
    status: 'waiting' as const,
    hostUid,
    hostName: sanitizeDisplayName(hostName),
    guestUid: '',
    guestName: '',
    activePlayers: [hostUid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'matches', matchId), payload);
    return matchId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function joinMatchLobby(
  matchId: string,
  guestUid: string,
  guestName: string,
): Promise<void> {
  const path = `matches/${matchId}`;
  const matchRef = doc(db, 'matches', matchId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) {
        throw new Error('Match lobby no longer exists.');
      }
      const data = snap.data() as FirestoreMatchDocument;
      if (data.status !== 'waiting' || data.guestUid !== '') {
        throw new Error('This match already has two players.');
      }
      if (data.hostUid === guestUid) {
        throw new Error('You cannot join your own match from the same account.');
      }

      const activePlayers = Array.from(new Set([data.hostUid, guestUid])).slice(0, 2);

      tx.update(matchRef, {
        guestUid,
        guestName: sanitizeDisplayName(guestName),
        status: 'active',
        activePlayers,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('no longer exists') ||
        error.message.includes('already has two players') ||
        error.message.includes('cannot join your own match'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function commitMatchState(
  matchId: string,
  nextState: MatchState,
): Promise<void> {
  const path = `matches/${matchId}`;
  const matchRef = doc(db, 'matches', matchId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists()) {
        throw new Error('Match document was closed.');
      }
      const current = snap.data() as FirestoreMatchDocument;
      if (current.status !== 'active' || current.winner !== 'NONE') {
        return;
      }

      tx.update(matchRef, {
        status: nextState.winner === 'NONE' ? 'active' : 'finished',
        round: nextState.round,
        activeTurn: nextState.activeTurn,
        activeRealm: nextState.activeRealm,
        p1Deck: nextState.p1Deck,
        p2Deck: nextState.p2Deck,
        warPot: nextState.warPot,
        resurrectionUsed: nextState.resurrectionUsed,
        gambitUsed: nextState.gambitUsed,
        gambitArmed: nextState.gambitArmed,
        winner: nextState.winner,
        lastOutcome: nextState.lastOutcome,
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
  if (!matchId || !uid) return;
  const path = `matches/${matchId}`;
  const matchRef = doc(db, 'matches', matchId);

  try {
    await runTransaction(db, async (tx) => {
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
        tx.update(matchRef, {
          activePlayers: remaining,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function getCreatedAtMillis(createdAt: unknown): number | null {
  if (createdAt instanceof Timestamp) {
    return createdAt.toMillis();
  }
  if (
    createdAt &&
    typeof createdAt === 'object' &&
    'toMillis' in createdAt &&
    typeof (createdAt as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (createdAt as { toMillis: () => number }).toMillis();
  }
  return null;
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
  const waitingQuery = query(collection(db, 'matches'), where('status', '==', 'waiting'));
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
  const path = `matches/${matchId}`;
  return onSnapshot(
    doc(db, 'matches', matchId),
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
