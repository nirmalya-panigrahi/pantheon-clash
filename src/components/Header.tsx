export type AppScreen = 'lobby' | 'arena' | 'codex' | 'rules';

interface HeaderProps {
  screen: AppScreen;
  hasActiveMatch: boolean;
  isSignedIn: boolean;
  signingIn: boolean;
  onNavigate: (screen: AppScreen) => void;
  onAuthAction: () => void;
}

export function Header({
  screen,
  hasActiveMatch,
  isSignedIn,
  signingIn,
  onNavigate,
  onAuthAction,
}: HeaderProps) {
  const navItems: { id: AppScreen; label: string }[] = [
    { id: 'lobby', label: 'Lobby' },
    ...(hasActiveMatch ? [{ id: 'arena' as const, label: 'Arena' }] : []),
    { id: 'codex', label: 'Codex' },
    { id: 'rules', label: 'Rules' },
  ];

  return (
    <header className="border-b border-white/10 bg-[#0E1117]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('lobby')}
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-stone-100 hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-500"
        >
          Pantheon Clash
        </button>

        <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 focus-visible:outline-2 focus-visible:outline-amber-500 ${
                  active
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-stone-300 hover:text-stone-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            disabled={signingIn}
            onClick={onAuthAction}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            {signingIn ? 'Signing In...' : isSignedIn ? 'Sign Out' : 'Sign In'}
          </button>
        </div>
      </div>
    </header>
  );
}
