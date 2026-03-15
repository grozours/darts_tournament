import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TournamentLogoRotator from '../../../../src/components/live-tournament/tournament-logo-rotator';

describe('TournamentLogoRotator', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no logo is provided', () => {
    const { container } = render(
      <TournamentLogoRotator tournamentName="Tournoi" logoUrls={[]} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders the unique normalized logo list and rotates every 5 seconds', async () => {
    vi.useFakeTimers();

    render(
      <TournamentLogoRotator
        tournamentName="Tournoi"
        logoUrls={[' /uploads/a.png ', '/uploads/b.png', '/uploads/a.png']}
      />
    );

    const logo = screen.getByRole('img', { name: 'Tournoi logo' });
    expect(logo).toHaveAttribute('src', '/uploads/a.png');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(logo).toHaveAttribute('src', '/uploads/b.png');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(logo).toHaveAttribute('src', '/uploads/a.png');
  });
});
