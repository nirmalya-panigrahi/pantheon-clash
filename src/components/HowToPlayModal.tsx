import { REALM_BONUS, ROUNDS_PER_REALM, MAX_ROUNDS } from '../engine/gameEngine';
import { PASSIVE_META, REALM_THEMES } from '../theme/pantheons';
import type { Passive, Realm } from '../types/game';
import { PassiveIcon, RealmIcon } from './MythEmblem';
import { Badge, Button, Modal } from './ui';

interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
}

const REALMS_LIST: Realm[] = ['SKY', 'UNDERWORLD', 'SEA', 'WAR'];
const PASSIVES_LIST: Passive[] = ['PIERCING', 'PROPHECY', 'RESURRECTION'];

export function HowToPlayModal({ open, onClose }: HowToPlayModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="How to Play Pantheon Clash" maxWidthClass="max-w-2xl">
      <div className="space-y-5 text-sm text-stone-300 leading-relaxed">
        <section className="space-y-2">
          <h3 className="font-display text-base font-bold text-amber-300">
            1. Deal &amp; Core Clash (2–4 Players)
          </h3>
          <p>
            All 60 deities are shuffled using a deterministic Mulberry32 seed and dealt evenly
            (30 each for 2 players, 20 each for 3 players, or 15 each for 4 players).
          </p>
          <p>
            The active leader chooses one stat—<strong className="text-stone-100">Might</strong>,{' '}
            <strong className="text-stone-100">Arcana</strong>,{' '}
            <strong className="text-stone-100">Cunning</strong>, or{' '}
            <strong className="text-stone-100">Influence</strong>. Every active player flips their
            top card. Highest effective value wins all played cards plus any cards in the War Pot
            and takes the next turn.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-base font-bold text-amber-300">
            2. Rotating Realms (+{REALM_BONUS} Domain Bonus)
          </h3>
          <p>
            The battlefield realm rotates deterministically every {ROUNDS_PER_REALM} rounds.
            Cards whose domain matches the active realm gain{' '}
            <span className="font-mono font-bold text-emerald-300">+{REALM_BONUS}</span> to all
            four stats for that clash.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {REALMS_LIST.map((r) => (
              <div
                key={r}
                className={`rounded-xl border px-3 py-2 flex items-center gap-2 text-xs ${REALM_THEMES[r].bannerClass}`}
              >
                <RealmIcon realm={r} className={`w-4 h-4 ${REALM_THEMES[r].textClass}`} />
                <span className={`font-semibold ${REALM_THEMES[r].textClass}`}>
                  {REALM_THEMES[r].label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-base font-bold text-amber-300">
            3. Tactical Passives
          </h3>
          <div className="space-y-2">
            {PASSIVES_LIST.map((p) => (
              <div
                key={p}
                className="rounded-xl bg-[#0D111C] border border-white/10 p-3 flex items-start gap-3"
              >
                <Badge tone="gold" className="shrink-0 mt-0.5">
                  <PassiveIcon passive={p} className="w-3.5 h-3.5" />
                  {PASSIVE_META[p].label}
                </Badge>
                <p className="text-xs text-stone-300">{PASSIVE_META[p].tooltip}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-base font-bold text-amber-300">
            4. Gambit, War Pots &amp; Modes
          </h3>
          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-stone-300">
            <li>
              <strong className="text-stone-100">Gambit (Once per Match):</strong> Arm Gambit on
              your turn to invert the clash so the <em>lowest</em> effective stat wins.
            </li>
            <li>
              <strong className="text-stone-100">War Pot Ties:</strong> If two or more top
              contenders tie for the winning value, all played cards move into the War Pot and the
              turn rotates clockwise.
            </li>
            <li>
              <strong className="text-stone-100">2v2 Teams &amp; Round Cap:</strong> In 4-player
              games you can enable 2v2 Teams (Seats 1 &amp; 3 vs Seats 2 &amp; 4). Matches also
              conclude after {MAX_ROUNDS} rounds, awarding victory by total cards held.
            </li>
          </ul>
        </section>

        <div className="pt-2 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Got It
          </Button>
        </div>
      </div>
    </Modal>
  );
}
