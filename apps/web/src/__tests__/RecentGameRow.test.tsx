import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecentGameRow } from '../components/RecentGameRow.js';
import type { RecentGameDTO } from '@botifarra/shared';

function makeMatch(overrides: Partial<RecentGameDTO> = {}): RecentGameDTO {
  return {
    matchId: 'match-1',
    mode: 'public',
    ranked: false,
    status: 'finished',
    players: [
      { userId: 'u1', username: 'Alice', seat: 0, connected: false },
      { userId: 'u2', username: 'Bob', seat: 1, connected: false },
    ],
    scores: [12, 8],
    targetScore: 101,
    createdAt: '2026-05-18T10:00:00.000Z',
    outcome: 'won',
    myTeam: 0,
    finishedAt: '2026-05-18T11:00:00.000Z',
    hasSnapshot: false,
    ...overrides,
  };
}

describe('RecentGameRow', () => {
  it('renders with green-tinted background and "won" label for outcome=won', () => {
    const { container } = render(<RecentGameRow match={makeMatch({ outcome: 'won' })} />);
    // Green background is applied via rgba(39, 174, 96, 0.12)
    const li = container.querySelector('li')!;
    expect(li).toHaveStyle({ background: 'rgba(39, 174, 96, 0.12)' });
    expect(screen.getByText(/history\.outcome\.won/i)).toBeTruthy();
  });

  it('renders with red-tinted background and "lost" label for outcome=lost', () => {
    const { container } = render(<RecentGameRow match={makeMatch({ outcome: 'lost' })} />);
    const li = container.querySelector('li')!;
    expect(li).toHaveStyle({ background: 'rgba(231, 76, 60, 0.12)' });
    expect(screen.getByText(/history\.outcome\.lost/i)).toBeTruthy();
  });

  it('renders neutral background and "in-progress" label for outcome=in-progress', () => {
    const { container } = render(
      <RecentGameRow match={makeMatch({ outcome: 'in-progress', status: 'in-progress', finishedAt: null })} />,
    );
    const li = container.querySelector('li')!;
    // neutral: uses var(--color-surface) which is not a specific rgba
    expect(li.style.background).not.toContain('rgba(39, 174');
    expect(li.style.background).not.toContain('rgba(231, 76');
    expect(screen.getByText(/history\.outcome\.in-progress/i)).toBeTruthy();
  });

  it('shows Resume button for in-progress matches when onResume is provided', async () => {
    const onResume = vi.fn();
    const user = userEvent.setup();
    render(
      <RecentGameRow
        match={makeMatch({ outcome: 'in-progress', status: 'in-progress', finishedAt: null, hasSnapshot: true })}
        onResume={onResume}
      />,
    );
    const btn = screen.getByText(/history\.resume/i);
    expect(btn).toBeTruthy();
    await user.click(btn);
    expect(onResume).toHaveBeenCalledWith('match-1');
  });

  it('does not show Resume button for finished games', () => {
    render(<RecentGameRow match={makeMatch({ outcome: 'won' })} />);
    expect(screen.queryByText(/history\.resume/i)).toBeNull();
  });

  it('renders "Abandonada" label for outcome=abandoned', () => {
    render(<RecentGameRow match={makeMatch({ outcome: 'abandoned', status: 'abandoned', finishedAt: null })} />);
    expect(screen.getByText(/history\.outcome\.abandoned/i)).toBeTruthy();
  });

  it('shows scores', () => {
    render(<RecentGameRow match={makeMatch({ scores: [12, 8] })} />);
    expect(screen.getByText('12 – 8')).toBeTruthy();
  });
});
