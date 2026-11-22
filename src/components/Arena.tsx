import { useEffect, useState } from 'react';
import { Copy, Check, Volume2, VolumeX, RotateCcw, LogOut } from 'lucide-react';
import { getCardById } from '../data/cards';
import {
  computeEffectiveStats,
  getProphecyStat,
  ROUNDS_PER_REALM,
} from '../engine/gameEngine';
import type { SoundCue } from '../hooks/useSound';
import type { MatchAction, MatchState, PlayerId, RoundOutcome, StatKey } from '../types/game';
import { MythCardView } from './MythCardView';
import { getRealmLabel, RealmIcon } from './MythEmblem';

interface ArenaProps {
  mode: 'solo' | 'multiplayer';
  matchId?: string;
  matchStatus?: 'waiting' | 'active' | 'finished';
  state: MatchState | null;
  localSeat: PlayerId;
  p1Label: string;
  p2Label: string;
  loading?: boolean;
  submitting?: boolean;
  error?: string | null;
  history: RoundOutcome[];
  muted: boolean;
  onToggleMuted: () => void;
  onPlaySound: (cue: SoundCue) => void;
  onDispatch: (action: MatchAction) => void;
  onLeave: () => void;
}

const STAT_LABELS: Record<StatKey, string> = {
  might: 'Might',
  arcana: 'Arcana',
  cunning: 'Cunning',
  influence: 'Influence',
};

export function Arena({
  mode,
  matchId,
  matchStatus = 'active',
  state,
  localSeat,
  p1Label,
  p2Label,
  loading = false,
  submitting = false,
  error = null,
  history,
  muted,
  onToggleMuted,
  onPlaySound,
  onDispatch,
  onLeave,
}: ArenaProps) {
  const [copiedId, setCopiedId] = useState(false);

  const lastOutcome = state?.lastOutcome ?? null;

  useEffect(() => {
    if (!lastOutcome) return;
    if (lastOutcome.resurrectedPlayer) {
      onPlaySound('resurrect');
    } else if (lastOutcome.winner === 'TIE') {
      onPlaySound('tie');
    } else if (lastOutcome.winner === localSeat) {
      onPlaySound('win');
    } else {
      onPlaySound('lose');
    }
  }, [lastOutcome?.round, lastOutcome?.winner, lastOutcome?.resurrectedPlayer, localSeat, onPlaySound]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-xl bg-[#161B24] border border-white/10 p-10 text-center text-sm text-stone-300">
          Synchronizing arena state...
        </div>
      </main>
    );
  }

  if (error && !state) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-xl bg-[#161B24] border border-red-500/30 p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-red-300">Arena Error</h2>
          <p className="text-sm text-stone-300">{error}</p>
          <button
            type="button"
            onClick={onLeave}
            className="min-h-[44px] px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm cursor-pointer"
          >
            Return to Lobby
          </button>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-xl bg-[#161B24] border border-white/10 p-8 space-y-4 text-center">
          <h2 className="font-display text-xl font-bold text-stone-100">Match Closed</h2>
          <p className="text-sm text-stone-400">
            This match session has ended or was removed when all players exited.
          </p>
          <button
            type="button"
            onClick={onLeave}
            className="min-h-[44px] px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm cursor-pointer"
          >
            Return to Lobby
          </button>
        </div>
      </main>
    );
  }

  if (mode === 'multiplayer' && matchStatus === 'waiting') {
    const handleCopy = async () => {
      if (!matchId || !navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(matchId);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 1800);
      } catch {
        // Ignore clipboard errors in restricted frames
      }
    };

    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-xl bg-[#161B24] border border-white/10 p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold text-stone-100">
              Waiting for Challenger
            </h2>
            <p className="text-sm text-stone-400">
              Share your Match ID below or wait for a player in the public lobby list to join.
            </p>
          </div>

          <div className="rounded-lg bg-[#0E1117] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-stone-400">Match ID</p>
              <p className="font-mono text-sm text-amber-400 truncate mt-0.5">{matchId}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="min-h-[40px] px-4 py-2 rounded-lg border border-white/15 bg-[#1D2430] hover:bg-[#252D3B] text-stone-100 text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedId ? 'Copied' : 'Copy ID'}
            </button>
          </div>

          <div className="text-xs text-stone-400 font-mono tabular-nums flex flex-wrap gap-x-4 gap-y-1">
            <span>Host: {p1Label}</span>
            <span>·</span>
            <span>Seed: {state.matchSeed}</span>
            <span>·</span>
            <span>Opening Realm: {getRealmLabel(state.activeRealm)}</span>
          </div>

          <button
            type="button"
            onClick={onLeave}
            className="min-h-[44px] px-5 py-2.5 rounded-lg border border-white/15 bg-[#1D2430] hover:bg-red-950/60 hover:border-red-500/40 text-stone-200 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancel Match
          </button>
        </div>
      </main>
    );
  }

  const oppSeat: PlayerId = localSeat === 'p1' ? 'p2' : 'p1';
  const localDeck = localSeat === 'p1' ? state.p1Deck : state.p2Deck;
  const oppDeck = localSeat === 'p1' ? state.p2Deck : state.p1Deck;
  const localName = localSeat === 'p1' ? p1Label : p2Label;
  const oppName = localSeat === 'p1' ? p2Label : p1Label;

  const isLocalTurn = state.winner === 'NONE' && state.activeTurn === localSeat;
  const canArmGambit = isLocalTurn && !state.gambitUsed[localSeat] && !submitting;
  const roundsIntoRealm = ((state.round - 1) % ROUNDS_PER_REALM) + 1;

  const localTopCard = localDeck.length > 0 ? getCardById(localDeck[0]) : null;
  const oppTopCard = oppDeck.length > 0 ? getCardById(oppDeck[0]) : null;
  const prophecyHint = getProphecyStat(state, localSeat);

  // Only reveal local card's own domain match bonus openly; do NOT leak opponent's face-down PIERCING passive before clash!
  const localBonusDisplay =
    localTopCard && localTopCard.domain === state.activeRealm ? 15 : 0;

  const oppEffectiveDisplay =
    oppTopCard && localTopCard && state.winner !== 'NONE'
      ? computeEffectiveStats(oppTopCard, localTopCard, state.activeRealm)
      : { bonus: 0 };

  const lastP1Card = lastOutcome ? getCardById(lastOutcome.p1CardId) : null;
  const lastP2Card = lastOutcome ? getCardById(lastOutcome.p2CardId) : null;

  const handleStatSelect = (stat: StatKey) => {
    if (!isLocalTurn || submitting) return;
    onPlaySound('pick');
    onDispatch({ type: 'PICK_STAT', player: localSeat, stat });
  };

  const handleToggleGambit = () => {
    if (!canArmGambit) return;
    onPlaySound('gambit');
    onDispatch({ type: 'TOGGLE_GAMBIT', player: localSeat });
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Unobtrusive Top Arena HUD */}
      <section className="rounded-xl bg-[#161B24] border border-white/10 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="text-stone-400">Round</span>
            <span className="font-mono tabular-nums font-semibold text-stone-100">
              {state.round}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <RealmIcon realm={state.activeRealm} className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-amber-300">
              {getRealmLabel(state.activeRealm)} Realm
            </span>
            <span className="text-stone-400 font-mono tabular-nums">
              ({roundsIntoRealm}/{ROUNDS_PER_REALM})
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono tabular-nums">
            <span className="text-stone-400">{localName}:</span>
            <span className="font-semibold text-stone-100">{localDeck.length}</span>
            <span className="text-stone-600">/</span>
            <span className="text-stone-400">{oppName}:</span>
            <span className="font-semibold text-stone-100">{oppDeck.length}</span>
          </div>

          {state.warPot.length > 0 && (
            <div className="font-mono tabular-nums text-amber-300 font-semibold">
              War Pot: {state.warPot.length} cards
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleMuted}
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-white/15 bg-[#1D2430] hover:bg-[#252D3B] text-stone-200 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{muted ? 'Muted' : 'Sound'}</span>
          </button>

          <button
            type="button"
            onClick={onLeave}
            className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-white/15 bg-[#1D2430] hover:bg-red-950/60 hover:border-red-500/40 text-stone-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Leave Match</span>
          </button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/35 bg-red-500/10 p-3.5 text-xs sm:text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {/* Victory / Defeat / Draw End Banner */}
      {state.winner !== 'NONE' && (
        <section
          aria-label="Match result"
          className="rounded-xl bg-[#161B24] border border-amber-500/40 p-6 sm:p-8 text-center space-y-4"
        >
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-amber-400">
            {state.winner === 'DRAW'
              ? 'Match Ended in a Draw'
              : state.winner === localSeat
                ? `${localName} Wins the Match`
                : `${oppName} Wins the Match`}
          </h2>
          <p className="text-sm text-stone-300 font-mono tabular-nums">
            Final Cards — {localName}: {localDeck.length} · {oppName}: {oppDeck.length} · Rounds Played: {state.round - 1}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {mode === 'solo' && (
              <button
                type="button"
                onClick={() => onDispatch({ type: 'RESET_MATCH', matchSeed: state.matchSeed })}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Play Again
              </button>
            )}
            <button
              type="button"
              onClick={onLeave}
              className="min-h-[44px] px-5 py-2.5 rounded-lg border border-white/15 bg-[#1D2430] hover:bg-[#252D3B] text-stone-100 font-semibold text-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              Return to Lobby
            </button>
          </div>
        </section>
      )}

      {/* Main Battle Table */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)] gap-6 items-start">
        {/* Local Player Card */}
        <div className="space-y-3 order-2 lg:order-1">
          <div className="flex items-center justify-between text-xs text-stone-400 px-1">
            <span>{localName} ({localSeat.toUpperCase()})</span>
            <span className="font-mono tabular-nums">
              Gambit: {state.gambitUsed[localSeat] ? 'Used' : 'Ready'} · Resurrection: {state.resurrectionUsed[localSeat] ? 'Used' : 'Available'}
            </span>
          </div>
          {localTopCard ? (
            <MythCardView
              card={localTopCard}
              ownerLabel={localName}
              activeRealm={state.activeRealm}
              realmBonus={localBonusDisplay}
              interactive={isLocalTurn}
              disabled={submitting}
              gambitArmed={state.gambitArmed && isLocalTurn}
              onSelectStat={handleStatSelect}
            />
          ) : (
            <div className="rounded-xl bg-[#161B24] border border-white/10 p-8 text-center text-sm text-stone-400 min-h-[410px] flex items-center justify-center">
              No cards remaining in deck
            </div>
          )}
        </div>

        {/* Center Clash & Tactical Controls */}
        <div className="space-y-4 order-1 lg:order-2">
          <div className="rounded-xl bg-[#161B24] border border-white/10 p-5 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs font-medium text-stone-400">
                {state.winner !== 'NONE'
                  ? 'Match Complete'
                  : isLocalTurn
                    ? 'Your Turn — Pick a Stat'
                    : `${oppName} is Choosing...`}
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300">
                <RealmIcon realm={state.activeRealm} className="w-4 h-4" />
                <span>{getRealmLabel(state.activeRealm)} (+15 Domain Bonus)</span>
              </div>
            </div>

            {state.winner === 'NONE' && (
              <button
                type="button"
                disabled={!canArmGambit}
                onClick={handleToggleGambit}
                aria-pressed={state.gambitArmed}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                  state.gambitArmed
                    ? 'bg-amber-500 text-stone-950 hover:bg-amber-400'
                    : 'bg-[#1D2430] border border-amber-500/35 text-amber-200 hover:bg-[#252D3B]'
                }`}
              >
                {state.gambitUsed[localSeat]
                  ? 'Gambit Expended'
                  : state.gambitArmed
                    ? 'Gambit Armed (Lowest Wins)'
                    : 'Use Gambit (Invert Round)'}
              </button>
            )}

            {state.warPot.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-center">
                <p className="text-xs font-semibold text-amber-300 font-mono tabular-nums">
                  War Pot Active: {state.warPot.length} Cards at Stake
                </p>
                <p className="text-xs text-stone-300 mt-0.5">
                  Next round winner claims the entire pot.
                </p>
              </div>
            )}

            {lastOutcome && lastP1Card && lastP2Card && (
              <div
                data-testid="last-outcome-panel"
                className="rounded-lg bg-[#0E1117] border border-white/10 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span className="font-mono tabular-nums">Round {lastOutcome.round} Result</span>
                  <span>{STAT_LABELS[lastOutcome.stat]}</span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-100 truncate">
                      {localSeat === 'p1' ? lastP1Card.name : lastP2Card.name}
                    </p>
                    <p className="font-mono tabular-nums text-xs text-stone-400">
                      {localSeat === 'p1' ? lastOutcome.p1Effective : lastOutcome.p2Effective}
                      {(localSeat === 'p1' ? lastOutcome.p1Bonus : lastOutcome.p2Bonus) > 0 &&
                        ` (+${localSeat === 'p1' ? lastOutcome.p1Bonus : lastOutcome.p2Bonus})`}
                    </p>
                  </div>
                  <span className="text-xs text-stone-500 font-mono">vs</span>
                  <div className="min-w-0 text-right">
                    <p className="font-semibold text-stone-100 truncate">
                      {localSeat === 'p1' ? lastP2Card.name : lastP1Card.name}
                    </p>
                    <p className="font-mono tabular-nums text-xs text-stone-400">
                      {localSeat === 'p1' ? lastOutcome.p2Effective : lastOutcome.p1Effective}
                      {(localSeat === 'p1' ? lastOutcome.p2Bonus : lastOutcome.p1Bonus) > 0 &&
                        ` (+${localSeat === 'p1' ? lastOutcome.p2Bonus : lastOutcome.p1Bonus})`}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 text-xs space-y-1">
                  <p
                    className={`font-semibold ${
                      lastOutcome.winner === 'TIE'
                        ? 'text-amber-300'
                        : lastOutcome.winner === localSeat
                          ? 'text-emerald-400'
                          : 'text-red-400'
                    }`}
                  >
                    {lastOutcome.winner === 'TIE'
                      ? 'Tied Clash — Both cards moved to War Pot'
                      : lastOutcome.winner === localSeat
                        ? `You won Round ${lastOutcome.round}${lastOutcome.potWon > 0 ? ` (+${lastOutcome.potWon} pot)` : ''}`
                        : `${oppName} won Round ${lastOutcome.round}${lastOutcome.potWon > 0 ? ` (+${lastOutcome.potWon} pot)` : ''}`}
                  </p>
                  {lastOutcome.gambitActive && (
                    <p className="text-amber-300">Gambit Inverted: Lowest stat won</p>
                  )}
                  {lastOutcome.resurrectedPlayer && (
                    <p className="text-sky-300">
                      Resurrection: {lastOutcome.resurrectedPlayer === localSeat ? localName : oppName}'s card returned to deck bottom
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Opponent Card */}
        <div className="space-y-3 order-3">
          <div className="flex items-center justify-between text-xs text-stone-400 px-1">
            <span>{oppName} ({oppSeat.toUpperCase()})</span>
            <span className="font-mono tabular-nums">
              Gambit: {state.gambitUsed[oppSeat] ? 'Used' : 'Ready'}
            </span>
          </div>
          {oppTopCard ? (
            <MythCardView
              card={oppTopCard}
              ownerLabel={oppName}
              activeRealm={state.activeRealm}
              realmBonus={oppEffectiveDisplay.bonus}
              faceDown={state.winner === 'NONE'}
              prophecyHint={state.winner === 'NONE' ? prophecyHint : null}
            />
          ) : (
            <div className="rounded-xl bg-[#161B24] border border-white/10 p-8 text-center text-sm text-stone-400 min-h-[410px] flex items-center justify-center">
              No cards remaining in deck
            </div>
          )}
        </div>
      </section>

      {/* Round History */}
      {history.length > 0 && (
        <section className="rounded-xl bg-[#161B24] border border-white/10 p-5 space-y-3">
          <h3 className="font-display text-base font-bold text-stone-100">
            Recent Clashes
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-stone-400">
                  <th className="py-2 pr-4 font-medium">Round</th>
                  <th className="py-2 pr-4 font-medium">Stat</th>
                  <th className="py-2 pr-4 font-medium">{p1Label}</th>
                  <th className="py-2 pr-4 font-medium">{p2Label}</th>
                  <th className="py-2 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                {history.slice(0, 8).map((item) => {
                  const c1 = getCardById(item.p1CardId);
                  const c2 = getCardById(item.p2CardId);
                  return (
                    <tr key={item.round} className="text-stone-300">
                      <td className="py-2 pr-4">{item.round}</td>
                      <td className="py-2 pr-4 font-sans">{STAT_LABELS[item.stat]}</td>
                      <td className="py-2 pr-4">
                        <span className="font-sans">{c1.name}</span> ({item.p1Effective})
                      </td>
                      <td className="py-2 pr-4">
                        <span className="font-sans">{c2.name}</span> ({item.p2Effective})
                      </td>
                      <td className="py-2 font-sans">
                        {item.winner === 'TIE'
                          ? 'Tie -> War Pot'
                          : item.winner === 'p1'
                            ? `${p1Label} won`
                            : `${p2Label} won`}
                        {item.gambitActive ? ' · Gambit' : ''}
                        {item.resurrectedPlayer ? ' · Resurrected' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
