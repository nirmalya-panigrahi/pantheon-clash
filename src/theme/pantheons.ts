import type { Pantheon, Passive, Realm, StatKey } from '../types/game';

export interface PantheonTheme {
  label: string;
  primary: string;
  secondary: string;
  borderClass: string;
  headerGradient: string;
  artGradient: string;
  glowShadow: string;
  badgeText: string;
  accentHex: string;
}

export const PANTHEON_THEMES: Record<Pantheon, PantheonTheme> = {
  Greek: {
    label: 'Greek',
    primary: '#38BDF8',
    secondary: '#E2E8F0',
    borderClass: 'border-sky-400/60',
    headerGradient: 'from-sky-950 via-slate-900 to-sky-900',
    artGradient: 'from-sky-900/50 via-slate-100/80 to-sky-100/90',
    glowShadow: 'shadow-[0_0_24px_rgba(56,189,248,0.22)]',
    badgeText: 'text-sky-200',
    accentHex: '#0284C7',
  },
  Norse: {
    label: 'Norse',
    primary: '#7DD3FC',
    secondary: '#64748B',
    borderClass: 'border-cyan-300/55',
    headerGradient: 'from-slate-900 via-cyan-950 to-slate-800',
    artGradient: 'from-cyan-900/35 via-slate-200/85 to-slate-300/90',
    glowShadow: 'shadow-[0_0_24px_rgba(125,211,252,0.22)]',
    badgeText: 'text-cyan-200',
    accentHex: '#0369A1',
  },
  Hindu: {
    label: 'Hindu',
    primary: '#FB923C',
    secondary: '#E879F9',
    borderClass: 'border-orange-400/60',
    headerGradient: 'from-orange-950 via-fuchsia-950 to-amber-950',
    artGradient: 'from-orange-200/80 via-amber-100/90 to-fuchsia-200/75',
    glowShadow: 'shadow-[0_0_24px_rgba(251,146,60,0.25)]',
    badgeText: 'text-orange-200',
    accentHex: '#C2410C',
  },
  Egyptian: {
    label: 'Egyptian',
    primary: '#FACC15',
    secondary: '#2DD4BF',
    borderClass: 'border-amber-400/65',
    headerGradient: 'from-amber-950 via-stone-900 to-teal-950',
    artGradient: 'from-amber-200/85 via-amber-100/90 to-teal-200/70',
    glowShadow: 'shadow-[0_0_24px_rgba(250,204,21,0.25)]',
    badgeText: 'text-amber-200',
    accentHex: '#B45309',
  },
  Japanese: {
    label: 'Japanese',
    primary: '#F43F5E',
    secondary: '#1E293B',
    borderClass: 'border-rose-500/60',
    headerGradient: 'from-rose-950 via-neutral-950 to-slate-900',
    artGradient: 'from-rose-200/70 via-stone-100/95 to-slate-200/85',
    glowShadow: 'shadow-[0_0_24px_rgba(244,63,94,0.22)]',
    badgeText: 'text-rose-200',
    accentHex: '#BE123C',
  },
  Celtic: {
    label: 'Celtic',
    primary: '#10B981',
    secondary: '#065F46',
    borderClass: 'border-emerald-400/60',
    headerGradient: 'from-emerald-950 via-stone-900 to-teal-950',
    artGradient: 'from-emerald-200/75 via-stone-100/90 to-teal-100/85',
    glowShadow: 'shadow-[0_0_24px_rgba(16,185,129,0.22)]',
    badgeText: 'text-emerald-200',
    accentHex: '#047857',
  },
  Mesoamerican: {
    label: 'Mesoamerican',
    primary: '#34D399',
    secondary: '#0F172A',
    borderClass: 'border-teal-400/60',
    headerGradient: 'from-teal-950 via-slate-950 to-emerald-950',
    artGradient: 'from-teal-200/75 via-stone-200/85 to-emerald-200/75',
    glowShadow: 'shadow-[0_0_24px_rgba(52,211,153,0.24)]',
    badgeText: 'text-teal-200',
    accentHex: '#0F766E',
  },
};

export interface RealmTheme {
  label: string;
  description: string;
  badgeTone: 'sky' | 'underworld' | 'sea' | 'war';
  bannerClass: string;
  textClass: string;
}

export const REALM_THEMES: Record<Realm, RealmTheme> = {
  SKY: {
    label: 'Sky',
    description: '+15 to all stats for Sky deities',
    badgeTone: 'sky',
    bannerClass: 'border-amber-400/40 bg-amber-500/12',
    textClass: 'text-amber-300',
  },
  UNDERWORLD: {
    label: 'Underworld',
    description: '+15 to all stats for Underworld deities',
    badgeTone: 'underworld',
    bannerClass: 'border-violet-400/40 bg-violet-500/12',
    textClass: 'text-violet-300',
  },
  SEA: {
    label: 'Sea',
    description: '+15 to all stats for Sea deities',
    badgeTone: 'sea',
    bannerClass: 'border-sky-400/40 bg-sky-500/12',
    textClass: 'text-sky-300',
  },
  WAR: {
    label: 'War',
    description: '+15 to all stats for War deities',
    badgeTone: 'war',
    bannerClass: 'border-rose-400/40 bg-rose-500/12',
    textClass: 'text-rose-300',
  },
};

export const STAT_META: Record<
  StatKey,
  { label: string; shortLabel: string; description: string }
> = {
  might: {
    label: 'Might',
    shortLabel: 'MGT',
    description: 'Raw physical strength and combat prowess.',
  },
  arcana: {
    label: 'Arcana',
    shortLabel: 'ARC',
    description: 'Mystical command, cosmos, and divine sorcery.',
  },
  cunning: {
    label: 'Cunning',
    shortLabel: 'CUN',
    description: 'Strategy, guile, foresight, and trickery.',
  },
  influence: {
    label: 'Influence',
    shortLabel: 'INF',
    description: 'Sovereignty, worship, and authority over mortals.',
  },
};

export const PASSIVE_META: Record<
  Passive,
  { label: string; shortSummary: string; tooltip: string }
> = {
  NONE: {
    label: 'Standard',
    shortSummary: 'Pure stat clash with no passive modifier.',
    tooltip: 'No passive ability.',
  },
  PIERCING: {
    label: 'Piercing',
    shortSummary: 'Negates all opponents’ +15 realm bonuses.',
    tooltip: 'Piercing: Ignores the +15 active realm bonus on all opponents’ cards during this clash.',
  },
  PROPHECY: {
    label: 'Prophecy',
    shortSummary: 'Reveals 1 stat of a chosen opponent’s top card.',
    tooltip: 'Prophecy: Before picking a stat, choose any opponent to reveal one seeded stat of their top card.',
  },
  RESURRECTION: {
    label: 'Resurrection',
    shortSummary: 'Returns to deck bottom on first clash loss.',
    tooltip: 'Resurrection: Once per match, if this card loses a clash, it returns to the bottom of your deck instead of being captured.',
  },
};
