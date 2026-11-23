import { Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Button, Modal } from './ui';

interface SettingsModalProps {
  open: boolean;
  muted: boolean;
  reducedMotion: boolean;
  onToggleMuted: () => void;
  onToggleReducedMotion: () => void;
  onClose: () => void;
}

export function SettingsModal({
  open,
  muted,
  reducedMotion,
  onToggleMuted,
  onToggleReducedMotion,
  onClose,
}: SettingsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Arena Settings" maxWidthClass="max-w-md">
      <div className="space-y-4">
        <div className="rounded-xl bg-[#0D111C] border border-white/10 p-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-stone-100 inline-flex items-center gap-2">
              {muted ? (
                <VolumeX className="w-4 h-4 text-stone-400" aria-hidden="true" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-300" aria-hidden="true" />
              )}
              Sound Effects
            </p>
            <p className="text-xs text-stone-400">
              Synthesized audio cues for card flips, clash results, and passives.
            </p>
          </div>
          <Button
            variant={muted ? 'secondary' : 'primary'}
            size="sm"
            role="switch"
            aria-checked={!muted}
            onClick={onToggleMuted}
          >
            {muted ? 'Muted' : 'Sound On'}
          </Button>
        </div>

        <div className="rounded-xl bg-[#0D111C] border border-white/10 p-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-stone-100 inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" aria-hidden="true" />
              Reduced Motion
            </p>
            <p className="text-xs text-stone-400">
              Minimizes card tilt, flip animations, and skips round delay timers.
            </p>
          </div>
          <Button
            variant={reducedMotion ? 'primary' : 'secondary'}
            size="sm"
            role="switch"
            aria-checked={reducedMotion}
            onClick={onToggleReducedMotion}
          >
            {reducedMotion ? 'Enabled' : 'Standard'}
          </Button>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
