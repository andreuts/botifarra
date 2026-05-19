import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LobbyCard } from '../../components/LobbyCard.js';

describe('LobbyCard', () => {
  it('renders the title in an h3', () => {
    render(
      <LobbyCard title="Solo Match" description="Play alone">
        <button>Start</button>
      </LobbyCard>,
    );
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Solo Match');
  });

  it('renders the description in a paragraph', () => {
    render(
      <LobbyCard title="Solo Match" description="Play alone">
        <button>Start</button>
      </LobbyCard>,
    );
    expect(screen.getByText('Play alone')).toBeInTheDocument();
  });

  it('renders children inside .lobby-card-actions', () => {
    const { container } = render(
      <LobbyCard title="Solo Match" description="Play alone">
        <button>Start</button>
      </LobbyCard>,
    );
    const actions = container.querySelector('.lobby-card-actions');
    expect(actions).not.toBeNull();
    expect(actions!.querySelector('button')).not.toBeNull();
  });

  it('adds lobby-card--disabled class when disabled is true', () => {
    const { container } = render(
      <LobbyCard title="Solo Match" description="Play alone" disabled>
        <button>Start</button>
      </LobbyCard>,
    );
    expect(container.querySelector('.lobby-card--disabled')).not.toBeNull();
  });

  it('does not add lobby-card--disabled class when disabled is false', () => {
    const { container } = render(
      <LobbyCard title="Solo Match" description="Play alone" disabled={false}>
        <button>Start</button>
      </LobbyCard>,
    );
    expect(container.querySelector('.lobby-card--disabled')).toBeNull();
  });
});
