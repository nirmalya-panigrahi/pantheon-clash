import { useCallback, useEffect, useState } from 'react';
import { subscribeWaitingLobbies, sweepStaleLobbies } from '../services/matchService';
import type { FirestoreMatchDocument } from '../types/game';

export function useLobbies(enabled: boolean) {
  const [lobbies, setLobbies] = useState<FirestoreMatchDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sweptCount, setSweptCount] = useState<number>(0);

  const runSweep = useCallback(async () => {
    if (!enabled) return;
    try {
      const count = await sweepStaleLobbies();
      setSweptCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sweep stale lobbies.');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLobbies([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    void sweepStaleLobbies()
      .then((count) => setSweptCount(count))
      .catch(() => {
        // Non-blocking sweep
      });

    const unsubscribe = subscribeWaitingLobbies(
      (nextLobbies) => {
        setLobbies(nextLobbies);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [enabled]);

  return {
    lobbies,
    loading,
    error,
    sweptCount,
    runSweep,
  };
}
