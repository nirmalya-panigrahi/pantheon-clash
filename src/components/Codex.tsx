import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ALL_CARDS } from '../data/cards';
import type { Pantheon, Passive, Realm } from '../types/game';
import { MythCardView } from './MythCardView';

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

export function Codex() {
  const [search, setSearch] = useState('');
  const [pantheon, setPantheon] = useState<'ALL' | Pantheon>('ALL');
  const [domain, setDomain] = useState<'ALL' | Realm>('ALL');
  const [passive, setPassive] = useState<'ALL' | Passive>('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_CARDS.filter((card) => {
      if (pantheon !== 'ALL' && card.pantheon !== pantheon) return false;
      if (domain !== 'ALL' && card.domain !== domain) return false;
      if (passive !== 'ALL' && card.passive !== passive) return false;
      if (q && !card.name.toLowerCase().includes(q) && !card.pantheon.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [search, pantheon, domain, passive]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
            Deity Codex
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Inspect all {ALL_CARDS.length} mythology cards, base stats, domains, and tactical passives.
          </p>
        </div>
        <p className="text-xs font-mono tabular-nums text-stone-400">
          Showing {filtered.length} of {ALL_CARDS.length} cards
        </p>
      </div>

      <section className="rounded-xl bg-[#161B24] border border-white/10 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deity name..."
              aria-label="Search deity name"
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-lg bg-[#0E1117] border border-white/15 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            aria-label="Filter by domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value as 'ALL' | Realm)}
            className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#0E1117] border border-white/15 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All Domains' : `${d} Domain`}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by passive"
            value={passive}
            onChange={(e) => setPassive(e.target.value as 'ALL' | Passive)}
            className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#0E1117] border border-white/15 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
          >
            {PASSIVES.map((p) => (
              <option key={p} value={p}>
                {p === 'ALL' ? 'All Passives' : p}
              </option>
            ))}
          </select>
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
                className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-amber-600 text-stone-950 font-semibold'
                    : 'bg-[#0E1117] text-stone-300 hover:text-stone-100 border border-white/10'
                }`}
              >
                {item === 'ALL' ? 'All Pantheons' : item}
              </button>
            );
          })}
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-[#161B24] border border-white/10 p-10 text-center text-sm text-stone-400">
          No mythology cards match the active filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((card) => (
            <MythCardView
              key={card.id}
              card={card}
              ownerLabel={`${card.pantheon} Pantheon`}
            />
          ))}
        </div>
      )}
    </main>
  );
}
