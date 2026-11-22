import { useState, type FormEvent } from 'react';
import { RefreshCw, Shield, Swords, Users } from 'lucide-react';
import { getRealmForRound } from '../engine/gameEngine';
import { parseSeedInput } from '../engine/prng';
import type { AuthState } from '../hooks/useAuth';
import type { FirestoreMatchDocument } from '../types/game';
import { getRealmLabel, RealmIcon } from './MythEmblem';

interface LobbyProps {
  authState: AuthState;
  lobbies: FirestoreMatchDocument[];
  lobbiesLoading: boolean;
  lobbiesError: string | null;
  sweptCount: number;
  creatingMatch: boolean;
  joiningMatchId: string | null;
  lobbyActionError: string | null;
  onStartSolo: (seed: number) => void;
  onCreateMultiplayer: (seed: number) => Promise<void>;
  onJoinMultiplayer: (matchId: string) => Promise<void>;
  onSweepStale: () => Promise<void>;
}

function formatLobbyAge(createdAt: unknown): string {
  if (
    createdAt &&
    typeof createdAt === 'object' &&
    'toMillis' in createdAt &&
    typeof (createdAt as { toMillis: () => number }).toMillis === 'function'
  ) {
    const mins = Math.max(0, Math.floor((Date.now() - (createdAt as { toMillis: () => number }).toMillis()) / 60000));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  }
  return 'Active';
}

export function Lobby({
  authState,
  lobbies,
  lobbiesLoading,
  lobbiesError,
  sweptCount,
  creatingMatch,
  joiningMatchId,
  lobbyActionError,
  onStartSolo,
  onCreateMultiplayer,
  onJoinMultiplayer,
  onSweepStale,
}: LobbyProps) {
  const [seedText, setSeedText] = useState('202601');
  const [joinIdInput, setJoinIdInput] = useState('');

  const parsedSeed = parseSeedInput(seedText);
  const realmPreview = [1, 4, 7, 10].map((roundStart) => ({
    label: `R${roundStart}–${roundStart + 2}`,
    realm: getRealmForRound(parsedSeed, roundStart),
  }));

  const handleRandomizeSeed = () => {
    const next = ((parsedSeed * 1664525 + 1013904223) >>> 0) % 1000000;
    setSeedText(String(next || 424242));
  };

  const handleSoloSubmit = (e: FormEvent) => {
    e.preventDefault();
    onStartSolo(parsedSeed);
  };

  const handleJoinByCode = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = joinIdInput.trim();
    if (!cleaned) return;
    void onJoinMultiplayer(cleaned);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <section className="max-w-3xl space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-100 tracking-tight text-balance">
          Deterministic Mythology Trump Card Duels
        </h1>
        <p className="text-sm sm:text-base text-stone-300 leading-relaxed">
          Draw from a 60-deity roster across seven pantheons. Every deck shuffle, realm shift, and bot decision is driven strictly by a Mulberry32 seeded PRNG.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: Solo vs Deterministic Bot */}
        <section className="rounded-xl bg-[#161B24] border border-white/10 p-6 sm:p-7 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-stone-100">
                  Solo Match vs Bot
                </h2>
                <p className="text-xs sm:text-sm text-stone-400 mt-1">
                  Instant 30-vs-30 card clash with reproducible seed order.
                </p>
              </div>
              <Swords className="w-5 h-5 text-amber-400 shrink-0 mt-1" aria-hidden="true" />
            </div>

            <form onSubmit={handleSoloSubmit} className="space-y-4">
              <div>
                <label htmlFor="match-seed-input" className="block text-xs font-medium text-stone-300 mb-1.5">
                  Match Seed (number or phrase)
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="match-seed-input"
                    type="text"
                    value={seedText}
                    onChange={(e) => setSeedText(e.target.value)}
                    placeholder="202601"
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg bg-[#0E1117] border border-white/15 text-stone-100 font-mono text-sm focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleRandomizeSeed}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-white/15 bg-[#1D2430] hover:bg-[#252D3B] text-stone-200 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    New Seed
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-stone-400 font-mono tabular-nums">
                  Normalized Seed: {parsedSeed}
                </p>
              </div>

              <div className="rounded-lg bg-[#0E1117] border border-white/10 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>Seeded Realm Schedule (+15 Bonus)</span>
                  <span>Rotates every 3 rounds</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {realmPreview.map((slot) => (
                    <div
                      key={slot.label}
                      className="rounded-md bg-[#161B24] border border-white/8 px-2.5 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-mono tabular-nums text-stone-400">{slot.label}</span>
                      <span className="inline-flex items-center gap-1 font-medium text-stone-200">
                        <RealmIcon realm={slot.realm} className="w-3.5 h-3.5 text-amber-400" />
                        {getRealmLabel(slot.realm)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Play vs Bot
              </button>
            </form>
          </div>

          <div className="pt-4 border-t border-white/10 text-xs text-stone-400 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>60 Cards</span>
            <span aria-hidden="true">·</span>
            <span>4 Stats</span>
            <span aria-hidden="true">·</span>
            <span>Once-Per-Match Gambit</span>
            <span aria-hidden="true">·</span>
            <span>War Pot Ties</span>
          </div>
        </section>

        {/* Right: 2-Player Firestore Multiplayer */}
        <section className="rounded-xl bg-[#161B24] border border-white/10 p-6 sm:p-7 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-stone-100">
                  2-Player Online Arena
                </h2>
                <p className="text-xs sm:text-sm text-stone-400 mt-1">
                  Real-time Firestore lobbies with automatic presence cleanup.
                </p>
              </div>
              <Users className="w-5 h-5 text-amber-400 shrink-0 mt-1" aria-hidden="true" />
            </div>

            {authState.error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/35 bg-red-500/10 p-3.5 text-xs sm:text-sm text-red-200 flex items-start justify-between gap-3"
              >
                <span>{authState.error}</span>
                <button
                  type="button"
                  onClick={authState.clearError}
                  className="text-xs font-semibold text-red-100 underline shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {lobbyActionError && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/35 bg-red-500/10 p-3.5 text-xs sm:text-sm text-red-200"
              >
                {lobbyActionError}
              </div>
            )}

            {!authState.isConfigured ? (
              <div className="rounded-lg bg-[#0E1117] border border-white/10 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-stone-100">
                      Online multiplayer disabled on this static build
                    </p>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      No Firebase Web API key is bundled in the public repository or GitHub Pages build. Play Solo Match vs Bot, browse the 60-card Codex, or supply <code className="font-mono text-stone-300">VITE_FIREBASE_API_KEY</code> in your local <code className="font-mono text-stone-300">.env.local</code> to enable online lobbies.
                    </p>
                  </div>
                </div>
              </div>
            ) : !authState.user ? (
              <div className="rounded-lg bg-[#0E1117] border border-white/10 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-stone-100">
                      Sign in to host or join online matches
                    </p>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      Authenticate with your Google account or enter immediately as an anonymous guest.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    disabled={authState.signingIn || authState.loading}
                    onClick={() => void authState.loginWithGoogle()}
                    className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Sign in with Google
                  </button>
                  <button
                    type="button"
                    disabled={authState.signingIn || authState.loading}
                    onClick={() => void authState.loginAsGuest()}
                    className="flex-1 min-h-[44px] px-4 py-2 rounded-lg border border-white/15 bg-[#1D2430] hover:bg-[#252D3B] text-stone-100 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Continue as Guest
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#0E1117] border border-white/10 px-4 py-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-stone-400">Player:</span>
                    <span className="font-semibold text-stone-100 truncate">
                      {authState.displayName}
                    </span>
                    <span className="text-stone-500">·</span>
                    <span className="text-stone-400">
                      {authState.user.isAnonymous ? 'Guest' : 'Google'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onSweepStale()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-300 hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    Sweep Stale
                  </button>
                </div>

                {sweptCount > 0 && (
                  <p className="text-xs text-stone-400 font-mono tabular-nums">
                    Cleaned {sweptCount} stale {sweptCount === 1 ? 'lobby' : 'lobbies'} older than 2 hours.
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    disabled={creatingMatch}
                    onClick={() => void onCreateMultiplayer(parsedSeed)}
                    className="min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {creatingMatch ? 'Creating Match...' : 'Create Match'}
                  </button>

                  <form onSubmit={handleJoinByCode} className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={joinIdInput}
                      onChange={(e) => setJoinIdInput(e.target.value)}
                      placeholder="Join by Match ID"
                      aria-label="Join by Match ID"
                      className="flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-lg bg-[#0E1117] border border-white/15 text-stone-100 font-mono text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={!joinIdInput.trim() || joiningMatchId !== null}
                      className="min-h-[44px] px-4 py-2 rounded-lg border border-white/15 bg-[#1D2430] hover:bg-[#252D3B] text-stone-100 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      Join
                    </button>
                  </form>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <span>Open Waiting Lobbies</span>
                    <span className="font-mono tabular-nums">{lobbies.length} available</span>
                  </div>

                  {lobbiesLoading ? (
                    <div className="rounded-lg bg-[#0E1117] border border-white/10 p-6 text-center text-xs text-stone-400">
                      Loading active lobbies...
                    </div>
                  ) : lobbiesError ? (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-xs text-red-200">
                      Unable to load lobbies: {lobbiesError}
                    </div>
                  ) : lobbies.length === 0 ? (
                    <div className="rounded-lg bg-[#0E1117] border border-white/10 p-6 text-center text-xs text-stone-400">
                      No open lobbies right now. Create a match to invite a challenger.
                    </div>
                  ) : (
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {lobbies.map((lobby) => {
                        const isSelfHost = lobby.hostUid === authState.user?.uid;
                        const isJoining = joiningMatchId === lobby.matchId;
                        return (
                          <li
                            key={lobby.matchId}
                            className="rounded-lg bg-[#0E1117] border border-white/10 px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-stone-100 truncate">
                                {lobby.hostName}
                              </p>
                              <p className="text-xs text-stone-400 font-mono tabular-nums truncate">
                                Seed {lobby.matchSeed} · {formatLobbyAge(lobby.createdAt)}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={isSelfHost || isJoining}
                              onClick={() => void onJoinMultiplayer(lobby.matchId)}
                              className="min-h-[40px] px-4 py-1.5 rounded-lg bg-[#1D2430] hover:bg-amber-600 hover:text-stone-950 border border-white/15 text-stone-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                            >
                              {isSelfHost ? 'Your Lobby' : isJoining ? 'Joining...' : 'Join Match'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 text-xs text-stone-400">
            Closing your tab or leaving removes your UID from activePlayers and deletes empty matches automatically.
          </div>
        </section>
      </div>
    </main>
  );
}
