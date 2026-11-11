import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HandComponent } from '../../components/HandComponent.js';
import { mockGameState } from '../fixtures/mockGameState.js';

const onPlayCard = vi.fn();

describe('HandComponent', () => {
  it('renders all cards in hand', () => {
    render(<HandComponent gameState={mockGameState} onPlayCard={onPlayCard} />);
    // Each card renders as role="button"
    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(mockGameState.hand.length);
  });

  it('shows "waiting" status when it is not my turn', () => {
    const notMyTurn = { ...mockGameState, currentPlayerSeat: 1 as const };
    render(<HandComponent gameState={notMyTurn} onPlayCard={onPlayCard} />);
    // The status div has aria-label matching the status text
    const statusEl = screen.getByLabelText('hand.waitingTurn');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl.textContent).toContain('hand.waitingTurn');
  });

  it('shows "your turn" status when it is my turn', () => {
    render(<HandComponent gameState={mockGameState} onPlayCard={onPlayCard} />);
    // On my turn the aria-label reflects the turn key
    const statusEl = screen.getByLabelText('game.currentTurn');
    expect(statusEl).toBeInTheDocument();
  });

  it('disables cards when it is not my turn', () => {
    const notMyTurn = { ...mockGameState, currentPlayerSeat: 1 as const };
    render(<HandComponent gameState={notMyTurn} onPlayCard={onPlayCard} />);
    const hand = screen.getByRole('group', { name: 'hand.yourHand' });
    const cards = hand.querySelectorAll('[aria-label]');
    expect(cards).toHaveLength(notMyTurn.hand.length);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect([...cards].every((card) => card.getAttribute('aria-disabled') === 'true')).toBe(true);
  });

  it('disables off-suit cards when following suit is required', () => {
    const mustFollowSuit = {
      ...mockGameState,
      currentTrick: [{ seat: 3 as const, card: { suit: 'oros' as const, rank: 2 as const } }],
    };
    render(<HandComponent gameState={mustFollowSuit} onPlayCard={onPlayCard} />);
    const hand = screen.getByRole('group', { name: 'hand.yourHand' });
    const cards = hand.querySelectorAll('[aria-label]');

    expect(cards).toHaveLength(mustFollowSuit.hand.length);
    expect(cards[0]).toHaveAttribute('role', 'button');
    expect(cards[1]).toHaveAttribute('aria-disabled', 'true');
    expect(cards[2]).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('does not call onPlayCard for a disabled card', () => {
    const notMyTurn = { ...mockGameState, currentPlayerSeat: 1 as const };
    render(<HandComponent gameState={notMyTurn} onPlayCard={onPlayCard} />);
    const hand = screen.getByRole('group', { name: 'hand.yourHand' });
    const cards = hand.querySelectorAll('[aria-label]');
    fireEvent.click(cards[0]!);
    expect(onPlayCard).not.toHaveBeenCalled();
  });
});
