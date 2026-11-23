import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCardById } from '../../data/cards';
import type { MatchState, PlayerState, StatKey } from '../../types/game';
import {
  chooseBotAction,
  computeEffectiveStats,
  computeEffectiveStatsForRound,
  createInitialMatchState,
  getProphecyStat,
  getProphecyStatForTarget,
  getRealmForRound,
  MAX_ROUNDS,
  REALM_BONUS,
  reduceMatchState,
  SEAT_IDS,
} from '../gameEngine';

function makePlayer(idx: number, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: SEAT_IDS[idx],
    seatIndex: idx,
    name: `Player ${idx + 1}`,
    isBot: idx > 0,
    uid: null,
    team: idx % 2 === 0 ? 0 : 1,
    deck: ['zeus', 'poseidon'],
    resurrectionUsed: false,
    gambitUsed: false,
    eliminated: false,
    away: false,
    ready: true,
    roundsWon: 0,
    ...overrides,
  };
}

function buildCustomState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchSeed: 12345,
    round: 1,
    maxRounds: MAX_ROUNDS,
    teamMode: 'ffa',
    activeTurnIndex: 0,
    activeRealm: 'SKY',
    players: [
      makePlayer(0, { deck: ['zeus', 'poseidon'] }),
      makePlayer(1, { deck: ['thor', 'hades'] }),
    ],
    warPot: [],
    gambitArmed: false,
    prophecyTarget: null,
    statWins: { might: 0, arcana: 0, cunning: 0, influence: 0 },
    bestWin: null,
    winner: 'NONE',
    lastOutcome: null,
    ...overrides,
  };
}

describe('gameEngine deterministic 2-4 player mechanics', () => {
  it('Blue Pill: splits 60 unique cards evenly for 2, 3, and 4 players deterministically', () => {
    const s2a = createInitialMatchState(777, { playerCount: 2 });
    const s2b = createInitialMatchState(777, { playerCount: 2 });
    const s3 = createInitialMatchState(777, { playerCount: 3 });
    const s4 = createInitialMatchState(777, { playerCount: 4 });

    expect(ALL_CARDS).toHaveLength(60);
    expect(s2a).toEqual(s2b);
    expect(s2a.players.map((p) => p.deck.length)).toEqual([30, 30]);
    expect(s3.players.map((p) => p.deck.length)).toEqual([20, 20, 20]);
    expect(s4.players.map((p) => p.deck.length)).toEqual([15, 15, 15, 15]);

    expect(new Set(s3.players.flatMap((p) => p.deck)).size).toBe(60);
    expect(new Set(s4.players.flatMap((p) => p.deck)).size).toBe(60);
  });

  it('Blue Pill: selects Round 1 leader deterministically via Mulberry32 across seats', () => {
    const leaders = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const s = createInitialMatchState(seed, { playerCount: 4 });
      expect(s.activeTurnIndex).toBeGreaterThanOrEqual(0);
      expect(s.activeTurnIndex).toBeLessThan(4);
      leaders.add(s.activeTurnIndex);
      expect(s.activeTurnIndex).toBe(createInitialMatchState(seed, { playerCount: 4 }).activeTurnIndex);
    }
    expect(leaders.size).toBeGreaterThan(1);
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

  it('Blue Pill: PIERCING ignores +15 realm bonus on ALL opponents in multi-player clashes', () => {
    const apollo = getCardById('apollo'); // SKY, PROPHECY
    const zeus = getCardById('zeus'); // SKY, PIERCING
    const horus = getCardById('horus'); // SKY, NONE

    const pierced2p = computeEffectiveStats(apollo, zeus, 'SKY');
    expect(pierced2p.bonus).toBe(0);
    expect(pierced2p.pierced).toBe(true);

    const multi = computeEffectiveStatsForRound(
      [
        { seatIndex: 0, card: apollo },
        { seatIndex: 1, card: zeus },
        { seatIndex: 2, card: horus },
      ],
      'SKY',
    );
    expect(multi[0].bonus).toBe(0);
    expect(multi[0].pierced).toBe(true);
    expect(multi[2].bonus).toBe(0);
    expect(multi[2].pierced).toBe(true);
    // Single PIERCING holder keeps own realm bonus
    expect(multi[1].bonus).toBe(REALM_BONUS);
    expect(multi[1].pierced).toBe(false);
  });

  it('Blue Pill: PROPHECY lets active player pick a target opponent in 3-4 player matches', () => {
    const state = buildCustomState({
      activeTurnIndex: 0,
      activeRealm: 'SEA',
      players: [
        makePlayer(0, { deck: ['athena', 'zeus'] }), // PROPHECY
        makePlayer(1, { deck: ['poseidon', 'thor'] }),
        makePlayer(2, { deck: ['hades', 'odin'] }),
      ],
    });

    // Multi-opponent requires explicit target choice (returns null until chosen)
    expect(getProphecyStat(state, 0)).toBeNull();

    const spied = reduceMatchState(state, {
      type: 'SELECT_PROPHECY_TARGET',
      playerIndex: 0,
      targetIndex: 2,
    });
    expect(spied.prophecyTarget).not.toBeNull();
    expect(spied.prophecyTarget?.targetSeat).toBe(2);
    expect(getProphecyStat(spied, 0)).toEqual(getProphecyStatForTarget(state, 0, 2));

    // Red Pill: cannot pick a second prophecy target in the same round
    const spiedTwice = reduceMatchState(spied, {
      type: 'SELECT_PROPHECY_TARGET',
      playerIndex: 0,
      targetIndex: 1,
    });
    expect(spiedTwice).toBe(spied);
  });

  it('Blue Pill: RESURRECTION returns losing card to bottom of owner deck once per match', () => {
    const initial = buildCustomState({
      activeTurnIndex: 0,
      activeRealm: 'UNDERWORLD',
      players: [
        makePlayer(0, { deck: ['hades', 'poseidon'] }), // hades RESURRECTION might 78
        makePlayer(1, { deck: ['thor', 'odin'] }), // thor PIERCING might 97
      ],
    });

    const afterFirstLoss = reduceMatchState(initial, {
      type: 'PICK_STAT',
      playerIndex: 0,
      stat: 'might',
    });

    expect(afterFirstLoss.lastOutcome?.winnerId).toBe('p2');
    expect(afterFirstLoss.lastOutcome?.resurrectedPlayers).toEqual(['p1']);
    expect(afterFirstLoss.players[0].resurrectionUsed).toBe(true);
    expect(afterFirstLoss.players[0].deck).toEqual(['poseidon', 'hades']);
    expect(afterFirstLoss.players[1].deck).toEqual(['odin', 'thor']);
  });

  it('Blue Pill: Gambit inverts comparison across all players so lowest effective stat wins', () => {
    const initial = buildCustomState({
      activeTurnIndex: 0,
      activeRealm: 'UNDERWORLD',
      players: [
        makePlayer(0, { deck: ['odysseus', 'zeus'] }), // might 67
        makePlayer(1, { deck: ['thor', 'odin'] }), // might 97
        makePlayer(2, { deck: ['ares', 'loki'] }), // might 94
      ],
    });

    const armed = reduceMatchState(initial, { type: 'TOGGLE_GAMBIT', playerIndex: 0 });
    expect(armed.gambitArmed).toBe(true);

    const resolved = reduceMatchState(armed, {
      type: 'PICK_STAT',
      playerIndex: 0,
      stat: 'might',
    });

    expect(resolved.lastOutcome?.gambitActive).toBe(true);
    expect(resolved.lastOutcome?.winnerId).toBe('p1');
    expect(resolved.players[0].gambitUsed).toBe(true);
    expect(resolved.players[0].deck).toEqual(['zeus', 'odysseus', 'thor', 'ares']);
  });

  it('Blue Pill: multi-player ties move all cards to warPot and rotate turn clockwise to next active seat', () => {
    const initial = buildCustomState({
      activeTurnIndex: 0,
      activeRealm: 'SKY',
      players: [
        makePlayer(0, { deck: ['kartikeya', 'thor'] }), // might 93
        makePlayer(1, { deck: ['karna', 'odysseus'] }), // might 93
        makePlayer(2, { deck: ['apollo', 'ares'] }), // might 78
      ],
    });

    const afterTie = reduceMatchState(initial, {
      type: 'PICK_STAT',
      playerIndex: 0,
      stat: 'might',
    });

    expect(afterTie.lastOutcome?.winnerId).toBe('TIE');
    expect(afterTie.warPot).toEqual(['kartikeya', 'karna', 'apollo']);
    expect(afterTie.activeTurnIndex).toBe(1); // Rotated clockwise from seat 0 -> seat 1

    // Seat 1 loses to seat 0 (thor) and seat 2 (ares); ares might 94 vs thor 97 -> seat 0 wins all + pot!
    const afterWin = reduceMatchState(afterTie, {
      type: 'PICK_STAT',
      playerIndex: 1,
      stat: 'might',
    });

    expect(afterWin.lastOutcome?.winnerId).toBe('p1');
    expect(afterWin.lastOutcome?.potWon).toBe(3);
    expect(afterWin.warPot).toEqual([]);
    expect(afterWin.players[1].eliminated).toBe(true);
    expect(afterWin.players[2].eliminated).toBe(true);
    expect(afterWin.winner).toBe('p1');
  });

  it('Blue Pill: enforces 60-round cap and crowns player with highest card count', () => {
    const capState = buildCustomState({
      round: MAX_ROUNDS,
      maxRounds: MAX_ROUNDS,
      activeTurnIndex: 0,
      activeRealm: 'SKY',
      players: [
        makePlayer(0, { deck: ['zeus', 'apollo', 'athena'] }),
        makePlayer(1, { deck: ['odin', 'thor'] }),
      ],
    });

    const resolved = reduceMatchState(capState, {
      type: 'PICK_STAT',
      playerIndex: 0,
      stat: 'influence',
    });

    expect(resolved.winner).toBe('p1');
  });

  it('Blue Pill: supports 2v2 teams mode (Seats 0&2 vs 1&3) with combined card counts at round cap', () => {
    const teamState = buildCustomState({
      round: MAX_ROUNDS,
      maxRounds: MAX_ROUNDS,
      teamMode: 'teams',
      activeTurnIndex: 1,
      activeRealm: 'SKY',
      players: [
        makePlayer(0, { team: 0, deck: ['apollo', 'zeus', 'athena'] }), // Team 0: 3
        makePlayer(1, { team: 1, deck: ['thor', 'odin', 'loki', 'freya'] }), // Team 1: 4
        makePlayer(2, { team: 0, deck: ['poseidon', 'hades'] }), // Team 0: 2 (Total 5)
        makePlayer(3, { team: 1, deck: ['ra', 'isis', 'osiris'] }), // Team 1: 3 (Total 7)
      ],
    });

    const resolved = reduceMatchState(teamState, {
      type: 'PICK_STAT',
      playerIndex: 1,
      stat: 'might',
    });

    expect(resolved.winner).toBe('TEAM_1');
  });

  it('Blue Pill: same seed produces identical bot simulations from start to finish', () => {
    const runMatch = (seed: number) => {
      let state = createInitialMatchState(seed, { playerCount: 4 });
      let steps = 0;
      while (state.winner === 'NONE' && steps < 150) {
        const action = chooseBotAction(state);
        expect(action).not.toBeNull();
        state = reduceMatchState(state, action!);
        steps += 1;
      }
      return state;
    };

    const runA = runMatch(98765);
    const runB = runMatch(98765);
    expect(runA).toEqual(runB);
    expect(runA.winner).not.toBe('NONE');
  });

  it('Red Pill: rejects out-of-turn actions, invalid stat keys, reused gambit, and post-victory mutations', () => {
    const initial = buildCustomState({ activeTurnIndex: 0 });

    expect(reduceMatchState(initial, { type: 'PICK_STAT', playerIndex: 1, stat: 'might' })).toBe(initial);
    expect(reduceMatchState(initial, { type: 'TOGGLE_GAMBIT', playerIndex: 1 })).toBe(initial);
    expect(
      reduceMatchState(initial, {
        type: 'PICK_STAT',
        playerIndex: 0,
        stat: 'invalid_stat' as StatKey,
      }),
    ).toBe(initial);

    const spentGambit = buildCustomState({
      activeTurnIndex: 0,
      players: [makePlayer(0, { gambitUsed: true }), makePlayer(1)],
    });
    expect(reduceMatchState(spentGambit, { type: 'TOGGLE_GAMBIT', playerIndex: 0 })).toBe(spentGambit);

    const finished = buildCustomState({ winner: 'p1' });
    expect(reduceMatchState(finished, { type: 'PICK_STAT', playerIndex: 0, stat: 'might' })).toBe(finished);
    expect(() => getCardById('nonexistent_deity')).toThrow();
  });
});
