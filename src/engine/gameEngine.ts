import { ALL_CARDS, getCardById } from '../data/cards';
import type {
  BestWinRecord,
  CardStats,
  GameMode,
  MatchAction,
  MatchPreset,
  MatchState,
  MatchWinner,
  MythCard,
  PendingClash,
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

export const REALMS: readonly Realm[] = ['SKY', 'NETHER', 'SEA', 'WAR'];
export const STAT_KEYS: readonly StatKey[] = ['might', 'arcana', 'cunning', 'influence'];
export const SEAT_IDS: readonly SeatId[] = ['p1', 'p2', 'p3', 'p4'];
export const REALM_BONUS = 15;
export const WAR_REALM_BONUS = 20;
export const ROUNDS_PER_REALM = 3;
export const MAX_ROUNDS = 60;
export const HAND_SIZE = 3;
export const TURN_TIMEOUT_SECONDS = 20;

export const MATCH_PRESETS: Record<
  MatchPreset,
  {
    label: string;
    shortLabel: string;
    cardsPerPlayer: number;
    maxRounds: number;
    gameMode: GameMode;
  }
> = {
  blitz: {
    label: 'Blitz (12R)',
    shortLabel: '12R Blitz',
    cardsPerPlayer: 12,
    maxRounds: 12,
    gameMode: 'points',
  },
  standard: {
    label: 'Standard (15R)',
    shortLabel: '15R Std',
    cardsPerPlayer: 15,
    maxRounds: 15,
    gameMode: 'points',
  },
  classic: {
    label: 'Classic War (60R)',
    shortLabel: '60R War',
    cardsPerPlayer: 0,
    maxRounds: 60,
    gameMode: 'classic',
  },
};

export interface InitialMatchOptions {
  playerCount?: PlayerCount;
  players?: PlayerSeedConfig[];
  teamMode?: TeamMode;
  matchPreset?: MatchPreset;
  gameMode?: GameMode;
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
 * Computes per-stat bonus for a card in the active realm, accounting for PIERCING negation.
 */
export function getStatBonusForRealm(
  card: MythCard,
  activeRealm: Realm,
  stat: StatKey,
  pierced = false,
): number {
  if (card.domain !== activeRealm || pierced) {
    return 0;
  }
  if (activeRealm === 'SKY') {
    return stat === 'arcana' || stat === 'influence' ? 20 : REALM_BONUS;
  }
  if (activeRealm === 'WAR') {
    return stat === 'might' ? 25 : WAR_REALM_BONUS;
  }
  return REALM_BONUS;
}

/**
 * Computes effective stats for `card` facing `opponentCard` in `activeRealm` (2-card helper).
 */
export function computeEffectiveStats(
  card: MythCard,
  opponentCard: MythCard,
  activeRealm: Realm,
): { bonus: number; pierced: boolean; effectiveStats: CardStats; statBonuses: CardStats } {
  const hasDomainMatch = card.domain === activeRealm;
  const negatedByPiercing = opponentCard.passive === 'PIERCING';
  const pierced = hasDomainMatch && negatedByPiercing;

  const statBonuses: CardStats = {
    might: getStatBonusForRealm(card, activeRealm, 'might', pierced),
    arcana: getStatBonusForRealm(card, activeRealm, 'arcana', pierced),
    cunning: getStatBonusForRealm(card, activeRealm, 'cunning', pierced),
    influence: getStatBonusForRealm(card, activeRealm, 'influence', pierced),
  };

  const baseBonus = hasDomainMatch && !pierced ? (activeRealm === 'WAR' ? WAR_REALM_BONUS : REALM_BONUS) : 0;

  return {
    bonus: baseBonus,
    pierced,
    statBonuses,
    effectiveStats: {
      might: card.stats.might + statBonuses.might,
      arcana: card.stats.arcana + statBonuses.arcana,
      cunning: card.stats.cunning + statBonuses.cunning,
      influence: card.stats.influence + statBonuses.influence,
    },
  };
}

/**
 * Computes effective stats across 2-4 active players in a clash.
 * Any active opponent holding a PIERCING card negates the realm bonus for all other cards.
 */
export function computeEffectiveStatsForRound(
  activeCards: readonly { seatIndex: number; card: MythCard }[],
  activeRealm: Realm,
): Record<
  number,
  { bonus: number; pierced: boolean; effectiveStats: CardStats; statBonuses: CardStats }
> {
  const piercingSeats = activeCards
    .filter((entry) => entry.card.passive === 'PIERCING')
    .map((entry) => entry.seatIndex);

  const result: Record<
    number,
    { bonus: number; pierced: boolean; effectiveStats: CardStats; statBonuses: CardStats }
  > = {};

  for (const entry of activeCards) {
    const hasDomainMatch = entry.card.domain === activeRealm;
    const opponentHasPiercing = piercingSeats.some((seat) => seat !== entry.seatIndex);
    const pierced = hasDomainMatch && opponentHasPiercing;
    const baseBonus =
      hasDomainMatch && !pierced ? (activeRealm === 'WAR' ? WAR_REALM_BONUS : REALM_BONUS) : 0;

    const statBonuses: CardStats = {
      might: getStatBonusForRealm(entry.card, activeRealm, 'might', pierced),
      arcana: getStatBonusForRealm(entry.card, activeRealm, 'arcana', pierced),
      cunning: getStatBonusForRealm(entry.card, activeRealm, 'cunning', pierced),
      influence: getStatBonusForRealm(entry.card, activeRealm, 'influence', pierced),
    };

    result[entry.seatIndex] = {
      bonus: baseBonus,
      pierced,
      statBonuses,
      effectiveStats: {
        might: entry.card.stats.might + statBonuses.might,
        arcana: entry.card.stats.arcana + statBonuses.arcana,
        cunning: entry.card.stats.cunning + statBonuses.cunning,
        influence: entry.card.stats.influence + statBonuses.influence,
      },
    };
  }

  return result;
}

/**
 * Deterministically reveals one stat of `targetIndex`'s lead card when `viewerIndex` holds a PROPHECY card in hand.
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

  const viewerHand = viewer.deck.slice(0, HAND_SIZE).map((id) => getCardById(id));
  if (!viewerHand.some((c) => c.passive === 'PROPHECY')) {
    return null;
  }

  const targetCard = getCardById(target.deck[0]);
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

  const matchPreset: MatchPreset = options.matchPreset ?? 'blitz';
  const presetCfg = MATCH_PRESETS[matchPreset];
  const gameMode: GameMode = options.gameMode ?? presetCfg.gameMode;
  const maxRounds = Math.max(1, options.maxRounds ?? presetCfg.maxRounds);

  const shuffledIds = shuffleDeterministic(
    cards.map((card) => card.id),
    seed,
  );
  const maxEvenSplit = Math.floor(shuffledIds.length / playerCount);
  const cardsPerPlayer =
    presetCfg.cardsPerPlayer > 0
      ? Math.min(presetCfg.cardsPerPlayer, maxEvenSplit)
      : maxEvenSplit;

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
      score: 0,
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
    matchPreset,
    gameMode,
    round: 1,
    maxRounds,
    teamMode,
    roundPhase: 'attack',
    activeTurnIndex,
    activeRealm: getRealmForRound(seed, 1),
    players,
    warPot: [],
    pendingClash: null,
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

function findNextPendingDefenderIndex(
  players: readonly PlayerState[],
  fromIndex: number,
  selections: Record<string, string>,
): number | null {
  const n = players.length;
  for (let offset = 1; offset <= n; offset += 1) {
    const idx = (fromIndex + offset) % n;
    const candidate = players[idx];
    if (!candidate.eliminated && candidate.deck.length > 0 && !selections[candidate.id]) {
      return idx;
    }
  }
  return null;
}

function evaluateMatchWinner(
  players: readonly PlayerState[],
  teamMode: TeamMode,
  gameMode: GameMode,
  resolvedRound: number,
  maxRounds: number,
): MatchWinner {
  const alive = players.filter((p) => !p.eliminated && p.deck.length > 0);

  if (gameMode === 'points') {
    const shouldEnd = alive.length < 2 || resolvedRound >= maxRounds;
    if (!shouldEnd) return 'NONE';

    if (teamMode === 'teams' && players.length === 4) {
      const t0 = players.filter((p) => p.team === 0);
      const t1 = players.filter((p) => p.team === 1);
      const t0Score = t0.reduce((sum, p) => sum + p.score, 0);
      const t1Score = t1.reduce((sum, p) => sum + p.score, 0);
      if (t0Score !== t1Score) return t0Score > t1Score ? 'TEAM_0' : 'TEAM_1';

      const t0Deck = t0.reduce((sum, p) => sum + p.deck.length, 0);
      const t1Deck = t1.reduce((sum, p) => sum + p.deck.length, 0);
      if (t0Deck !== t1Deck) return t0Deck > t1Deck ? 'TEAM_0' : 'TEAM_1';

      const t0Wins = t0.reduce((sum, p) => sum + p.roundsWon, 0);
      const t1Wins = t1.reduce((sum, p) => sum + p.roundsWon, 0);
      if (t0Wins !== t1Wins) return t0Wins > t1Wins ? 'TEAM_0' : 'TEAM_1';
      return 'DRAW';
    }

    const sorted = [...players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.deck.length !== a.deck.length) return b.deck.length - a.deck.length;
      return b.roundsWon - a.roundsWon;
    });
    const top = sorted[0];
    const second = sorted[1];
    if (
      second &&
      top.score === second.score &&
      top.deck.length === second.deck.length &&
      top.roundsWon === second.roundsWon
    ) {
      return 'DRAW';
    }
    return top.id;
  }

  // Classic deck-capture mode
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

function removeCardFromDeck(deck: readonly string[], cardId: string): string[] {
  const idx = deck.indexOf(cardId);
  if (idx < 0) return [...deck];
  return [...deck.slice(0, idx), ...deck.slice(idx + 1)];
}

function resolveClashRound(state: MatchState, clash: PendingClash): MatchState {
  const activeParticipants = state.players.filter((p) => !p.eliminated && p.deck.length > 0);
  const leader = state.players[clash.leaderSeat] ?? activeParticipants[0];

  const activeTopCards = activeParticipants.map((p) => {
    const chosenId = clash.selections[p.id] ?? p.deck[0];
    return {
      seatIndex: p.seatIndex,
      playerId: p.id,
      cardId: chosenId,
      card: getCardById(chosenId),
    };
  });

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
      baseValue: item.card.stats[clash.stat],
      bonus: calc.statBonuses[clash.stat],
      effectiveValue: calc.effectiveStats[clash.stat],
      pierced: calc.pierced,
    };
  });

  const values = entries.map((e) => e.effectiveValue);
  const winningValue = clash.gambitActive ? Math.min(...values) : Math.max(...values);
  const contenders = entries.filter((e) => e.effectiveValue === winningValue);

  const nextPlayers: PlayerState[] = state.players.map((p) => {
    const isActive = !p.eliminated && p.deck.length > 0;
    const chosenId = clash.selections[p.id];
    return {
      ...p,
      deck: isActive && chosenId ? removeCardFromDeck(p.deck, chosenId) : [...p.deck],
      gambitUsed:
        p.seatIndex === clash.leaderSeat && clash.gambitActive ? true : p.gambitUsed,
    };
  });

  let nextWarPot = [...state.warPot];
  const resurrectedPlayers: SeatId[] = [];
  let roundWinnerId: RoundOutcome['winnerId'] = 'TIE';
  let tiedPlayerIds: SeatId[] = [];
  let potWon = 0;
  let pointsAwarded = 0;
  let nextActiveTurnIndex = clash.leaderSeat;
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
      const freeNetherResurrection = state.activeRealm === 'NETHER';
      if (loserCard.passive === 'RESURRECTION' && (!loser.resurrectionUsed || freeNetherResurrection)) {
        if (!freeNetherResurrection) {
          loser.resurrectionUsed = true;
        }
        loser.deck = [...loser.deck, entry.cardId];
        resurrectedPlayers.push(loser.id);
      } else {
        capturedCards.push(entry.cardId);
      }
    }

    const winnerPlayer = nextPlayers[winnerEntry.seatIndex];
    const seaPotMultiplier = state.activeRealm === 'SEA' ? 2 : 1;
    pointsAwarded = 1 + capturedCards.length + state.warPot.length * seaPotMultiplier;

    if (state.gameMode === 'classic') {
      winnerPlayer.deck = [
        ...winnerPlayer.deck,
        winnerEntry.cardId,
        ...capturedCards,
        ...state.warPot,
      ];
    }

    winnerPlayer.score += pointsAwarded;
    winnerPlayer.roundsWon += 1;
    nextWarPot = [];
    nextActiveTurnIndex = winnerPlayer.seatIndex;
    nextStatWins[clash.stat] += 1;

    if (!nextBestWin || winnerEntry.effectiveValue > nextBestWin.effectiveValue) {
      nextBestWin = {
        cardId: winnerEntry.cardId,
        playerId: winnerEntry.playerId,
        stat: clash.stat,
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

  const matchWinner = evaluateMatchWinner(
    nextPlayers,
    state.teamMode,
    state.gameMode,
    state.round,
    state.maxRounds,
  );

  if (matchWinner === 'NONE') {
    if (roundWinnerId === 'TIE') {
      nextActiveTurnIndex = findNextActiveSeatIndex(nextPlayers, clash.leaderSeat);
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
    matchPreset: state.matchPreset,
    gameMode: state.gameMode,
    round: nextRound,
    maxRounds: state.maxRounds,
    teamMode: state.teamMode,
    roundPhase: 'attack',
    activeTurnIndex: nextActiveTurnIndex,
    activeRealm: getRealmForRound(state.matchSeed, nextRound),
    players: nextPlayers,
    warPot: nextWarPot,
    pendingClash: null,
    gambitArmed: false,
    prophecyTarget: null,
    statWins: nextStatWins,
    bestWin: nextBestWin,
    winner: matchWinner,
    lastOutcome: {
      round: state.round,
      leaderId: leader.id,
      stat: clash.stat,
      entries,
      gambitActive: clash.gambitActive,
      resurrectedPlayers,
      winnerId: roundWinnerId,
      tiedPlayerIds,
      potWon,
      potSizeAfter: nextWarPot.length,
      pointsAwarded,
    },
  };
}

/**
 * Pure reducer resolving all game actions for 2-4 players with zero side effects.
 */
export function reduceMatchState(state: MatchState, action: MatchAction): MatchState {
  if (action.type === 'RESET_MATCH') {
    const nextPreset = action.matchPreset ?? state.matchPreset;
    return createInitialMatchState(action.matchSeed ?? state.matchSeed, {
      playerCount: state.players.length as PlayerCount,
      teamMode: state.teamMode,
      matchPreset: nextPreset,
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
    if (
      !actor ||
      state.roundPhase !== 'attack' ||
      state.activeRealm === 'WAR' ||
      action.playerIndex !== state.activeTurnIndex ||
      actor.gambitUsed
    ) {
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
      state.roundPhase !== 'attack' ||
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

  if (action.type === 'PICK_STAT') {
    const leader = state.players[state.activeTurnIndex];
    if (
      !leader ||
      state.roundPhase !== 'attack' ||
      action.playerIndex !== state.activeTurnIndex ||
      leader.eliminated ||
      leader.deck.length === 0 ||
      !STAT_KEYS.includes(action.stat)
    ) {
      return state;
    }

    const handCount = Math.min(HAND_SIZE, leader.deck.length);
    const handIdx = action.handIndex ?? 0;
    if (!Number.isInteger(handIdx) || handIdx < 0 || handIdx >= handCount) {
      return state;
    }

    const chosenCardId = leader.deck[handIdx];
    const canUseGambit = !leader.gambitUsed && state.activeRealm !== 'WAR';
    const gambitActive = canUseGambit && (action.useGambit ?? state.gambitArmed);

    const selections: Record<string, string> = {
      [leader.id]: chosenCardId,
    };

    const nextClash: PendingClash = {
      leaderSeat: leader.seatIndex,
      stat: action.stat,
      gambitActive,
      selections,
    };

    const nextDefender = findNextPendingDefenderIndex(
      state.players,
      leader.seatIndex,
      selections,
    );

    if (nextDefender === null) {
      return resolveClashRound(state, nextClash);
    }

    return {
      ...state,
      roundPhase: 'defend',
      activeTurnIndex: nextDefender,
      pendingClash: nextClash,
      gambitArmed: false,
    };
  }

  if (action.type === 'DEFEND_CARD') {
    if (state.roundPhase !== 'defend' || !state.pendingClash) {
      return state;
    }
    const defender = state.players[state.activeTurnIndex];
    if (
      !defender ||
      action.playerIndex !== state.activeTurnIndex ||
      defender.eliminated ||
      defender.deck.length === 0 ||
      state.pendingClash.selections[defender.id]
    ) {
      return state;
    }

    const handCount = Math.min(HAND_SIZE, defender.deck.length);
    if (!Number.isInteger(action.handIndex) || action.handIndex < 0 || action.handIndex >= handCount) {
      return state;
    }

    const chosenCardId = defender.deck[action.handIndex];
    const nextSelections: Record<string, string> = {
      ...state.pendingClash.selections,
      [defender.id]: chosenCardId,
    };
    const nextClash: PendingClash = {
      ...state.pendingClash,
      selections: nextSelections,
    };

    const nextDefender = findNextPendingDefenderIndex(
      state.players,
      defender.seatIndex,
      nextSelections,
    );

    if (nextDefender === null) {
      return resolveClashRound(state, nextClash);
    }

    return {
      ...state,
      activeTurnIndex: nextDefender,
      pendingClash: nextClash,
    };
  }

  return state;
}

/**
 * Deterministic bot policy for 2-4 player games with 3-card hand selection on both attack & defense.
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

  const botHand = bot.deck.slice(0, Math.min(HAND_SIZE, bot.deck.length)).map((id, handIndex) => ({
    handIndex,
    cardId: id,
    card: getCardById(id),
  }));

  // Defense phase: pick the best counter-card from hand for the challenged stat
  if (state.roundPhase === 'defend' && state.pendingClash) {
    const stat = state.pendingClash.stat;
    const gambitActive = state.pendingClash.gambitActive;
    const rng = mulberry32(deriveSeed(state.matchSeed, state.round, 131 + botIndex));

    const scoredHand = botHand.map((item) => {
      const effectiveVal =
        item.card.stats[stat] + getStatBonusForRealm(item.card, state.activeRealm, stat, false);
      return {
        handIndex: item.handIndex,
        card: item.card,
        effectiveVal,
        tieBreak: rng(),
      };
    });

    if (gambitActive) {
      const lowest = [...scoredHand].sort((a, b) =>
        a.effectiveVal !== b.effectiveVal ? a.effectiveVal - b.effectiveVal : a.tieBreak - b.tieBreak,
      )[0];
      return { type: 'DEFEND_CARD', playerIndex: botIndex, handIndex: lowest.handIndex };
    }

    const sortedBest = [...scoredHand].sort((a, b) =>
      b.effectiveVal !== a.effectiveVal ? b.effectiveVal - a.effectiveVal : b.tieBreak - a.tieBreak,
    );
    const sortedWeakest = [...scoredHand].sort((a, b) =>
      a.effectiveVal !== b.effectiveVal ? a.effectiveVal - b.effectiveVal : a.tieBreak - b.tieBreak,
    );

    const best = sortedBest[0];
    // If War Pot is empty and best card is weak (< 62) with multiple cards in hand, sacrifice weakest (preferring Resurrection)
    if (state.warPot.length === 0 && best.effectiveVal < 62 && botHand.length > 1) {
      const resSacrifice = sortedWeakest.find((item) => item.card.passive === 'RESURRECTION');
      const sacrifice = resSacrifice ?? sortedWeakest[0];
      return { type: 'DEFEND_CARD', playerIndex: botIndex, handIndex: sacrifice.handIndex };
    }

    return { type: 'DEFEND_CARD', playerIndex: botIndex, handIndex: best.handIndex };
  }

  // Attack phase: evaluate Prophecy, then pick optimal (handIndex, stat, useGambit)
  const canUseGambit = !bot.gambitUsed && state.activeRealm !== 'WAR';
  const hasProphecyInHand = botHand.some((h) => h.card.passive === 'PROPHECY');

  if (hasProphecyInHand) {
    if (
      opponents.length > 1 &&
      (!state.prophecyTarget || state.prophecyTarget.bySeat !== botIndex)
    ) {
      const targetRng = mulberry32(deriveSeed(state.matchSeed, state.round, 71 + botIndex));
      const rankedOpponents = [...opponents].sort((a, b) =>
        b.score !== a.score
          ? b.score - a.score
          : b.deck.length !== a.deck.length
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
      const stat = prophecyHint.stat;
      const winningChoice = botHand
        .map((item) => ({
          handIndex: item.handIndex,
          val: item.card.stats[stat] + getStatBonusForRealm(item.card, state.activeRealm, stat, false),
        }))
        .sort((a, b) => b.val - a.val)[0];

      if (winningChoice && winningChoice.val > prophecyHint.effectiveValue) {
        return {
          type: 'PICK_STAT',
          playerIndex: botIndex,
          handIndex: winningChoice.handIndex,
          stat,
          useGambit: false,
        };
      }

      if (canUseGambit && prophecyHint.effectiveValue >= 78) {
        const lowestChoice = botHand
          .map((item) => ({
            handIndex: item.handIndex,
            val: item.card.stats[stat] + getStatBonusForRealm(item.card, state.activeRealm, stat, false),
          }))
          .sort((a, b) => a.val - b.val)[0];

        if (lowestChoice && lowestChoice.val < prophecyHint.effectiveValue && lowestChoice.val <= 55) {
          return {
            type: 'PICK_STAT',
            playerIndex: botIndex,
            handIndex: lowestChoice.handIndex,
            stat,
            useGambit: true,
          };
        }
      }
    }
  }

  const rng = mulberry32(deriveSeed(state.matchSeed, state.round, 99 + botIndex));
  const options: { handIndex: number; stat: StatKey; value: number; tieBreak: number }[] = [];

  for (const item of botHand) {
    for (const stat of STAT_KEYS) {
      const value =
        item.card.stats[stat] + getStatBonusForRealm(item.card, state.activeRealm, stat, false);
      options.push({
        handIndex: item.handIndex,
        stat,
        value,
        tieBreak: rng(),
      });
    }
  }

  const sortedDesc = [...options].sort((a, b) =>
    b.value !== a.value ? b.value - a.value : b.tieBreak - a.tieBreak,
  );
  const sortedAsc = [...options].sort((a, b) =>
    a.value !== b.value ? a.value - b.value : b.tieBreak - a.tieBreak,
  );

  const strongest = sortedDesc[0];
  const weakest = sortedAsc[0];

  if (canUseGambit && strongest.value <= 64 && weakest.value <= 50) {
    return {
      type: 'PICK_STAT',
      playerIndex: botIndex,
      handIndex: weakest.handIndex,
      stat: weakest.stat,
      useGambit: true,
    };
  }

  return {
    type: 'PICK_STAT',
    playerIndex: botIndex,
    handIndex: strongest.handIndex,
    stat: strongest.stat,
    useGambit: false,
  };
}
