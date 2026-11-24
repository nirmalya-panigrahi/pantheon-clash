import { MAX_ROUNDS, REALM_BONUS, ROUNDS_PER_REALM } from '../engine/gameEngine';
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
            Clash
          </h3>
          <p className="text-xs sm:text-sm text-white/85">
            60 deities split evenly (2P Solo vs Bot, or 2–4P Online). Pick a stat; highest value takes all played cards and the War Pot.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-sm font-bold text-amber-200 uppercase tracking-wider">
            Realms (+{REALM_BONUS} every {ROUNDS_PER_REALM} rounds)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {REALMS_LIST.map((r) => (
              <div
                key={r}
                className="rounded-xl glass-panel-md px-3 py-2 flex items-center gap-2 text-xs"
              >
                <RealmIcon realm={r} className={`w-4 h-4 ${REALM_THEMES[r].textClass}`} />
                <span className="font-semibold text-white">{REALM_THEMES[r].label}</span>
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
            Gambit &amp; Caps
          </h3>
          <p className="text-xs text-white/85">
            Gambit inverts one round (lowest wins). Ties feed the War Pot. Matches cap at {MAX_ROUNDS} rounds; 4P rooms support 2v2 Teams.
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
