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
import { getRealmLabel, PantheonCrest, PassiveIcon, RealmIcon, StatIcon } from './MythEmblem';
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

const DOMAINS: ('ALL' | Realm)[] = ['ALL', 'SKY', 'UNDERWORLD', 'SEA', 'WAR'];
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
            Deity Codex
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Inspect all {ALL_CARDS.length} mythology cards across seven pantheons. Click any card for detailed breakdown.
          </p>
        </div>
        <p className="text-xs font-mono tabular-nums text-amber-300/90">
          Showing {filtered.length} of {ALL_CARDS.length} deities
        </p>
      </div>

      <section className="rounded-2xl bg-[#131826]/90 border border-white/10 p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deity name..."
              aria-label="Search deity name"
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-[#0B0E17] border border-white/15 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <select
            aria-label="Filter by domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value as 'ALL' | Realm)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B0E17] border border-white/15 text-sm text-stone-100 focus:outline-none focus:border-amber-400"
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All Realms' : `${getRealmLabel(d)} Domain`}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by passive"
            value={passive}
            onChange={(e) => setPassive(e.target.value as 'ALL' | Passive)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B0E17] border border-white/15 text-sm text-stone-100 focus:outline-none focus:border-amber-400"
          >
            {PASSIVES.map((p) => (
              <option key={p} value={p}>
                {p === 'ALL' ? 'All Passives' : PASSIVE_META[p].label}
              </option>
            ))}
          </select>

          <div className="relative">
            <ArrowUpDown
              className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              aria-label="Sort cards"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-[#0B0E17] border border-white/15 text-sm text-stone-100 focus:outline-none focus:border-amber-400"
            >
              <option value="default">Sort: Roster Order</option>
              <option value="name">Sort: Name (A–Z)</option>
              <option value="might">Sort: Highest Might</option>
              <option value="arcana">Sort: Highest Arcana</option>
              <option value="cunning">Sort: Highest Cunning</option>
              <option value="influence">Sort: Highest Influence</option>
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
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  active
                    ? 'bg-amber-500 text-stone-950 font-semibold'
                    : 'bg-[#0B0E17] text-stone-300 hover:text-stone-100 border border-white/10'
                }`}
              >
                {item === 'ALL' ? 'All Pantheons' : item}
              </button>
            );
          })}
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#131826]/90 border border-white/10 p-10 text-center text-sm text-stone-400">
          No mythology cards match the active filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((card) => (
            <Card
              key={card.id}
              card={card}
              ownerLabel={`${card.pantheon}`}
              highlightedStat={
                sortBy !== 'default' && sortBy !== 'name' ? sortBy : null
              }
              onClickCard={() => setSelectedCard(card)}
            />
          ))}
        </div>
      )}

      {/* Card Detail Modal */}
      <Modal
        open={Boolean(selectedCard)}
        onClose={() => setSelectedCard(null)}
        title={selectedCard ? `${selectedCard.name} — ${selectedCard.pantheon}` : 'Deity Details'}
        maxWidthClass="max-w-xl"
      >
        {selectedCard && (
          <div className="space-y-5">
            <div
              className={`rounded-2xl bg-gradient-to-br ${
                PANTHEON_THEMES[selectedCard.pantheon].artGradient
              } border border-white/15 p-4`}
            >
              <PantheonCrest
                pantheon={selectedCard.pantheon}
                domain={selectedCard.domain}
                size="lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={REALM_THEMES[selectedCard.domain].badgeTone}>
                <RealmIcon realm={selectedCard.domain} className="w-3.5 h-3.5" />
                {getRealmLabel(selectedCard.domain)} Realm
              </Badge>
              <Badge tone="neutral">
                Tier {'★'.repeat(selectedCard.tier)}
              </Badge>
              {selectedCard.passive !== 'NONE' && (
                <Badge tone="gold">
                  <PassiveIcon passive={selectedCard.passive} className="w-3.5 h-3.5" />
                  {PASSIVE_META[selectedCard.passive].label}
                </Badge>
              )}
            </div>

            <div className="rounded-xl bg-[#0D111C] border border-white/10 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Base Attributes (+15 when {getRealmLabel(selectedCard.domain)} Realm is active)
              </h4>
              <div className="space-y-2.5">
                {STAT_KEYS.map((stat) => {
                  const val = selectedCard.stats[stat];
                  return (
                    <div key={stat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 text-stone-200 font-medium">
                          <StatIcon stat={stat} className="w-3.5 h-3.5 text-amber-300" />
                          {STAT_META[stat].label}
                        </span>
                        <span className="font-mono tabular-nums font-bold text-stone-100">
                          {val} <span className="text-emerald-400 text-[11px]">({val + 15} boosted)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                          style={{ width: `${Math.min(100, val)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-[#0D111C] border border-white/10 p-4 space-y-1">
              <p className="text-xs font-semibold text-amber-300">
                Passive Ability: {PASSIVE_META[selectedCard.passive].label}
              </p>
              <p className="text-xs text-stone-300 leading-relaxed">
                {PASSIVE_META[selectedCard.passive].tooltip}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
