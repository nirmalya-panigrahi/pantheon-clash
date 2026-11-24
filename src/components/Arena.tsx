import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Bot,
  Check,
  Clock,
  Copy,
  Crown,
  Eye,
  FastForward,
  Flame,
  LogOut,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  UserCheck,
  UserX,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getCardById } from '../data/cards';
import {
  getProphecyStat,
  getProphecyStatForTarget,
  MAX_ROUNDS,
  ROUNDS_PER_REALM,
  STAT_KEYS,
} from '../engine/gameEngine';
import type { SoundCue } from '../hooks/useSound';
import { PASSIVE_META, REALM_THEMES, STAT_META } from '../theme/pantheons';
import type {
  MatchAction,
  MatchState,
  PlayerState,
  RoundOutcome,
  StatKey,
  TeamMode,
} from '../types/game';
import { Card } from './Card';
import { getRealmLabel, PassiveIcon, RealmIcon, StatIcon } from './MythEmblem';
import { Badge, Button, Tooltip } from './ui';

interface ArenaProps {
  mode: 'solo' | 'multiplayer';
  matchId?: string;
  roomCode?: string;
  matchStatus?: 'waiting' | 'active' | 'finished';
  fillWithBots?: boolean;
  state: MatchState | null;
  localSeatIndex: number;
  isHost?: boolean;
  turnSecondsRemaining?: number;
  loading?: boolean;
  submitting?: boolean;
  error?: string | null;
  history: RoundOutcome[];
  muted: boolean;
  reducedMotion?: boolean;
  onToggleMuted: () => void;
  onPlaySound: (cue: SoundCue) => void;
  onDispatch: (action: MatchAction) => void;
  onLeave: () => void;
  onToggleReady?: () => void;
  onUpdateRoomOptions?: (updates: { fillWithBots?: boolean; teamMode?: TeamMode }) => void;
  onKickSeat?: (seatIndex: number) => void;
  onStartRoom?: () => void;
  onRejoin?: () => void;
}

type ResolutionPhase = 'idle' | 'flip' | 'compare' | 'winner';

function formatOutcomeTicker(outcome: RoundOutcome, players: readonly PlayerState[]): string {
  const statLabel = STAT_META[outcome.stat].label;
  if (outcome.winnerId === 'TIE') {
    return `R${outcome.round}: Tie on ${statLabel} · War pot ${outcome.potSizeAfter}`;
  }
  const winEntry = outcome.entries.find((e) => e.playerId === outcome.winnerId);
  const winPlayer = players.find((p) => p.id === outcome.winnerId);
  const winCard = winEntry ? getCardById(winEntry.cardId) : null;
  const runnerUp = outcome.entries
    .filter((e) => e.playerId !== outcome.winnerId)
    .sort((a, b) =>
      outcome.gambitActive
        ? a.effectiveValue - b.effectiveValue
        : b.effectiveValue - a.effectiveValue,
    )[0];
  const scoreText =
    winEntry && runnerUp ? ` (${winEntry.effectiveValue} vs ${runnerUp.effectiveValue})` : '';
  const potText = outcome.potWon > 0 ? ` +${outcome.potWon} pot` : '';
  const resText = outcome.resurrectedPlayers.length > 0 ? ' · Resurrection!' : '';
  return `${winCard?.name ?? winPlayer?.name ?? outcome.winnerId} wins R${outcome.round} (${statLabel})${scoreText}${potText}${resText}`;
}

export function Arena({
  mode,
  matchId,
  roomCode,
  matchStatus = 'active',
  fillWithBots = false,
  state,
  localSeatIndex,
  isHost = false,
  turnSecondsRemaining = 20,
  loading = false,
  submitting = false,
  error = null,
  history,
  muted,
  reducedMotion = false,
  onToggleMuted,
  onPlaySound,
  onDispatch,
  onLeave,
  onToggleReady,
  onUpdateRoomOptions,
  onKickSeat,
  onStartRoom,
  onRejoin,
}: ArenaProps) {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [resolutionPhase, setResolutionPhase] = useState<ResolutionPhase>('idle');
  const [countUpProgress, setCountUpProgress] = useState(1);

  const lastOutcome = state?.lastOutcome ?? null;
  const seenRoundRef = useRef<number | null>(lastOutcome?.round ?? null);

  useEffect(() => {
    if (!lastOutcome) return;
    if (seenRoundRef.current === lastOutcome.round) return;
    seenRoundRef.current = lastOutcome.round;

    const localId = state?.players[localSeatIndex]?.id;
    if (lastOutcome.resurrectedPlayers.length > 0) {
      onPlaySound('resurrect');
    } else if (lastOutcome.winnerId === 'TIE') {
      onPlaySound('tie');
    } else if (lastOutcome.winnerId === localId) {
      onPlaySound('win');
    } else {
      onPlaySound('lose');
    }

    if (reducedMotion) {
      setResolutionPhase('idle');
      setCountUpProgress(1);
      return;
    }

    onPlaySound('flip');
    setResolutionPhase('flip');
    setCountUpProgress(0);

    const compareTimer = window.setTimeout(() => {
      setResolutionPhase('compare');
    }, 420);

    let frameId = 0;
    const startAnim = performance.now() + 420;
    const duration = 520;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - startAnim) / duration));
      setCountUpProgress(t);
      if (t < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };
    frameId = window.requestAnimationFrame(tick);

    const winnerTimer = window.setTimeout(() => {
      setResolutionPhase('winner');
      setCountUpProgress(1);
    }, 960);

    const endTimer = window.setTimeout(() => {
      setResolutionPhase('idle');
    }, 1500);

    return () => {
      window.clearTimeout(compareTimer);
      window.clearTimeout(winnerTimer);
      window.clearTimeout(endTimer);
      window.cancelAnimationFrame(frameId);
    };
  }, [lastOutcome, localSeatIndex, onPlaySound, reducedMotion, state?.players]);

  const skipAnimation = () => {
    setResolutionPhase('idle');
    setCountUpProgress(1);
  };

  const tickerMessages = useMemo(() => {
    if (!state) return [];
    const source = history.length > 0 ? history : state.lastOutcome ? [state.lastOutcome] : [];
    return source.slice(0, 4).map((item) => formatOutcomeTicker(item, state.players));
  }, [history, state]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-12">
        <div className="glass-panel rounded-2xl p-10 text-center text-sm text-white/85">
          Syncing arena...
        </div>
      </main>
    );
  }

  if (error && !state) {
    return (
      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-12">
        <div className="glass-panel rounded-2xl border-rose-400/40 p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-rose-200">Arena Error</h2>
          <p className="text-sm text-white/85">{error}</p>
          <Button variant="primary" onClick={onLeave}>
            Return to Lobby
          </Button>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-12">
        <div className="glass-panel rounded-2xl p-8 space-y-4 text-center">
          <h2 className="font-display text-xl font-bold text-white">Match Closed</h2>
          <p className="text-sm text-white/75">This session has ended.</p>
          <Button variant="primary" onClick={onLeave}>
            Return to Lobby
          </Button>
        </div>
      </main>
    );
  }

  // Multiplayer Waiting Room (2-4 seats)
  if (mode === 'multiplayer' && matchStatus === 'waiting') {
    const localPlayer = state.players[localSeatIndex];
    const seatedHumans = state.players.filter((p) => p.uid !== null);
    const allHumansReady = seatedHumans.every((p) => p.ready || p.seatIndex === 0);
    const canStart = isHost && allHumansReady && (fillWithBots || seatedHumans.length >= 2);

    const inviteUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?room=${roomCode ?? matchId ?? ''}`
        : roomCode ?? matchId ?? '';

    const handleCopyInvite = async () => {
      if (!navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedInvite(true);
        window.setTimeout(() => setCopiedInvite(false), 1800);
      } catch {
        // Ignore clipboard errors in restricted frames
      }
    };

    return (
      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-8 sm:py-10 space-y-6">
        <div className="glass-panel rounded-2xl p-5 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone="gold">Waiting Room</Badge>
                <Badge tone="neutral">{state.players.length} Seats</Badge>
                {state.teamMode === 'teams' && <Badge tone="sky">2v2 Teams</Badge>}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Room Lobby
              </h2>
              <p className="text-xs sm:text-sm text-white/75">
                Share the code below to invite challengers.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => void handleCopyInvite()}>
                {copiedInvite ? (
                  <Check className="w-4 h-4 text-emerald-300" aria-hidden="true" />
                ) : (
                  <Copy className="w-4 h-4" aria-hidden="true" />
                )}
                {copiedInvite ? 'Copied Link' : 'Copy Invite Link'}
              </Button>
            </div>
          </div>

          <div className="glass-panel-md rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-white/70">Room Code</p>
              <p className="font-mono text-2xl font-bold tracking-[0.2em] text-amber-200 mt-0.5">
                {roomCode || matchId}
              </p>
            </div>
            <div className="text-xs text-white/75 font-mono tabular-nums space-y-0.5 text-right">
              <p>ID: {matchId}</p>
              <p>
                Seed {state.matchSeed} · {getRealmLabel(state.activeRealm)}
              </p>
            </div>
          </div>

          {/* Seat Roster */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {state.players.map((seat) => {
              const isOccupied = seat.uid !== null;
              const isBotFillSlot = !isOccupied && fillWithBots;
              const initials = seat.name.slice(0, 2).toUpperCase();

              return (
                <div
                  key={seat.id}
                  className={`glass-panel-md rounded-2xl p-4 flex items-center justify-between gap-3 ${
                    isOccupied ? 'border-amber-300/40' : 'border-dashed border-white/20 opacity-85'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm shrink-0 ${
                        isOccupied
                          ? 'bg-amber-400/20 text-amber-200 border border-amber-300/45'
                          : isBotFillSlot
                            ? 'bg-sky-400/20 text-sky-200 border border-sky-300/40'
                            : 'bg-white/10 text-white/70 border border-white/20'
                      }`}
                    >
                      {isOccupied ? (
                        initials
                      ) : isBotFillSlot ? (
                        <Bot className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        seat.seatIndex + 1
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-white truncate">
                          {isOccupied
                            ? seat.name
                            : isBotFillSlot
                              ? 'Bot (Auto-Fill)'
                              : 'Open Seat'}
                        </p>
                        {seat.seatIndex === 0 && <Badge tone="gold">Host</Badge>}
                        {state.teamMode === 'teams' && (
                          <Badge tone={seat.team === 0 ? 'sky' : 'war'}>
                            {seat.team === 0 ? 'Team A' : 'Team B'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-white/70 mt-0.5">
                        {isOccupied
                          ? seat.ready || seat.seatIndex === 0
                            ? 'Ready'
                            : 'Waiting'
                          : isBotFillSlot
                            ? 'Bot joins at start'
                            : 'Open'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOccupied && (
                      <Badge tone={seat.ready || seat.seatIndex === 0 ? 'emerald' : 'neutral'}>
                        {seat.ready || seat.seatIndex === 0 ? 'Ready' : 'Not Ready'}
                      </Badge>
                    )}
                    {isHost && isOccupied && seat.seatIndex > 0 && onKickSeat && (
                      <Button
                        variant="danger"
                        size="sm"
                        aria-label={`Kick ${seat.name}`}
                        onClick={() => onKickSeat(seat.seatIndex)}
                      >
                        <UserX className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-400/40 bg-rose-500/15 backdrop-blur-md p-3.5 text-xs sm:text-sm text-rose-100"
            >
              {error}
            </div>
          )}

          {/* Room Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-white/15">
            <div className="flex flex-wrap items-center gap-3">
              {isHost && onUpdateRoomOptions && (
                <>
                  <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fillWithBots}
                      onChange={(e) => onUpdateRoomOptions({ fillWithBots: e.target.checked })}
                      className="w-4 h-4 accent-amber-400"
                    />
                    Fill empty seats with bots
                  </label>

                  {state.players.length === 4 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        onUpdateRoomOptions({
                          teamMode: state.teamMode === 'teams' ? 'ffa' : 'teams',
                        })
                      }
                    >
                      Mode: {state.teamMode === 'teams' ? '2v2 Teams' : 'Free-for-All'}
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="danger" onClick={onLeave}>
                Cancel Match
              </Button>

              {!isHost && localPlayer && onToggleReady && (
                <Button
                  variant={localPlayer.ready ? 'secondary' : 'primary'}
                  onClick={onToggleReady}
                >
                  <UserCheck className="w-4 h-4" aria-hidden="true" />
                  {localPlayer.ready ? 'Unready' : 'Mark Ready'}
                </Button>
              )}

              {isHost && onStartRoom && (
                <Button
                  variant="primary"
                  disabled={!canStart || submitting}
                  onClick={onStartRoom}
                >
                  <Play className="w-4 h-4" aria-hidden="true" />
                  {submitting ? 'Starting...' : 'Start Match'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const localPlayer = state.players[localSeatIndex] ?? state.players[0];
  const opponents = state.players.filter((p) => p.seatIndex !== localPlayer.seatIndex);
  const activeOpponents = opponents.filter((p) => !p.eliminated && p.deck.length > 0);
  const activeTurnPlayer = state.players[state.activeTurnIndex] ?? state.players[0];

  const isLocalTurn =
    state.winner === 'NONE' &&
    state.activeTurnIndex === localPlayer.seatIndex &&
    !localPlayer.eliminated &&
    localPlayer.deck.length > 0;
  const canArmGambit = isLocalTurn && !localPlayer.gambitUsed && !submitting;

  const roundsIntoRealm = ((state.round - 1) % ROUNDS_PER_REALM) + 1;
  const roundsUntilRealmChange = ROUNDS_PER_REALM - roundsIntoRealm + 1;
  const realmTheme = REALM_THEMES[state.activeRealm];

  const localTopCard = localPlayer.deck.length > 0 ? getCardById(localPlayer.deck[0]) : null;
  const localBonusDisplay =
    localTopCard && localTopCard.domain === state.activeRealm ? 15 : 0;

  const localHasProphecy = Boolean(localTopCard && localTopCard.passive === 'PROPHECY');
  const needsProphecyTargetPick =
    isLocalTurn &&
    localHasProphecy &&
    activeOpponents.length > 1 &&
    (!state.prophecyTarget || state.prophecyTarget.bySeat !== localPlayer.seatIndex);

  const singleOrChosenProphecy = getProphecyStat(state, localPlayer.seatIndex);

  const handleStatSelect = (stat: StatKey) => {
    if (!isLocalTurn || submitting) return;
    onPlaySound('pick');
    onDispatch({ type: 'PICK_STAT', playerIndex: localPlayer.seatIndex, stat });
  };

  const handleToggleGambit = () => {
    if (!canArmGambit) return;
    onPlaySound('gambit');
    onDispatch({ type: 'TOGGLE_GAMBIT', playerIndex: localPlayer.seatIndex });
  };

  const handleSelectProphecyTarget = (targetIndex: number) => {
    if (!isLocalTurn || submitting) return;
    onPlaySound('pick');
    onDispatch({
      type: 'SELECT_PROPHECY_TARGET',
      playerIndex: localPlayer.seatIndex,
      targetIndex,
    });
  };

  const winnerBannerText = (() => {
    if (state.winner === 'DRAW') return 'Draw';
    if (state.winner === 'TEAM_0') {
      const names = state.players
        .filter((p) => p.team === 0)
        .map((p) => p.name)
        .join(' & ');
      return `Team A Wins (${names})`;
    }
    if (state.winner === 'TEAM_1') {
      const names = state.players
        .filter((p) => p.team === 1)
        .map((p) => p.name)
        .join(' & ');
      return `Team B Wins (${names})`;
    }
    const winPlayer = state.players.find((p) => p.id === state.winner);
    return `${winPlayer?.name ?? state.winner} Wins`;
  })();

  const isResolving = resolutionPhase !== 'idle' && lastOutcome !== null;

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-5">
      {/* Persistent Top HUD */}
      <section className="glass-panel rounded-2xl px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-white/75">Round</span>
            <span className="font-mono tabular-nums font-bold text-white">
              {Math.min(state.round, state.maxRounds)}/{state.maxRounds}
            </span>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-xl border backdrop-blur-md px-3 py-1 ${realmTheme.bannerClass}`}
          >
            <RealmIcon realm={state.activeRealm} className={`w-4 h-4 ${realmTheme.textClass}`} />
            <span className={`font-semibold ${realmTheme.textClass}`}>
              {realmTheme.label} (+15)
            </span>
            <span className="text-[11px] font-mono tabular-nums text-white/85">
              · Changes in {roundsUntilRealmChange} {roundsUntilRealmChange === 1 ? 'round' : 'rounds'}
            </span>
          </div>

          {state.warPot.length > 0 && (
            <Badge tone="gold" className="font-mono tabular-nums">
              War Pot: {state.warPot.length}
            </Badge>
          )}

          {mode === 'multiplayer' && state.winner === 'NONE' && (
            <Badge
              tone={turnSecondsRemaining <= 5 ? 'war' : 'neutral'}
              className="font-mono tabular-nums"
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {turnSecondsRemaining}s
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMuted}
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{muted ? 'Muted' : 'Sound'}</span>
          </Button>

          <Button variant="danger" size="sm" onClick={onLeave}>
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Leave</span>
          </Button>
        </div>
      </section>

      {/* Deck Standings Strip */}
      <section className="flex flex-wrap items-center gap-2">
        {state.players.map((p) => {
          const isTurn = state.winner === 'NONE' && p.seatIndex === state.activeTurnIndex;
          const isSelf = p.seatIndex === localPlayer.seatIndex;
          return (
            <div
              key={p.id}
              className={`glass-panel-md rounded-xl px-3 py-2 text-xs flex items-center gap-2 ${
                isTurn
                  ? 'border-amber-300/65 bg-amber-400/20 text-amber-100'
                  : p.eliminated
                    ? 'opacity-55 text-white/60'
                    : 'text-white'
              }`}
            >
              <span className="font-semibold truncate max-w-[120px]">
                {p.name}
                {isSelf ? ' (You)' : ''}
              </span>
              {state.teamMode === 'teams' && (
                <Badge tone={p.team === 0 ? 'sky' : 'war'}>
                  {p.team === 0 ? 'A' : 'B'}
                </Badge>
              )}
              <span className="font-mono tabular-nums font-bold">{p.deck.length}</span>
              {p.eliminated && <span className="text-rose-300 font-medium">Out</span>}
              {p.away && !p.eliminated && <Badge tone="gold">Away</Badge>}
            </div>
          );
        })}
      </section>

      {localPlayer.away && state.winner === 'NONE' && onRejoin && (
        <div
          role="status"
          className="glass-panel-md rounded-2xl border-amber-300/50 bg-amber-400/15 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-sm text-amber-100">
            <ShieldAlert className="w-5 h-5 text-amber-200 shrink-0" aria-hidden="true" />
            <span>Marked Away after timeout. Rejoin to play.</span>
          </div>
          <Button variant="primary" size="sm" onClick={onRejoin}>
            Rejoin Match
          </Button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-400/40 bg-rose-500/15 backdrop-blur-md p-3.5 text-xs sm:text-sm text-rose-100"
        >
          {error}
        </div>
      )}

      {/* Game-Over Screen & Match Summary */}
      {state.winner !== 'NONE' && (
        <section
          aria-label="Match result"
          className="glass-panel rounded-2xl border-amber-300/45 p-6 sm:p-8 space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/45 flex items-center justify-center mx-auto text-amber-200">
              <Crown className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold text-amber-200">
              {winnerBannerText}
            </h2>
            <p className="text-xs sm:text-sm text-white/80 font-mono tabular-nums">
              Rounds: {state.lastOutcome?.round ?? state.round - 1}/{MAX_ROUNDS}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel-md rounded-2xl p-4 space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Final Standings
              </h3>
              <ul className="space-y-1.5 text-xs">
                {[...state.players]
                  .sort((a, b) => b.deck.length - a.deck.length)
                  .map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-white">
                      <span className="truncate font-medium">
                        {p.name}
                        {state.teamMode === 'teams' ? ` (Team ${p.team === 0 ? 'A' : 'B'})` : ''}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-amber-200">
                        {p.deck.length} cards · {p.roundsWon}W
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="glass-panel-md rounded-2xl p-4 space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Stat Wins
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {STAT_KEYS.map((stat) => (
                  <div
                    key={stat}
                    className="rounded-xl bg-white/10 border border-white/15 px-2.5 py-2 flex items-center justify-between"
                  >
                    <span className="inline-flex items-center gap-1.5 text-white/85">
                      <StatIcon stat={stat} className="w-3.5 h-3.5 text-amber-200" />
                      {STAT_META[stat].label}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-white">
                      {state.statWins[stat]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel-md rounded-2xl p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70 inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />
                Top Clash
              </h3>
              {state.bestWin ? (
                <div className="space-y-1 text-xs">
                  <p className="font-display text-base font-bold text-amber-200">
                    {getCardById(state.bestWin.cardId).name}
                  </p>
                  <p className="text-white/85">
                    {state.players.find((p) => p.id === state.bestWin?.playerId)?.name}
                  </p>
                  <p className="font-mono tabular-nums text-white/70">
                    {STAT_META[state.bestWin.stat].label} {state.bestWin.effectiveValue} · R
                    {state.bestWin.round}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-white/70">None recorded.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {(mode === 'solo' || isHost) && (
              <Button
                variant="primary"
                size="lg"
                onClick={() => onDispatch({ type: 'RESET_MATCH', matchSeed: state.matchSeed })}
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Rematch
              </Button>
            )}
            <Button variant="secondary" size="lg" onClick={onLeave}>
              Back to Lobby
            </Button>
          </div>
        </section>
      )}

      {/* Opponents Row (1-3 Opponents) */}
      <section aria-label="Opponents" className="space-y-2">
        <div
          className={`grid gap-4 ${
            opponents.length === 1
              ? 'grid-cols-1 max-w-sm mx-auto'
              : opponents.length === 2
                ? 'grid-cols-2 max-w-3xl mx-auto'
                : 'grid-cols-1 sm:grid-cols-3'
          }`}
        >
          {opponents.map((opp) => {
            const oppTopCard = opp.deck.length > 0 ? getCardById(opp.deck[0]) : null;
            const isProphecyTargeted =
              state.prophecyTarget?.bySeat === localPlayer.seatIndex &&
              state.prophecyTarget?.targetSeat === opp.seatIndex;
            const hintForOpp =
              state.winner !== 'NONE'
                ? null
                : activeOpponents.length === 1 && singleOrChosenProphecy
                  ? singleOrChosenProphecy
                  : isProphecyTargeted
                    ? getProphecyStatForTarget(state, localPlayer.seatIndex, opp.seatIndex)
                    : null;

            return (
              <div key={opp.id} className="space-y-2 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs text-white/85 px-1">
                  <span className="font-semibold truncate">
                    {opp.name} ({opp.deck.length})
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {opp.gambitUsed && <Badge tone="neutral">Gambit Used</Badge>}
                    {opp.resurrectionUsed && <Badge tone="neutral">Res Used</Badge>}
                  </div>
                </div>

                {oppTopCard ? (
                  <Card
                    card={oppTopCard}
                    ownerLabel={opp.name}
                    activeRealm={state.activeRealm}
                    faceDown={state.winner === 'NONE'}
                    compact={opponents.length > 1}
                    prophecyHint={hintForOpp}
                  />
                ) : (
                  <div className="glass-panel-md rounded-2xl p-6 text-center text-xs text-white/70 min-h-[200px] flex items-center justify-center">
                    {opp.eliminated ? 'Eliminated' : 'No cards'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Center Battlefield */}
      <section className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-wider text-white/70 font-semibold">
              Battlefield
            </p>
            <p className="font-display text-lg sm:text-xl font-bold text-amber-200">
              {state.winner !== 'NONE'
                ? 'Match Complete'
                : isLocalTurn
                  ? 'Your Turn — Pick a Stat'
                  : `${activeTurnPlayer.name} is Choosing...`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={localPlayer.resurrectionUsed ? 'neutral' : 'emerald'}>
              <Flame className="w-3.5 h-3.5" aria-hidden="true" />
              Resurrection: {localPlayer.resurrectionUsed ? 'Used' : 'Ready'}
            </Badge>

            {state.winner === 'NONE' && (
              <Tooltip
                content={
                  localPlayer.gambitUsed
                    ? 'Gambit already used.'
                    : 'Lowest effective stat wins this round.'
                }
              >
                <Button
                  variant={state.gambitArmed && isLocalTurn ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={!canArmGambit}
                  aria-pressed={state.gambitArmed}
                  onClick={handleToggleGambit}
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  {localPlayer.gambitUsed
                    ? 'Gambit Used'
                    : state.gambitArmed
                      ? 'Gambit Armed (Low Wins)'
                      : 'Use Gambit'}
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Multi-Opponent Prophecy Target Picker */}
        {needsProphecyTargetPick && (
          <div className="glass-panel-md rounded-2xl border-amber-300/45 bg-amber-400/15 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-100">
              <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Prophecy: Pick an opponent to spy.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeOpponents.map((opp) => (
                <Button
                  key={opp.id}
                  variant="primary"
                  size="sm"
                  onClick={() => handleSelectProphecyTarget(opp.seatIndex)}
                >
                  Spy {opp.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* ~1.5s Skippable Animated Clash Sequence */}
        {isResolving && lastOutcome && (
          <div
            data-testid="clash-resolution-stage"
            className="glass-panel-md rounded-2xl border-amber-300/45 p-4 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                <Badge tone="gold">
                  Round {lastOutcome.round} · {STAT_META[lastOutcome.stat].label}
                </Badge>
                <span>
                  {resolutionPhase === 'flip'
                    ? 'Flipping...'
                    : resolutionPhase === 'compare'
                      ? 'Comparing...'
                      : lastOutcome.winnerId === 'TIE'
                        ? 'Tie -> War Pot!'
                        : `${
                            state.players.find((p) => p.id === lastOutcome.winnerId)?.name ??
                            lastOutcome.winnerId
                          } Wins!`}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={skipAnimation}>
                <FastForward className="w-3.5 h-3.5" aria-hidden="true" />
                Skip
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {lastOutcome.entries.map((entry) => {
                const playedCard = getCardById(entry.cardId);
                const owner = state.players[entry.seatIndex];
                const isWinner =
                  resolutionPhase === 'winner' && entry.playerId === lastOutcome.winnerId;
                const isLoser =
                  resolutionPhase === 'winner' &&
                  lastOutcome.winnerId !== 'TIE' &&
                  entry.playerId !== lastOutcome.winnerId;

                return (
                  <Card
                    key={entry.playerId}
                    card={playedCard}
                    ownerLabel={owner?.name}
                    activeRealm={state.activeRealm}
                    realmBonus={entry.bonus}
                    bonusNegated={entry.pierced}
                    faceDown={resolutionPhase === 'flip'}
                    selectedStat={lastOutcome.stat}
                    outcomeState={isWinner ? 'winner' : isLoser ? 'loser' : 'neutral'}
                    countUpProgress={countUpProgress}
                    compact
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Latest Clash Summary & Event Log Ticker */}
        {lastOutcome && (
          <div
            data-testid="last-outcome-panel"
            className="glass-panel-md rounded-2xl p-4 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/75">
              <span className="font-mono tabular-nums font-semibold text-white">
                Round {lastOutcome.round} · {STAT_META[lastOutcome.stat].label}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {lastOutcome.gambitActive && <Badge tone="gold">Gambit</Badge>}
                {lastOutcome.resurrectedPlayers.length > 0 && (
                  <Badge tone="sky">
                    Resurrected:{' '}
                    {lastOutcome.resurrectedPlayers
                      .map((id) => state.players.find((p) => p.id === id)?.name ?? id)
                      .join(', ')}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {lastOutcome.entries.map((entry) => {
                const card = getCardById(entry.cardId);
                const owner = state.players[entry.seatIndex];
                const isRoundWinner = entry.playerId === lastOutcome.winnerId;
                return (
                  <div
                    key={entry.playerId}
                    className={`rounded-xl border px-3 py-2 backdrop-blur-md ${
                      isRoundWinner
                        ? 'border-amber-300/60 bg-amber-400/20'
                        : 'border-white/15 bg-white/10'
                    }`}
                  >
                    <p className="text-[11px] text-white/70 truncate">{owner?.name}</p>
                    <p className="font-semibold text-white truncate">{card.name}</p>
                    <p className="font-mono tabular-nums text-amber-200 font-bold mt-0.5">
                      {entry.effectiveValue}
                      {entry.bonus > 0 && (
                        <span className="text-emerald-300 text-[11px] ml-1">(+{entry.bonus})</span>
                      )}
                      {entry.pierced && (
                        <span className="text-rose-300 text-[11px] ml-1">(Pierced)</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>

            {tickerMessages.length > 0 && (
              <div className="pt-2 border-t border-white/15 space-y-1">
                {tickerMessages.slice(0, 3).map((msg, i) => (
                  <p
                    key={`${i}-${msg}`}
                    className={`text-xs ${i === 0 ? 'text-white font-medium' : 'text-white/70'}`}
                  >
                    {msg}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Local Player Top Card */}
      <section aria-label="Your top card" className="space-y-3">
        <div className="max-w-sm mx-auto space-y-2">
          <div className="flex items-center justify-between text-xs text-white/85 px-1">
            <span className="font-semibold">{localPlayer.name}</span>
            <span className="font-mono tabular-nums text-white/75">
              {localPlayer.deck.length} cards
            </span>
          </div>

          {localTopCard ? (
            <Card
              card={localTopCard}
              ownerLabel={localPlayer.name}
              activeRealm={state.activeRealm}
              realmBonus={localBonusDisplay}
              interactive={isLocalTurn}
              disabled={submitting}
              gambitArmed={state.gambitArmed && isLocalTurn}
              onSelectStat={handleStatSelect}
            />
          ) : (
            <div className="glass-panel-md rounded-2xl p-8 text-center text-sm text-white/75 min-h-[260px] flex items-center justify-center">
              {localPlayer.eliminated ? 'Eliminated — spectating match.' : 'No cards left.'}
            </div>
          )}

          {localTopCard && localTopCard.passive !== 'NONE' && (
            <p className="text-[11px] text-center text-white/75 inline-flex items-center justify-center gap-1.5 w-full">
              <PassiveIcon passive={localTopCard.passive} className="w-3.5 h-3.5 text-amber-200" />
              <span>{PASSIVE_META[localTopCard.passive].shortSummary}</span>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
