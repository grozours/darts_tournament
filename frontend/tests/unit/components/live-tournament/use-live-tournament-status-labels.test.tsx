import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import useLiveTournamentStatusLabels from '../../../../src/components/live-tournament/use-live-tournament-status-labels';

describe('useLiveTournamentStatusLabels', () => {
  const t = (key: string) => `translated:${key}`;

  it('returns translated status for known label', () => {
    const { result } = renderHook(() => useLiveTournamentStatusLabels(t));

    expect(result.current.getStatusLabel('match', 'IN_PROGRESS')).toBe('translated:status.match.in_progress');
  });

  it('returns raw status when label is unknown', () => {
    const { result } = renderHook(() => useLiveTournamentStatusLabels(t));

    expect(result.current.getStatusLabel('stage', 'PAUSED')).toBe('PAUSED');
  });

  it('returns empty string when status is missing', () => {
    const { result } = renderHook(() => useLiveTournamentStatusLabels(t));

    expect(result.current.getStatusLabel('pool', undefined)).toBe('');
  });
});
