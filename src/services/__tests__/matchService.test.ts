import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTxGet = vi.fn();
const mockTxUpdate = vi.fn();
const mockTxDelete = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('../../firebase', async () => {
  const actual = await vi.importActual<typeof import('../../firebase')>('../../firebase');
  return {
    ...actual,
    db: { __mockDb: true },
  };
});

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    doc: vi.fn((_db, col: string, id: string) => ({ path: `${col}/${id}`, id })),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    runTransaction: vi.fn(async (_db, callback: (tx: unknown) => Promise<void>) => {
      await callback({
        get: mockTxGet,
        update: mockTxUpdate,
        delete: mockTxDelete,
      });
    }),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  };
});

import {
  buildCreateMatchPayload,
  createMatchLobby,
  generateMatchId,
  generateRoomCode,
  isLobbyStale,
  joinMatchLobby,
  leaveMatchSession,
  sanitizeDisplayName,
  setSeatAwayStatus,
  STALE_LOBBY_AGE_MS,
  startWaitingMatch,
} from '../matchService';

describe('matchService 2-4 player rooms and session cleanup', () => {
  beforeEach(() => {
    mockTxGet.mockReset();
    mockTxUpdate.mockReset();
    mockTxDelete.mockReset();
    mockSetDoc.mockReset();
  });

  it('Blue Pill: creates a 4-player waiting room with roomCode and initial seat roster', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    const matchId = await createMatchLobby({
      hostUid: 'host-1',
      hostName: 'ZeusHost',
      matchSeed: 202601,
      maxPlayers: 4,
      teamMode: 'teams',
      fillWithBots: true,
    });

    expect(matchId).toMatch(/^match-/);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(payload.maxPlayers).toBe(4);
    expect(payload.teamMode).toBe('teams');
    expect(payload.fillWithBots).toBe(true);
    expect(payload.players).toHaveLength(4);
    expect(payload.players[0].uid).toBe('host-1');
    expect(payload.players[1].uid).toBeNull();
  });

  it('Blue Pill: fills open seat on join and rejects full rooms cleanly', async () => {
    mockTxGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'waiting',
        activePlayers: ['host-1'],
        players: [
          { uid: 'host-1', name: 'Host', isBot: false, deck: ['a'], away: false, ready: true },
          { uid: null, name: 'Open Seat', isBot: false, deck: ['b'], away: false, ready: false },
          { uid: null, name: 'Open Seat', isBot: false, deck: ['c'], away: false, ready: false },
        ],
      }),
    });

    await joinMatchLobby('match-room-1', 'guest-2', 'Athena');
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
    const updateData = mockTxUpdate.mock.calls[0][1];
    expect(updateData.players[1].uid).toBe('guest-2');
    expect(updateData.players[1].name).toBe('Athena');
    expect(updateData.activePlayers).toEqual(['host-1', 'guest-2']);

    // Red Pill: full room throws explicit error
    mockTxGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'waiting',
        activePlayers: ['host-1', 'guest-2'],
        players: [
          { uid: 'host-1', name: 'Host', isBot: false },
          { uid: 'guest-2', name: 'Athena', isBot: false },
        ],
      }),
    });

    await expect(joinMatchLobby('match-room-1', 'guest-3', 'Loki')).rejects.toThrow(/full/i);
  });

  it('Blue Pill & Red Pill: only host can start waiting room and fillWithBots populates empty seats', async () => {
    mockTxGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'waiting',
        hostUid: 'host-1',
        matchSeed: 202601,
        maxPlayers: 3,
        teamMode: 'ffa',
        fillWithBots: true,
        players: [
          { uid: 'host-1', name: 'Host', isBot: false, ready: true },
          { uid: null, name: 'Open Seat', isBot: false, ready: false },
          { uid: null, name: 'Open Seat', isBot: false, ready: false },
        ],
      }),
    });

    await expect(startWaitingMatch('match-1', 'not-host')).rejects.toThrow(/host/i);

    mockTxGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'waiting',
        hostUid: 'host-1',
        matchSeed: 202601,
        maxPlayers: 3,
        teamMode: 'ffa',
        fillWithBots: true,
        players: [
          { uid: 'host-1', name: 'Host', isBot: false, ready: true },
          { uid: null, name: 'Open Seat', isBot: false, ready: false },
          { uid: null, name: 'Open Seat', isBot: false, ready: false },
        ],
      }),
    });

    await startWaitingMatch('match-1', 'host-1');
    const started = mockTxUpdate.mock.calls[0][1];
    expect(started.status).toBe('active');
    expect(started.players[1].isBot).toBe(true);
    expect(started.players[2].isBot).toBe(true);
  });

  it('Blue Pill: removes leaving UID from activePlayers and deletes match when empty', async () => {
    mockTxGet.mockResolvedValue({
      exists: () => true,
      data: () => ({
        activePlayers: ['uid-host', 'uid-guest'],
      }),
    });

    await leaveMatchSession('match-123', 'uid-host');
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
    expect(mockTxUpdate.mock.calls[0][1].activePlayers).toEqual(['uid-guest']);
    expect(mockTxDelete).not.toHaveBeenCalled();

    mockTxGet.mockResolvedValue({
      exists: () => true,
      data: () => ({
        activePlayers: ['uid-last'],
      }),
    });

    await leaveMatchSession('match-123', 'uid-last');
    expect(mockTxDelete).toHaveBeenCalledTimes(1);
  });

  it('Blue Pill & Red Pill: detects stale lobbies >2h and formats room codes, names, and IDs', () => {
    const now = 1_700_000_000_000;
    const freshTimestamp = { toMillis: () => now - 30 * 60 * 1000 };
    const staleTimestamp = { toMillis: () => now - STALE_LOBBY_AGE_MS - 1000 };

    expect(isLobbyStale(freshTimestamp, now)).toBe(false);
    expect(isLobbyStale(staleTimestamp, now)).toBe(true);
    expect(isLobbyStale(null, now)).toBe(false);

    expect(sanitizeDisplayName('   ')).toBe('Oracle');
    expect(sanitizeDisplayName('Zeus   Thunder')).toBe('Zeus Thunder');
    expect(generateMatchId(202601)).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(generateRoomCode(202601, 42)).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('Blue Pill: buildCreateMatchPayload matches isValidMatch required/allowed keys, seat rules, and room bounds', () => {
    const requiredKeys = [
      'matchId',
      'roomCode',
      'status',
      'hostUid',
      'maxPlayers',
      'fillWithBots',
      'activePlayers',
      'matchSeed',
      'matchPreset',
      'gameMode',
      'round',
      'maxRounds',
      'teamMode',
      'roundPhase',
      'activeTurnIndex',
      'activeRealm',
      'players',
      'warPot',
      'gambitArmed',
      'statWins',
      'winner',
      'turnStartedAt',
      'createdAt',
      'updatedAt',
    ];
    const allowedKeys = new Set([
      ...requiredKeys,
      'pendingClash',
      'prophecyTarget',
      'bestWin',
      'lastOutcome',
    ]);

    for (const maxPlayers of [2, 3, 4] as const) {
      const { matchId, payload } = buildCreateMatchPayload({
        hostUid: 'Zze89CHTwkalGxP71jbSuU9AL8E3',
        hostName: 'Host Challenger',
        matchSeed: 202601,
        maxPlayers,
        teamMode: maxPlayers === 4 ? 'teams' : 'ffa',
        fillWithBots: true,
        matchPreset: 'blitz',
      });

      const payloadKeys = Object.keys(payload);
      for (const reqKey of requiredKeys) {
        expect(payloadKeys).toContain(reqKey);
      }
      for (const key of payloadKeys) {
        expect(allowedKeys.has(key)).toBe(true);
      }

      expect(payload.matchId).toBe(matchId);
      expect(payload.status).toBe('waiting');
      expect(payload.hostUid).toBe('Zze89CHTwkalGxP71jbSuU9AL8E3');
      expect([2, 3, 4]).toContain(payload.maxPlayers);
      expect(payload.maxPlayers).toBe(maxPlayers);
      expect(payload.matchPreset).toBe('blitz');
      expect(payload.gameMode).toBe('points');
      expect(payload.roundPhase).toBe('attack');
      expect(payload.activePlayers).toEqual(['Zze89CHTwkalGxP71jbSuU9AL8E3']);
      expect(payload.round).toBe(1);
      expect(payload.maxRounds).toBe(12);
      expect(payload.winner).toBe('NONE');
      expect(payload.warPot).toEqual([]);
      expect(payload.pendingClash).toBeNull();
      expect(payload.prophecyTarget).toBeNull();
      expect(payload.bestWin).toBeNull();
      expect(payload.lastOutcome).toBeNull();
      expect(Object.keys(payload.statWins).sort()).toEqual([
        'arcana',
        'cunning',
        'influence',
        'might',
      ]);
      expect(payload.turnStartedAt).toEqual({ __serverTimestamp: true });
      expect(payload.createdAt).toEqual({ __serverTimestamp: true });
      expect(payload.updatedAt).toEqual({ __serverTimestamp: true });
      expect(payload.players).toHaveLength(maxPlayers);

      const expectedSeatKeys = [
        'away',
        'deck',
        'eliminated',
        'gambitUsed',
        'id',
        'isBot',
        'name',
        'ready',
        'resurrectionUsed',
        'roundsWon',
        'score',
        'seatIndex',
        'team',
        'uid',
      ];
      payload.players.forEach((seat, idx) => {
        expect(Object.keys(seat).sort()).toEqual(expectedSeatKeys);
        expect(seat.seatIndex).toBe(idx);
        expect(seat.score).toBe(0);
        expect(seat.roundsWon).toBe(0);
        expect(seat.deck.length).toBeGreaterThan(0);
        expect(seat.deck.length).toBeLessThanOrEqual(60);
      });

      expect(payload.players[0].uid).toBe('Zze89CHTwkalGxP71jbSuU9AL8E3');
      for (let i = 1; i < maxPlayers; i += 1) {
        expect(payload.players[i].uid).toBeNull();
      }
    }
  });

  it('Blue Pill: setSeatAwayStatus restores activePlayers on rejoin and waiting join no-ops when already seated', async () => {
    mockTxGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'waiting',
        activePlayers: ['host-1'],
        players: [
          { uid: 'host-1', name: 'Host', isBot: false, away: false, ready: true },
          { uid: null, name: 'Open Seat', isBot: false, away: false, ready: false },
        ],
      }),
    });

    await joinMatchLobby('match-wait-1', 'host-1', 'Host');
    expect(mockTxUpdate).not.toHaveBeenCalled();

    mockTxGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'active',
        activePlayers: ['host-1'],
        players: [
          { uid: 'host-1', name: 'Host', isBot: false, away: false, ready: true },
          { uid: 'guest-2', name: 'Athena', isBot: false, away: true, ready: true },
        ],
      }),
    });

    await setSeatAwayStatus('match-active-1', 'guest-2', false);
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockTxUpdate.mock.calls[0][1];
    expect(updateArg.players[1].away).toBe(false);
    expect(updateArg.activePlayers).toEqual(['host-1', 'guest-2']);
  });
});
