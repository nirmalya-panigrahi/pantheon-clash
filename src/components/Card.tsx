import { DEITY_NUMBER_BY_ID } from '../data/deityImages';
import { getStatBonusForRealm, REALM_BONUS, STAT_KEYS } from '../engine/gameEngine';
import { PANTHEON_THEMES, PASSIVE_META, STAT_META } from '../theme/pantheons';
import type { MythCard, ProphecyHint, Realm, StatKey } from '../types/game';
import { DeityArt, getRealmLabel, RealmIcon, StatIcon } from './MythEmblem';
import { Tooltip } from './ui';

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
  selected?: boolean;
  actionLabel?: string;
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
  selected = false,
  actionLabel,
  onSelectStat,
  onClickCard,
}: CardProps) {
  if (faceDown) {
    return (
      <article
        aria-label={`${ownerLabel ?? 'Opponent'} hidden card`}
        className={`w-full ${
          compact ? 'max-w-[220px]' : 'max-w-[330px]'
        } aspect-[5/7] mx-auto p-[6px] rounded-[18px] gold-glitter-frame shadow-[0_14px_34px_rgba(0,0,0,0.65)] select-none`}
      >
        <div className="h-full w-full rounded-[12px] bg-[#0b0b0c] p-3.5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-[10px] font-condensed uppercase tracking-widest text-[#b8892b] border-b border-[#b8892b]/35 pb-1.5">
            <span className="truncate">{ownerLabel ?? 'Opponent'}</span>
            <span>Veiled</span>
          </div>

          <div className="my-2 flex-1 rounded-lg border border-[#b8892b]/45 bg-[#050506] p-3 flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden">
            <div className="w-12 h-12 rounded-full border border-[#f0d27a]/45 bg-[#161207] flex items-center justify-center text-[#f0d27a]">
              <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7" aria-hidden="true">
                <polygon
                  points="20,4 34,20 20,36 6,20"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="currentColor"
                  fillOpacity="0.12"
                />
                <circle cx="20" cy="20" r="3.5" fill="currentColor" />
              </svg>
            </div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-[#f0d27a]">
              Pantheon Clash
            </p>

            {prophecyHint && (
              <div
                data-testid="prophecy-reveal"
                className="w-full rounded-lg border border-[#f0d27a]/60 bg-[#151107] px-2.5 py-2 text-left"
              >
                <div className="flex items-center justify-between text-[10px] font-condensed uppercase tracking-wider text-[#f0d27a]">
                  <span>Prophecy</span>
                  <span>{STAT_META[prophecyHint.stat].label}</span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="text-[11px] text-[#b8892b]">Revealed</span>
                  <span className="font-display tabular-nums text-base font-bold text-[#f0d27a]">
                    {prophecyHint.effectiveValue}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] font-condensed uppercase tracking-[0.2em] text-[#b8892b] text-center border-t border-[#b8892b]/35 pt-1.5">
            Gold Idol Edition
          </div>
        </div>
      </article>
    );
  }

  const pTheme = PANTHEON_THEMES[card.pantheon];
  const passiveInfo = PASSIVE_META[card.passive];
  const tierStars = '★'.repeat(card.tier);
  const cardNumber = DEITY_NUMBER_BY_ID[card.id] ?? '00/60';
  const realmMatches = activeRealm === card.domain;
  const activeStatHighlight = selectedStat ?? highlightedStat;

  const baseRealmBonus = activeRealm ? getStatBonusForRealm(card, activeRealm, 'cunning', bonusNegated) : 0;
  const displayBonus = realmBonus > 0 ? realmBonus : baseRealmBonus;

  const outcomeOuterClass =
    outcomeState === 'winner'
      ? 'ring-2 ring-[#f5d77a] shadow-[0_0_32px_rgba(245,215,122,0.5)]'
      : outcomeState === 'loser'
        ? 'grayscale opacity-65 shadow-lg'
        : selected
          ? 'ring-2 ring-[#f5d77a] -translate-y-1 shadow-[0_0_26px_rgba(245,215,122,0.4)]'
          : 'shadow-[0_14px_34px_rgba(0,0,0,0.65)]';

  const hoverClasses =
    interactive || onClickCard
      ? 'hover:-translate-y-1.5 md:hover:rotate-[0.5deg] transition-transform duration-200'
      : 'transition-all duration-200';

  const bonusBoxValue = bonusNegated
    ? 'Pierced'
    : displayBonus > 0
      ? `+${displayBonus}`
      : realmMatches
        ? `+${REALM_BONUS}`
        : '—';

  return (
    <article
      aria-label={`${card.name} card`}
      onClick={onClickCard}
      className={`w-full ${
        compact ? 'max-w-[232px]' : 'max-w-[330px]'
      } aspect-[5/7] mx-auto p-[6px] rounded-[18px] gold-glitter-frame ${outcomeOuterClass} ${hoverClasses} ${
        onClickCard ? 'cursor-pointer' : ''
      }`}
    >
      <div className="h-full w-full rounded-[12px] bg-[#0b0b0c] text-[#f5f0e4] px-2.5 py-2 flex flex-col justify-between gap-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 border-b border-[#b8892b]/50 pb-1 shrink-0">
          <h3 className="font-display text-sm sm:text-[15px] font-bold uppercase tracking-[0.09em] text-[#f0d27a] truncate leading-tight">
            {card.name}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="font-display text-[11px] text-[#f0d27a] tracking-tight"
              aria-label={`Tier ${card.tier}`}
            >
              {tierStars}
            </span>
            <span
              title={`${getRealmLabel(card.domain)} Domain`}
              className="w-5 h-5 rounded-full border border-[#f0d27a]/80 bg-[#1a1407] text-[#f0d27a] flex items-center justify-center shrink-0"
            >
              <RealmIcon realm={card.domain} className="w-3 h-3" />
            </span>
          </div>
        </header>

        {/* Art Panel */}
        <div
          className={`relative w-full ${
            compact ? 'aspect-[2/1]' : 'aspect-[2/1]'
          } rounded-lg border border-[#b8892b]/65 bg-[#050506] overflow-hidden flex items-center justify-center px-4 py-1 shrink-0`}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, ${pTheme.accentHex}33 0%, rgba(5,5,6,0.18) 55%, rgba(5,5,6,0.88) 100%)`,
            }}
          />
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <DeityArt card={card} size={compact ? 'sm' : 'md'} />
          </div>
          <span className="absolute left-1.5 bottom-1 z-20 font-display italic text-[10px] text-[#f0d27a]/90 pointer-events-none">
            {card.pantheon}
          </span>
          <span
            aria-hidden="true"
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 [writing-mode:vertical-rl] rotate-180 font-condensed text-[8px] uppercase tracking-[0.2em] text-[#b8892b]/85 pointer-events-none"
          >
            {card.pantheon}
          </span>
        </div>

        {/* Info Strip (Full Card Only) */}
        {!compact && (
          <div className="flex items-center justify-between gap-1 px-1 py-0.5 font-condensed text-[10px] uppercase tracking-wider text-[#b8892b] border-b border-[#b8892b]/35 shrink-0">
            <span className="truncate">{card.pantheon}</span>
            <span aria-hidden="true" className="text-[#b8892b]/50">|</span>
            <span className="truncate">{getRealmLabel(card.domain)}</span>
            <span aria-hidden="true" className="text-[#b8892b]/50">|</span>
            <span className="truncate">
              {card.passive === 'NONE' ? 'Standard' : passiveInfo.label}
            </span>
            <span aria-hidden="true" className="text-[#b8892b]/50">|</span>
            <span className="tabular-nums text-[#f0d27a] shrink-0">No. {cardNumber}</span>
          </div>
        )}

        {/* Four Stat Rows */}
        <div
          className="divide-y divide-[#b8892b]/30 border-b border-[#b8892b]/40 flex-1 flex flex-col justify-center"
          role="group"
          aria-label={`${card.name} stats`}
        >
          {STAT_KEYS.map((stat) => {
            const base = card.stats[stat];
            const statBonus = activeRealm
              ? getStatBonusForRealm(card, activeRealm, stat, bonusNegated)
              : realmBonus;
            const targetEffective = base + statBonus;
            const displayEffective =
              countUpProgress < 1
                ? Math.round(base + (targetEffective - base) * countUpProgress)
                : targetEffective;
            const isSelected = activeStatHighlight === stat;

            const rowHighlight = isSelected
              ? 'bg-[#f0d27a]/20 shadow-[inset_0_0_12px_rgba(240,210,122,0.28)]'
              : gambitArmed && interactive
                ? 'bg-[#f0d27a]/10 hover:bg-[#f0d27a]/20'
                : interactive
                  ? 'hover:bg-[#f0d27a]/10'
                  : '';

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
                  className={`w-full min-h-[44px] px-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f5d77a] disabled:opacity-45 disabled:cursor-not-allowed ${rowHighlight}`}
                >
                  <span className="font-display text-xs sm:text-sm text-[#f5f0e4] inline-flex items-center gap-1.5 whitespace-nowrap">
                    <StatIcon stat={stat} className="w-3.5 h-3.5 text-[#f0d27a]" />
                    <span>{STAT_META[stat].label}</span>
                    {gambitArmed && (
                      <span className="font-condensed text-[10px] uppercase tracking-wider text-[#f5d77a]">
                        (Low)
                      </span>
                    )}
                  </span>
                  <span className="font-display tabular-nums text-base sm:text-lg font-bold text-[#f0d27a] inline-flex items-baseline gap-1 shrink-0">
                    {bonusNegated ? (
                      <span className="text-[11px] font-normal text-[#b8892b] line-through opacity-45">
                        +{REALM_BONUS}
                      </span>
                    ) : statBonus > 0 ? (
                      <span className="text-[11px] font-semibold text-[#f5d77a]">
                        +{statBonus}
                      </span>
                    ) : null}
                    <span>{displayEffective}</span>
                  </span>
                </button>
              );
            }

            return (
              <div
                key={stat}
                className={`w-full ${
                  compact ? 'min-h-[26px] px-1.5 py-0.5' : 'min-h-[30px] px-2 py-0.5'
                } flex items-center justify-between gap-2 ${rowHighlight}`}
              >
                <span className="font-display text-[11px] sm:text-xs text-[#f5f0e4] inline-flex items-center gap-1.5 whitespace-nowrap">
                  <StatIcon stat={stat} className="w-3 h-3 text-[#f0d27a]" />
                  <span>{STAT_META[stat].label}</span>
                </span>
                <span
                  className={`font-display tabular-nums ${
                    compact ? 'text-sm' : 'text-base sm:text-lg'
                  } font-bold text-[#f0d27a] inline-flex items-baseline gap-1 shrink-0`}
                >
                  {bonusNegated ? (
                    <span className="text-[10px] font-normal text-[#b8892b] line-through opacity-45">
                      +{REALM_BONUS}
                    </span>
                  ) : statBonus > 0 ? (
                    <span className="text-[10px] font-semibold text-[#f5d77a]">
                      +{statBonus}
                    </span>
                  ) : null}
                  <span>{displayEffective}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Bottom 3 Gold Boxes (Full Card Only) */}
        {!compact && (
          <div className="grid grid-cols-3 gap-1.5 pt-0.5 shrink-0">
            <div className="rounded border border-[#b8892b]/55 bg-[#12100a] px-1.5 py-1 text-center">
              <p className="font-condensed text-[8px] uppercase tracking-widest text-[#b8892b]">
                Realm
              </p>
              <p className="font-condensed text-[11px] font-semibold text-[#f0d27a] truncate">
                {getRealmLabel(card.domain)}
              </p>
            </div>

            <div className="rounded border border-[#b8892b]/55 bg-[#12100a] px-1.5 py-1 text-center flex flex-col items-center justify-center">
              <p className="font-condensed text-[8px] uppercase tracking-widest text-[#b8892b]">
                Passive
              </p>
              {card.passive === 'NONE' ? (
                <p className="font-condensed text-[11px] font-semibold text-[#f0d27a]">—</p>
              ) : (
                <Tooltip content={passiveInfo.tooltip}>
                  <span className="font-condensed text-[11px] font-semibold text-[#f0d27a] underline decoration-[#b8892b]/60 decoration-dotted">
                    {passiveInfo.label}
                  </span>
                </Tooltip>
              )}
            </div>

            <div className="rounded border border-[#b8892b]/55 bg-[#12100a] px-1.5 py-1 text-center">
              <p className="font-condensed text-[8px] uppercase tracking-widest text-[#b8892b]">
                Bonus
              </p>
              <p
                className={`font-condensed text-[11px] font-semibold truncate ${
                  bonusNegated ? 'text-[#b8892b]/65 line-through' : 'text-[#f0d27a]'
                }`}
              >
                {bonusBoxValue}
              </p>
            </div>
          </div>
        )}

        {/* Footer / Action Hint */}
        {actionLabel ? (
          <footer className="text-center font-condensed text-[10px] font-bold uppercase tracking-[0.18em] text-[#0b0b0c] bg-[#f0d27a] rounded py-1 shrink-0">
            {actionLabel}
          </footer>
        ) : (
          !compact && (
            <footer className="text-center font-condensed text-[9px] uppercase tracking-[0.16em] text-[#b8892b] pt-0.5 shrink-0">
              Pantheon Clash · No. {cardNumber} · {tierStars}
            </footer>
          )
        )}
      </div>
    </article>
  );
}
