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
    expect(screen.getByRole('link', { name: 'Tournois' })).toHaveAttribute('href', '/?status=OPEN');
    expect(screen.getByAltText('Exemple de consultation des inscrits sur un tournoi')).toBeInTheDocument();
  });

  it('renders english player documentation when lang is en', () => {
    currentLang = 'en';
    render(<DocsView accountType="player" />);

    expect(screen.getByRole('heading', { name: 'Quick documentation' })).toBeInTheDocument();
    expect(screen.getByText('Register and follow your matches')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('href', '/?view=equipes');
    expect(screen.getByAltText('Doublette join example')).toBeInTheDocument();
  });

  it('renders admin documentation and screenshots', () => {
    currentLang = 'fr';
    render(<DocsView accountType="admin" />);

    expect(screen.getByText('Piloter le tournoi en mode opérationnel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer un tournoi' })).toHaveAttribute('href', '/?view=create-tournament');
    expect(screen.getByAltText('Vue cibles avec démarrage, saisie de score, clôture et annulation de match')).toBeInTheDocument();
  });
});
