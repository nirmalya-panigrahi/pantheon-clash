import { ROUNDS_PER_REALM } from '../engine/gameEngine';
import { PASSIVE_META, REALM_THEMES } from '../theme/pantheons';
import type { Passive, Realm } from '../types/game';
import { PassiveIcon, RealmIcon } from './MythEmblem';
import { Badge, Button, Modal } from './ui';

interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
}

const REALMS_LIST: Realm[] = ['SKY', 'NETHER', 'SEA', 'WAR'];
const PASSIVES_LIST: Passive[] = ['PIERCING', 'PROPHECY', 'RESURRECTION'];

export function HowToPlayModal({ open, onClose }: HowToPlayModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="How to Play" maxWidthClass="max-w-xl">
      <div className="space-y-4 text-sm text-white/90 leading-relaxed">
        <section className="space-y-1">
          <h3 className="font-display text-sm font-bold text-amber-200 uppercase tracking-wider">
            3-Card Hand &amp; Clashes
          </h3>
          <p className="text-xs sm:text-sm text-white/85">
            Hold up to 3 deities in hand. On Attack, pick any deity and stat to challenge. On Defense, pick 1 of your 3 deities to counter that stat. Highest effective stat scores Trophies!
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-sm font-bold text-amber-200 uppercase tracking-wider">
            Realms (rotate every {ROUNDS_PER_REALM} rounds)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REALMS_LIST.map((r) => (
              <div
                key={r}
                className="rounded-xl glass-panel-md px-3 py-2 flex items-start gap-2.5 text-xs"
              >
                <RealmIcon realm={r} className={`w-4 h-4 shrink-0 mt-0.5 ${REALM_THEMES[r].textClass}`} />
                <div>
                  <p className="font-semibold text-white">{REALM_THEMES[r].label}</p>
                  <p className="text-[11px] text-white/75">{REALM_THEMES[r].ruleSummary}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-sm font-bold text-amber-200 uppercase tracking-wider">
            Passives
          </h3>
          <div className="space-y-1.5">
            {PASSIVES_LIST.map((p) => (
              <div
                key={p}
                className="rounded-xl glass-panel-md p-2.5 flex items-center gap-3"
              >
                <Badge tone="gold" className="shrink-0">
                  <PassiveIcon passive={p} className="w-3.5 h-3.5" />
                  {PASSIVE_META[p].label}
                </Badge>
                <p className="text-xs text-white/85">{PASSIVE_META[p].shortSummary}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-1">
          <h3 className="font-display text-sm font-bold text-amber-200 uppercase tracking-wider">
            Formats &amp; Gambit
          </h3>
          <p className="text-xs text-white/85">
            Default Blitz runs 12 rounds (most Trophies wins). Standard runs 15 rounds, and Classic War runs 60 rounds with deck capture. Gambit inverts one clash (lowest wins, disabled in War).
          </p>
        </section>

        <div className="pt-1 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Got It
          </Button>
        </div>
      </div>
    </Modal>
  );
}
