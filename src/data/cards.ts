import rawCards from './cards.json';
import type { MythCard } from '../types/game';

export const ALL_CARDS: readonly MythCard[] = rawCards as MythCard[];

export const CARD_BY_ID: ReadonlyMap<string, MythCard> = new Map(
  ALL_CARDS.map((card) => [card.id, card]),
);

export function getCardById(id: string): MythCard {
  const card = CARD_BY_ID.get(id);
  if (!card) {
    throw new Error(`Unknown mythology card ID: ${id}`);
  }
  return card;
}
