import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DocsView from '../../../src/components/docs-view';

let currentLang: 'fr' | 'en' = 'fr';

vi.mock('../../../src/i18n', () => ({
  useI18n: () => ({ lang: currentLang }),
}));

describe('docs-view', () => {
  beforeEach(() => {
    currentLang = 'fr';
  });

  it('renders french anonymous documentation when lang is fr', () => {
    currentLang = 'fr';
    render(<DocsView accountType="anonymous" />);

    expect(screen.getByRole('heading', { name: 'Documentation rapide' })).toBeInTheDocument();
    expect(screen.getByText('Découvrir les tournois sans compte')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 : Tournois' })).toHaveAttribute('href', '/?status=OPEN');
    expect(screen.getByAltText('Exemple de consultation des inscrits sur un tournoi')).toBeInTheDocument();
  });

  it('renders english player documentation when lang is en', () => {
    currentLang = 'en';
    render(<DocsView accountType="player" />);

    expect(screen.getByRole('heading', { name: 'Quick documentation' })).toBeInTheDocument();
    expect(screen.getByText('Register and follow your matches')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '3 : Teams' })).toHaveAttribute('href', '/?view=equipes');
    expect(screen.getByAltText('Doublette join example')).toBeInTheDocument();
  });

  it('renders admin documentation and screenshots', () => {
    currentLang = 'fr';
    render(<DocsView accountType="admin" />);

    expect(screen.getByText('Piloter le tournoi en mode opérationnel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 : Créer un tournoi' })).toHaveAttribute('href', '/?view=create-tournament');
    expect(screen.getByAltText('Vue cibles avec démarrage, saisie de score, clôture et annulation de match')).toBeInTheDocument();
  });

  it('renders access link inside description card for anonymous, player, and admin', () => {
    currentLang = 'fr';

    const cases = [
      {
        accountType: 'anonymous' as const,
        linkLabel: '1 : Tournois',
      },
      {
        accountType: 'player' as const,
        linkLabel: '2 : Doublettes',
      },
      {
        accountType: 'admin' as const,
        linkLabel: '1 : Créer un tournoi',
      },
    ];

    for (const testCase of cases) {
      const { unmount } = render(<DocsView accountType={testCase.accountType} />);

      const descriptionCards = screen.getAllByTestId('doc-step-description-card');
      const accessLink = screen.getByRole('link', { name: testCase.linkLabel });
      expect(descriptionCards.some((card) => card.contains(accessLink))).toBe(true);

      unmount();
    }
  }, 15000);
});
