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

  it('renders french content when lang is fr', () => {
    currentLang = 'fr';
    render(<DocsView />);

    expect(screen.getByRole('heading', { name: 'Guide tournoi de fléchettes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Parcours tournoi' })).toBeInTheDocument();
    expect(screen.getByText('Notifications : convocations au pas de tir et changements de format.')).toBeInTheDocument();
  });

  it('renders english content when lang is en', () => {
    currentLang = 'en';
    render(<DocsView />);

    expect(screen.getByRole('heading', { name: 'Darts Tournament Guide' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tournament flow' })).toBeInTheDocument();
    expect(screen.getByText('Targets view: assign target, start, finish, or cancel a match.')).toBeInTheDocument();
  });
});
