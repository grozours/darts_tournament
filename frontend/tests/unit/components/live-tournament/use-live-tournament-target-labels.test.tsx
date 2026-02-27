import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useLiveTournamentTargetLabels from '../../../../src/components/live-tournament/use-live-tournament-target-labels';

const formatTargetLabelMock = vi.fn();
const getTargetLabelMock = vi.fn();
const getMatchTargetLabelMock = vi.fn();

vi.mock('../../../../src/components/live-tournament/target-utilities', () => ({
  formatTargetLabel: (...args: unknown[]) => formatTargetLabelMock(...args),
  getTargetLabel: (...args: unknown[]) => getTargetLabelMock(...args),
  getMatchTargetLabel: (...args: unknown[]) => getMatchTargetLabelMock(...args),
}));

describe('useLiveTournamentTargetLabels', () => {
  beforeEach(() => {
    formatTargetLabelMock.mockReset();
    getTargetLabelMock.mockReset();
    getMatchTargetLabelMock.mockReset();
  });

  it('delegates target label helpers with translator', () => {
    const t = (key: string) => `t:${key}`;
    formatTargetLabelMock.mockReturnValue('formatted');
    getTargetLabelMock.mockReturnValue('target');
    getMatchTargetLabelMock.mockReturnValue('match-target');

    const { result } = renderHook(() => useLiveTournamentTargetLabels(t));

    expect(result.current.formatTargetLabel('A1')).toBe('formatted');
    expect(result.current.getTargetLabel({ number: 1 } as never)).toBe('target');
    expect(result.current.getMatchTargetLabel({ number: 2 } as never)).toBe('match-target');

    expect(formatTargetLabelMock).toHaveBeenCalledWith('A1', t);
    expect(getTargetLabelMock).toHaveBeenCalledWith({ number: 1 }, t);
    expect(getMatchTargetLabelMock).toHaveBeenCalledWith({ number: 2 }, t);
  });
});
