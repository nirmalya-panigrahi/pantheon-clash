export type Pantheon =
  | 'Greek'
  | 'Norse'
  | 'Hindu'
  | 'Egyptian'
  | 'Japanese'
  | 'Celtic'
  | 'Mesoamerican';

export type Realm = 'SKY' | 'NETHER' | 'SEA' | 'WAR';

export type Passive = 'NONE' | 'PIERCING' | 'PROPHECY' | 'RESURRECTION';

export type StatKey = 'might' | 'arcana' | 'cunning' | 'influence';

export type SeatId = 'p1' | 'p2' | 'p3' | 'p4';

export type PlayerCount = 2 | 3 | 4;

export type TeamMode = 'ffa' | 'teams';

export type MatchWinner = 'NONE' | SeatId | 'TEAM_0' | 'TEAM_1' | 'DRAW';

export type MatchStatus = 'waiting' | 'active' | 'finished';

export type CardStats = Record<StatKey, number>;

export interface MythCard {
  id: string;
  name: string;
  pantheon: Pantheon;
  tier: 1 | 2 | 3;
  domain: Realm;
  passive: Passive;
  stats: CardStats;
}

export interface PlayerState {
  id: SeatId;
  seatIndex: number;
  name: string;
  isBot: boolean;
  uid: string | null;
  team: 0 | 1;
  deck: string[];
  resurrectionUsed: boolean;
  gambitUsed: boolean;
  eliminated: boolean;
  away: boolean;
  ready: boolean;
  roundsWon: number;
}

export interface PlayedCardEntry {
  playerId: SeatId;
  seatIndex: number;
  cardId: string;
  baseValue: number;
  bonus: number;
  effectiveValue: number;
  pierced: boolean;
}

export interface RoundOutcome {
  round: number;
  leaderId: SeatId;
  stat: StatKey;
  entries: PlayedCardEntry[];
  gambitActive: boolean;
  resurrectedPlayers: SeatId[];
  winnerId: SeatId | 'TIE';
  tiedPlayerIds: SeatId[];
  potWon: number;
  potSizeAfter: number;
}

export interface ProphecyTarget {
  bySeat: number;
  targetSeat: number;
  stat: StatKey;
  baseValue: number;
  effectiveValue: number;
}

export interface BestWinRecord {
  cardId: string;
  playerId: SeatId;
  stat: StatKey;
  effectiveValue: number;
  round: number;
}

export interface MatchState {
  matchSeed: number;
  round: number;
  maxRounds: number;
  teamMode: TeamMode;
  activeTurnIndex: number;
  activeRealm: Realm;
  players: PlayerState[];
  warPot: string[];
  gambitArmed: boolean;
  prophecyTarget: ProphecyTarget | null;
  statWins: Record<StatKey, number>;
  bestWin: BestWinRecord | null;
  winner: MatchWinner;
  lastOutcome: RoundOutcome | null;
}

export interface PlayerSeedConfig {
  name: string;
  isBot: boolean;
  uid?: string | null;
  ready?: boolean;
}

export type MatchAction =
  | { type: 'TOGGLE_GAMBIT'; playerIndex: number }
  | { type: 'SELECT_PROPHECY_TARGET'; playerIndex: number; targetIndex: number }
  | { type: 'PICK_STAT'; playerIndex: number; stat: StatKey; useGambit?: boolean }
  | { type: 'RESET_MATCH'; matchSeed?: number };

export interface ProphecyHint {
  stat: StatKey;
  baseValue: number;
  effectiveValue: number;
}

export interface FirestoreMatchDocument extends MatchState {
  matchId: string;
  roomCode: string;
  status: MatchStatus;
  hostUid: string;
  maxPlayers: PlayerCount;
  fillWithBots: boolean;
  activePlayers: string[];
  turnStartedAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}
