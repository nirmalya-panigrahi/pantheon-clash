import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createInitialMatchState } from '../../engine/gameEngine';
import type { AuthState } from '../../hooks/useAuth';
import type { FirestoreMatchDocument } from '../../types/game';
import { Lobby } from '../Lobby';

function makeAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    isConfigured: true,
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
  const base = createInitialMatchState(202601, {
    playerCount: 3,
    players: [
      { name: 'AthenaHost', isBot: false, uid: 'host-uid-1', ready: true },
      { name: 'Open Seat', isBot: false, uid: null, ready: false },
      { name: 'Open Seat', isBot: false, uid: null, ready: false },
    ],
  });

  return {
    ...base,
    matchId: 'match-abc-123',
    roomCode: 'AB12CD',
    status: 'waiting',
    hostUid: 'host-uid-1',
    maxPlayers: 3,
    fillWithBots: true,
    activePlayers: ['host-uid-1'],
    turnStartedAt: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('Lobby component', () => {
  it('Blue Pill: starts solo 4-player 2v2 match with normalized seed and handles auth buttons', async () => {
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

    await user.click(screen.getByRole('button', { name: '4P' }));
    await user.click(screen.getByRole('button', { name: /2v2 teams/i }));

    const seedInput = screen.getByLabelText(/match seed/i);
    await user.clear(seedInput);
    await user.type(seedInput, '4242');
    await user.click(screen.getByRole('button', { name: /play vs bot/i }));

    expect(onStartSolo).toHaveBeenCalledWith({
      seed: 4242,
      playerCount: 4,
      teamMode: 'teams',
    });

    await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(authState.loginWithGoogle).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /continue as guest/i }));
    expect(authState.loginAsGuest).toHaveBeenCalledTimes(1);
  });

  it('Blue Pill & Red Pill: supports segmented room-code input, creating rooms, and open room joining', async () => {
    const user = userEvent.setup();
    const onJoinMultiplayer = vi.fn();
    const onCreateMultiplayer = vi.fn().mockResolvedValue(undefined);
    const authState = makeAuthState({
      user: { uid: 'host-uid-1', isAnonymous: true } as AuthState['user'],
      displayName: 'AthenaHost',
    });

    const otherBase = createInitialMatchState(202601, {
      playerCount: 2,
      players: [
        { name: 'OdinHost', isBot: false, uid: 'other-uid-2', ready: true },
        { name: 'Open Seat', isBot: false, uid: null, ready: false },
      ],
    });

    const lobbies = [
      makeLobbyDoc({ matchId: 'match-own', hostUid: 'host-uid-1' }),
      makeLobbyDoc({
        ...otherBase,
        matchId: 'match-other',
        roomCode: 'XYZ789',
        hostUid: 'other-uid-2',
        maxPlayers: 2,
      }),
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
        lobbyActionError="Room already full"
        onStartSolo={vi.fn()}
        onCreateMultiplayer={onCreateMultiplayer}
        onJoinMultiplayer={onJoinMultiplayer}
        onSweepStale={vi.fn()}
      />,
    );

    expect(screen.getByText(/cleaned 2 stale lobbies/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Room already full');

    expect(screen.getByRole('button', { name: /your lobby/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /join match/i }));
    expect(onJoinMultiplayer).toHaveBeenCalledWith('match-other');

    // Switch to Create Room & test creating 3-seat room
    await user.click(screen.getByRole('button', { name: '3 Seats' }));
    await user.click(screen.getByRole('button', { name: /create 3-player room/i }));
    expect(onCreateMultiplayer).toHaveBeenCalledWith({
      seed: 202601,
      maxPlayers: 3,
      teamMode: 'ffa',
      fillWithBots: true,
    });

    // Switch to Join Room & enter 6-char segmented room code
    await user.click(screen.getByRole('tab', { name: /join room/i }));
    const chars = ['K', '9', 'M', '2', 'P', '4'];
    for (let i = 0; i < 6; i += 1) {
      await user.type(screen.getByLabelText(`Room code character ${i + 1}`), chars[i]);
    }
    await user.click(screen.getByRole('button', { name: /^join room$/i }));
    expect(onJoinMultiplayer).toHaveBeenCalledWith('K9M2P4');
  });

  it('Red Pill: hides auth buttons and explains offline mode when Firebase is not configured', () => {
    const authState = makeAuthState({ isConfigured: false });

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
        onStartSolo={vi.fn()}
        onCreateMultiplayer={vi.fn()}
        onJoinMultiplayer={vi.fn()}
        onSweepStale={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/online multiplayer disabled on this static build/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /sign in with google/i }),
    ).not.toBeInTheDocument();
  });
});
