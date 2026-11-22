import { PassiveIcon, RealmIcon } from './MythEmblem';

interface RulesViewProps {
  onBackToLobby: () => void;
}

export function RulesView({ onBackToLobby }: RulesViewProps) {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
            Rules & Mechanics
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Deterministic resolution rules for Pantheon Clash.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToLobby}
          className="min-h-[44px] px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm whitespace-nowrap shrink-0 cursor-pointer"
        >
          Back to Lobby
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-xl bg-[#161B24] border border-white/10 p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-stone-100">
            01. Core Clash Loop
          </h2>
          <p className="text-sm text-stone-300 leading-relaxed">
            A 60-card roster is shuffled using Mulberry32 from the match seed and dealt 30 cards each. On their turn, the active player chooses one of four stats: Might, Arcana, Cunning, or Influence.
          </p>
          <p className="text-sm text-stone-300 leading-relaxed">
            The higher effective value wins both top cards (placed at the bottom of the winner's deck) and leads the next round. First player to capture all cards wins.
          </p>
        </section>

        <section className="rounded-xl bg-[#161B24] border border-white/10 p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-stone-100">
            02. Rotating Realms (+15 Bonus)
          </h2>
          <p className="text-sm text-stone-300 leading-relaxed">
            Every 3 rounds, the active realm rotates deterministically across Sky, Underworld, Sea, and War. Cards matching the active realm gain +15 to all four stats for that round.
          </p>
          <div className="pt-1 flex flex-wrap gap-4 text-xs text-stone-300">
            <span className="inline-flex items-center gap-1.5">
              <RealmIcon realm="SKY" className="w-4 h-4 text-amber-400" /> Sky
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RealmIcon realm="UNDERWORLD" className="w-4 h-4 text-violet-400" /> Underworld
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RealmIcon realm="SEA" className="w-4 h-4 text-sky-400" /> Sea
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RealmIcon realm="WAR" className="w-4 h-4 text-red-400" /> War
            </span>
          </div>
        </section>

        <section className="rounded-xl bg-[#161B24] border border-white/10 p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-stone-100">
            03. Deity Passives
          </h2>
          <ul className="space-y-2.5 text-sm text-stone-300">
            <li className="flex items-start gap-2.5">
              <PassiveIcon passive="PIERCING" className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
              <span>
                <strong className="text-stone-100">Piercing:</strong> Negates the opponent's +15 realm bonus for that clash.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <PassiveIcon passive="PROPHECY" className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
              <span>
                <strong className="text-stone-100">Prophecy:</strong> Reveals one seeded stat of the opponent's top card before you choose.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <PassiveIcon passive="RESURRECTION" className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
              <span>
                <strong className="text-stone-100">Resurrection:</strong> Once per match, if this card loses a clash, it returns to the bottom of its owner's deck instead of being captured.
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-xl bg-[#161B24] border border-white/10 p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-stone-100">
            04. Gambit & War Pot Ties
          </h2>
          <p className="text-sm text-stone-300 leading-relaxed">
            <strong className="text-stone-100">Gambit (Once per Match):</strong> The active player may arm Gambit before selecting a stat to invert the clash so the lowest effective value wins.
          </p>
          <p className="text-sm text-stone-300 leading-relaxed">
            <strong className="text-stone-100">War Pot:</strong> Equal effective stats push both cards into the War Pot. The next round's winner claims the entire pot alongside that round's cards.
          </p>
        </section>
      </div>
    </main>
  );
}
