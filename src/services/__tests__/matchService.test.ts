import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTxGet = vi.fn();
const mockTxUpdate = vi.fn();
const mockTxDelete = vi.fn();

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
  generateMatchId,
  isLobbyStale,
  leaveMatchSession,
  sanitizeDisplayName,
  STALE_LOBBY_AGE_MS,
} from '../matchService';

describe('matchService helpers and session cleanup', () => {
  beforeEach(() => {
    mockTxGet.mockReset();
    mockTxUpdate.mockReset();
    mockTxDelete.mockReset();
  });

  it('Blue Pill: removes leaving UID from activePlayers when another player remains', async () => {
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
  });

  it('Blue Pill: deletes match document inside transaction when activePlayers becomes empty', async () => {
    mockTxGet.mockResolvedValue({
      exists: () => true,
      data: () => ({
        activePlayers: ['uid-last'],
      }),
    });

    await leaveMatchSession('match-123', 'uid-last');

    expect(mockTxDelete).toHaveBeenCalledTimes(1);
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('Blue Pill & Red Pill: detects stale lobbies >2h and sanitizes display names and IDs', () => {
    const now = 1_700_000_000_000;
    const freshTimestamp = { toMillis: () => now - 30 * 60 * 1000 };
    const staleTimestamp = { toMillis: () => now - STALE_LOBBY_AGE_MS - 1000 };

    expect(isLobbyStale(freshTimestamp, now)).toBe(false);
    expect(isLobbyStale(staleTimestamp, now)).toBe(true);
    expect(isLobbyStale(null, now)).toBe(false);

    expect(sanitizeDisplayName('   ')).toBe('Oracle');
    expect(sanitizeDisplayName('Zeus   Thunder')).toBe('Zeus Thunder');
    expect(generateMatchId(202601)).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});
