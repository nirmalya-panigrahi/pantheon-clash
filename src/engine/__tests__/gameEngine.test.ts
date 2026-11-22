import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCardById } from '../../data/cards';
import type { MatchState, StatKey } from '../../types/game';
import {
  chooseBotAction,
  computeEffectiveStats,
  createInitialMatchState,
  getProphecyStat,
  getRealmForRound,
  REALM_BONUS,
  reduceMatchState,
} from '../gameEngine';

function buildCustomState(overrides: Partial<MatchState>): MatchState {
  return {
    matchSeed: 12345,
    round: 1,
    activeTurn: 'p1',
    activeRealm: 'SKY',
    p1Deck: ['zeus', 'poseidon'],
    p2Deck: ['thor', 'hades'],
    warPot: [],
    resurrectionUsed: { p1: false, p2: false },
    gambitUsed: { p1: false, p2: false },
    gambitArmed: false,
    winner: 'NONE',
    lastOutcome: null,
    ...overrides,
  };
}

describe('gameEngine deterministic mechanics', () => {
  it('Blue Pill: deals 60 unique cards evenly (30 vs 30) reproducibly from a match seed', () => {
    const stateA = createInitialMatchState(777);
    const stateB = createInitialMatchState(777);
    const stateC = createInitialMatchState(778);

    expect(ALL_CARDS).toHaveLength(60);
    expect(stateA.p1Deck).toHaveLength(30);
    expect(stateA.p2Deck).toHaveLength(30);
    expect(stateA).toEqual(stateB);
    expect(stateA.p1Deck).not.toEqual(stateC.p1Deck);

    const combined = new Set([...stateA.p1Deck, ...stateA.p2Deck]);
    expect(combined.size).toBe(60);
  });

  it('Blue Pill: rotates realms deterministically every 3 rounds', () => {
    const r1 = getRealmForRound(555, 1);
    const r2 = getRealmForRound(555, 2);
    const r3 = getRealmForRound(555, 3);
    const r4 = getRealmForRound(555, 4);
    const r7 = getRealmForRound(555, 7);
    const r10 = getRealmForRound(555, 10);

    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    expect(new Set([r1, r4, r7, r10]).size).toBe(4);
  });

  it('Blue Pill: grants +15 realm bonus to matching domain unless negated by PIERCING', () => {
    const poseidon = getCardById('poseidon'); // SEA, NONE
    const apollo = getCardById('apollo'); // SKY, PROPHECY
    const zeus = getCardById('zeus'); // SKY, PIERCING

    const normalSky = computeEffectiveStats(apollo, poseidon, 'SKY');
    expect(normalSky.bonus).toBe(REALM_BONUS);
    expect(normalSky.effectiveStats.arcana).toBe(apollo.stats.arcana + 15);

    const piercedSky = computeEffectiveStats(apollo, zeus, 'SKY');
    expect(piercedSky.bonus).toBe(0);
    expect(piercedSky.effectiveStats.arcana).toBe(apollo.stats.arcana);

    // PIERCING attacker still keeps its own realm bonus
    const zeusOwnBonus = computeEffectiveStats(zeus, apollo, 'SKY');
    expect(zeusOwnBonus.bonus).toBe(REALM_BONUS);
  });

  it('Blue Pill: PROPHECY reveals exactly one deterministic stat of opponent top card', () => {
    const state = buildCustomState({
      p1Deck: ['athena', 'zeus'], // athena has PROPHECY
      p2Deck: ['poseidon', 'thor'],
      activeRealm: 'SEA',
    });

    const hint1 = getProphecyStat(state, 'p1');
    const hint2 = getProphecyStat(state, 'p1');
    const oppHint = getProphecyStat(state, 'p2');

    expect(hint1).not.toBeNull();
    expect(hint1).toEqual(hint2);
    expect(oppHint).toBeNull();
  });

  it('Blue Pill: RESURRECTION returns losing card to bottom of owner deck once per match', () => {
    // hades (UNDERWORLD, RESURRECTION, might 78) vs thor (WAR, PIERCING, might 97)
    const initial = buildCustomState({
      activeTurn: 'p1',
      activeRealm: 'UNDERWORLD',
      p1Deck: ['hades', 'poseidon'],
      p2Deck: ['thor', 'odin'],
    });

    const afterFirstLoss = reduceMatchState(initial, {
      type: 'PICK_STAT',
      player: 'p1',
      stat: 'might',
    });

    expect(afterFirstLoss.lastOutcome?.winner).toBe('p2');
    expect(afterFirstLoss.lastOutcome?.resurrectedPlayer).toBe('p1');
    expect(afterFirstLoss.resurrectionUsed.p1).toBe(true);
    // hades returned to bottom of p1Deck instead of going to p2
    expect(afterFirstLoss.p1Deck).toEqual(['poseidon', 'hades']);
    expect(afterFirstLoss.p2Deck).toEqual(['odin', 'thor']);

    // Second loss with another RESURRECTION card (hel, might 70) will NOT resurrect for p1
    const beforeSecondLoss: MatchState = {
      ...afterFirstLoss,
      activeTurn: 'p1',
      p1Deck: ['hel', 'poseidon'],
      p2Deck: ['thor', 'odin'],
    };

    const afterSecondLoss = reduceMatchState(beforeSecondLoss, {
      type: 'PICK_STAT',
      player: 'p1',
      stat: 'might',
    });

    expect(afterSecondLoss.lastOutcome?.resurrectedPlayer).toBeNull();
    expect(afterSecondLoss.p1Deck).toEqual(['poseidon']);
    expect(afterSecondLoss.p2Deck).toEqual(['odin', 'thor', 'hel']);
  });

  it('Blue Pill: Gambit inverts comparison once per match so lowest effective stat wins', () => {
    // odysseus (might 67) vs thor (might 97)
    const initial = buildCustomState({
      activeTurn: 'p1',
      activeRealm: 'UNDERWORLD',
      p1Deck: ['odysseus', 'zeus'],
      p2Deck: ['thor', 'odin'],
    });

    const armed = reduceMatchState(initial, { type: 'TOGGLE_GAMBIT', player: 'p1' });
    expect(armed.gambitArmed).toBe(true);

    const resolved = reduceMatchState(armed, {
      type: 'PICK_STAT',
      player: 'p1',
      stat: 'might',
    });

    expect(resolved.lastOutcome?.gambitActive).toBe(true);
    expect(resolved.lastOutcome?.winner).toBe('p1');
    expect(resolved.gambitUsed.p1).toBe(true);
    expect(resolved.gambitArmed).toBe(false);
    expect(resolved.p1Deck).toEqual(['zeus', 'odysseus', 'thor']);
  });

  it('Blue Pill: ties push both cards to warPot and next winner claims the pot', () => {
    // kartikeya (might 93) vs karna (might 93) in SKY realm -> tie!
    const initial = buildCustomState({
      activeTurn: 'p1',
      activeRealm: 'SKY',
      p1Deck: ['kartikeya', 'thor'],
      p2Deck: ['karna', 'odysseus'],
    });

    const afterTie = reduceMatchState(initial, {
      type: 'PICK_STAT',
      player: 'p1',
      stat: 'might',
    });

    expect(afterTie.lastOutcome?.winner).toBe('TIE');
    expect(afterTie.warPot).toEqual(['kartikeya', 'karna']);
    expect(afterTie.activeTurn).toBe('p1');

    // Round 2: thor (might 97) beats odysseus (might 67) and claims warPot too
    const afterWin = reduceMatchState(afterTie, {
      type: 'PICK_STAT',
      player: 'p1',
      stat: 'might',
    });

    expect(afterWin.lastOutcome?.winner).toBe('p1');
    expect(afterWin.lastOutcome?.potWon).toBe(2);
    expect(afterWin.warPot).toEqual([]);
    expect(afterWin.p1Deck).toEqual(['thor', 'odysseus', 'kartikeya', 'karna']);
    expect(afterWin.winner).toBe('p1');
  });

  it('Blue Pill: deterministic bot chooses consistent action for a given state', () => {
    const state = buildCustomState({
      activeTurn: 'p2',
      p1Deck: ['odysseus', 'zeus'],
      p2Deck: ['thor', 'hades'],
    });

    const action1 = chooseBotAction(state);
    const action2 = chooseBotAction(state);

    expect(action1).toEqual(action2);
    expect(action1?.type).toBe('PICK_STAT');
    if (action1?.type === 'PICK_STAT') {
      expect(action1.stat).toBe('might');
    }
  });

  it('Red Pill: rejects out-of-turn actions, invalid stat keys, reused gambit, and post-victory mutations', () => {
    const initial = buildCustomState({ activeTurn: 'p1' });

    // Wrong player tries to pick or toggle gambit
    expect(reduceMatchState(initial, { type: 'PICK_STAT', player: 'p2', stat: 'might' })).toBe(initial);
    expect(reduceMatchState(initial, { type: 'TOGGLE_GAMBIT', player: 'p2' })).toBe(initial);

    // Invalid stat string
    expect(
      reduceMatchState(initial, {
        type: 'PICK_STAT',
        player: 'p1',
        stat: 'invalid_stat' as StatKey,
      }),
    ).toBe(initial);

    // Reused gambit cannot be armed again
    const spentGambit = buildCustomState({
      activeTurn: 'p1',
      gambitUsed: { p1: true, p2: false },
    });
    expect(reduceMatchState(spentGambit, { type: 'TOGGLE_GAMBIT', player: 'p1' })).toBe(spentGambit);

    const resolvedSpent = reduceMatchState(spentGambit, {
      type: 'PICK_STAT',
      player: 'p1',
      stat: 'might',
      useGambit: true,
    });
    expect(resolvedSpent.lastOutcome?.gambitActive).toBe(false);

    // Finished match ignores actions
    const finished = buildCustomState({ winner: 'p1' });
    expect(reduceMatchState(finished, { type: 'PICK_STAT', player: 'p1', stat: 'might' })).toBe(finished);

    // Unknown card throws explicit error
    expect(() => getCardById('nonexistent_deity')).toThrow();
  });

  it('Red Pill: simultaneous final-card tie results in DRAW match state', () => {
    const finalTie = buildCustomState({
      activeTurn: 'p1',
      activeRealm: 'SKY',
      p1Deck: ['kartikeya'], // might 93
      p2Deck: ['karna'], // might 93
    });

    const next = reduceMatchState(finalTie, {
      type: 'PICK_STAT',
      player: 'p1',
      stat: 'might',
    });

    expect(next.winner).toBe('DRAW');
    expect(next.p1Deck).toEqual([]);
    expect(next.p2Deck).toEqual([]);
    expect(next.warPot).toEqual(['kartikeya', 'karna']);
  });
});
