import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createInitialMatchState } from '../../engine/gameEngine';
import type { MatchState } from '../../types/game';
import { Arena } from '../Arena';

function makeArenaState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    ...createInitialMatchState(202601),
    ...overrides,
  };
}

describe('Arena component', () => {
  it('Blue Pill: lets active player arm Gambit, pick a stat, and displays Prophecy reveal', async () => {
    const user = userEvent.setup();
    const onDispatch = vi.fn();
    const state = makeArenaState({
      activeTurn: 'p1',
      p1Deck: ['athena', 'zeus'], // athena has PROPHECY
      p2Deck: ['poseidon', 'thor'],
    });

    render(
      <Arena
        mode="solo"
        state={state}
        localSeat="p1"
        p1Label="Player 1"
        p2Label="Deterministic Bot"
        history={[]}
        muted={false}
        onToggleMuted={vi.fn()}
        onPlaySound={vi.fn()}
        onDispatch={onDispatch}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByTestId('prophecy-reveal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /use gambit/i }));
    expect(onDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_GAMBIT', player: 'p1' });

    await user.click(screen.getByRole('button', { name: /cunning/i }));
    expect(onDispatch).toHaveBeenCalledWith({
      type: 'PICK_STAT',
      player: 'p1',
      stat: 'cunning',
    });
  });

  it('Blue Pill: renders multiplayer waiting room and triggers Cancel Match', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    const state = makeArenaState();

    render(
      <Arena
        mode="multiplayer"
        matchId="match-xyz-999"
        matchStatus="waiting"
        state={state}
        localSeat="p1"
        p1Label="HostPlayer"
        p2Label="Opponent"
        history={[]}
        muted={false}
        onToggleMuted={vi.fn()}
        onPlaySound={vi.fn()}
        onDispatch={vi.fn()}
        onLeave={onLeave}
      />,
    );

    expect(screen.getByText('match-xyz-999')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel match/i }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('Red Pill: handles null match closed state and disables actions when not local turn', async () => {
    const onLeave = vi.fn();
    const { rerender } = render(
      <Arena
        mode="multiplayer"
        state={null}
        localSeat="p1"
        p1Label="Host"
        p2Label="Guest"
        history={[]}
        muted={false}
        onToggleMuted={vi.fn()}
        onPlaySound={vi.fn()}
        onDispatch={vi.fn()}
        onLeave={onLeave}
      />,
    );

    expect(screen.getByText(/match closed/i)).toBeInTheDocument();

    const oppTurnState = makeArenaState({ activeTurn: 'p2' });
    rerender(
      <Arena
        mode="solo"
        state={oppTurnState}
        localSeat="p1"
        p1Label="Host"
        p2Label="Bot"
        history={[]}
        muted={false}
        onToggleMuted={vi.fn()}
        onPlaySound={vi.fn()}
        onDispatch={vi.fn()}
        onLeave={onLeave}
      />,
    );

    expect(screen.getByText(/bot is choosing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use gambit/i })).toBeDisabled();
  });
});
