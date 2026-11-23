import { BookOpen, Settings, Sparkles } from 'lucide-react';
import { Button } from './ui';

export type AppScreen = 'lobby' | 'arena' | 'codex';

interface HeaderProps {
  screen: AppScreen;
  hasActiveMatch: boolean;
  isFirebaseConfigured: boolean;
  isSignedIn: boolean;
  signingIn: boolean;
  onNavigate: (screen: AppScreen) => void;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onAuthAction: () => void;
  onQuickSolo: () => void;
}

export function Header({
  screen,
  hasActiveMatch,
  isFirebaseConfigured,
  isSignedIn,
  signingIn,
  onNavigate,
  onOpenHowToPlay,
  onOpenSettings,
  onAuthAction,
  onQuickSolo,
}: HeaderProps) {
  const navItems: { id: AppScreen; label: string }[] = [
    { id: 'lobby', label: 'Lobby' },
    ...(hasActiveMatch ? [{ id: 'arena' as const, label: 'Arena' }] : []),
    { id: 'codex', label: 'Codex' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B0E17]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6">
        <button
          type="button"
          onClick={() => onNavigate('lobby')}
          className="inline-flex items-center gap-2 font-display text-base sm:text-xl font-bold tracking-tight text-stone-100 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 rounded-md"
        >
          <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </span>
          <span>Pantheon Clash</span>
        </button>

        <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-2 px-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                  active
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-stone-300 hover:text-stone-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenHowToPlay}
            aria-label="How to Play"
            className="px-2 sm:px-3"
          >
            <BookOpen className="w-4 h-4 text-amber-300" aria-hidden="true" />
            <span className="hidden md:inline">How to Play</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="px-2 sm:px-3"
          >
            <Settings className="w-4 h-4 text-stone-300" aria-hidden="true" />
            <span className="hidden lg:inline">Settings</span>
          </Button>

          {isFirebaseConfigured ? (
            <Button
              variant="primary"
              size="sm"
              disabled={signingIn}
              onClick={onAuthAction}
            >
              {signingIn ? 'Signing In...' : isSignedIn ? 'Sign Out' : 'Sign In'}
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onQuickSolo}>
              Quick Duel
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
