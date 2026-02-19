import { createElement } from 'react';
import { vi } from 'vitest';
import type { LiveViewMatch } from '../../../../src/components/live-tournament/types';

export const translate = (key: string) => key;

const serviceMocks = vi.hoisted(() => ({
  fetchTournamentLiveView: vi.fn(),
  updateMatchStatus: vi.fn(),
  completeMatch: vi.fn(),
  updateCompletedMatchScores: vi.fn(),
  updatePoolStage: vi.fn(),
  deletePoolStage: vi.fn(),
  completePoolStageWithScores: vi.fn(),
  completeBracketRoundWithScores: vi.fn(),
}));

export const getServiceMocks = () => serviceMocks;

vi.mock('../../../../src/services/tournament-service', () => ({
  fetchTournamentLiveView: serviceMocks.fetchTournamentLiveView,
  updateMatchStatus: serviceMocks.updateMatchStatus,
  completeMatch: serviceMocks.completeMatch,
  updateCompletedMatchScores: serviceMocks.updateCompletedMatchScores,
  updatePoolStage: serviceMocks.updatePoolStage,
  deletePoolStage: serviceMocks.deletePoolStage,
  completePoolStageWithScores: serviceMocks.completePoolStageWithScores,
  completeBracketRoundWithScores: serviceMocks.completeBracketRoundWithScores,
}));

vi.mock('../../../../src/auth/sign-in-panel', () => ({
  default: ({ title, description }: { title: string; description: string }) =>
    createElement(
      'div',
      undefined,
      createElement('span', undefined, title),
      createElement('span', undefined, description)
    ),
}));

export const makeMatch = (id: string, status: string): LiveViewMatch => ({
  id,
  matchNumber: 1,
  roundNumber: 1,
  status,
});
