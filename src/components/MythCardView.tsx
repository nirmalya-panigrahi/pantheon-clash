import { STAT_KEYS } from '../engine/gameEngine';
import type { MythCard, ProphecyHint, Realm, StatKey } from '../types/game';
import {
  getPassiveLabel,
  getPassiveSummary,
  getRealmLabel,
  PantheonCrest,
  PassiveIcon,
  RealmIcon,
} from './MythEmblem';

interface MythCardViewProps {
  card: MythCard;
  ownerLabel: string;
  activeRealm?: Realm;
  realmBonus?: number;
  bonusNegated?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
  gambitArmed?: boolean;
  highlightedStat?: StatKey | null;
  prophecyHint?: ProphecyHint | null;
  onSelectStat?: (stat: StatKey) => void;
}

const STAT_LABELS: Record<StatKey, string> = {
  might: 'Might',
  arcana: 'Arcana',
  cunning: 'Cunning',
  influence: 'Influence',
};

const REALM_ACCENT_TEXT: Record<Realm, string> = {
  SKY: 'text-amber-700',
  UNDERWORLD: 'text-violet-800',
  SEA: 'text-sky-800',
  WAR: 'text-red-800',
};

const REALM_PANEL_BG: Record<Realm, string> = {
  SKY: 'bg-amber-500/8',
  UNDERWORLD: 'bg-violet-500/8',
  SEA: 'bg-sky-500/8',
  WAR: 'bg-red-500/8',
};

export function MythCardView({
  card,
  ownerLabel,
  activeRealm,
  realmBonus = 0,
  bonusNegated = false,
  interactive = false,
  disabled = false,
  faceDown = false,
  gambitArmed = false,
  highlightedStat = null,
  prophecyHint = null,
  onSelectStat,
}: MythCardViewProps) {
  if (faceDown) {
    return (
      <article
        aria-label={`${ownerLabel} hidden card`}
        className="w-full rounded-xl bg-[#161B24] border border-amber-500/25 p-5 flex flex-col justify-between min-h-[410px] shadow-xl"
      >
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>{ownerLabel}</span>
          <span>Deck Top Card</span>
        </div>

        <div className="my-4 flex-1 rounded-lg border border-amber-500/20 bg-[#10141C] p-5 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-full border border-amber-500/30 flex items-center justify-center text-amber-400">
            <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9" aria-hidden="true">
              <polygon
                points="20,4 34,20 20,36 6,20"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="20" cy="20" r="4" fill="currentColor" />
            </svg>
          </div>
          <div>
            <p className="font-display text-base font-semibold text-stone-200">
              Veiled Deity
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Stats remain hidden until the clash resolves
            </p>
          </div>

          {prophecyHint && (
            <div
              data-testid="prophecy-reveal"
              className="w-full mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-left"
            >
              <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <PassiveIcon passive="PROPHECY" className="w-3.5 h-3.5" />
                  Prophecy Reveal
                </span>
                <span>{STAT_LABELS[prophecyHint.stat]}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xs text-stone-300">Effective Value</span>
                <span className="font-mono tabular-nums text-lg font-semibold text-amber-200">
                  {prophecyHint.effectiveValue}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-stone-500 text-center">
          Face-Down Card
        </div>
      </article>
    );
  }

  const tierStars = '★'.repeat(card.tier);
  const realmMatches = activeRealm === card.domain;

  return (
    <article
      aria-label={`${card.name} card`}
      className="w-full rounded-xl bg-[#FAF7F0] text-stone-900 border border-stone-300/90 p-5 flex flex-col justify-between min-h-[410px] shadow-xl"
    >
      <div>
        <div className="flex items-center justify-between gap-2 text-xs text-stone-600">
          <span className="truncate">{ownerLabel}</span>
          <span className="font-mono tabular-nums text-amber-700 shrink-0" aria-label={`Tier ${card.tier}`}>
            {tierStars}
          </span>
        </div>

        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold text-stone-950 leading-tight">
              {card.name}
            </h3>
            <p className="text-xs text-stone-600 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>{card.pantheon}</span>
              <span aria-hidden="true">·</span>
              <span className={`inline-flex items-center gap-1 font-medium ${REALM_ACCENT_TEXT[card.domain]}`}>
                <RealmIcon realm={card.domain} className="w-3.5 h-3.5" />
                {getRealmLabel(card.domain)}
              </span>
              {card.passive !== 'NONE' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-stone-800">
                    <PassiveIcon passive={card.passive} className="w-3.5 h-3.5" />
                    {getPassiveLabel(card.passive)}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className={`mt-3 rounded-lg p-2 ${REALM_PANEL_BG[card.domain]}`}>
          <PantheonCrest pantheon={card.pantheon} domain={card.domain} />
        </div>

        {realmMatches && (
          <div className="mt-2.5 flex items-center justify-between text-xs px-1">
            <span className="text-stone-700 font-medium">
              Realm Synergy ({getRealmLabel(card.domain)})
            </span>
            <span className="font-mono tabular-nums font-semibold text-amber-700">
              {bonusNegated ? 'Negated by Piercing' : `+${realmBonus}`}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1.5" role="group" aria-label={`${card.name} stats`}>
        {STAT_KEYS.map((stat) => {
          const base = card.stats[stat];
          const effective = base + realmBonus;
          const isHighlighted = highlightedStat === stat;

          if (interactive) {
            return (
              <button
                key={stat}
                type="button"
                disabled={disabled}
                onClick={() => onSelectStat?.(stat)}
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50 disabled:cursor-not-allowed ${
                  gambitArmed
                    ? 'border-amber-600/60 bg-amber-50 hover:bg-amber-100 text-stone-950'
                    : 'border-stone-300 bg-white hover:bg-stone-100 hover:border-stone-400 text-stone-950'
                }`}
              >
                <span className="text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0">
                  <span>{STAT_LABELS[stat]}</span>
                  {gambitArmed && (
                    <span className="text-xs font-medium text-amber-800">
                      (Lowest Wins)
                    </span>
                  )}
                </span>
                <span className="font-mono tabular-nums text-base font-semibold flex items-baseline gap-1.5 shrink-0">
                  {realmBonus > 0 && (
                    <span className="text-xs text-amber-700">
                      {base}+{realmBonus}
                    </span>
                  )}
                  <span>{effective}</span>
                </span>
              </button>
            );
          }

          return (
            <div
              key={stat}
              className={`w-full min-h-[40px] px-3.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 ${
                isHighlighted
                  ? 'border-amber-600 bg-amber-100/80 text-stone-950'
                  : 'border-stone-200 bg-white/75 text-stone-800'
              }`}
            >
              <span className="text-sm font-medium whitespace-nowrap shrink-0">
                {STAT_LABELS[stat]}
              </span>
              <span className="font-mono tabular-nums text-base font-semibold flex items-baseline gap-1.5 shrink-0">
                {realmBonus > 0 && (
                  <span className="text-xs text-amber-700">
                    {base}+{realmBonus}
                  </span>
                )}
                <span>{effective}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-stone-300/70 text-xs text-stone-600 flex items-center justify-between gap-2">
        <span className="truncate">{getPassiveSummary(card.passive)}</span>
      </div>
    </article>
  );
}
