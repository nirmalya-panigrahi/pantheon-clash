import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createInitialMatchState } from '../../engine/gameEngine';
import type { MatchState } from '../../types/game';
import { Arena } from '../Arena';

function makeArenaState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    ...createInitialMatchState(202601, { playerCount: 2 }),
    ...overrides,
  };
}

describe('Arena component', () => {
  it('Blue Pill: lets active player arm Gambit, pick a stat, and displays Prophecy reveal', async () => {
    const user = userEvent.setup();
    const onDispatch = vi.fn();
    const base = createInitialMatchState(202601, { playerCount: 2 });
    const state = makeArenaState({
      activeTurnIndex: 0,
      players: [
        { ...base.players[0], deck: ['athena', 'zeus'] },
        { ...base.players[1], deck: ['poseidon', 'thor'] },
      ],
    });

    render(
      <Arena
        mode="solo"
        state={state}
        localSeatIndex={0}
        history={[]}
        muted={true}
        reducedMotion={true}
        onToggleMuted={vi.fn()}
        onPlaySound={vi.fn()}
        onDispatch={onDispatch}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByTestId('prophecy-reveal')).toBeInTheDocument();
    expect(screen.getByText(/changes in 3 rounds/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /use gambit/i }));
    expect(onDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_GAMBIT', playerIndex: 0 });

    await user.click(screen.getByRole('button', { name: /cunning/i }));
    expect(onDispatch).toHaveBeenCalledWith({
      type: 'PICK_STAT',
      playerIndex: 0,
      stat: 'cunning',
    });
  });

  it('Blue Pill: allows Prophecy target picking in 3-player clashes', async () => {
    const user = userEvent.setup();
    const onDispatch = vi.fn();
    const base = createInitialMatchState(202601, { playerCount: 3 });
    const state: MatchState = {
      ...base,
      activeTurnIndex: 0,
      players: [
        { ...base.players[0], name: 'Hero', deck: ['athena', 'zeus'] },
        { ...base.players[1], name: 'Odin Bot', deck: ['odin', 'thor'] },
        { ...base.players[2], name: 'Anubis Bot', deck: ['anubis', 'ra'] },
      ],
    };

    render(
      <Arena
        mode="solo"
        state={state}
        localSeatIndex={0}
        history={[]}
        muted={true}
        reducedMotion={true}
        onToggleMuted={vi.fn()}
        onPlaySound={vi.fn()}
        onDispatch={onDispatch}
        onLeave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /spy anubis bot/i }));
    expect(onDispatch).toHaveBeenCalledWith({
      type: 'SELECT_PROPHECY_TARGET',
      playerIndex: 0,
      targetIndex: 2,
    });
  });

  it('Blue Pill: renders multiplayer waiting room with room code, seats, Start Match, and Cancel Match', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    const onStartRoom = vi.fn();
    const state = createInitialMatchState(202601, {
      playerCount: 3,
      players: [
        { name: 'HostPlayer', isBot: false, uid: 'uid-host', ready: true },
        { name: 'Open Seat', isBot: false, uid: null, ready: false },
        { name: 'Open Seat', isBot: false, uid: null, ready: false },
      ],
    });

    render(
      <Arena
        mode="multiplayer"
        matchId="match-xyz-999"
        roomCode="HYP42Z"
        matchStatus="waiting"
        fillWithBots={true}
        state={state}
        localSeatIndex={0}
        isHost={true}
        history={[]}
        muted={true}
        reducedMotion={true}
        onToggleMuted={vi.fn()}
        onPlaySound={vi.fn()}
        onDispatch={vi.fn()}
        onLeave={onLeave}
        onStartRoom={onStartRoom}
      />,
    );

    expect(screen.getByText('HYP42Z')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /start match/i }));
    expect(onStartRoom).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /cancel match/i }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('Red Pill: handles null match closed state and disables actions when not local turn or Gambit used', () => {
    const onLeave = vi.fn();
    const { rerender } = render(
      <Arena
        mode="multiplayer"
        state={null}
        localSeatIndex={0}
        history={[]}
        muted={true}
        onToggleMuted={vi.fn()}
        onPlaySound={vi.fn()}
        onDispatch={vi.fn()}
        onLeave={onLeave}
      />,
    );

    expect(screen.getByText(/match closed/i)).toBeInTheDocument();

    const base = createInitialMatchState(202601, { playerCount: 2 });
    const oppTurnState = makeArenaState({
      activeTurnIndex: 1,
      players: [
        { ...base.players[0], gambitUsed: true },
        { ...base.players[1], name: 'Valkyrie Bot' },
      ],
    });
    rerender(
      <Arena
        mode="solo"
        state={oppTurnState}
        localSeatIndex={0}
        history={[]}
        muted={true}
        onToggleMuted={vi.fn()}
        onPlaySound={vi.fn()}
        onDispatch={vi.fn()}
        onLeave={onLeave}
      />,
    );

    expect(screen.getByText(/valkyrie bot is choosing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gambit used/i })).toBeDisabled();
  });
});
