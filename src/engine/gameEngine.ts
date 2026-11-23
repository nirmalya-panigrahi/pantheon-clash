import { ALL_CARDS, getCardById } from '../data/cards';
import type {
  BestWinRecord,
  CardStats,
  MatchAction,
  MatchState,
  MatchWinner,
  MythCard,
  PlayedCardEntry,
  PlayerCount,
  PlayerSeedConfig,
  PlayerState,
  ProphecyHint,
  Realm,
  RoundOutcome,
  SeatId,
  StatKey,
  TeamMode,
} from '../types/game';
import { deriveSeed, mulberry32, normalizeSeed, shuffleDeterministic } from './prng';

export const REALMS: readonly Realm[] = ['SKY', 'UNDERWORLD', 'SEA', 'WAR'];
export const STAT_KEYS: readonly StatKey[] = ['might', 'arcana', 'cunning', 'influence'];
export const SEAT_IDS: readonly SeatId[] = ['p1', 'p2', 'p3', 'p4'];
export const REALM_BONUS = 15;
export const ROUNDS_PER_REALM = 3;
export const MAX_ROUNDS = 60;
export const TURN_TIMEOUT_SECONDS = 20;

export interface InitialMatchOptions {
  playerCount?: PlayerCount;
  players?: PlayerSeedConfig[];
  teamMode?: TeamMode;
  maxRounds?: number;
}

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
 * Computes effective stats for `card` facing `opponentCard` in `activeRealm` (2-card helper).
 * Grants +15 to matching domain unless negated by opponent's PIERCING passive.
 */
export function computeEffectiveStats(
  card: MythCard,
  opponentCard: MythCard,
  activeRealm: Realm,
): { bonus: number; pierced: boolean; effectiveStats: CardStats } {
  const hasDomainMatch = card.domain === activeRealm;
  const negatedByPiercing = opponentCard.passive === 'PIERCING';
  const bonus = hasDomainMatch && !negatedByPiercing ? REALM_BONUS : 0;

  return {
    bonus,
    pierced: hasDomainMatch && negatedByPiercing,
    effectiveStats: {
      might: card.stats.might + bonus,
      arcana: card.stats.arcana + bonus,
      cunning: card.stats.cunning + bonus,
      influence: card.stats.influence + bonus,
    },
  };
}

/**
 * Computes effective stats across 2-4 active players in a clash.
 * Any active opponent holding a PIERCING card negates the +15 realm bonus for all other cards.
 */
export function computeEffectiveStatsForRound(
  activeCards: readonly { seatIndex: number; card: MythCard }[],
  activeRealm: Realm,
): Record<number, { bonus: number; pierced: boolean; effectiveStats: CardStats }> {
  const piercingSeats = activeCards
    .filter((entry) => entry.card.passive === 'PIERCING')
    .map((entry) => entry.seatIndex);

  const result: Record<number, { bonus: number; pierced: boolean; effectiveStats: CardStats }> = {};

  for (const entry of activeCards) {
    const hasDomainMatch = entry.card.domain === activeRealm;
    const opponentHasPiercing = piercingSeats.some((seat) => seat !== entry.seatIndex);
    const pierced = hasDomainMatch && opponentHasPiercing;
    const bonus = hasDomainMatch && !opponentHasPiercing ? REALM_BONUS : 0;

    result[entry.seatIndex] = {
      bonus,
      pierced,
      effectiveStats: {
        might: entry.card.stats.might + bonus,
        arcana: entry.card.stats.arcana + bonus,
        cunning: entry.card.stats.cunning + bonus,
        influence: entry.card.stats.influence + bonus,
      },
    };
  }

  return result;
}

/**
 * Deterministically reveals one stat of `targetIndex`'s top card when `viewerIndex`'s top card has PROPHECY.
 */
export function getProphecyStatForTarget(
  state: MatchState,
  viewerIndex: number,
  targetIndex: number,
): ProphecyHint | null {
  if (state.winner !== 'NONE') return null;
  const viewer = state.players[viewerIndex];
  const target = state.players[targetIndex];
  if (
    !viewer ||
    !target ||
    viewerIndex === targetIndex ||
    viewer.eliminated ||
    target.eliminated ||
    viewer.deck.length === 0 ||
    target.deck.length === 0
  ) {
    return null;
  }

  const viewerCard = getCardById(viewer.deck[0]);
  const targetCard = getCardById(target.deck[0]);
  if (viewerCard.passive !== 'PROPHECY') {
    return null;
  }

  const activeCards = state.players
    .filter((p) => !p.eliminated && p.deck.length > 0)
    .map((p) => ({ seatIndex: p.seatIndex, card: getCardById(p.deck[0]) }));

  const effectiveMap = computeEffectiveStatsForRound(activeCards, state.activeRealm);
  const targetEffective = effectiveMap[targetIndex]?.effectiveStats ?? targetCard.stats;

  const rng = mulberry32(deriveSeed(state.matchSeed, state.round, 31 + viewerIndex * 7 + targetIndex));
  const stat = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];

  return {
    stat,
    baseValue: targetCard.stats[stat],
    effectiveValue: targetEffective[stat],
  };
}

/**
 * Convenience helper for 2-player (or single remaining opponent) Prophecy lookups.
 */
export function getProphecyStat(state: MatchState, viewerIndex: number): ProphecyHint | null {
  if (state.prophecyTarget && state.prophecyTarget.bySeat === viewerIndex) {
    return {
      stat: state.prophecyTarget.stat,
      baseValue: state.prophecyTarget.baseValue,
      effectiveValue: state.prophecyTarget.effectiveValue,
    };
  }
  const activeOpponents = state.players.filter(
    (p) => p.seatIndex !== viewerIndex && !p.eliminated && p.deck.length > 0,
  );
  if (activeOpponents.length === 1) {
    return getProphecyStatForTarget(state, viewerIndex, activeOpponents[0].seatIndex);
  }
  return null;
}

/**
 * Generates bot display names for unfilled or solo bot seats.
 */
export function getDefaultBotName(seatIndex: number): string {
  const names = ['Oracle Bot', 'Valkyrie Bot', 'Sphinx Bot', 'Tengu Bot'];
  return names[seatIndex] ?? `Automaton ${seatIndex + 1}`;
}

/**
 * Builds the initial 2-4 player MatchState from a deterministic seed and card roster.
 */
export function createInitialMatchState(
  matchSeed: number,
  options: InitialMatchOptions = {},
  cards: readonly MythCard[] = ALL_CARDS,
): MatchState {
  const seed = normalizeSeed(matchSeed);
  const rawCount = options.players?.length ?? options.playerCount ?? 2;
  const playerCount: PlayerCount = rawCount >= 4 ? 4 : rawCount === 3 ? 3 : 2;
  const teamMode: TeamMode = playerCount === 4 && options.teamMode === 'teams' ? 'teams' : 'ffa';
  const maxRounds = Math.max(1, options.maxRounds ?? MAX_ROUNDS);

  const shuffledIds = shuffleDeterministic(
    cards.map((card) => card.id),
    seed,
  );
  const cardsPerPlayer = Math.floor(shuffledIds.length / playerCount);

  const players: PlayerState[] = Array.from({ length: playerCount }, (_, idx) => {
    const cfg = options.players?.[idx];
    const start = idx * cardsPerPlayer;
    const isBot = cfg?.isBot ?? idx > 0;
    return {
      id: SEAT_IDS[idx],
      seatIndex: idx,
      name: cfg?.name?.trim() || (isBot ? getDefaultBotName(idx) : `Challenger ${idx + 1}`),
      isBot,
      uid: cfg?.uid ?? null,
      team: idx % 2 === 0 ? 0 : 1,
      deck: shuffledIds.slice(start, start + cardsPerPlayer),
      resurrectionUsed: false,
      gambitUsed: false,
      eliminated: false,
      away: false,
      ready: cfg?.ready ?? isBot,
      roundsWon: 0,
    };
  });

  const leaderRng = mulberry32(deriveSeed(seed, 1, 17));
  const activeTurnIndex = Math.floor(leaderRng() * playerCount);

  return {
    matchSeed: seed,
    round: 1,
    maxRounds,
    teamMode,
    activeTurnIndex,
    activeRealm: getRealmForRound(seed, 1),
    players,
    warPot: [],
    gambitArmed: false,
    prophecyTarget: null,
    statWins: { might: 0, arcana: 0, cunning: 0, influence: 0 },
    bestWin: null,
    winner: 'NONE',
    lastOutcome: null,
  };
}

/**
 * Finds the next active (non-eliminated, non-empty deck) player clockwise starting after `fromIndex`.
 */
export function findNextActiveSeatIndex(players: readonly PlayerState[], fromIndex: number): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset += 1) {
    const idx = (fromIndex + offset) % n;
    if (!players[idx].eliminated && players[idx].deck.length > 0) {
      return idx;
    }
  }
  return 0;
}

function evaluateMatchWinner(
  players: readonly PlayerState[],
  teamMode: TeamMode,
  resolvedRound: number,
  maxRounds: number,
): MatchWinner {
  const alive = players.filter((p) => !p.eliminated && p.deck.length > 0);

  if (teamMode === 'teams' && players.length === 4) {
    const team0Alive = alive.some((p) => p.team === 0);
    const team1Alive = alive.some((p) => p.team === 1);

    if (!team0Alive && !team1Alive) return 'DRAW';
    if (!team1Alive) return 'TEAM_0';
    if (!team0Alive) return 'TEAM_1';

    if (resolvedRound >= maxRounds) {
      const team0Cards = players.filter((p) => p.team === 0).reduce((sum, p) => sum + p.deck.length, 0);
      const team1Cards = players.filter((p) => p.team === 1).reduce((sum, p) => sum + p.deck.length, 0);
      if (team0Cards > team1Cards) return 'TEAM_0';
      if (team1Cards > team0Cards) return 'TEAM_1';
      return 'DRAW';
    }
    return 'NONE';
  }

  if (alive.length === 0) return 'DRAW';
  if (alive.length === 1) return alive[0].id;

  if (resolvedRound >= maxRounds) {
    let maxDeck = -1;
    let leaders: PlayerState[] = [];
    for (const player of alive) {
      if (player.deck.length > maxDeck) {
        maxDeck = player.deck.length;
        leaders = [player];
      } else if (player.deck.length === maxDeck) {
        leaders.push(player);
      }
    }
    return leaders.length === 1 ? leaders[0].id : 'DRAW';
  }

  return 'NONE';
}

/**
 * Pure reducer resolving all game actions for 2-4 players with zero side effects.
 */
export function reduceMatchState(state: MatchState, action: MatchAction): MatchState {
  if (action.type === 'RESET_MATCH') {
    return createInitialMatchState(action.matchSeed ?? state.matchSeed, {
      playerCount: state.players.length as PlayerCount,
      teamMode: state.teamMode,
      maxRounds: state.maxRounds,
      players: state.players.map((p) => ({
        name: p.name,
        isBot: p.isBot,
        uid: p.uid,
        ready: p.ready,
      })),
    });
  }

  if (state.winner !== 'NONE') {
    return state;
  }

  const activeParticipants = state.players.filter((p) => !p.eliminated && p.deck.length > 0);
  if (activeParticipants.length < 2) {
    return state;
  }

  if (action.type === 'TOGGLE_GAMBIT') {
    const actor = state.players[action.playerIndex];
    if (!actor || action.playerIndex !== state.activeTurnIndex || actor.gambitUsed) {
      return state;
    }
    return {
      ...state,
      gambitArmed: !state.gambitArmed,
    };
  }

  if (action.type === 'SELECT_PROPHECY_TARGET') {
    const actor = state.players[action.playerIndex];
    const target = state.players[action.targetIndex];
    if (
      !actor ||
      !target ||
      action.playerIndex !== state.activeTurnIndex ||
      action.playerIndex === action.targetIndex ||
      actor.eliminated ||
      actor.deck.length === 0 ||
      target.eliminated ||
      target.deck.length === 0
    ) {
      return state;
    }

    if (state.prophecyTarget && state.prophecyTarget.bySeat === action.playerIndex) {
      return state;
    }

    const hint = getProphecyStatForTarget(state, action.playerIndex, action.targetIndex);
    if (!hint) {
      return state;
    }

    return {
      ...state,
      prophecyTarget: {
        bySeat: action.playerIndex,
        targetSeat: action.targetIndex,
        stat: hint.stat,
        baseValue: hint.baseValue,
        effectiveValue: hint.effectiveValue,
      },
    };
  }

  if (action.type !== 'PICK_STAT') {
    return state;
  }

  const leader = state.players[state.activeTurnIndex];
  if (
    !leader ||
    action.playerIndex !== state.activeTurnIndex ||
    leader.eliminated ||
    leader.deck.length === 0 ||
    !STAT_KEYS.includes(action.stat)
  ) {
    return state;
  }

  const canUseGambit = !leader.gambitUsed;
  const gambitActive = canUseGambit && (action.useGambit ?? state.gambitArmed);

  const activeTopCards = activeParticipants.map((p) => ({
    seatIndex: p.seatIndex,
    playerId: p.id,
    cardId: p.deck[0],
    card: getCardById(p.deck[0]),
  }));

  const effectiveMap = computeEffectiveStatsForRound(
    activeTopCards.map((item) => ({ seatIndex: item.seatIndex, card: item.card })),
    state.activeRealm,
  );

  const entries: PlayedCardEntry[] = activeTopCards.map((item) => {
    const calc = effectiveMap[item.seatIndex];
    return {
      playerId: item.playerId,
      seatIndex: item.seatIndex,
      cardId: item.cardId,
      baseValue: item.card.stats[action.stat],
      bonus: calc.bonus,
      effectiveValue: calc.effectiveStats[action.stat],
      pierced: calc.pierced,
    };
  });

  const values = entries.map((e) => e.effectiveValue);
  const winningValue = gambitActive ? Math.min(...values) : Math.max(...values);
  const contenders = entries.filter((e) => e.effectiveValue === winningValue);

  // Clone mutable player decks/flags cleanly
  const nextPlayers: PlayerState[] = state.players.map((p) => {
    const isActive = !p.eliminated && p.deck.length > 0;
    return {
      ...p,
      deck: isActive ? p.deck.slice(1) : [...p.deck],
      gambitUsed:
        p.seatIndex === leader.seatIndex && gambitActive ? true : p.gambitUsed,
    };
  });

  let nextWarPot = [...state.warPot];
  const resurrectedPlayers: SeatId[] = [];
  let roundWinnerId: RoundOutcome['winnerId'] = 'TIE';
  let tiedPlayerIds: SeatId[] = [];
  let potWon = 0;
  let nextActiveTurnIndex = state.activeTurnIndex;
  const nextStatWins = { ...state.statWins };
  let nextBestWin: BestWinRecord | null = state.bestWin;

  if (contenders.length > 1) {
    tiedPlayerIds = contenders.map((c) => c.playerId);
    nextWarPot = [...state.warPot, ...entries.map((e) => e.cardId)];
  } else {
    const winnerEntry = contenders[0];
    roundWinnerId = winnerEntry.playerId;
    potWon = state.warPot.length;

    const capturedCards: string[] = [];
    for (const entry of entries) {
      if (entry.seatIndex === winnerEntry.seatIndex) continue;
      const loser = nextPlayers[entry.seatIndex];
      const loserCard = getCardById(entry.cardId);
      if (loserCard.passive === 'RESURRECTION' && !loser.resurrectionUsed) {
        loser.resurrectionUsed = true;
        loser.deck = [...loser.deck, entry.cardId];
        resurrectedPlayers.push(loser.id);
      } else {
        capturedCards.push(entry.cardId);
      }
    }

    const winnerPlayer = nextPlayers[winnerEntry.seatIndex];
    winnerPlayer.deck = [
      ...winnerPlayer.deck,
      winnerEntry.cardId,
      ...capturedCards,
      ...state.warPot,
    ];
    winnerPlayer.roundsWon += 1;
    nextWarPot = [];
    nextActiveTurnIndex = winnerPlayer.seatIndex;
    nextStatWins[action.stat] += 1;

    if (!nextBestWin || winnerEntry.effectiveValue > nextBestWin.effectiveValue) {
      nextBestWin = {
        cardId: winnerEntry.cardId,
        playerId: winnerEntry.playerId,
        stat: action.stat,
        effectiveValue: winnerEntry.effectiveValue,
        round: state.round,
      };
    }
  }

  for (const player of nextPlayers) {
    if (player.deck.length === 0) {
      player.eliminated = true;
    }
  }

  const matchWinner = evaluateMatchWinner(nextPlayers, state.teamMode, state.round, state.maxRounds);

  if (matchWinner === 'NONE') {
    if (roundWinnerId === 'TIE') {
      nextActiveTurnIndex = findNextActiveSeatIndex(nextPlayers, state.activeTurnIndex);
    } else if (
      nextPlayers[nextActiveTurnIndex].eliminated ||
      nextPlayers[nextActiveTurnIndex].deck.length === 0
    ) {
      nextActiveTurnIndex = findNextActiveSeatIndex(nextPlayers, nextActiveTurnIndex);
    }
  }

  const nextRound = state.round + 1;

  return {
    matchSeed: state.matchSeed,
    round: nextRound,
    maxRounds: state.maxRounds,
    teamMode: state.teamMode,
    activeTurnIndex: nextActiveTurnIndex,
    activeRealm: getRealmForRound(state.matchSeed, nextRound),
    players: nextPlayers,
    warPot: nextWarPot,
    gambitArmed: false,
    prophecyTarget: null,
    statWins: nextStatWins,
    bestWin: nextBestWin,
    winner: matchWinner,
    lastOutcome: {
      round: state.round,
      leaderId: leader.id,
      stat: action.stat,
      entries,
      gambitActive,
      resurrectedPlayers,
      winnerId: roundWinnerId,
      tiedPlayerIds,
      potWon,
      potSizeAfter: nextWarPot.length,
    },
  };
}

/**
 * Deterministic bot policy for 2-4 player games using only MatchState and Mulberry32 PRNG.
 */
export function chooseBotAction(state: MatchState): MatchAction | null {
  if (state.winner !== 'NONE') return null;
  const botIndex = state.activeTurnIndex;
  const bot = state.players[botIndex];
  if (!bot || bot.eliminated || bot.deck.length === 0) return null;

  const opponents = state.players.filter(
    (p) => p.seatIndex !== botIndex && !p.eliminated && p.deck.length > 0,
  );
  if (opponents.length === 0) return null;

  const botCard = getCardById(bot.deck[0]);
  const activeCards = state.players
    .filter((p) => !p.eliminated && p.deck.length > 0)
    .map((p) => ({ seatIndex: p.seatIndex, card: getCardById(p.deck[0]) }));

  const effectiveMap = computeEffectiveStatsForRound(activeCards, state.activeRealm);
  const botEffective = effectiveMap[botIndex].effectiveStats;
  const canUseGambit = !bot.gambitUsed;

  // If bot has PROPHECY and multiple opponents and hasn't spied yet this round, pick a target first
  if (botCard.passive === 'PROPHECY') {
    if (
      opponents.length > 1 &&
      (!state.prophecyTarget || state.prophecyTarget.bySeat !== botIndex)
    ) {
      const targetRng = mulberry32(deriveSeed(state.matchSeed, state.round, 71 + botIndex));
      const rankedOpponents = [...opponents].sort((a, b) =>
        b.deck.length !== a.deck.length
          ? b.deck.length - a.deck.length
          : targetRng() - 0.5,
      );
      return {
        type: 'SELECT_PROPHECY_TARGET',
        playerIndex: botIndex,
        targetIndex: rankedOpponents[0].seatIndex,
      };
    }

    const prophecyHint =
      state.prophecyTarget && state.prophecyTarget.bySeat === botIndex
        ? state.prophecyTarget
        : getProphecyStatForTarget(state, botIndex, opponents[0].seatIndex);

    if (prophecyHint) {
      const myVal = botEffective[prophecyHint.stat];
      if (myVal > prophecyHint.effectiveValue) {
        return {
          type: 'PICK_STAT',
          playerIndex: botIndex,
          stat: prophecyHint.stat,
          useGambit: false,
        };
      }
      if (
        canUseGambit &&
        myVal < prophecyHint.effectiveValue &&
        prophecyHint.effectiveValue >= 78 &&
        myVal <= 55
      ) {
        return {
          type: 'PICK_STAT',
          playerIndex: botIndex,
          stat: prophecyHint.stat,
          useGambit: true,
        };
      }
    }
  }

  const rng = mulberry32(deriveSeed(state.matchSeed, state.round, 99 + botIndex));
  const ordered = STAT_KEYS.map((stat) => ({
    stat,
    value: botEffective[stat],
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

  if (canUseGambit && strongest.value <= 64 && weakest.value <= 50) {
    return { type: 'PICK_STAT', playerIndex: botIndex, stat: weakest.stat, useGambit: true };
  }

  return { type: 'PICK_STAT', playerIndex: botIndex, stat: strongest.stat, useGambit: false };
}
