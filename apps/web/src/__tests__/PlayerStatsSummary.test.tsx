import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerStatsSummary } from '../components/PlayerStatsSummary.js';
import type { PlayerStatsDTO } from '@botifarra/shared';

function makeStats(overrides: Partial<PlayerStatsDTO> = {}): PlayerStatsDTO {
  return {
    totalGames: 10,
    wins: 7,
    losses: 3,
    winRate: 0.7,
    currentElo: 1120,
    averageEloChange: 8.5,
    eloHistory: [
      { matchId: 'm1', eloAfter: 1080, eloChange: 20, isRanked: false, createdAt: '2026-05-01T00:00:00Z' },
      { matchId: 'm2', eloAfter: 1100, eloChange: 20, isRanked: false, createdAt: '2026-05-02T00:00:00Z' },
    ],
    rankedEloHistory: [
      { matchId: 'm1', eloAfter: 1080, eloChange: 20, isRanked: true, createdAt: '2026-05-01T00:00:00Z' },
    ],
    topPlayedWith: [
      { userId: 'u2', username: 'Bob', gamesPlayed: 5, winRateVsOpponent: 0.8 },
    ],
    topPlayedAgainst: [
      { userId: 'u3', username: 'Carol', gamesPlayed: 4, winRateVsOpponent: 0.5 },
    ],
    ...overrides,
  };
}

describe('PlayerStatsSummary', () => {
  it('renders the stats heading', () => {
    render(<PlayerStatsSummary stats={makeStats()} />);
    expect(screen.getByText(/history\.stats\.heading/i)).toBeTruthy();
  });

  it('displays totalGames', () => {
    render(<PlayerStatsSummary stats={makeStats({ totalGames: 42 })} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('displays wins and losses', () => {
    render(<PlayerStatsSummary stats={makeStats({ wins: 7, losses: 3 })} />);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('displays win rate as percentage', () => {
    render(<PlayerStatsSummary stats={makeStats({ winRate: 0.7 })} />);
    expect(screen.getByText('70.0%')).toBeTruthy();
  });

  it('displays current ELO rounded', () => {
    render(<PlayerStatsSummary stats={makeStats({ currentElo: 1120.7 })} />);
    expect(screen.getByText('1121')).toBeTruthy();
  });

  it('displays average ELO change with sign', () => {
    render(<PlayerStatsSummary stats={makeStats({ averageEloChange: 8.5 })} />);
    expect(screen.getByText('+8.5')).toBeTruthy();
  });

  it('renders top player names', () => {
    render(<PlayerStatsSummary stats={makeStats()} />);
    expect(screen.getByText(/Bob/i)).toBeTruthy();
    expect(screen.getByText(/Carol/i)).toBeTruthy();
  });

  it('renders "no data" text when ELO history is empty', () => {
    render(
      <PlayerStatsSummary
        stats={makeStats({ eloHistory: [], rankedEloHistory: [] })}
      />,
    );
    // EloGraph should show noData placeholder text
    const noDataItems = screen.getAllByText(/history\.stats\.noData/i);
    expect(noDataItems.length).toBeGreaterThan(0);
  });

  it('handles zero-games edge case gracefully', () => {
    render(
      <PlayerStatsSummary
        stats={makeStats({
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          topPlayedWith: [],
          topPlayedAgainst: [],
        })}
      />,
    );
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0);
  });
});
