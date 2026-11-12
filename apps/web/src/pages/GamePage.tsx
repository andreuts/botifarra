import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore.js';
import { useGameStore } from '../store/gameStore.js';
import { useGameRoom } from '../hooks/useGameRoom.js';
import { useInterpolatedTimers } from '../hooks/useInterpolatedTimers.js';
import { TrickArea } from '../components/TrickArea.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { GameStatusPanel } from '../components/GameStatusPanel.js';
import { DeclareTrumpPanel } from '../components/DeclareTrumpPanel.js';
import { getContraDecidingTeam } from '../gamePhase.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { SettingsOpenContext } from '../components/SettingsOpenContext.js';
import { api } from '../api/client.js';
import { unlockReactionSounds } from '../utils/reactionSounds.js';
import type { ActiveGameMode } from '../store/gameStore.js';
import type { CompletedTrick, Seat } from '@botifarra/core';
import {
  TRICK_PAUSE_DURATION_MS,
  TRICK_REVEAL_DURATION_MS,
} from '@botifarra/shared';
import type { SeatReservationData } from '../hooks/useMatchmakingQueue.js';

export function GamePage() {
  const openSettings = useContext(SettingsOpenContext);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leavingWaitingRoom, setLeavingWaitingRoom] = useState(false);
  const [endingGame, setEndingGame] = useState(false);
  const [endGameError, setEndGameError] = useState<string | null>(null);
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
    timerSnapshot,
    reset,
    setError,
    setActiveGame,
    activeGame,
    activeGameRoomId,
    roomId: connectedRoomId,
  } = useGameStore();

  // Interpolate authoritative server timer snapshots against monotonic client time.
  const interpolatedTimers = useInterpolatedTimers(timerSnapshot);
  const [finalTrickReveal, setFinalTrickReveal] = useState<CompletedTrick | null>(null);
  const [finalTrickAnimating, setFinalTrickAnimating] = useState(false);
  const [trickReveal, setTrickReveal] = useState<CompletedTrick | null>(null);
  const previousTrickRef = useRef<{ roundNumber: number; count: number } | null>(null);

  useEffect(() => {
    const unlock = () => {
      unlockReactionSounds();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

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
  const isReconnecting =
    searchParams.get('resume') === '1' ||
    (activeGame?.roomId ?? activeGameRoomId) === matchId;
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
    sendReaction,
    commandErrorVersion,
    roomPlayers,
    activeReactions,
    leaveRoom,
  } = useGameRoom(matchId, isPracticeMode ? 'practice' : 'botifarra', seatReservation);

  function returnToLobby() {
    setLeaveConfirmOpen(false);
    leaveRoom();
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
    if (gameState && !gameResult) {
      setEndGameError(null);
      setLeaveConfirmOpen(true);
      return;
    }
    returnToLobby();
  }

  async function endBotGame() {
    if (!user?.accessToken || !gameState?.matchId || endingGame) return;
    setEndingGame(true);
    setEndGameError(null);
    try {
      await api.matches.abandon(gameState.matchId, user.accessToken);
      setLeaveConfirmOpen(false);
      setActiveGame(null);
      leaveRoom();
      reset();
      navigate('/');
    } catch {
      setEndGameError(t('game.endGameFailed'));
    } finally {
      setEndingGame(false);
    }
  }

  const leaveConfirmDialog = (
    <ConfirmDialog
      open={leaveConfirmOpen}
      title={t('game.leaveGameTitle')}
      message={t('game.leaveGameMessage')}
      confirmLabel={t('game.leaveGameConfirm')}
      cancelLabel={t('game.leaveGameCancel')}
      confirmDisabled={endingGame}
      errorMessage={endGameError ?? undefined}
      extraAction={isPracticeMode && !gameResult
        ? { label: endingGame ? t('common.loading') : t('game.endBotGame'), onClick: () => void endBotGame(), dangerous: true }
        : undefined}
      onCancel={() => setLeaveConfirmOpen(false)}
      onConfirm={returnToLobby}
    />
  );

  const gameInProgress = !!gameState && !gameResult;
  useEffect(() => {
    if (!gameInProgress) return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [gameInProgress]);

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

  // Persist the durable match ID separately from the transient Colyseus room ID.
  useEffect(() => {
    if (!connected || !connectedRoomId || !gameState || !matchId || gameResult) return;
    setActiveGame({
      roomId: connectedRoomId,
      matchId: gameState.matchId,
      mode: mode as ActiveGameMode,
      canAbandon: isPracticeMode,
    });
  }, [connected, connectedRoomId, gameState?.matchId, gameResult, isPracticeMode, matchId, mode, setActiveGame]);

  // Clear active game when it ends
  useEffect(() => {
    if (gameResult) {
      setActiveGame(null);
    }
  }, [gameResult, setActiveGame]);

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
        {openSettings && (
          <button
            className="settings-gear settings-gear-loading"
            onClick={openSettings}
            aria-label={t('settings.heading')}
            title={t('settings.heading')}
          >
            ⚙
          </button>
        )}
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
  const playerConnectivity = roomPlayers.reduce<Partial<Record<Seat, boolean>>>((statuses, player) => {
    if (player.seat >= 0 && player.seat <= 3) statuses[player.seat as Seat] = player.connected;
    return statuses;
  }, {});

  const isDeclaringPhase = gameState.trump === null;
  const isContraPhase = getContraDecidingTeam(gameState) !== null;
  const gameModeTone = isPracticeMode ? 'practice' : gameState.ranked ? 'ranked' : 'normal';
  const gameModeLabel = isPracticeMode
    ? null
    : t(gameState.ranked ? 'game.ranked' : 'game.normal');

  return (
    <div className="game-room">
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

      <div className="game-board-shell">
        <header className="game-room-topbar">
          <button
            type="button"
            className="game-room-back"
            onClick={requestReturnToLobby}
            aria-label={t('game.backToLobby')}
            title={t('game.backToLobby')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        </header>
        {openSettings && (
          <button
            className="settings-gear settings-gear-game"
            onClick={openSettings}
            aria-label={t('settings.heading')}
            title={t('settings.heading')}
          >
            ⚙
          </button>
        )}

        <Scoreboard gameState={gameState} />
        <GameStatusPanel gameState={gameState} modeLabel={gameModeLabel} modeTone={gameModeTone} />

        {/* Keep the table mounted in one stable stage through bidding and card play. */}
        <div className="game-play-stage">
          <div className="game-table-panel">
            <TrickArea
              gameState={gameState}
              mySeat={mySeat}
              playerConnectivity={playerConnectivity}
              onPlayCard={(card) => sendPlayCard(card)}
              onReaction={sendReaction}
              activeReactions={activeReactions}
              commandErrorVersion={commandErrorVersion}
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

      </div>
      {leaveConfirmDialog}
    </div>
  );
}
