import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router';
import { useAuthStore } from '../store/authStore.js';
import { useGameStore } from '../store/gameStore.js';
import { useGameRoom } from '../hooks/useGameRoom.js';
import { HandComponent } from '../components/HandComponent.js';
import { TrickArea } from '../components/TrickArea.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { DeclareTrumpPanel } from '../components/DeclareTrumpPanel.js';
import type { Seat } from '@botifarra/core';
import type { SeatReservationData } from '../hooks/useMatchmakingQueue.js';

export function GamePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const mode = searchParams.get('mode') === 'practice' ? 'practice' : 'botifarra';
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    gameState,
    connected,
    error,
    gameResult,
    toasts,
    dismissToast,
    reset,
    setActiveGameRoomId,
    activeGameRoomId,
  } = useGameStore();

  // Seat reservation passed from matchmaking via route state.
  // Only use it for fresh joins — if we're reconnecting to an active game, force joinById instead.
  const isReconnecting = activeGameRoomId === matchId;
  const seatReservation = !isReconnecting
    ? (location.state as { reservation?: SeatReservationData } | null)?.reservation
    : undefined;

  const { connect, sendDeclareTrump, sendPlayCard, sendPassDeclaration, sendCallContra } =
    useGameRoom(matchId, mode, seatReservation);

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
      <div className="page">
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>Connection Error</h2>
          <p style={{ color: 'var(--color-muted)', marginBottom: '1.5rem' }}>{error}</p>
          <button
            onClick={() => {
              setActiveGameRoomId(null);
              navigate('/');
            }}
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (!connected || !gameState) {
    return (
      <div className="page">
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid var(--color-border)',
              borderTopColor: 'var(--color-accent)',
              borderRadius: '50%',
              animation: 'pulse 0.8s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <p style={{ color: 'var(--color-muted)' }}>
            {connected ? 'Waiting for players…' : 'Connecting to game…'}
          </p>
        </div>
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
  // Contra phase: trump declared, no cards played yet, and contra escalation is still possible
  const contraLevel = gameState.contraLevel ?? 0;
  const isContraPhase =
    gameState.trump !== null &&
    gameState.currentTrick.length === 0 &&
    gameState.completedTricks.length === 0 &&
    contraLevel < 3 &&
    // Sant Vicenç (level 3) blocked on botifarra — so after recontro on botifarra we're done
    !(contraLevel === 2 && gameState.trump === 'botifarra');
  const isPlayingPhase = gameState.trump !== null && gameState.completedTricks.length < 12;
  const isMyTurn = gameState.currentPlayerSeat === mySeat;

  return (
    <div
      style={{
        maxWidth: 700,
        margin: '0 auto',
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        minHeight: '100dvh',
        position: 'relative',
      }}
    >
      {/* Toast */}
      {toasts.length > 0 && (
        <div className="toast" onClick={dismissToast}>
          {toasts[0]}
        </div>
      )}

      {/* Game Over overlay */}
      {gameResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              gameResult.winner === myTeam
                ? 'linear-gradient(135deg, rgba(46, 204, 113, 0.95) 0%, rgba(39, 174, 96, 0.95) 100%)'
                : 'linear-gradient(135deg, rgba(192, 57, 43, 0.95) 0%, rgba(142, 68, 173, 0.95) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            animation: 'fadeIn 0.5s ease',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              maxWidth: 600,
              padding: '3rem 2rem',
              background: 'rgba(0,0,0,0.4)',
              borderRadius: 'var(--radius-lg)',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
          >
            {/* Result title */}
            <div
              style={{
                fontSize: '4.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#fff',
                textShadow: '0 4px 20px rgba(0,0,0,0.5)',
                animation: 'slideDown 0.6s ease-out',
              }}
            >
              {gameResult.winner === myTeam ? '¡Victoria!' : 'Derrota'}
            </div>

            {/* Icon */}
            <div
              style={{
                fontSize: '5rem',
                marginBottom: '1.5rem',
                animation: 'scaleIn 0.5s ease-out 0.3s backwards',
              }}
            >
              {gameResult.winner === myTeam ? '🏆' : '😔'}
            </div>

            {/* Score display */}
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 'var(--radius)',
                padding: '2rem',
                marginBottom: '2rem',
                animation: 'fadeIn 0.6s ease-out 0.5s backwards',
              }}
            >
              <div
                style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: '1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Puntuació Final
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '3rem',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'rgba(255,255,255,0.6)',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {myTeam === 0 ? 'Tu Equipo' : 'Oponentes'}
                  </div>
                  <div
                    style={{
                      fontSize: '3.5rem',
                      fontWeight: 'bold',
                      color: gameResult.winner === 0 ? '#2ecc71' : '#fff',
                      textShadow:
                        gameResult.winner === 0 ? '0 0 20px rgba(46, 204, 113, 0.8)' : 'none',
                    }}
                  >
                    {gameResult.scores[0]}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'rgba(255,255,255,0.5)',
                      marginTop: '0.25rem',
                    }}
                  >
                    {names[0]} & {names[2]}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '2.5rem',
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 300,
                  }}
                >
                  :
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'rgba(255,255,255,0.6)',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {myTeam === 1 ? 'Tu Equipo' : 'Oponentes'}
                  </div>
                  <div
                    style={{
                      fontSize: '3.5rem',
                      fontWeight: 'bold',
                      color: gameResult.winner === 1 ? '#2ecc71' : '#fff',
                      textShadow:
                        gameResult.winner === 1 ? '0 0 20px rgba(46, 204, 113, 0.8)' : 'none',
                    }}
                  >
                    {gameResult.scores[1]}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'rgba(255,255,255,0.5)',
                      marginTop: '0.25rem',
                    }}
                  >
                    {names[1]} & {names[3]}
                  </div>
                </div>
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={() => {
                setActiveGameRoomId(null);
                reset();
                navigate('/');
              }}
              style={{
                background: 'rgba(255,255,255,0.95)',
                color: '#1a1a1a',
                fontWeight: 600,
                padding: '0.75rem 2.5rem',
                fontSize: '1rem',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
              }}
            >
              Volver al Lobby
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn-outline"
          onClick={() => {
            setActiveGameRoomId(null);
            navigate('/');
          }}
          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
        >
          ← Lobby
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
          {mode === 'practice' && (
            <span
              style={{
                background: 'var(--color-surface-2)',
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius)',
                color: 'var(--color-warning)',
              }}
            >
              Practice
            </span>
          )}
          <span style={{ color: connected ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {connected ? '● Online' : '○ Offline'}
          </span>
        </div>
      </header>

      {/* Scoreboard */}
      <Scoreboard gameState={gameState} />

      {/* Dealer indicator */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--color-muted)',
          padding: '0.25rem',
        }}
      >
        Dealer: <strong>{names[gameState.dealerSeat]}</strong>
        {gameState.declarantSeat !== undefined && (
          <>
            {' '}
            · Declares: <strong>{names[gameState.declarantSeat]}</strong>
          </>
        )}
      </div>

      {/* Trump declaration & contra phase */}
      {(isDeclaringPhase || isContraPhase) && (
        <DeclareTrumpPanel
          gameState={gameState}
          mySeat={mySeat}
          onDeclare={sendDeclareTrump}
          onPass={sendPassDeclaration}
          onContra={sendCallContra}
        />
      )}

      {/* Trick area */}
      {isPlayingPhase && (
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <TrickArea gameState={gameState} mySeat={mySeat} />
        </div>
      )}

      {/* Turn indicator */}
      <div
        style={{
          background: isMyTurn ? 'rgba(46, 204, 113, 0.1)' : 'var(--color-surface)',
          border: isMyTurn ? '1px solid var(--color-success)' : '1px solid transparent',
          borderRadius: 'var(--radius)',
          padding: '0.5rem 1rem',
          fontSize: '0.85rem',
          color: isMyTurn ? 'var(--color-success)' : 'var(--color-muted)',
          textAlign: 'center',
          fontWeight: isMyTurn ? 600 : 400,
          transition: 'all 0.2s',
        }}
      >
        {isMyTurn
          ? '✨ Your turn — play a card'
          : gameState.currentPlayerSeat !== null
            ? `Waiting for ${names[gameState.currentPlayerSeat]}…`
            : 'Waiting…'}
      </div>

      {/* Hand */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          marginTop: 'auto',
        }}
      >
        <HandComponent gameState={gameState} onPlayCard={(card) => sendPlayCard(card)} />
      </div>
    </div>
  );
}
