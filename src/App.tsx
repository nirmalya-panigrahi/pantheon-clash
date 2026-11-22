import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Arena } from './components/Arena';
import { Codex } from './components/Codex';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header, type AppScreen } from './components/Header';
import { Lobby } from './components/Lobby';
import { RulesView } from './components/RulesView';
import {
  chooseBotAction,
  createInitialMatchState,
  reduceMatchState,
} from './engine/gameEngine';
import { useAuth } from './hooks/useAuth';
import { useLobbies } from './hooks/useLobbies';
import { useMultiplayerMatch } from './hooks/useMultiplayerMatch';
import { useSound } from './hooks/useSound';
import { createMatchLobby, joinMatchLobby } from './services/matchService';
import type { MatchAction, MatchState, RoundOutcome } from './types/game';

interface SoloHistoryState {
  match: MatchState;
  history: RoundOutcome[];
}

function soloReducer(
  prev: SoloHistoryState,
  action: MatchAction,
): SoloHistoryState {
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

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('lobby');
  const [activeMode, setActiveMode] = useState<'none' | 'solo' | 'multiplayer'>('none');
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
  const [lobbyActionError, setLobbyActionError] = useState<string | null>(null);

  const [soloState, dispatchSolo] = useReducer(soloReducer, 202601, (seed) => ({
    match: createInitialMatchState(seed),
    history: [],
  }));

  const [mpHistory, setMpHistory] = useState<RoundOutcome[]>([]);
  const lastRecordedMpRound = useRef<number | null>(null);

  const authState = useAuth();
  const { muted, toggleMuted, play } = useSound();

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

  // Record multiplayer round outcomes locally for the Recent Clashes table.
  useEffect(() => {
    const outcome = multiplayer.match?.lastOutcome;
    if (!outcome) return;
    if (lastRecordedMpRound.current !== outcome.round) {
      lastRecordedMpRound.current = outcome.round;
      setMpHistory((prev) => [outcome, ...prev]);
    }
  }, [multiplayer.match?.lastOutcome]);

  // Deterministic Bot turn execution in Solo mode.
  useEffect(() => {
    if (activeMode !== 'solo' || screen !== 'arena') return;
    const { match } = soloState;
    if (match.winner !== 'NONE' || match.activeTurn !== 'p2') return;

    const timer = window.setTimeout(() => {
      const botAction = chooseBotAction(match);
      if (botAction) {
        dispatchSolo(botAction);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [activeMode, screen, soloState]);

  const handleStartSolo = useCallback((seed: number) => {
    setLobbyActionError(null);
    dispatchSolo({ type: 'RESET_MATCH', matchSeed: seed });
    setActiveMode('solo');
    setActiveMatchId(null);
    setScreen('arena');
  }, []);

  const handleCreateMultiplayer = useCallback(
    async (seed: number) => {
      if (!authState.user) return;
      setCreatingMatch(true);
      setLobbyActionError(null);
      try {
        const matchId = await createMatchLobby(
          authState.user.uid,
          authState.displayName,
          seed,
        );
        setMpHistory([]);
        lastRecordedMpRound.current = null;
        setActiveMatchId(matchId);
        setActiveMode('multiplayer');
        setScreen('arena');
      } catch (err) {
        setLobbyActionError(
          err instanceof Error ? err.message : 'Unable to create multiplayer match.',
        );
      } finally {
        setCreatingMatch(false);
      }
    },
    [authState.user, authState.displayName],
  );

  const handleJoinMultiplayer = useCallback(
    async (matchId: string) => {
      if (!authState.user) return;
      setJoiningMatchId(matchId);
      setLobbyActionError(null);
      try {
        await joinMatchLobby(matchId, authState.user.uid, authState.displayName);
        setMpHistory([]);
        lastRecordedMpRound.current = null;
        setActiveMatchId(matchId);
        setActiveMode('multiplayer');
        setScreen('arena');
      } catch (err) {
        setLobbyActionError(
          err instanceof Error ? err.message : 'Unable to join match.',
        );
      } finally {
        setJoiningMatchId(null);
      }
    },
    [authState.user, authState.displayName],
  );

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
      <div className="min-h-screen bg-[#0E1117] text-stone-100 flex flex-col">
        <Header
          screen={screen}
          hasActiveMatch={activeMode !== 'none'}
          isFirebaseConfigured={authState.isConfigured}
          isSignedIn={Boolean(authState.user)}
          signingIn={authState.signingIn}
          onNavigate={setScreen}
          onAuthAction={handleHeaderAuthAction}
          onQuickSolo={() => handleStartSolo(202601)}
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
              onStartSolo={handleStartSolo}
              onCreateMultiplayer={handleCreateMultiplayer}
              onJoinMultiplayer={handleJoinMultiplayer}
              onSweepStale={runSweep}
            />
          )}

          {screen === 'arena' && activeMode === 'solo' && (
            <Arena
              mode="solo"
              state={soloState.match}
              localSeat="p1"
              p1Label={authState.user ? authState.displayName : 'Challenger'}
              p2Label="Deterministic Bot"
              history={soloState.history}
              muted={muted}
              onToggleMuted={toggleMuted}
              onPlaySound={play}
              onDispatch={dispatchSolo}
              onLeave={handleLeaveArena}
            />
          )}

          {screen === 'arena' && activeMode === 'multiplayer' && (
            <Arena
              mode="multiplayer"
              matchId={activeMatchId ?? undefined}
              matchStatus={multiplayer.match?.status}
              state={multiplayer.match}
              localSeat={multiplayer.localSeat ?? 'p1'}
              p1Label={multiplayer.match?.hostName ?? 'Host'}
              p2Label={multiplayer.match?.guestName || 'Opponent'}
              loading={multiplayer.loading}
              submitting={multiplayer.submitting}
              error={multiplayer.error}
              history={mpHistory}
              muted={muted}
              onToggleMuted={toggleMuted}
              onPlaySound={play}
              onDispatch={(action) => void multiplayer.dispatchAction(action)}
              onLeave={handleLeaveArena}
            />
          )}

          {screen === 'codex' && <Codex />}

          {screen === 'rules' && (
            <RulesView onBackToLobby={() => setScreen('lobby')} />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
