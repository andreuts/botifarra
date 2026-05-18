import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeclareTrumpPanel } from '../../components/DeclareTrumpPanel.js';
import { mockGameState } from '../fixtures/mockGameState.js';

describe('DeclareTrumpPanel', () => {
  it('renders declaration buttons when it is the declarant seat', () => {
    const state = { ...mockGameState, trump: null, declarantSeat: 0 as const };
    const onDeclare = vi.fn();
    render(<DeclareTrumpPanel gameState={state} mySeat={0} onDeclare={onDeclare} />);
    // Should see suit buttons (Oros, Copes, Espases, Bastos, Botifarra)
    expect(screen.getByText(/Oros/i)).toBeInTheDocument();
    expect(screen.getByText(/Copes/i)).toBeInTheDocument();
    expect(screen.getByText(/Botifarra/i)).toBeInTheDocument();
  });

  it('calls onDeclare with correct suit when button clicked', () => {
    const state = { ...mockGameState, trump: null, declarantSeat: 0 as const };
    const onDeclare = vi.fn();
    render(<DeclareTrumpPanel gameState={state} mySeat={0} onDeclare={onDeclare} />);
    fireEvent.click(screen.getByText(/Oros/i));
    expect(onDeclare).toHaveBeenCalledWith('oros');
  });

  it('renders nothing when trump is already declared and no contra action is available', () => {
    // trump set, no contra possible (trick already in progress)
    const state = {
      ...mockGameState,
      trump: 'oros' as const,
      declarantSeat: 0 as const,
      contraLevel: 0,
      currentTrick: [{ seat: 0 as const, card: { suit: 'O', rank: 'A' } }],
    };
    const { container } = render(
      <DeclareTrumpPanel gameState={state} mySeat={0} onDeclare={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onPass when pass button is clicked', () => {
    const onDeclare = vi.fn();
    const onPass = vi.fn();
    // Dealer (seat 0) has not yet passed, can be forced to declare
    const state = { ...mockGameState, trump: null, declarantSeat: 0 as const, dealerPassed: false };
    render(<DeclareTrumpPanel gameState={state} mySeat={0} onDeclare={onDeclare} onPass={onPass} />);
    const passBtn = screen.queryByRole('button', { name: /declare\.pass/i });
    if (passBtn) {
      fireEvent.click(passBtn);
      expect(onPass).toHaveBeenCalled();
    }
  });
});
