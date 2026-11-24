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
    score: 0,
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
    matchPreset: 'blitz',
    gameMode: 'points',
    round: 1,
    maxRounds: 12,
    teamMode: 'ffa',
    roundPhase: 'attack',
    activeTurnIndex: 0,
    activeRealm: 'SKY',
    players: [
      makePlayer(0, { deck: ['zeus', 'poseidon'] }),
      makePlayer(1, { deck: ['thor', 'hades'] }),
    ],
    warPot: [],
    pendingClash: null,
    gambitArmed: false,
    prophecyTarget: null,
    statWins: { might: 0, arcana: 0, cunning: 0, influence: 0 },
    bestWin: null,
    winner: 'NONE',
    lastOutcome: null,
    ...overrides,
  };
}

function playFullRound(
  state: MatchState,
  stat: StatKey,
  handBySeat: Record<number, number> = {},
): MatchState {
  const leader = state.activeTurnIndex;
  let next = reduceMatchState(state, {
    type: 'PICK_STAT',
    playerIndex: leader,
    stat,
    handIndex: handBySeat[leader] ?? 0,
  });
  let safety = 0;
  while (next.roundPhase === 'defend' && next.winner === 'NONE' && safety < 4) {
    const defender = next.activeTurnIndex;
    next = reduceMatchState(next, {
      type: 'DEFEND_CARD',
      playerIndex: defender,
      handIndex: handBySeat[defender] ?? 0,
    });
    safety += 1;
  }
  return next;
}

describe('gameEngine deterministic 2-4 player mechanics', () => {
  it('Blue Pill: deals Blitz (12), Standard (15), and Classic full-split decks deterministically', () => {
    const blitzA = createInitialMatchState(777, { playerCount: 2 });
    const blitzB = createInitialMatchState(777, { playerCount: 2 });
    const std4 = createInitialMatchState(777, { playerCount: 4, matchPreset: 'standard' });
    const classic3 = createInitialMatchState(777, { playerCount: 3, matchPreset: 'classic' });
    const classic4 = createInitialMatchState(777, { playerCount: 4, matchPreset: 'classic' });

    expect(ALL_CARDS).toHaveLength(60);
    expect(blitzA).toEqual(blitzB);
    expect(blitzA.matchPreset).toBe('blitz');
    expect(blitzA.gameMode).toBe('points');
    expect(blitzA.maxRounds).toBe(12);
    expect(blitzA.players.map((p) => p.deck.length)).toEqual([12, 12]);

    expect(std4.maxRounds).toBe(15);
    expect(std4.players.map((p) => p.deck.length)).toEqual([15, 15, 15, 15]);
    expect(new Set(std4.players.flatMap((p) => p.deck)).size).toBe(60);

    expect(classic3.gameMode).toBe('classic');
    expect(classic3.maxRounds).toBe(60);
    expect(classic3.players.map((p) => p.deck.length)).toEqual([20, 20, 20]);
    expect(classic4.players.map((p) => p.deck.length)).toEqual([15, 15, 15, 15]);
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

  it('Blue Pill: applies distinct SKY/WAR stat bonuses and PIERCING negation across 2-4 players', () => {
    const apollo = getCardById('apollo'); // SKY, PROPHECY
    const zeus = getCardById('zeus'); // SKY, PIERCING
    const horus = getCardById('horus'); // SKY, NONE
    const poseidon = getCardById('poseidon'); // SEA, NONE
    const ares = getCardById('ares'); // WAR, PIERCING

    const pierced2p = computeEffectiveStats(apollo, zeus, 'SKY');
    expect(pierced2p.bonus).toBe(0);
    expect(pierced2p.pierced).toBe(true);
    expect(pierced2p.effectiveStats.arcana).toBe(apollo.stats.arcana);

    // SKY grants +20 Arcana/Influence and +15 Might/Cunning when unpierced
    const skyUnpierced = computeEffectiveStats(apollo, poseidon, 'SKY');
    expect(skyUnpierced.statBonuses).toEqual({
      might: 15,
      arcana: 20,
      cunning: 15,
      influence: 20,
    });

    // WAR grants +25 Might and +20 other stats when unpierced
    const warUnpierced = computeEffectiveStats(ares, poseidon, 'WAR');
    expect(warUnpierced.statBonuses).toEqual({
      might: 25,
      arcana: 20,
      cunning: 20,
      influence: 20,
    });

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
    expect(multi[1].bonus).toBe(REALM_BONUS);
    expect(multi[1].pierced).toBe(false);
  });

  it('Blue Pill: 3-card hand attack + defend selection spends chosen cards and scores Trophy points', () => {
    const initial = buildCustomState({
      activeTurnIndex: 0,
      activeRealm: 'SKY',
      players: [
        makePlayer(0, { deck: ['odysseus', 'zeus', 'apollo'] }), // hand index 1 = zeus (SKY, influence 98+20=118)
        makePlayer(1, { deck: ['thor', 'odin', 'loki'] }), // hand index 2 = loki
      ],
    });

    const afterAttack = reduceMatchState(initial, {
      type: 'PICK_STAT',
      playerIndex: 0,
      stat: 'influence',
      handIndex: 1,
    });

    expect(afterAttack.roundPhase).toBe('defend');
    expect(afterAttack.activeTurnIndex).toBe(1);
    expect(afterAttack.pendingClash?.selections).toEqual({ p1: 'zeus' });

    const resolved = reduceMatchState(afterAttack, {
      type: 'DEFEND_CARD',
      playerIndex: 1,
      handIndex: 2,
    });

    expect(resolved.roundPhase).toBe('attack');
    expect(resolved.pendingClash).toBeNull();
    expect(resolved.round).toBe(2);
    expect(resolved.lastOutcome?.winnerId).toBe('p1');
    expect(resolved.lastOutcome?.pointsAwarded).toBe(2);
    expect(resolved.players[0].score).toBe(2);
    // Spent cards removed in points mode (not returned to winner deck)
    expect(resolved.players[0].deck).toEqual(['odysseus', 'apollo']);
    expect(resolved.players[1].deck).toEqual(['thor', 'odin']);
  });

  it('Blue Pill: PROPHECY detects hand card and lets active player pick target in 3-4P', () => {
    const state = buildCustomState({
      activeTurnIndex: 0,
      activeRealm: 'SEA',
      players: [
        makePlayer(0, { deck: ['zeus', 'athena', 'apollo'] }), // athena at hand index 1
        makePlayer(1, { deck: ['poseidon', 'thor'] }),
        makePlayer(2, { deck: ['hades', 'odin'] }),
      ],
    });

    expect(getProphecyStat(state, 0)).toBeNull();

    const spied = reduceMatchState(state, {
      type: 'SELECT_PROPHECY_TARGET',
      playerIndex: 0,
      targetIndex: 2,
    });
    expect(spied.prophecyTarget).not.toBeNull();
    expect(spied.prophecyTarget?.targetSeat).toBe(2);
    expect(getProphecyStat(spied, 0)).toEqual(getProphecyStatForTarget(state, 0, 2));

    const spiedTwice = reduceMatchState(spied, {
      type: 'SELECT_PROPHECY_TARGET',
      playerIndex: 0,
      targetIndex: 1,
    });
    expect(spiedTwice).toBe(spied);
  });

  it('Blue Pill: RESURRECTION is free in NETHER and single-use in other realms', () => {
    const netherInitial = buildCustomState({
      activeTurnIndex: 0,
      activeRealm: 'NETHER',
      players: [
        makePlayer(0, { deck: ['hades', 'poseidon'] }), // hades RESURRECTION might 78+15=93
        makePlayer(1, { deck: ['thor', 'odin'] }), // thor PIERCING might 97
      ],
    });

    const afterNetherLoss = playFullRound(netherInitial, 'might');
    expect(afterNetherLoss.lastOutcome?.winnerId).toBe('p2');
    expect(afterNetherLoss.lastOutcome?.resurrectedPlayers).toEqual(['p1']);
    expect(afterNetherLoss.players[0].resurrectionUsed).toBe(false);
    expect(afterNetherLoss.players[0].deck).toEqual(['poseidon', 'hades']);

    const skyInitial = buildCustomState({
      activeTurnIndex: 0,
      activeRealm: 'SKY',
      players: [
        makePlayer(0, { deck: ['hades', 'poseidon'] }),
        makePlayer(1, { deck: ['thor', 'odin'] }),
      ],
    });
    const afterSkyLoss = playFullRound(skyInitial, 'might');
    expect(afterSkyLoss.lastOutcome?.resurrectedPlayers).toEqual(['p1']);
    expect(afterSkyLoss.players[0].resurrectionUsed).toBe(true);
  });

  it('Blue Pill: Gambit inverts comparison in SKY/SEA/NETHER and is locked in WAR', () => {
    const warState = buildCustomState({ activeTurnIndex: 0, activeRealm: 'WAR' });
    expect(reduceMatchState(warState, { type: 'TOGGLE_GAMBIT', playerIndex: 0 })).toBe(warState);

    const initial = buildCustomState({
      activeTurnIndex: 0,
      activeRealm: 'NETHER',
      players: [
        makePlayer(0, { deck: ['odysseus', 'zeus'] }), // might 67
        makePlayer(1, { deck: ['thor', 'odin'] }), // might 97
        makePlayer(2, { deck: ['ares', 'loki'] }), // might 94
      ],
    });

    const armed = reduceMatchState(initial, { type: 'TOGGLE_GAMBIT', playerIndex: 0 });
    expect(armed.gambitArmed).toBe(true);

    const resolved = playFullRound(armed, 'might');
    expect(resolved.lastOutcome?.gambitActive).toBe(true);
    expect(resolved.lastOutcome?.winnerId).toBe('p1');
    expect(resolved.players[0].gambitUsed).toBe(true);
    expect(resolved.players[0].score).toBe(3);
  });

  it('Blue Pill: Ties feed warPot and SEA realm doubles War Pot Trophy payouts', () => {
    const initial = buildCustomState({
      activeTurnIndex: 0,
      activeRealm: 'SEA',
      players: [
        makePlayer(0, { deck: ['kartikeya', 'poseidon'] }), // kartikeya might 93
        makePlayer(1, { deck: ['karna', 'odysseus'] }), // karna might 93
      ],
    });

    const afterTie = playFullRound(initial, 'might');
    expect(afterTie.lastOutcome?.winnerId).toBe('TIE');
    expect(afterTie.warPot).toEqual(['kartikeya', 'karna']);
    expect(afterTie.activeTurnIndex).toBe(1);

    const afterWin = playFullRound({ ...afterTie, activeRealm: 'SEA' }, 'might');
    expect(afterWin.lastOutcome?.winnerId).toBe('p1');
    expect(afterWin.lastOutcome?.potWon).toBe(2);
    // 1 own + 1 opponent + (2 pot * 2 SEA multiplier) = 6 pts
    expect(afterWin.lastOutcome?.pointsAwarded).toBe(6);
    expect(afterWin.players[0].score).toBe(6);
  });

  it('Blue Pill: supports Classic 60-round cap and 2v2 Teams scoring', () => {
    const teamPointsState = buildCustomState({
      round: 12,
      maxRounds: 12,
      teamMode: 'teams',
      gameMode: 'points',
      activeTurnIndex: 1,
      activeRealm: 'SKY',
      players: [
        makePlayer(0, { team: 0, score: 4, deck: ['apollo', 'zeus'] }),
        makePlayer(1, { team: 1, score: 8, deck: ['thor', 'odin'] }),
        makePlayer(2, { team: 0, score: 3, deck: ['poseidon', 'hades'] }),
        makePlayer(3, { team: 1, score: 6, deck: ['ra', 'isis'] }),
      ],
    });

    const resolvedPoints = playFullRound(teamPointsState, 'might');
    expect(resolvedPoints.winner).toBe('TEAM_1');

    const classicCap = buildCustomState({
      matchPreset: 'classic',
      gameMode: 'classic',
      round: MAX_ROUNDS,
      maxRounds: MAX_ROUNDS,
      activeTurnIndex: 0,
      players: [
        makePlayer(0, { deck: ['zeus', 'apollo', 'athena'] }),
        makePlayer(1, { deck: ['odin', 'thor'] }),
      ],
    });
    const resolvedClassic = playFullRound(classicCap, 'influence');
    expect(resolvedClassic.winner).toBe('p1');
  });

  it('Blue Pill: same seed produces identical 4-player Blitz bot simulations start to finish', () => {
    const runMatch = (seed: number) => {
      let state = createInitialMatchState(seed, { playerCount: 4, matchPreset: 'blitz' });
      let steps = 0;
      while (state.winner === 'NONE' && steps < 120) {
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
    expect(runA.round).toBeLessThanOrEqual(13);
  });

  it('Red Pill: rejects out-of-turn actions, invalid hand indices, invalid stat keys, and post-victory mutations', () => {
    const initial = buildCustomState({ activeTurnIndex: 0 });

    expect(reduceMatchState(initial, { type: 'PICK_STAT', playerIndex: 1, stat: 'might' })).toBe(initial);
    expect(reduceMatchState(initial, { type: 'PICK_STAT', playerIndex: 0, stat: 'might', handIndex: 5 })).toBe(initial);
    expect(reduceMatchState(initial, { type: 'DEFEND_CARD', playerIndex: 1, handIndex: 0 })).toBe(initial);
    expect(reduceMatchState(initial, { type: 'TOGGLE_GAMBIT', playerIndex: 1 })).toBe(initial);
    expect(
      reduceMatchState(initial, {
        type: 'PICK_STAT',
        playerIndex: 0,
        stat: 'invalid_stat' as StatKey,
      }),
    ).toBe(initial);

    const finished = buildCustomState({ winner: 'p1' });
    expect(reduceMatchState(finished, { type: 'PICK_STAT', playerIndex: 0, stat: 'might' })).toBe(finished);
    expect(() => getCardById('nonexistent_deity')).toThrow();
  });
});
