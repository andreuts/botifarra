import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore.js';
import { useGameStore } from '../store/gameStore.js';
import { useGameRoom } from '../hooks/useGameRoom.js';
import { useInterpolatedTimers } from '../hooks/useInterpolatedTimers.js';
import { HandComponent } from '../components/HandComponent.js';
import { TrickArea } from '../components/TrickArea.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { GameStatusPanel } from '../components/GameStatusPanel.js';
import { DeclareTrumpPanel } from '../components/DeclareTrumpPanel.js';
import { getContraDecidingTeam } from '../gamePhase.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import type { CompletedTrick, Seat } from '@botifarra/core';
import {
  TRICK_PAUSE_DURATION_MS,
  TRICK_REVEAL_DURATION_MS,
} from '@botifarra/shared';
import type { SeatReservationData } from '../hooks/useMatchmakingQueue.js';

export function GamePage() {
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leavingWaitingRoom, setLeavingWaitingRoom] = useState(false);
  const { matchId } = useParams<{ matchId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { t } = useTranslation();
  const requestedMode = searchParams.get('mode');
  const mode = requestedMode === 'practice-duo'
    ? 'practice-duo'
    : requestedMode === 'practice'
      ? 'practice'
      : 'botifarra';
  const isPracticeMode = mode !== 'botifarra';
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    gameState,
    connected,
    error,
    gameResult,
    toasts,
    timerSnapshot,
    dismissToast,
    reset,
    setError,
    setActiveGameRoomId,
    activeGameRoomId,
  } = useGameStore();

  // Interpolate authoritative server timer snapshots against monotonic client time.
  const interpolatedTimers = useInterpolatedTimers(timerSnapshot);
  const [finalTrickReveal, setFinalTrickReveal] = useState<CompletedTrick | null>(null);
  const [finalTrickAnimating, setFinalTrickAnimating] = useState(false);
  const [trickReveal, setTrickReveal] = useState<CompletedTrick | null>(null);
  const previousTrickRef = useRef<{ roundNumber: number; count: number } | null>(null);

  useLayoutEffect(() => {
    if (!gameState) {
      previousTrickRef.current = null;
      setTrickReveal(null);
      return;
    }

    const current = {
      roundNumber: gameState.roundNumber,
      count: gameState.completedTricks.length,
    };
    const previous = previousTrickRef.current;
    previousTrickRef.current = current;

    if (!previous) {
      if (gameState.trickPauseLeader != null && current.count > 0 && current.count < 12) {
        setTrickReveal(gameState.completedTricks.at(-1) ?? null);
      }
      return;
    }
    if (previous.roundNumber !== current.roundNumber || current.count < previous.count) {
      setTrickReveal(null);
      return;
    }
    if (current.count > previous.count) {
      // The twelfth trick already has its own end-of-round/game reveal.
      setTrickReveal(current.count === 12 ? null : gameState.completedTricks.at(-1) ?? null);
    }
    // The state payload changes on every timer update; only react to trick-count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.roundNumber, gameState?.completedTricks.length]);

  useEffect(() => {
    if (!gameState || gameState.completedTricks.length !== 12) {
      setFinalTrickReveal(null);
      setFinalTrickAnimating(false);
      return;
    }

    const lastTrick = gameState.completedTricks.at(-1);
    if (!lastTrick) return;

    setFinalTrickReveal(lastTrick);
    setFinalTrickAnimating(false);
    const animationTimer = window.setTimeout(() => setFinalTrickAnimating(true), TRICK_REVEAL_DURATION_MS);
    const clearTimer = window.setTimeout(() => {
      setFinalTrickReveal(null);
      setFinalTrickAnimating(false);
    }, TRICK_PAUSE_DURATION_MS);

    return () => {
      window.clearTimeout(animationTimer);
      window.clearTimeout(clearTimer);
    };
    // Restart the reveal only when a round first reaches its twelfth trick or a new round begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.roundNumber, gameState?.completedTricks.length]);

  const pauseRemainingMs = interpolatedTimers?.trickPauseRemainingMs
    ?? gameState?.trickPauseRemainingMs
    ?? null;
  const trickPauseElapsedMs = pauseRemainingMs === null
    ? 0
    : Math.max(0, TRICK_PAUSE_DURATION_MS - pauseRemainingMs);
  const activeTrickReveal = gameState?.trickPauseLeader != null && trickPauseElapsedMs < TRICK_PAUSE_DURATION_MS
    ? trickReveal
    : null;
  const isTrickRevealAnimating = activeTrickReveal !== null
    && trickPauseElapsedMs >= TRICK_REVEAL_DURATION_MS;

  // Seat reservation passed from matchmaking via route state.
  // Only use it for fresh joins — if we're reconnecting to an active game, force joinById instead.
  const isReconnecting = activeGameRoomId === matchId;
  const routeState = location.state as {
    reservation?: SeatReservationData;
    inviteCode?: string;
  } | null;
  const seatReservation = !isReconnecting
    ? routeState?.reservation
    : undefined;
  const inviteCode = routeState?.inviteCode;

  const {
    connect,
    sendDeclareTrump,
    sendPlayCard,
    sendPassDeclaration,
    sendPassContra,
    sendCallContra,
    commandErrorVersion,
    roomPlayers,
    leaveRoom,
  } = useGameRoom(matchId, isPracticeMode ? 'practice' : 'botifarra', seatReservation);

  function returnToLobby() {
    setLeaveConfirmOpen(false);
    setActiveGameRoomId(null);
    reset();
    navigate('/');
  }

  async function leaveWaitingRoom() {
    if (leavingWaitingRoom) return;
    setLeavingWaitingRoom(true);
    leaveRoom();

    if (user?.accessToken) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 1500);
      try {
        await fetch('/api/matches/queue/leave', {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.accessToken}` },
          signal: controller.signal,
        });
      } catch {
        // The room is already being left. Queue cleanup is best-effort if offline.
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    returnToLobby();
  }

  function requestReturnToLobby() {
    if (isPracticeMode && !gameResult) {
      setLeaveConfirmOpen(true);
      return;
    }
    returnToLobby();
  }

  const leaveConfirmDialog = (
    <ConfirmDialog
      open={leaveConfirmOpen}
      title={t('game.leavePracticeTitle')}
      message={t('game.leavePracticeMessage')}
      confirmLabel={t('game.leavePracticeConfirm')}
      cancelLabel={t('game.leavePracticeCancel')}
      dangerous
      onCancel={() => setLeaveConfirmOpen(false)}
      onConfirm={returnToLobby}
    />
  );

  const practiceGameInProgress = isPracticeMode && !!gameState && !gameResult;
  useEffect(() => {
    if (!practiceGameInProgress) return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [practiceGameInProgress]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    void connect(user.accessToken, user.userId, user.username);
    return () => {
      reset();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save active game roomId for rejoin functionality
  useEffect(() => {
    if (connected && matchId && mode === 'botifarra') {
      setActiveGameRoomId(matchId);
    }
  }, [connected, matchId, mode, setActiveGameRoomId]);

  // Clear active game when it ends
  useEffect(() => {
    if (gameResult) {
      setActiveGameRoomId(null);
    }
  }, [gameResult, setActiveGameRoomId]);

  // Auto-dismiss toasts
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(dismissToast, 3000);
    return () => clearTimeout(t);
  }, [toasts, dismissToast]);

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="page game-screen">
        <div className="card game-error-panel">
          <h2>{t('game.connectionError')}</h2>
          <p>{error}</p>
          {!connected && user && (
            <button
              className="game-result-button game-state-button"
              onClick={() => {
                setError(null);
                void connect(user.accessToken, user.userId, user.username);
              }}
            >
              {t('game.retryConnection')}
            </button>
          )}
          <button
            className="game-result-button game-state-button"
            onClick={requestReturnToLobby}
          >
            {t('game.backToLobby')}
          </button>
        </div>
        {leaveConfirmDialog}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if ((!connected && !gameResult) || !gameState) {
    const connectedPlayerCount = roomPlayers.filter((player) => player.connected).length;
    const loadingTitle = connectedPlayerCount >= 4
      ? t('game.startingGame')
      : connected
        ? t('game.waitingForPlayers')
        : t('game.connecting');
    const loadingDescription = !connected
      ? inviteCode
        ? t('game.connectingToCode', { code: inviteCode })
        : t('game.connecting')
      : connectedPlayerCount >= 4
        ? t('game.allPlayersConnected')
        : inviteCode
          ? mode === 'practice-duo'
            ? t('game.waitingForPracticePartner', { code: inviteCode })
            : t('game.waitingForCodePlayers', { code: inviteCode })
          : t('game.waitingForMatch');

    return (
      <div className="page game-screen game-loading">
        <section className="game-loading-panel" role="status" aria-live="polite">
          <div className="game-loading-header">
            <div className="game-loading-indicator" aria-hidden="true" />
            <div className="game-loading-message">
              <h1 className="game-loading-title">{loadingTitle}</h1>
              <p className="game-loading-copy">{loadingDescription}</p>
            </div>
          </div>

          {connected && (
            <section className="game-lobby-roster" aria-label={t('game.playersInRoom')}>
              <div className="game-lobby-roster-heading">
                <h2>{t('game.playersInRoom')}</h2>
                <span>{t('game.playersConnected', { count: connectedPlayerCount })}</span>
              </div>
              <ul className="game-lobby-player-list">
                {([0, 1, 2, 3] as const).map((seat) => {
                  const player = roomPlayers.find((candidate) => candidate.seat === seat);
                  const stateClass = !player
                    ? 'is-open'
                    : player.connected
                      ? 'is-connected'
                      : 'is-disconnected';

                  return (
                    <li className={`game-lobby-player-slot ${stateClass}`} key={seat}>
                      <span className="game-lobby-player-mark" aria-hidden="true" />
                      <div className="game-lobby-player-copy">
                        <strong>{player?.username ?? t('game.waitingSeat', { seat: seat + 1 })}</strong>
                        <span>
                          {player
                            ? player.connected
                              ? t('game.online')
                              : t('game.offline')
                            : t('game.waitingForPlayer')}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!isReconnecting && (
            <button
              type="button"
              className="btn-outline game-loading-back"
              disabled={leavingWaitingRoom}
              onClick={() => void leaveWaitingRoom()}
            >
              {leavingWaitingRoom ? t('common.loading') : t('game.backToLobby')}
            </button>
          )}
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  const mySeat: Seat = gameState.mySeat;
  const myTeam = mySeat % 2 === 0 ? 0 : 1;
  const names = gameState.playerNames;

  const isDeclaringPhase = gameState.trump === null;
  const isContraPhase = getContraDecidingTeam(gameState) !== null;
  const isMyTurn =
    getContraDecidingTeam(gameState) === null &&
    (gameState.currentPlayerSeat === mySeat ||
      (isDeclaringPhase && gameState.declarantSeat === mySeat));

  return (
    <div className={`game-room${toasts.length > 0 ? ' has-toast' : ''}`}>
      {/* Toast */}
      {toasts.length > 0 && (
        <div className="toast" onClick={dismissToast}>
          {toasts[0]}
        </div>
      )}

      {/* Game Over overlay */}
      {gameResult && (
        <div
          className={`game-result-overlay ${gameResult.winner === myTeam ? 'is-victory' : 'is-defeat'}`}
        >
          <section className="game-result-panel" aria-labelledby="game-result-heading">
            <p className="game-result-eyebrow">{t('game.finalScore')}</p>
            <h1 className="game-result-title" id="game-result-heading">
              {t(gameResult.winner === myTeam ? 'game.victory' : 'game.defeat')}
            </h1>
            <div className="game-result-score">
              <div className="game-result-team">
                <span className="game-result-team-label">
                  {myTeam === 0 ? t('game.yourTeam') : t('game.opponents')}
                </span>
                <strong className={gameResult.winner === 0 ? 'is-winner' : ''}>{gameResult.scores[0]}</strong>
                <span className="game-result-player-names">{names[0]} &amp; {names[2]}</span>
              </div>
              <span className="game-result-separator" aria-hidden="true">:</span>
              <div className="game-result-team">
                <span className="game-result-team-label">
                  {myTeam === 1 ? t('game.yourTeam') : t('game.opponents')}
                </span>
                <strong className={gameResult.winner === 1 ? 'is-winner' : ''}>{gameResult.scores[1]}</strong>
                <span className="game-result-player-names">{names[1]} &amp; {names[3]}</span>
              </div>
            </div>
            <button
              className="game-result-button"
              onClick={returnToLobby}
            >
              {t('game.backToLobby')}
            </button>
          </section>
        </div>
      )}

      {/* Top bar */}
      <header className="game-room-topbar">
        <button
          className="btn-outline"
          onClick={requestReturnToLobby}
        >
          {t('game.backToLobby')}
        </button>
        <div className="game-room-status">
          {isPracticeMode && (
            <span className="game-mode-badge game-mode-badge--practice">
              {t(mode === 'practice-duo' ? 'game.practiceWithPartner' : 'game.practice')}
            </span>
          )}
          {mode === 'botifarra' && gameState && (
            <span className={`game-mode-badge${gameState.ranked ? ' game-mode-badge--ranked' : ''}`}>
              {gameState.ranked ? t('game.ranked') : t('game.normal')}
            </span>
          )}
          <span className={`game-connection${connected ? ' is-online' : ' is-offline'}`}>
            <span className="game-connection-dot" aria-hidden="true" />
            {connected ? t('game.online') : t('game.offline')}
          </span>
          <Link to="/rules" target="_blank" rel="noreferrer" className="game-rules-link">
            {t('nav.rules')}
          </Link>
        </div>
      </header>

      <div className="game-board-shell">
        <Scoreboard gameState={gameState} />
        <GameStatusPanel gameState={gameState} isMyTurn={isMyTurn} />

        {/* Keep the table mounted in one stable stage through bidding and card play. */}
        <div className="game-play-stage">
          <div className="game-table-panel">
            <TrickArea
              gameState={gameState}
              mySeat={mySeat}
              timers={interpolatedTimers?.timers}
              trickReveal={activeTrickReveal}
              trickRevealAnimating={isTrickRevealAnimating}
              finalTrickReveal={finalTrickReveal}
              finalTrickAnimating={finalTrickAnimating}
            />
          </div>

          {/* Bidding and contra prompts float over the table, so showing or hiding them
              never pushes the board up or down. */}
          {(isDeclaringPhase || isContraPhase) && (
            <div className="game-decision-overlay">
              <DeclareTrumpPanel
                gameState={gameState}
                mySeat={mySeat}
                timers={interpolatedTimers?.timers}
                onDeclare={sendDeclareTrump}
                onPass={sendPassDeclaration}
                onPassContra={sendPassContra}
                onContra={sendCallContra}
              />
            </div>
          )}
        </div>

        <div className="game-hand-panel">
          <HandComponent
            gameState={gameState}
            onPlayCard={(card) => sendPlayCard(card)}
            commandErrorVersion={commandErrorVersion}
          />
        </div>
      </div>
      {leaveConfirmDialog}
    </div>
  );
}
