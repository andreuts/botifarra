import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppShell } from '../../components/AppShell.js';

const mockLogout = vi.fn();

vi.mock('../../store/authStore.js', () => ({
  useAuthStore: () => ({
    user: { username: 'testuser', accessToken: 'token' },
    logout: mockLogout,
  }),
}));

vi.mock('../../components/SettingsPanel.js', () => ({
  SettingsPanel: () => null,
}));

function renderAppShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <main>content</main>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell nav user section', () => {
  beforeEach(() => {
    mockLogout.mockClear();
  });

  it('shows the logged-in username in the nav', () => {
    renderAppShell('/');
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveTextContent('testuser');
  });

  it('shows a sign-out button in the nav', () => {
    renderAppShell('/');
    const nav = screen.getByRole('navigation');
    const btn = nav.querySelector('button.app-nav-signout');
    expect(btn).not.toBeNull();
  });

  it('calls logout when the sign-out button is clicked', () => {
    renderAppShell('/');
    const nav = screen.getByRole('navigation');
    const btn = nav.querySelector('button.app-nav-signout') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('does not show the nav on the game page', () => {
    renderAppShell('/match/abc123');
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
