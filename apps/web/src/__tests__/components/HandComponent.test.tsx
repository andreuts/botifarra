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
    const statusEl = screen.getByLabelText(/hand\.yourTurn/);
    expect(statusEl).toBeInTheDocument();
  });

  it('does not call onPlayCard when it is not my turn', () => {
    const notMyTurn = { ...mockGameState, currentPlayerSeat: 1 as const };
    render(<HandComponent gameState={notMyTurn} onPlayCard={onPlayCard} />);
    const cards = screen.getAllByRole('button');
    fireEvent.click(cards[0]!);
    expect(onPlayCard).not.toHaveBeenCalled();
  });
});
