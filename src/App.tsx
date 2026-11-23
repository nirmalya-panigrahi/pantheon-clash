import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Arena } from './components/Arena';
import { Codex } from './components/Codex';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header, type AppScreen } from './components/Header';
import { HowToPlayModal } from './components/HowToPlayModal';
import { Lobby, type CreateRoomConfig, type SoloLaunchConfig } from './components/Lobby';
import { SettingsModal } from './components/SettingsModal';
import {
  chooseBotAction,
  createInitialMatchState,
  getDefaultBotName,
  reduceMatchState,
} from './engine/gameEngine';
import { useAuth } from './hooks/useAuth';
import { useLobbies } from './hooks/useLobbies';
import { useMultiplayerMatch } from './hooks/useMultiplayerMatch';
import { useSettings } from './hooks/useSettings';
import { useSound } from './hooks/useSound';
import { createMatchLobby, joinMatchLobby } from './services/matchService';
import type { MatchAction, MatchState, RoundOutcome } from './types/game';

interface SoloHistoryState {
  match: MatchState;
  history: RoundOutcome[];
}

function soloReducer(prev: SoloHistoryState, action: MatchAction): SoloHistoryState {
  const nextMatch = reduceMatchState(prev.match, action);
  if (action.type === 'RESET_MATCH') {
    return { match: nextMatch, history: [] };
  }
  if (nextMatch === prev.match) {
    return prev;
  }
  const nextHistory =
    nextMatch.lastOutcome && nextMatch.lastOutcome.round !== prev.match.lastOutcome?.round
      ? [nextMatch.lastOutcome, ...prev.history]
      : prev.history;
  return { match: nextMatch, history: nextHistory };
}

function getInitialRoomCodeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('room') ?? '').trim().toUpperCase();
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('lobby');
  const [activeMode, setActiveMode] = useState<'none' | 'solo' | 'multiplayer'>('none');
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
  const [lobbyActionError, setLobbyActionError] = useState<string | null>(null);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [initialRoomCode] = useState<string>(getInitialRoomCodeFromUrl);
  const autoJoinedRoomRef = useRef(false);

  const [soloState, dispatchSolo] = useReducer(soloReducer, 202601, (seed) => ({
    match: createInitialMatchState(seed, { playerCount: 2 }),
    history: [],
  }));

  const [mpHistory, setMpHistory] = useState<RoundOutcome[]>([]);
  const lastRecordedMpRound = useRef<number | null>(null);

  const authState = useAuth();
  const { muted, toggleMuted, play } = useSound(true);
  const { reducedMotion, toggleReducedMotion } = useSettings();

  const {
    lobbies,
    loading: lobbiesLoading,
    error: lobbiesError,
    sweptCount,
    runSweep,
  } = useLobbies(Boolean(authState.user));

  const multiplayer = useMultiplayerMatch(
    activeMode === 'multiplayer' ? activeMatchId : null,
    authState.user?.uid ?? null,
  );

  // Record multiplayer round outcomes locally for the event ticker.
  useEffect(() => {
    const outcome = multiplayer.match?.lastOutcome;
    if (!outcome) return;
    if (lastRecordedMpRound.current !== outcome.round) {
      lastRecordedMpRound.current = outcome.round;
      setMpHistory((prev) => [outcome, ...prev]);
    }
  }, [multiplayer.match?.lastOutcome]);

  // Deterministic Bot turn execution in Solo mode (supports 2-4 players).
  useEffect(() => {
    if (activeMode !== 'solo' || screen !== 'arena') return;
    const { match } = soloState;
    if (match.winner !== 'NONE') return;
    const activePlayer = match.players[match.activeTurnIndex];
    if (!activePlayer || !activePlayer.isBot) return;

    const timer = window.setTimeout(() => {
      const botAction = chooseBotAction(match);
      if (botAction) {
        dispatchSolo(botAction);
      }
    }, reducedMotion ? 150 : 600);

    return () => window.clearTimeout(timer);
  }, [activeMode, screen, soloState, reducedMotion]);

  const handleStartSolo = useCallback(
    (config: SoloLaunchConfig) => {
      setLobbyActionError(null);
      const players = Array.from({ length: config.playerCount }, (_, idx) => ({
        name:
          idx === 0
            ? authState.user
              ? authState.displayName
              : 'Challenger'
            : getDefaultBotName(idx),
        isBot: idx > 0,
        uid: null,
        ready: true,
      }));
      const fresh = createInitialMatchState(config.seed, {
        playerCount: config.playerCount,
        teamMode: config.teamMode,
        players,
      });
      // Replace via RESET-like sync: initialize directly with custom config by resetting soloReducer state
      // We handle custom solo configs by storing custom solo state or dispatching RESET_MATCH if same count.
      setCustomSoloState({ match: fresh, history: [] });
      setActiveMode('solo');
      setActiveMatchId(null);
      setScreen('arena');
    },
    [authState.user, authState.displayName],
  );

  const [customSoloState, setCustomSoloState] = useState<SoloHistoryState | null>(null);
  const effectiveSoloState = customSoloState ?? soloState;

  const handleDispatchSolo = useCallback(
    (action: MatchAction) => {
      if (customSoloState) {
        setCustomSoloState((prev) => (prev ? soloReducer(prev, action) : null));
      } else {
        dispatchSolo(action);
      }
    },
    [customSoloState],
  );

  // Bot loop for customSoloState when active
  useEffect(() => {
    if (activeMode !== 'solo' || screen !== 'arena' || !customSoloState) return;
    const { match } = customSoloState;
    if (match.winner !== 'NONE') return;
    const activePlayer = match.players[match.activeTurnIndex];
    if (!activePlayer || !activePlayer.isBot) return;

    const timer = window.setTimeout(() => {
      const botAction = chooseBotAction(match);
      if (botAction) {
        setCustomSoloState((prev) => (prev ? soloReducer(prev, botAction) : null));
      }
    }, reducedMotion ? 150 : 600);

    return () => window.clearTimeout(timer);
  }, [activeMode, screen, customSoloState, reducedMotion]);

  const handleCreateMultiplayer = useCallback(
    async (config: CreateRoomConfig) => {
      if (!authState.user) return;
      setCreatingMatch(true);
      setLobbyActionError(null);
      try {
        const matchId = await createMatchLobby({
          hostUid: authState.user.uid,
          hostName: authState.displayName,
          matchSeed: config.seed,
          maxPlayers: config.maxPlayers,
          teamMode: config.teamMode,
          fillWithBots: config.fillWithBots,
        });
        setMpHistory([]);
        lastRecordedMpRound.current = null;
        setActiveMatchId(matchId);
        setActiveMode('multiplayer');
        setScreen('arena');
      } catch (err) {
        setLobbyActionError(
          err instanceof Error ? err.message : 'Unable to create multiplayer room.',
        );
      } finally {
        setCreatingMatch(false);
      }
    },
    [authState.user, authState.displayName],
  );

  const handleJoinMultiplayer = useCallback(
    async (matchIdOrCode: string) => {
      if (!authState.user) return;
      setJoiningMatchId(matchIdOrCode);
      setLobbyActionError(null);
      try {
        const resolvedId = await joinMatchLobby(
          matchIdOrCode,
          authState.user.uid,
          authState.displayName,
        );
        setMpHistory([]);
        lastRecordedMpRound.current = null;
        setActiveMatchId(resolvedId);
        setActiveMode('multiplayer');
        setScreen('arena');
      } catch (err) {
        setLobbyActionError(
          err instanceof Error ? err.message : 'Unable to join room.',
        );
      } finally {
        setJoiningMatchId(null);
      }
    },
    [authState.user, authState.displayName],
  );

  // Auto-join from invite URL (?room=CODE) once signed in
  useEffect(() => {
    if (
      initialRoomCode &&
      authState.user &&
      !autoJoinedRoomRef.current &&
      activeMode === 'none'
    ) {
      autoJoinedRoomRef.current = true;
      void handleJoinMultiplayer(initialRoomCode);
    }
  }, [initialRoomCode, authState.user, activeMode, handleJoinMultiplayer]);

  const handleLeaveArena = useCallback(() => {
    if (activeMode === 'multiplayer') {
      void multiplayer.leaveMatch();
    }
    setActiveMode('none');
    setActiveMatchId(null);
    setScreen('lobby');
  }, [activeMode, multiplayer]);

  const handleHeaderAuthAction = useCallback(() => {
    if (authState.user) {
      if (activeMode === 'multiplayer') {
        void multiplayer.leaveMatch();
        setActiveMode('none');
        setActiveMatchId(null);
        setScreen('lobby');
      }
      void authState.logout();
    } else {
      void authState.loginWithGoogle();
    }
  }, [authState, activeMode, multiplayer]);

  return (
    <ErrorBoundary
      onReset={() => {
        setActiveMode('none');
        setActiveMatchId(null);
        setScreen('lobby');
      }}
    >
      <div className="min-h-screen text-stone-100 flex flex-col">
        <Header
          screen={screen}
          hasActiveMatch={activeMode !== 'none'}
          isFirebaseConfigured={authState.isConfigured}
          isSignedIn={Boolean(authState.user)}
          signingIn={authState.signingIn}
          onNavigate={setScreen}
          onOpenHowToPlay={() => setHowToPlayOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onAuthAction={handleHeaderAuthAction}
          onQuickSolo={() =>
            handleStartSolo({ seed: 202601, playerCount: 2, teamMode: 'ffa' })
          }
        />

        <div className="flex-1">
          {screen === 'lobby' && (
            <Lobby
              authState={authState}
              lobbies={lobbies}
              lobbiesLoading={lobbiesLoading}
              lobbiesError={lobbiesError}
              sweptCount={sweptCount}
              creatingMatch={creatingMatch}
              joiningMatchId={joiningMatchId}
              lobbyActionError={lobbyActionError}
              initialRoomCode={initialRoomCode}
              onStartSolo={handleStartSolo}
              onCreateMultiplayer={handleCreateMultiplayer}
              onJoinMultiplayer={handleJoinMultiplayer}
              onSweepStale={runSweep}
            />
          )}

          {screen === 'arena' && activeMode === 'solo' && (
            <Arena
              mode="solo"
              state={effectiveSoloState.match}
              localSeatIndex={0}
              history={effectiveSoloState.history}
              muted={muted}
              reducedMotion={reducedMotion}
              onToggleMuted={toggleMuted}
              onPlaySound={play}
              onDispatch={handleDispatchSolo}
              onLeave={handleLeaveArena}
            />
          )}

          {screen === 'arena' && activeMode === 'multiplayer' && (
            <Arena
              mode="multiplayer"
              matchId={activeMatchId ?? undefined}
              roomCode={multiplayer.match?.roomCode}
              matchStatus={multiplayer.match?.status}
              fillWithBots={multiplayer.match?.fillWithBots}
              state={multiplayer.match}
              localSeatIndex={multiplayer.localSeatIndex ?? 0}
              isHost={multiplayer.isHost}
              turnSecondsRemaining={multiplayer.turnSecondsRemaining}
              loading={multiplayer.loading}
              submitting={multiplayer.submitting}
              error={multiplayer.error}
              history={mpHistory}
              muted={muted}
              reducedMotion={reducedMotion}
              onToggleMuted={toggleMuted}
              onPlaySound={play}
              onDispatch={(action) => void multiplayer.dispatchAction(action)}
              onLeave={handleLeaveArena}
              onToggleReady={() => void multiplayer.toggleReady()}
              onUpdateRoomOptions={(updates) => void multiplayer.updateRoomOptions(updates)}
              onKickSeat={(idx) => void multiplayer.kickSeat(idx)}
              onStartRoom={() => void multiplayer.startRoom()}
              onRejoin={() => void multiplayer.rejoinActive()}
            />
          )}

          {screen === 'codex' && <Codex />}
        </div>

        <HowToPlayModal open={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} />
        <SettingsModal
          open={settingsOpen}
          muted={muted}
          reducedMotion={reducedMotion}
          onToggleMuted={toggleMuted}
          onToggleReducedMotion={toggleReducedMotion}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </ErrorBoundary>
  );
}
