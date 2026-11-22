import { useCallback, useEffect, useRef, useState } from 'react';
import { reduceMatchState } from '../engine/gameEngine';
import {
  commitMatchState,
  leaveMatchSession,
  subscribeMatch,
} from '../services/matchService';
import type { FirestoreMatchDocument, MatchAction, PlayerId } from '../types/game';

export function useMultiplayerMatch(matchId: string | null, uid: string | null) {
  const [match, setMatch] = useState<FirestoreMatchDocument | null>(null);
  const [loading, setLoading] = useState(Boolean(matchId));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeLeaveRef = useRef<{ matchId: string | null; uid: string | null }>({
    matchId,
    uid,
  });

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

  const localSeat: PlayerId | null =
    !match || !uid
      ? null
      : match.hostUid === uid
        ? 'p1'
        : match.guestUid === uid
          ? 'p2'
          : null;

  const dispatchAction = useCallback(
    async (action: MatchAction) => {
      if (!matchId || !match || !localSeat) return;
      if (match.status !== 'active' || match.winner !== 'NONE') return;
      if (action.type !== 'RESET_MATCH' && action.player !== match.activeTurn) return;

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
    [matchId, match, localSeat],
  );

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
    localSeat,
    loading,
    submitting,
    error,
    dispatchAction,
    leaveMatch,
  };
}
