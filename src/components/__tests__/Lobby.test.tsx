import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../../hooks/useAuth';
import type { FirestoreMatchDocument } from '../../types/game';
import { Lobby } from '../Lobby';

function makeAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    user: null,
    displayName: 'Guest',
    loading: false,
    signingIn: false,
    error: null,
    loginWithGoogle: vi.fn(),
    loginAsGuest: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

function makeLobbyDoc(overrides: Partial<FirestoreMatchDocument> = {}): FirestoreMatchDocument {
  return {
    matchId: 'match-abc-123',
    status: 'waiting',
    hostUid: 'host-uid-1',
    hostName: 'AthenaHost',
    guestUid: '',
    guestName: '',
    activePlayers: ['host-uid-1'],
    matchSeed: 202601,
    round: 1,
    activeTurn: 'p1',
    activeRealm: 'SKY',
    p1Deck: ['zeus'],
    p2Deck: ['thor'],
    warPot: [],
    resurrectionUsed: { p1: false, p2: false },
    gambitUsed: { p1: false, p2: false },
    gambitArmed: false,
    winner: 'NONE',
    lastOutcome: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('Lobby component', () => {
  it('Blue Pill: starts solo match with normalized user seed and triggers Google/Guest auth', async () => {
    const user = userEvent.setup();
    const onStartSolo = vi.fn();
    const authState = makeAuthState();

    render(
      <Lobby
        authState={authState}
        lobbies={[]}
        lobbiesLoading={false}
        lobbiesError={null}
        sweptCount={0}
        creatingMatch={false}
        joiningMatchId={null}
        lobbyActionError={null}
        onStartSolo={onStartSolo}
        onCreateMultiplayer={vi.fn()}
        onJoinMultiplayer={vi.fn()}
        onSweepStale={vi.fn()}
      />,
    );

    const seedInput = screen.getByLabelText(/match seed/i);
    await user.clear(seedInput);
    await user.type(seedInput, '4242');
    await user.click(screen.getByRole('button', { name: /play vs bot/i }));

    expect(onStartSolo).toHaveBeenCalledWith(4242);

    await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(authState.loginWithGoogle).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /continue as guest/i }));
    expect(authState.loginAsGuest).toHaveBeenCalledTimes(1);
  });

  it('Blue Pill & Red Pill: lists open lobbies, prevents joining own lobby, and renders errors cleanly', async () => {
    const user = userEvent.setup();
    const onJoinMultiplayer = vi.fn();
    const authState = makeAuthState({
      user: { uid: 'host-uid-1', isAnonymous: true } as AuthState['user'],
      displayName: 'AthenaHost',
    });

    const lobbies = [
      makeLobbyDoc({ matchId: 'match-own', hostUid: 'host-uid-1', hostName: 'AthenaHost' }),
      makeLobbyDoc({ matchId: 'match-other', hostUid: 'other-uid-2', hostName: 'OdinGuest' }),
    ];

    render(
      <Lobby
        authState={authState}
        lobbies={lobbies}
        lobbiesLoading={false}
        lobbiesError={null}
        sweptCount={2}
        creatingMatch={false}
        joiningMatchId={null}
        lobbyActionError="Match already full"
        onStartSolo={vi.fn()}
        onCreateMultiplayer={vi.fn()}
        onJoinMultiplayer={onJoinMultiplayer}
        onSweepStale={vi.fn()}
      />,
    );

    expect(screen.getByText(/cleaned 2 stale lobbies/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Match already full');

    const ownBtn = screen.getByRole('button', { name: /your lobby/i });
    expect(ownBtn).toBeDisabled();

    const joinBtn = screen.getByRole('button', { name: /join match/i });
    await user.click(joinBtn);
    expect(onJoinMultiplayer).toHaveBeenCalledWith('match-other');
  });
});
