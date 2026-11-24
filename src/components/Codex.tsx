import { useMemo, useState } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import { ALL_CARDS } from '../data/cards';
import { STAT_KEYS } from '../engine/gameEngine';
import {
  PANTHEON_THEMES,
  PASSIVE_META,
  REALM_THEMES,
  STAT_META,
} from '../theme/pantheons';
import type { MythCard, Pantheon, Passive, Realm, StatKey } from '../types/game';
import { Card } from './Card';
import { DeityArt, getRealmLabel, PassiveIcon, RealmIcon, StatIcon } from './MythEmblem';
import { Badge, Modal } from './ui';

const PANTHEONS: ('ALL' | Pantheon)[] = [
  'ALL',
  'Greek',
  'Norse',
  'Hindu',
  'Egyptian',
  'Japanese',
  'Celtic',
  'Mesoamerican',
];

const DOMAINS: ('ALL' | Realm)[] = ['ALL', 'SKY', 'NETHER', 'SEA', 'WAR'];
const PASSIVES: ('ALL' | Passive)[] = ['ALL', 'PIERCING', 'PROPHECY', 'RESURRECTION', 'NONE'];

type SortOption = 'default' | 'name' | StatKey;

export function Codex() {
  const [search, setSearch] = useState('');
  const [pantheon, setPantheon] = useState<'ALL' | Pantheon>('ALL');
  const [domain, setDomain] = useState<'ALL' | Realm>('ALL');
  const [passive, setPassive] = useState<'ALL' | Passive>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [selectedCard, setSelectedCard] = useState<MythCard | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = ALL_CARDS.filter((card) => {
      if (pantheon !== 'ALL' && card.pantheon !== pantheon) return false;
      if (domain !== 'ALL' && card.domain !== domain) return false;
      if (passive !== 'ALL' && card.passive !== passive) return false;
      if (q && !card.name.toLowerCase().includes(q) && !card.pantheon.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    if (sortBy === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy !== 'default') {
      return [...list].sort((a, b) => b.stats[sortBy] - a.stats[sortBy]);
    }
    return list;
  }, [search, pantheon, domain, passive, sortBy]);

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Deity Codex
          </h1>
          <p className="text-sm text-white/75 mt-0.5">
            60 deities across seven pantheons. Click any card for details.
          </p>
        </div>
        <p className="text-xs font-mono tabular-nums text-amber-200">
          Showing {filtered.length} of {ALL_CARDS.length} deities
        </p>
      </div>

      <section className="rounded-2xl glass-panel p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-white/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deity..."
              aria-label="Search deity name"
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-black/30 border border-white/20 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-amber-300"
            />
          </div>

          <select
            aria-label="Filter by domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value as 'ALL' | Realm)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black/40 border border-white/20 text-sm text-white focus:outline-none focus:border-amber-300"
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d} className="bg-slate-900 text-white">
                {d === 'ALL' ? 'All Realms' : `${getRealmLabel(d)} Domain`}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by passive"
            value={passive}
            onChange={(e) => setPassive(e.target.value as 'ALL' | Passive)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black/40 border border-white/20 text-sm text-white focus:outline-none focus:border-amber-300"
          >
            {PASSIVES.map((p) => (
              <option key={p} value={p} className="bg-slate-900 text-white">
                {p === 'ALL' ? 'All Passives' : PASSIVE_META[p].label}
              </option>
            ))}
          </select>

          <div className="relative">
            <ArrowUpDown
              className="w-4 h-4 text-white/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              aria-label="Sort cards"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-black/40 border border-white/20 text-sm text-white focus:outline-none focus:border-amber-300"
            >
              <option value="default" className="bg-slate-900 text-white">
                Sort: Roster Order
              </option>
              <option value="name" className="bg-slate-900 text-white">
                Sort: Name (A–Z)
              </option>
              <option value="might" className="bg-slate-900 text-white">
                Sort: Highest Might
              </option>
              <option value="arcana" className="bg-slate-900 text-white">
                Sort: Highest Arcana
              </option>
              <option value="cunning" className="bg-slate-900 text-white">
                Sort: Highest Cunning
              </option>
              <option value="influence" className="bg-slate-900 text-white">
                Sort: Highest Influence
              </option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by pantheon">
          {PANTHEONS.map((item) => {
            const active = pantheon === item;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPantheon(item)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                  active
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : 'bg-white/10 text-white/85 hover:bg-white/20 border border-white/20 backdrop-blur-md'
                }`}
              >
                {item === 'ALL' ? 'All Pantheons' : item}
              </button>
            );
          })}
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-2xl glass-panel p-10 text-center text-sm text-white/80">
          No mythology cards match the active filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((card) => (
            <Card
              key={card.id}
              card={card}
              highlightedStat={
                sortBy !== 'default' && sortBy !== 'name' ? sortBy : null
              }
              onClickCard={() => setSelectedCard(card)}
            />
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selectedCard)}
        onClose={() => setSelectedCard(null)}
        title={selectedCard ? `${selectedCard.name} — ${selectedCard.pantheon}` : 'Deity'}
        maxWidthClass="max-w-lg"
      >
        {selectedCard && (
          <div className="space-y-4">
            <div className="relative rounded-xl border border-[#b8892b]/60 bg-[#050506] p-4 h-44 flex items-center justify-center overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 50%, ${
                    PANTHEON_THEMES[selectedCard.pantheon].accentHex
                  }33 0%, rgba(5,5,6,0.9) 100%)`,
                }}
              />
              <div className="relative z-10 h-full w-full flex items-center justify-center">
                <DeityArt card={selectedCard} size="lg" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={REALM_THEMES[selectedCard.domain].badgeTone}>
                <RealmIcon realm={selectedCard.domain} className="w-3.5 h-3.5" />
                {getRealmLabel(selectedCard.domain)}
              </Badge>
              <Badge tone="neutral">Tier {'★'.repeat(selectedCard.tier)}</Badge>
              {selectedCard.passive !== 'NONE' && (
                <Badge tone="gold">
                  <PassiveIcon passive={selectedCard.passive} className="w-3.5 h-3.5" />
                  {PASSIVE_META[selectedCard.passive].label}
                </Badge>
              )}
            </div>

            <div className="rounded-xl glass-panel-md p-4 space-y-2.5">
              {STAT_KEYS.map((stat) => {
                const val = selectedCard.stats[stat];
                return (
                  <div key={stat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 text-white font-medium">
                        <StatIcon stat={stat} className="w-3.5 h-3.5 text-amber-300" />
                        {STAT_META[stat].label}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-white">
                        {val}{' '}
                        <span className="text-amber-200 text-[11px]">({val + 15} Realm)</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                        style={{ width: `${Math.min(100, val)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl glass-panel-md p-3.5">
              <p className="text-xs text-white/90">
                <strong className="text-amber-200">
                  {PASSIVE_META[selectedCard.passive].label}:
                </strong>{' '}
                {PASSIVE_META[selectedCard.passive].shortSummary}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
