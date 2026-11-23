import { STAT_KEYS } from '../engine/gameEngine';
import {
  PANTHEON_THEMES,
  PASSIVE_META,
  REALM_THEMES,
  STAT_META,
} from '../theme/pantheons';
import type { MythCard, ProphecyHint, Realm, StatKey } from '../types/game';
import {
  getRealmLabel,
  PantheonCrest,
  PassiveIcon,
  RealmIcon,
  StatIcon,
} from './MythEmblem';
import { Badge, Tooltip } from './ui';

export interface CardProps {
  card: MythCard;
  ownerLabel?: string;
  activeRealm?: Realm;
  realmBonus?: number;
  bonusNegated?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
  gambitArmed?: boolean;
  selectedStat?: StatKey | null;
  highlightedStat?: StatKey | null;
  outcomeState?: 'neutral' | 'winner' | 'loser';
  prophecyHint?: ProphecyHint | null;
  compact?: boolean;
  countUpProgress?: number;
  onSelectStat?: (stat: StatKey) => void;
  onClickCard?: () => void;
}

export function Card({
  card,
  ownerLabel,
  activeRealm,
  realmBonus = 0,
  bonusNegated = false,
  interactive = false,
  disabled = false,
  faceDown = false,
  gambitArmed = false,
  selectedStat = null,
  highlightedStat = null,
  outcomeState = 'neutral',
  prophecyHint = null,
  compact = false,
  countUpProgress = 1,
  onSelectStat,
  onClickCard,
}: CardProps) {
  if (faceDown) {
    return (
      <article
        aria-label={`${ownerLabel ?? 'Opponent'} hidden card`}
        className={`w-full ${
          compact ? 'max-w-[200px] min-h-[260px] p-3' : 'max-w-[300px] aspect-[5/7] p-4'
        } mx-auto rounded-2xl bg-[#111728] border border-amber-500/35 shadow-[0_12px_32px_rgba(0,0,0,0.55)] flex flex-col justify-between select-none`}
      >
        <div className="flex items-center justify-between text-[11px] text-stone-400">
          <span className="truncate font-medium">{ownerLabel ?? 'Opponent'}</span>
          <span className="font-mono text-amber-400/80">Hidden</span>
        </div>

        <div className="my-2 flex-1 rounded-xl border border-amber-400/20 bg-gradient-to-b from-[#161E34] via-[#101627] to-[#161E34] p-3 flex flex-col items-center justify-center text-center gap-2.5 relative overflow-hidden">
          <div className="w-12 h-12 rounded-full border border-amber-400/35 bg-amber-500/10 flex items-center justify-center text-amber-300">
            <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7" aria-hidden="true">
              <polygon
                points="20,4 34,20 20,36 6,20"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="20" cy="20" r="4" fill="currentColor" />
            </svg>
          </div>
          <p className="font-display text-sm font-semibold text-stone-200 tracking-wide">
            Veiled Deity
          </p>

          {prophecyHint && (
            <div
              data-testid="prophecy-reveal"
              className="w-full rounded-lg border border-amber-400/50 bg-amber-500/15 px-2.5 py-2 text-left"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-amber-200">
                <span className="inline-flex items-center gap-1">
                  <PassiveIcon passive="PROPHECY" className="w-3 h-3" />
                  Prophecy
                </span>
                <span>{STAT_META[prophecyHint.stat].label}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-[11px] text-stone-300">Effective</span>
                <span className="font-mono tabular-nums text-base font-bold text-amber-200">
                  {prophecyHint.effectiveValue}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="text-[11px] text-stone-500 text-center font-medium">
          Pantheon Clash
        </div>
      </article>
    );
  }

  const pTheme = PANTHEON_THEMES[card.pantheon];
  const rTheme = REALM_THEMES[card.domain];
  const passiveInfo = PASSIVE_META[card.passive];
  const tierStars = '★'.repeat(card.tier);
  const realmMatches = activeRealm === card.domain;
  const activeStatHighlight = selectedStat ?? highlightedStat;

  const outcomeClasses =
    outcomeState === 'winner'
      ? 'ring-2 ring-amber-400 shadow-[0_0_32px_rgba(251,191,36,0.45)] border-amber-300'
      : outcomeState === 'loser'
        ? 'grayscale opacity-70 border-stone-500/50'
        : `${pTheme.borderClass} ${pTheme.glowShadow}`;

  const hoverClasses =
    interactive || onClickCard
      ? 'hover:-translate-y-1.5 md:hover:rotate-[0.6deg] transition-transform duration-200'
      : 'transition-all duration-200';

  const cardContent = (
    <article
      aria-label={`${card.name} card`}
      onClick={onClickCard}
      className={`w-full ${
        compact ? 'max-w-[230px] p-3' : 'max-w-[310px] aspect-[5/7] p-4'
      } mx-auto rounded-2xl bg-[#F6F0E2] text-stone-900 border-2 flex flex-col justify-between ${outcomeClasses} ${hoverClasses} ${
        onClickCard ? 'cursor-pointer' : ''
      }`}
    >
      {/* Top Banner */}
      <div className="space-y-2">
        <div
          className={`rounded-xl bg-gradient-to-r ${pTheme.headerGradient} px-3 py-2 text-stone-100 border border-white/10`}
        >
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className={`font-semibold tracking-wide ${pTheme.badgeText} truncate`}>
              {ownerLabel ? `${ownerLabel} · ${card.pantheon}` : card.pantheon}
            </span>
            <span
              className="font-mono tabular-nums text-amber-300 shrink-0"
              aria-label={`Tier ${card.tier}`}
            >
              {tierStars}
            </span>
          </div>
          <h3 className="font-display text-lg font-bold text-white leading-tight truncate mt-0.5">
            {card.name}
          </h3>
        </div>

        {/* Art & Domain / Passive Strip */}
        <div
          className={`rounded-xl bg-gradient-to-br ${pTheme.artGradient} border border-stone-900/10 p-2 relative overflow-hidden`}
        >
          <PantheonCrest
            pantheon={card.pantheon}
            domain={card.domain}
            size={compact ? 'sm' : 'md'}
          />
          <div className="mt-1.5 flex items-center justify-between gap-1.5 flex-wrap">
            <Badge tone={rTheme.badgeTone}>
              <RealmIcon realm={card.domain} className="w-3 h-3" />
              {getRealmLabel(card.domain)}
            </Badge>

            {card.passive !== 'NONE' && (
              <Tooltip content={passiveInfo.tooltip}>
                <Badge tone="gold" className="!bg-stone-900 !text-amber-300 !border-amber-500/50">
                  <PassiveIcon passive={card.passive} className="w-3 h-3" />
                  {passiveInfo.label}
                </Badge>
              </Tooltip>
            )}
          </div>
        </div>

        {realmMatches && (
          <div className="flex items-center justify-between text-[11px] px-1">
            <span className="font-semibold text-stone-700">
              {getRealmLabel(card.domain)} Realm Bonus
            </span>
            <span
              className={`font-mono tabular-nums font-bold ${
                bonusNegated ? 'text-rose-700 line-through' : 'text-emerald-700'
              }`}
            >
              {bonusNegated ? 'Pierced (0)' : `+${realmBonus}`}
            </span>
          </div>
        )}
      </div>

      {/* Four Stat Rows */}
      <div className="mt-2 space-y-1.5" role="group" aria-label={`${card.name} stats`}>
        {STAT_KEYS.map((stat) => {
          const base = card.stats[stat];
          const targetEffective = base + realmBonus;
          const displayEffective =
            countUpProgress < 1
              ? Math.round(base + (targetEffective - base) * countUpProgress)
              : targetEffective;
          const isSelected = activeStatHighlight === stat;

          if (interactive) {
            return (
              <button
                key={stat}
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectStat?.(stat);
                }}
                className={`w-full min-h-[44px] px-3 py-1.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'border-amber-600 bg-amber-200/80 text-stone-950'
                    : gambitArmed
                      ? 'border-amber-600/60 bg-amber-50 hover:bg-amber-100 text-stone-950'
                      : 'border-stone-300 bg-white/95 hover:bg-stone-100 hover:border-stone-400 text-stone-950'
                }`}
              >
                <span className="text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap">
                  <StatIcon stat={stat} className="w-3.5 h-3.5 text-stone-600" />
                  <span>{STAT_META[stat].label}</span>
                  {gambitArmed && (
                    <span className="text-[11px] font-semibold text-amber-800">
                      (Low)
                    </span>
                  )}
                </span>
                <span className="font-mono tabular-nums text-sm sm:text-base font-bold inline-flex items-baseline gap-1.5 shrink-0">
                  {realmBonus > 0 && (
                    <span className="text-[11px] font-bold text-emerald-700">
                      +{realmBonus}
                    </span>
                  )}
                  <span>{displayEffective}</span>
                </span>
              </button>
            );
          }

          return (
            <div
              key={stat}
              className={`w-full ${
                compact ? 'min-h-[30px] px-2.5 py-1' : 'min-h-[38px] px-3 py-1.5'
              } rounded-xl border flex items-center justify-between gap-2 ${
                isSelected
                  ? 'border-amber-600 bg-amber-100 text-stone-950 font-semibold'
                  : 'border-stone-300/80 bg-white/80 text-stone-800'
              }`}
            >
              <span className="text-xs sm:text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap">
                <StatIcon stat={stat} className="w-3.5 h-3.5 text-stone-600" />
                <span>{STAT_META[stat].label}</span>
              </span>
              <span className="font-mono tabular-nums text-sm sm:text-base font-bold inline-flex items-baseline gap-1.5 shrink-0">
                {realmBonus > 0 && (
                  <span className="text-[11px] font-bold text-emerald-700">
                    +{realmBonus}
                  </span>
                )}
                <span>{displayEffective}</span>
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );

  return cardContent;
}
