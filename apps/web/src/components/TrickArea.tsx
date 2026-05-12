import type { Seat } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import { CardComponent, EmptyCardSlot } from './CardComponent.js';

interface TrickAreaProps {
  gameState: PlayerGameStateDTO;
  mySeat: Seat;
}

export function TrickArea({ gameState, mySeat }: TrickAreaProps) {
  const { currentTrick, playerNames, currentPlayerSeat } = gameState;

  // Relative seat positions around the table
  const partner   = ((mySeat + 2) % 4) as Seat;
  const leftOpp   = ((mySeat + 1) % 4) as Seat;
  const rightOpp  = ((mySeat + 3) % 4) as Seat;

  function cardFor(seat: Seat) {
    return currentTrick.find((tc) => tc.seat === seat)?.card ?? null;
  }

  function Slot({ seat, position }: { seat: Seat; position: string }) {
    const card = cardFor(seat);
    const name = seat === mySeat ? 'You' : (playerNames[seat] ?? `Seat ${seat}`);
    const isActive = currentPlayerSeat === seat;
    const teamClass = seat % 2 === 0 ? 'team-0' : 'team-1';

    return (
      <div
        className={position}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
        aria-label={`${name}${card ? '' : isActive ? ' — waiting to play' : ''}`}
      >
        <span className={`seat-badge ${teamClass}${isActive ? ' active' : ''}`}>
          {isActive && (
            <span
              aria-hidden="true"
              style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block', animation: 'pulse 1s infinite' }}
            />
          )}
          {name}
        </span>
        {card
          ? <CardComponent card={card} small playAnimate />
          : <EmptyCardSlot small label="" />
        }
      </div>
    );
  }

  // Trump label for center
  const trumpLabel: Record<string, string> = {
    oros: 'Oros', copes: 'Copes', espases: 'Espases', bastos: 'Bastos',
    botifarra: 'Botifarra',
  };

  return (
    <div
      className="trick-grid"
      role="region"
      aria-label="Current trick"
    >
      <Slot seat={partner}  position="top"    />
      <Slot seat={leftOpp}  position="left"   />
      <div
        className="center"
        aria-label={gameState.trump ? `Trump: ${trumpLabel[gameState.trump] ?? gameState.trump}` : 'No trump yet'}
        style={{
          width: 54, height: 64,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 2,
        }}
      >
        {gameState.trump && gameState.trump !== 'botifarra' ? (
          <>
            <span style={{ fontSize: '0.6rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trump</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-gold)', fontWeight: 700, textTransform: 'capitalize' }}>
              {gameState.trump}
            </span>
          </>
        ) : gameState.trump === 'botifarra' ? (
          <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 700 }}>BOTIFARRA</span>
        ) : null}
      </div>
      <Slot seat={rightOpp} position="right"  />
      <Slot seat={mySeat}   position="bottom" />
    </div>
  );
}

