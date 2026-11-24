import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Bot, PlusCircle, RefreshCw, Shield, Swords, Users } from 'lucide-react';
import { getRealmForRound } from '../engine/gameEngine';
import { parseSeedInput } from '../engine/prng';
import type { AuthState } from '../hooks/useAuth';
import { REALM_THEMES } from '../theme/pantheons';
import type { FirestoreMatchDocument, PlayerCount, TeamMode } from '../types/game';
import { getRealmLabel, RealmIcon } from './MythEmblem';
import { Badge, Button } from './ui';

export interface SoloLaunchConfig {
  seed: number;
}

export interface CreateRoomConfig {
  seed: number;
  maxPlayers: PlayerCount;
  teamMode: TeamMode;
  fillWithBots: boolean;
}

interface LobbyProps {
  authState: AuthState;
  lobbies: FirestoreMatchDocument[];
  lobbiesLoading: boolean;
  lobbiesError: string | null;
  sweptCount: number;
  creatingMatch: boolean;
  joiningMatchId: string | null;
  lobbyActionError: string | null;
  initialRoomCode?: string;
  onStartSolo: (config: SoloLaunchConfig) => void;
  onCreateMultiplayer: (config: CreateRoomConfig) => Promise<void>;
  onJoinMultiplayer: (matchIdOrCode: string) => Promise<void>;
  onSweepStale: () => Promise<void>;
}

const SEAT_COUNTS: PlayerCount[] = [2, 3, 4];

function formatLobbyAge(createdAt: unknown): string {
  if (
    createdAt &&
    typeof createdAt === 'object' &&
    'toMillis' in createdAt &&
    typeof (createdAt as { toMillis: () => number }).toMillis === 'function'
  ) {
    const mins = Math.max(
      0,
      Math.floor((Date.now() - (createdAt as { toMillis: () => number }).toMillis()) / 60000),
    );
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  }
  return 'Open';
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
  initialRoomCode = '',
  onStartSolo,
  onCreateMultiplayer,
  onJoinMultiplayer,
  onSweepStale,
}: LobbyProps) {
  const [seedText, setSeedText] = useState('202601');

  const [roomMaxPlayers, setRoomMaxPlayers] = useState<PlayerCount>(2);
  const [roomTeamMode, setRoomTeamMode] = useState<TeamMode>('ffa');
  const [fillWithBots, setFillWithBots] = useState<boolean>(true);
  const [onlinePanelMode, setOnlinePanelMode] = useState<'join' | 'create'>(
    initialRoomCode ? 'join' : 'create',
  );

  const normalizedInitialChars = initialRoomCode
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
    .split('');
  const [codeChars, setCodeChars] = useState<string[]>(() =>
    Array.from({ length: 6 }, (_, i) => normalizedInitialChars[i] ?? ''),
  );
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [fallbackMatchId, setFallbackMatchId] = useState('');

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
    onStartSolo({ seed: parsedSeed });
  };

  const handleCreateRoom = () => {
    void onCreateMultiplayer({
      seed: parsedSeed,
      maxPlayers: roomMaxPlayers,
      teamMode: roomMaxPlayers === 4 ? roomTeamMode : 'ffa',
      fillWithBots,
    });
  };

  const handleCodeCharChange = (index: number, raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) {
      setCodeChars((prev) => prev.map((c, idx) => (idx === index ? '' : c)));
      return;
    }

    if (clean.length > 1) {
      const nextChars = [...codeChars];
      for (let i = 0; i < clean.length && index + i < 6; i += 1) {
        nextChars[index + i] = clean[i];
      }
      setCodeChars(nextChars);
      const focusIdx = Math.min(5, index + clean.length);
      codeRefs.current[focusIdx]?.focus();
      return;
    }

    setCodeChars((prev) => prev.map((c, idx) => (idx === index ? clean : c)));
    if (index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeChars[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      codeRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData
      .getData('text')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, i) => pasted[i] ?? '');
    setCodeChars(next);
    codeRefs.current[Math.min(5, pasted.length)]?.focus();
  };

  const joinedRoomCode = codeChars.join('');

  const handleJoinRoomSubmit = (e: FormEvent) => {
    e.preventDefault();
    const target = joinedRoomCode.length === 6 ? joinedRoomCode : fallbackMatchId.trim();
    if (!target) return;
    void onJoinMultiplayer(target);
  };

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Hero */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="max-w-2xl space-y-2.5">
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-white tracking-tight text-balance">
            Pantheon Clash
          </h1>
          <p className="text-sm sm:text-base text-white/80">
            Seeded myth trump duels—2P vs Bot or up to 4 players online.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Card: Solo 2P vs Bot */}
        <section className="glass-panel rounded-2xl p-5 sm:p-7 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  Play vs Bot
                </h2>
                <p className="text-xs sm:text-sm text-white/75 mt-1">
                  2-player offline duel (30 cards each).
                </p>
              </div>
              <Swords className="w-5 h-5 text-amber-300 shrink-0 mt-1" aria-hidden="true" />
            </div>

            <form onSubmit={handleSoloSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="match-seed-input"
                  className="block text-xs font-medium text-white/85 mb-1.5"
                >
                  Match Seed
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="match-seed-input"
                    type="text"
                    value={seedText}
                    onChange={(e) => setSeedText(e.target.value)}
                    placeholder="202601"
                    className="glass-panel-md flex-1 min-h-[44px] px-3.5 py-2 rounded-xl text-white placeholder:text-white/45 font-mono text-sm focus:outline-none focus:border-amber-300"
                  />
                  <Button type="button" variant="secondary" onClick={handleRandomizeSeed}>
                    New Seed
                  </Button>
                </div>
              </div>

              <div className="glass-panel-md rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-white/75">
                  <span>Realm Order (+15)</span>
                  <span>Every 3 rounds</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {realmPreview.map((slot) => (
                    <div
                      key={slot.label}
                      className={`rounded-xl border px-2.5 py-2 flex items-center justify-between gap-1.5 text-xs backdrop-blur-md ${REALM_THEMES[slot.realm].bannerClass}`}
                    >
                      <span className="font-mono tabular-nums text-white/85">{slot.label}</span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${REALM_THEMES[slot.realm].textClass}`}
                      >
                        <RealmIcon realm={slot.realm} className="w-3.5 h-3.5" />
                        {getRealmLabel(slot.realm)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full">
                <Bot className="w-4 h-4" aria-hidden="true" />
                Play vs Bot
              </Button>
            </form>
          </div>
        </section>

        {/* Right Card: 2–4 Player Online Rooms */}
        <section className="glass-panel rounded-2xl p-5 sm:p-7 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  Online Rooms (2–4P)
                </h2>
                <p className="text-xs sm:text-sm text-white/75 mt-1">
                  Create a 2–4 seat room or join by 6-character code.
                </p>
              </div>
              <Users className="w-5 h-5 text-amber-300 shrink-0 mt-1" aria-hidden="true" />
            </div>

            {authState.error && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-400/40 bg-rose-500/15 backdrop-blur-md p-3.5 text-xs sm:text-sm text-rose-100 flex items-start justify-between gap-3"
              >
                <span>{authState.error}</span>
                <button
                  type="button"
                  onClick={authState.clearError}
                  className="text-xs font-semibold text-white underline shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {lobbyActionError && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-400/40 bg-rose-500/15 backdrop-blur-md p-3.5 text-xs sm:text-sm text-rose-100"
              >
                {lobbyActionError}
              </div>
            )}

            {!authState.isConfigured ? (
              <div className="glass-panel-md rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      Online rooms unavailable
                    </p>
                    <p className="text-xs text-white/75">
                      Play vs Bot and the 60-card Codex work offline.
                    </p>
                  </div>
                </div>
              </div>
            ) : !authState.user ? (
              <div className="glass-panel-md rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      Sign in for online rooms
                    </p>
                    <p className="text-xs text-white/75">
                      Join with Google or continue as a guest.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <Button
                    variant="primary"
                    disabled={authState.signingIn || authState.loading}
                    onClick={() => void authState.loginWithGoogle()}
                    className="flex-1"
                  >
                    Sign in with Google
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={authState.signingIn || authState.loading}
                    onClick={() => void authState.loginAsGuest()}
                    className="flex-1"
                  >
                    Continue as Guest
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="glass-panel-md rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white/70">Player:</span>
                    <span className="font-semibold text-white truncate">
                      {authState.displayName}
                    </span>
                    <Badge tone="neutral">
                      {authState.user.isAnonymous ? 'Guest' : 'Google'}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onSweepStale()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    Sweep Stale
                  </button>
                </div>

                {sweptCount > 0 && (
                  <p className="text-xs text-white/75 font-mono tabular-nums">
                    Cleaned {sweptCount} stale {sweptCount === 1 ? 'lobby' : 'lobbies'}.
                  </p>
                )}

                {/* Create Room vs Join Room Switcher */}
                <div
                  role="tablist"
                  aria-label="Room action mode"
                  className="glass-panel-md grid grid-cols-2 gap-2 p-1 rounded-2xl"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={onlinePanelMode === 'create'}
                    onClick={() => setOnlinePanelMode('create')}
                    className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      onlinePanelMode === 'create'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" aria-hidden="true" />
                    Create Room
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={onlinePanelMode === 'join'}
                    onClick={() => setOnlinePanelMode('join')}
                    className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      onlinePanelMode === 'join'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <Users className="w-4 h-4" aria-hidden="true" />
                    Join Room
                  </button>
                </div>

                {onlinePanelMode === 'create' ? (
                  <div className="glass-panel-md rounded-2xl p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="block text-xs font-medium text-white/85 mb-1.5">
                          Seats (2–4P)
                        </span>
                        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Room seat count">
                          {SEAT_COUNTS.map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => {
                                setRoomMaxPlayers(cnt);
                                if (cnt !== 4) setRoomTeamMode('ffa');
                              }}
                              className={`min-h-[38px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                                roomMaxPlayers === cnt
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : 'bg-white/10 text-white border-white/20 hover:bg-white/15'
                              }`}
                            >
                              {cnt} Seats
                            </button>
                          ))}
                        </div>
                      </div>

                      {roomMaxPlayers === 4 && (
                        <div>
                          <span className="block text-xs font-medium text-white/85 mb-1.5">
                            Format
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setRoomTeamMode('ffa')}
                              className={`min-h-[38px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                                roomTeamMode === 'ffa'
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : 'bg-white/10 text-white border-white/20 hover:bg-white/15'
                              }`}
                            >
                              FFA
                            </button>
                            <button
                              type="button"
                              onClick={() => setRoomTeamMode('teams')}
                              className={`min-h-[38px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                                roomTeamMode === 'teams'
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : 'bg-white/10 text-white border-white/20 hover:bg-white/15'
                              }`}
                            >
                              2v2 Teams
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <label className="flex items-center justify-between gap-3 rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 cursor-pointer">
                      <span className="text-xs text-white font-medium">
                        Fill empty seats with bots
                      </span>
                      <input
                        type="checkbox"
                        checked={fillWithBots}
                        onChange={(e) => setFillWithBots(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                      />
                    </label>

                    <Button
                      variant="primary"
                      size="lg"
                      disabled={creatingMatch}
                      onClick={handleCreateRoom}
                      className="w-full"
                    >
                      {creatingMatch ? 'Opening Room...' : `Create ${roomMaxPlayers}-Player Room`}
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleJoinRoomSubmit}
                    className="glass-panel-md rounded-2xl p-4 space-y-3"
                  >
                    <label className="block text-xs font-medium text-white/85">
                      6-Character Room Code
                    </label>
                    <div
                      className="grid grid-cols-6 gap-1.5 sm:gap-2"
                      role="group"
                      aria-label="Room code input"
                    >
                      {codeChars.map((char, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            codeRefs.current[idx] = el;
                          }}
                          type="text"
                          inputMode="text"
                          maxLength={6}
                          value={char}
                          aria-label={`Room code character ${idx + 1}`}
                          onChange={(e) => handleCodeCharChange(idx, e.target.value)}
                          onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                          onPaste={handleCodePaste}
                          className="h-12 w-full rounded-xl bg-white/10 border border-white/20 backdrop-blur-md text-center font-mono text-lg font-bold uppercase text-amber-200 focus:outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300"
                        />
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={fallbackMatchId}
                        onChange={(e) => setFallbackMatchId(e.target.value)}
                        placeholder="Or paste Match ID..."
                        aria-label="Join by Match ID"
                        className="flex-1 min-w-0 min-h-[40px] px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/45 font-mono text-xs focus:outline-none focus:border-amber-300"
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={
                          (joinedRoomCode.length < 6 && !fallbackMatchId.trim()) ||
                          joiningMatchId !== null
                        }
                      >
                        Join Room
                      </Button>
                    </div>
                  </form>
                )}

                {/* Open Waiting Rooms List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/75">
                    <span>Open Rooms</span>
                    <span className="font-mono tabular-nums">{lobbies.length} available</span>
                  </div>

                  {lobbiesLoading ? (
                    <div className="glass-panel-md rounded-2xl p-5 text-center text-xs text-white/75">
                      Loading rooms...
                    </div>
                  ) : lobbiesError ? (
                    <div className="rounded-2xl bg-rose-500/15 border border-rose-400/35 backdrop-blur-md p-4 text-xs text-rose-100">
                      Unable to load rooms: {lobbiesError}
                    </div>
                  ) : lobbies.length === 0 ? (
                    <div className="glass-panel-md rounded-2xl p-5 text-center text-xs text-white/75">
                      No open rooms right now.
                    </div>
                  ) : (
                    <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {lobbies.map((lobby) => {
                        const isSelfSeated = lobby.players.some(
                          (p) => p.uid === authState.user?.uid,
                        );
                        const seatedCount = lobby.players.filter((p) => p.uid !== null).length;
                        const isFull = seatedCount >= lobby.maxPlayers;
                        const isJoining = joiningMatchId === lobby.matchId;
                        const hostName = lobby.players[0]?.name ?? 'Host';

                        return (
                          <li
                            key={lobby.matchId}
                            className="glass-panel-md rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-white truncate">
                                  {hostName}
                                </p>
                                {lobby.roomCode && (
                                  <Badge tone="gold">{lobby.roomCode}</Badge>
                                )}
                                {lobby.teamMode === 'teams' && (
                                  <Badge tone="sky">2v2</Badge>
                                )}
                              </div>
                              <p className="text-xs text-white/70 font-mono tabular-nums truncate">
                                {seatedCount}/{lobby.maxPlayers} seats · Seed {lobby.matchSeed} ·{' '}
                                {formatLobbyAge(lobby.createdAt)}
                              </p>
                            </div>
                            <Button
                              variant={isSelfSeated ? 'ghost' : 'secondary'}
                              size="sm"
                              disabled={isSelfSeated || isFull || isJoining}
                              onClick={() => void onJoinMultiplayer(lobby.matchId)}
                            >
                              {isSelfSeated
                                ? 'Your Lobby'
                                : isFull
                                  ? 'Full'
                                  : isJoining
                                    ? 'Joining...'
                                    : 'Join Match'}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/15 text-xs text-white/70">
            Empty rooms close automatically when all players leave.
          </div>
        </section>
      </div>
    </main>
  );
}
