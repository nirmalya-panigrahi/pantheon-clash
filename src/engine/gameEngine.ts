import { ALL_CARDS, getCardById } from '../data/cards';
import type {
  CardStats,
  MatchAction,
  MatchState,
  MythCard,
  PlayerId,
  ProphecyHint,
  Realm,
  RoundOutcome,
  StatKey,
} from '../types/game';
import { deriveSeed, mulberry32, normalizeSeed, shuffleDeterministic } from './prng';

export const REALMS: readonly Realm[] = ['SKY', 'UNDERWORLD', 'SEA', 'WAR'];
export const STAT_KEYS: readonly StatKey[] = ['might', 'arcana', 'cunning', 'influence'];
export const REALM_BONUS = 15;
export const ROUNDS_PER_REALM = 3;

/**
 * Deterministically rotates realms every 3 rounds based on the match seed.
 * Each 4-block (12-round) epoch visits all 4 realms once, avoiding back-to-back repeats across epoch boundaries.
 */
export function getRealmForRound(matchSeed: number, round: number): Realm {
  const safeRound = Math.max(1, Math.trunc(round));
  const blockIndex = Math.floor((safeRound - 1) / ROUNDS_PER_REALM);
  const epoch = Math.floor(blockIndex / REALMS.length);
  const slot = blockIndex % REALMS.length;

  const epochOrder = shuffleDeterministic(REALMS, deriveSeed(matchSeed, epoch, 101));
  if (epoch > 0) {
    const prevOrder = shuffleDeterministic(REALMS, deriveSeed(matchSeed, epoch - 1, 101));
    const prevLast = prevOrder[prevOrder.length - 1];
    if (epochOrder[0] === prevLast) {
      const shifted = [...epochOrder.slice(1), epochOrder[0]];
      return shifted[slot];
    }
  }
  return epochOrder[slot];
}

/**
 * Computes effective stats for `card` facing `opponentCard` in `activeRealm`.
 * Grants +15 to matching domain unless negated by opponent's PIERCING passive.
 */
export function computeEffectiveStats(
  card: MythCard,
  opponentCard: MythCard,
  activeRealm: Realm,
): { bonus: number; effectiveStats: CardStats } {
  const hasDomainMatch = card.domain === activeRealm;
  const negatedByPiercing = opponentCard.passive === 'PIERCING';
  const bonus = hasDomainMatch && !negatedByPiercing ? REALM_BONUS : 0;

  return {
    bonus,
    effectiveStats: {
      might: card.stats.might + bonus,
      arcana: card.stats.arcana + bonus,
      cunning: card.stats.cunning + bonus,
      influence: card.stats.influence + bonus,
    },
  };
}

/**
 * Deterministically reveals one stat of the opponent's top card when the viewer's top card has PROPHECY.
 */
export function getProphecyStat(state: MatchState, viewer: PlayerId): ProphecyHint | null {
  if (state.winner !== 'NONE' || state.p1Deck.length === 0 || state.p2Deck.length === 0) {
    return null;
  }

  const viewerCardId = viewer === 'p1' ? state.p1Deck[0] : state.p2Deck[0];
  const oppCardId = viewer === 'p1' ? state.p2Deck[0] : state.p1Deck[0];
  const viewerCard = getCardById(viewerCardId);
  const oppCard = getCardById(oppCardId);

  if (viewerCard.passive !== 'PROPHECY') {
    return null;
  }

  const rng = mulberry32(deriveSeed(state.matchSeed, state.round, viewer === 'p1' ? 31 : 37));
  const stat = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];
  const { effectiveStats } = computeEffectiveStats(oppCard, viewerCard, state.activeRealm);

  return {
    stat,
    baseValue: oppCard.stats[stat],
    effectiveValue: effectiveStats[stat],
  };
}

/**
 * Builds the initial MatchState from a deterministic seed and card roster.
 */
export function createInitialMatchState(
  matchSeed: number,
  cards: readonly MythCard[] = ALL_CARDS,
): MatchState {
  const seed = normalizeSeed(matchSeed);
  const shuffledIds = shuffleDeterministic(
    cards.map((card) => card.id),
    seed,
  );
  const half = Math.floor(shuffledIds.length / 2);

  return {
    matchSeed: seed,
    round: 1,
    activeTurn: 'p1',
    activeRealm: getRealmForRound(seed, 1),
    p1Deck: shuffledIds.slice(0, half),
    p2Deck: shuffledIds.slice(half, half * 2),
    warPot: [],
    resurrectionUsed: { p1: false, p2: false },
    gambitUsed: { p1: false, p2: false },
    gambitArmed: false,
    winner: 'NONE',
    lastOutcome: null,
  };
}

/**
 * Pure reducer resolving all game actions with zero side effects.
 */
export function reduceMatchState(state: MatchState, action: MatchAction): MatchState {
  if (action.type === 'RESET_MATCH') {
    return createInitialMatchState(action.matchSeed ?? state.matchSeed);
  }

  if (state.winner !== 'NONE' || state.p1Deck.length === 0 || state.p2Deck.length === 0) {
    return state;
  }

  if (action.type === 'TOGGLE_GAMBIT') {
    if (action.player !== state.activeTurn || state.gambitUsed[action.player]) {
      return state;
    }
    return {
      ...state,
      gambitArmed: !state.gambitArmed,
    };
  }

  if (action.type !== 'PICK_STAT') {
    return state;
  }

  if (action.player !== state.activeTurn || !STAT_KEYS.includes(action.stat)) {
    return state;
  }

  const p1CardId = state.p1Deck[0];
  const p2CardId = state.p2Deck[0];
  const p1Rest = state.p1Deck.slice(1);
  const p2Rest = state.p2Deck.slice(1);

  const p1Card = getCardById(p1CardId);
  const p2Card = getCardById(p2CardId);

  const p1Eff = computeEffectiveStats(p1Card, p2Card, state.activeRealm);
  const p2Eff = computeEffectiveStats(p2Card, p1Card, state.activeRealm);

  const p1Value = p1Eff.effectiveStats[action.stat];
  const p2Value = p2Eff.effectiveStats[action.stat];

  const canUseGambit = !state.gambitUsed[action.player];
  const gambitActive = canUseGambit && (action.useGambit ?? state.gambitArmed);

  let nextP1Deck = p1Rest;
  let nextP2Deck = p2Rest;
  let nextWarPot = [...state.warPot];
  let nextResurrectionUsed = { ...state.resurrectionUsed };
  let resurrectedPlayer: PlayerId | null = null;
  let roundWinner: RoundOutcome['winner'] = 'TIE';
  let nextActiveTurn: PlayerId = state.activeTurn;
  let potWon = 0;

  if (p1Value === p2Value) {
    nextWarPot = [...state.warPot, p1CardId, p2CardId];
  } else {
    const p1Wins = gambitActive ? p1Value < p2Value : p1Value > p2Value;
    roundWinner = p1Wins ? 'p1' : 'p2';
    nextActiveTurn = roundWinner;
    potWon = state.warPot.length;

    const loser: PlayerId = p1Wins ? 'p2' : 'p1';
    const loserCard = p1Wins ? p2Card : p1Card;
    const loserCardId = p1Wins ? p2CardId : p1CardId;
    const winnerCardId = p1Wins ? p1CardId : p2CardId;

    const canResurrect = loserCard.passive === 'RESURRECTION' && !state.resurrectionUsed[loser];

    if (canResurrect) {
      resurrectedPlayer = loser;
      nextResurrectionUsed = { ...state.resurrectionUsed, [loser]: true };

      if (roundWinner === 'p1') {
        nextP1Deck = [...p1Rest, winnerCardId, ...state.warPot];
        nextP2Deck = [...p2Rest, loserCardId];
      } else {
        nextP2Deck = [...p2Rest, winnerCardId, ...state.warPot];
        nextP1Deck = [...p1Rest, loserCardId];
      }
    } else if (roundWinner === 'p1') {
      nextP1Deck = [...p1Rest, winnerCardId, loserCardId, ...state.warPot];
    } else {
      nextP2Deck = [...p2Rest, winnerCardId, loserCardId, ...state.warPot];
    }

    nextWarPot = [];
  }

  let matchWinner: MatchState['winner'] = 'NONE';
  if (nextP1Deck.length === 0 && nextP2Deck.length === 0) {
    matchWinner = 'DRAW';
  } else if (nextP1Deck.length === 0) {
    matchWinner = 'p2';
  } else if (nextP2Deck.length === 0) {
    matchWinner = 'p1';
  }

  const nextRound = state.round + 1;
  const nextGambitUsed = gambitActive
    ? { ...state.gambitUsed, [action.player]: true }
    : { ...state.gambitUsed };

  return {
    matchSeed: state.matchSeed,
    round: nextRound,
    activeTurn: nextActiveTurn,
    activeRealm: getRealmForRound(state.matchSeed, nextRound),
    p1Deck: nextP1Deck,
    p2Deck: nextP2Deck,
    warPot: nextWarPot,
    resurrectionUsed: nextResurrectionUsed,
    gambitUsed: nextGambitUsed,
    gambitArmed: false,
    winner: matchWinner,
    lastOutcome: {
      round: state.round,
      stat: action.stat,
      p1CardId,
      p2CardId,
      p1Effective: p1Value,
      p2Effective: p2Value,
      p1Bonus: p1Eff.bonus,
      p2Bonus: p2Eff.bonus,
      gambitActive,
      resurrectedPlayer,
      winner: roundWinner,
      potWon,
    },
  };
}

/**
 * Deterministic bot policy using only current match state and seeded PRNG tie-breaking.
 */
export function chooseBotAction(state: MatchState): MatchAction | null {
  if (state.winner !== 'NONE' || state.p1Deck.length === 0 || state.p2Deck.length === 0) {
    return null;
  }

  const bot = state.activeTurn;
  const botCardId = bot === 'p1' ? state.p1Deck[0] : state.p2Deck[0];
  const oppCardId = bot === 'p1' ? state.p2Deck[0] : state.p1Deck[0];
  const botCard = getCardById(botCardId);
  const oppCard = getCardById(oppCardId);
  const { effectiveStats } = computeEffectiveStats(botCard, oppCard, state.activeRealm);
  const canUseGambit = !state.gambitUsed[bot];

  const prophecy = getProphecyStat(state, bot);
  if (prophecy) {
    const myProphecyVal = effectiveStats[prophecy.stat];
    if (myProphecyVal > prophecy.effectiveValue) {
      return { type: 'PICK_STAT', player: bot, stat: prophecy.stat, useGambit: false };
    }
    if (canUseGambit && myProphecyVal < prophecy.effectiveValue && prophecy.effectiveValue >= 75) {
      return { type: 'PICK_STAT', player: bot, stat: prophecy.stat, useGambit: true };
    }
  }

  const rng = mulberry32(deriveSeed(state.matchSeed, state.round, 99));
  const ordered = STAT_KEYS.map((stat) => ({
    stat,
    value: effectiveStats[stat],
    tieBreak: rng(),
  }));

  const sortedDesc = [...ordered].sort((a, b) =>
    b.value !== a.value ? b.value - a.value : b.tieBreak - a.tieBreak,
  );
  const sortedAsc = [...ordered].sort((a, b) =>
    a.value !== b.value ? a.value - b.value : b.tieBreak - a.tieBreak,
  );

  const strongest = sortedDesc[0];
  const weakest = sortedAsc[0];

  if (canUseGambit && strongest.value <= 66 && weakest.value <= 52) {
    return { type: 'PICK_STAT', player: bot, stat: weakest.stat, useGambit: true };
  }

  return { type: 'PICK_STAT', player: bot, stat: strongest.stat, useGambit: false };
}
