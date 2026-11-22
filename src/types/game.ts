export type Pantheon =
  | 'Greek'
  | 'Norse'
  | 'Hindu'
  | 'Egyptian'
  | 'Japanese'
  | 'Celtic'
  | 'Mesoamerican';

export type Realm = 'SKY' | 'UNDERWORLD' | 'SEA' | 'WAR';

export type Passive = 'NONE' | 'PIERCING' | 'PROPHECY' | 'RESURRECTION';

export type StatKey = 'might' | 'arcana' | 'cunning' | 'influence';

export type PlayerId = 'p1' | 'p2';

export type MatchWinner = 'NONE' | 'p1' | 'p2' | 'DRAW';

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

export interface RoundOutcome {
  round: number;
  stat: StatKey;
  p1CardId: string;
  p2CardId: string;
  p1Effective: number;
  p2Effective: number;
  p1Bonus: number;
  p2Bonus: number;
  gambitActive: boolean;
  resurrectedPlayer: PlayerId | null;
  winner: 'p1' | 'p2' | 'TIE';
  potWon: number;
}

export interface MatchState {
  matchSeed: number;
  round: number;
  activeTurn: PlayerId;
  activeRealm: Realm;
  p1Deck: string[];
  p2Deck: string[];
  warPot: string[];
  resurrectionUsed: { p1: boolean; p2: boolean };
  gambitUsed: { p1: boolean; p2: boolean };
  gambitArmed: boolean;
  winner: MatchWinner;
  lastOutcome: RoundOutcome | null;
}

export type MatchAction =
  | { type: 'TOGGLE_GAMBIT'; player: PlayerId }
  | { type: 'PICK_STAT'; player: PlayerId; stat: StatKey; useGambit?: boolean }
  | { type: 'RESET_MATCH'; matchSeed?: number };

export interface ProphecyHint {
  stat: StatKey;
  baseValue: number;
  effectiveValue: number;
}

export interface FirestoreMatchDocument extends MatchState {
  matchId: string;
  status: MatchStatus;
  hostUid: string;
  hostName: string;
  guestUid: string;
  guestName: string;
  activePlayers: string[];
  createdAt: unknown;
  updatedAt: unknown;
}
