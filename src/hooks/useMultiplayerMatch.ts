import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chooseBotAction,
  reduceMatchState,
  TURN_TIMEOUT_SECONDS,
} from '../engine/gameEngine';
import {
  commitMatchState,
  getTimestampMillis,
  kickPlayerSeat,
  leaveMatchSession,
  setSeatAwayStatus,
  startWaitingMatch,
  subscribeMatch,
  toggleSeatReady,
  updateWaitingRoomOptions,
} from '../services/matchService';
import type { FirestoreMatchDocument, MatchAction, TeamMode } from '../types/game';

export function useMultiplayerMatch(matchId: string | null, uid: string | null) {
  const [match, setMatch] = useState<FirestoreMatchDocument | null>(null);
  const [loading, setLoading] = useState(Boolean(matchId));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnSecondsRemaining, setTurnSecondsRemaining] = useState<number>(TURN_TIMEOUT_SECONDS);

  const activeLeaveRef = useRef<{ matchId: string | null; uid: string | null }>({
    matchId,
    uid,
  });
  const autoAdvanceRoundRef = useRef<string | null>(null);

  useEffect(() => {
    activeLeaveRef.current = { matchId, uid };
  }, [matchId, uid]);

  useEffect(() => {
    if (!matchId || !uid) {
      setMatch(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const unsubscribe = subscribeMatch(
      matchId,
      (nextMatch) => {
        setMatch(nextMatch);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [matchId, uid]);

  // Tab close / unload cleanup removing UID from activePlayers and deleting if empty.
  useEffect(() => {
    if (!matchId || !uid) return;

    const handleBeforeUnload = () => {
      void leaveMatchSession(matchId, uid).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [matchId, uid]);

  const localSeatIndex =
    !match || !uid
      ? null
      : (() => {
          const found = match.players.findIndex((p) => p.uid === uid);
          return found >= 0 ? found : null;
        })();

  const localPlayer = localSeatIndex !== null && match ? match.players[localSeatIndex] : null;
  const isHost = Boolean(match && uid && match.hostUid === uid);

  // 20-second turn timer countdown + deterministic bot / away / timeout auto-play
  useEffect(() => {
    if (!match || !matchId || !uid || match.status !== 'active' || match.winner !== 'NONE') {
      setTurnSecondsRemaining(TURN_TIMEOUT_SECONDS);
      return;
    }

    const activePlayer = match.players[match.activeTurnIndex];
    if (!activePlayer) return;

    const roundKey = `${match.round}-${match.activeTurnIndex}-${match.prophecyTarget ? 'p' : 'n'}`;

    const runAutoTurn = async () => {
      if (autoAdvanceRoundRef.current === roundKey) return;
      autoAdvanceRoundRef.current = roundKey;

      const botAction = chooseBotAction(match);
      if (!botAction) return;
      const nextState = reduceMatchState(match, botAction);
      if (nextState === match) return;

      try {
        await commitMatchState(matchId, nextState);
      } catch {
        autoAdvanceRoundRef.current = null;
      }
    };

    // Host runs deterministic Bot or Away player turns smoothly
    if (isHost && (activePlayer.isBot || activePlayer.away)) {
      const botDelay = window.setTimeout(() => {
        void runAutoTurn();
      }, 650);
      return () => window.clearTimeout(botDelay);
    }

    const startedMs = getTimestampMillis(match.turnStartedAt) ?? Date.now();

    const updateTimer = () => {
      const elapsedSec = Math.floor((Date.now() - startedMs) / 1000);
      const remaining = Math.max(0, TURN_TIMEOUT_SECONDS - elapsedSec);
      setTurnSecondsRemaining(remaining);

      if (remaining === 0) {
        // If local player timed out, mark them away first or auto-play cleanly
        const canAuthoritativelyAutoPlay =
          isHost ||
          activePlayer.uid === uid ||
          activePlayer.away ||
          elapsedSec >= TURN_TIMEOUT_SECONDS + 2;

        if (canAuthoritativelyAutoPlay) {
          void (async () => {
            if (activePlayer.uid === uid && !activePlayer.away) {
              await setSeatAwayStatus(matchId, uid, true).catch(() => {});
            }
            await runAutoTurn();
          })();
        }
      }
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 500);
    return () => window.clearInterval(interval);
  }, [match, matchId, uid, isHost]);

  const dispatchAction = useCallback(
    async (action: MatchAction) => {
      if (!matchId || !match || localSeatIndex === null) return;
      if (action.type === 'RESET_MATCH') {
        if (!isHost || match.status !== 'finished') return;
      } else {
        if (match.status !== 'active' || match.winner !== 'NONE') return;
        if (action.playerIndex !== match.activeTurnIndex) return;
      }

      const nextState = reduceMatchState(match, action);
      if (nextState === match) return;

      setSubmitting(true);
      setError(null);
      try {
        await commitMatchState(matchId, nextState);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update match state.');
      } finally {
        setSubmitting(false);
      }
    },
    [matchId, match, localSeatIndex],
  );

  const toggleReady = useCallback(async () => {
    if (!matchId || !uid) return;
    setError(null);
    try {
      await toggleSeatReady(matchId, uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update ready status.');
    }
  }, [matchId, uid]);

  const updateRoomOptions = useCallback(
    async (updates: { fillWithBots?: boolean; teamMode?: TeamMode }) => {
      if (!matchId || !uid) return;
      setError(null);
      try {
        await updateWaitingRoomOptions(matchId, uid, updates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to update room settings.');
      }
    },
    [matchId, uid],
  );

  const kickSeat = useCallback(
    async (seatIndex: number) => {
      if (!matchId || !uid) return;
      setError(null);
      try {
        await kickPlayerSeat(matchId, uid, seatIndex);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to remove player.');
      }
    },
    [matchId, uid],
  );

  const startRoom = useCallback(async () => {
    if (!matchId || !uid) return;
    setSubmitting(true);
    setError(null);
    try {
      await startWaitingMatch(matchId, uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start match.');
    } finally {
      setSubmitting(false);
    }
  }, [matchId, uid]);

  const rejoinActive = useCallback(async () => {
    if (!matchId || !uid) return;
    setError(null);
    try {
      await setSeatAwayStatus(matchId, uid, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rejoin seat.');
    }
  }, [matchId, uid]);

  const leaveMatch = useCallback(async () => {
    const targetMatchId = activeLeaveRef.current.matchId;
    const targetUid = activeLeaveRef.current.uid;
    if (!targetMatchId || !targetUid) return;
    try {
      await leaveMatchSession(targetMatchId, targetUid);
    } catch {
      // Ignore error during explicit exit so user is not trapped
    }
  }, []);

  return {
    match,
    localSeatIndex,
    localPlayer,
    isHost,
    loading,
    submitting,
    error,
    turnSecondsRemaining,
    dispatchAction,
    toggleReady,
    updateRoomOptions,
    kickSeat,
    startRoom,
    rejoinActive,
    leaveMatch,
  };
}
