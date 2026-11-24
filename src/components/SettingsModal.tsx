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
    <Modal open={open} onClose={onClose} title="Settings" maxWidthClass="max-w-md">
      <div className="space-y-3">
        <div className="rounded-xl glass-panel-md p-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white inline-flex items-center gap-2">
              {muted ? (
                <VolumeX className="w-4 h-4 text-white/70" aria-hidden="true" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-200" aria-hidden="true" />
              )}
              Sound
            </p>
            <p className="text-xs text-white/75">Audio cues for card flips and clashes.</p>
          </div>
          <Button
            variant={muted ? 'secondary' : 'primary'}
            size="sm"
            role="switch"
            aria-checked={!muted}
            onClick={onToggleMuted}
          >
            {muted ? 'Muted' : 'On'}
          </Button>
        </div>

        <div className="rounded-xl glass-panel-md p-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-200" aria-hidden="true" />
              Reduced Motion
            </p>
            <p className="text-xs text-white/75">Skips card animations and delays.</p>
          </div>
          <Button
            variant={reducedMotion ? 'primary' : 'secondary'}
            size="sm"
            role="switch"
            aria-checked={reducedMotion}
            onClick={onToggleReducedMotion}
          >
            {reducedMotion ? 'On' : 'Off'}
          </Button>
        </div>

        <div className="pt-1 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
