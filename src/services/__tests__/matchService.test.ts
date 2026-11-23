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
  createMatchLobby,
  generateMatchId,
  generateRoomCode,
  isLobbyStale,
  joinMatchLobby,
  leaveMatchSession,
  sanitizeDisplayName,
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
});
