import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Scoreboard } from '../../components/Scoreboard.js';
import { mockGameState } from '../fixtures/mockGameState.js';

describe('Scoreboard', () => {
  it('renders team scores', () => {
    render(<Scoreboard gameState={mockGameState} />);
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('renders player names for both teams', () => {
    render(<Scoreboard gameState={mockGameState} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Carol/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/Dave/)).toBeInTheDocument();
  });

  it('has accessible region label', () => {
    render(<Scoreboard gameState={mockGameState} />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('shows round number', () => {
    render(<Scoreboard gameState={mockGameState} />);
    // The round number is alone in its div; use getAllByText to avoid ambiguity
    const roundEls = screen.getAllByText('1');
    expect(roundEls.length).toBeGreaterThan(0);
  });

  it('renders updated scores when gameState changes', () => {
    const { rerender } = render(<Scoreboard gameState={mockGameState} />);
    rerender(<Scoreboard gameState={{ ...mockGameState, scores: [100, 20] }} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });
});
