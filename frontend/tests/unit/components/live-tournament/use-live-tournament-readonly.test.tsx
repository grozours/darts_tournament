import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import useLiveTournamentReadonly from '../../../../src/components/live-tournament/use-live-tournament-readonly';

describe('useLiveTournamentReadonly', () => {
  it('returns read-only for non-admin on live view', () => {
    const { result } = renderHook(() => useLiveTournamentReadonly({
      isAdmin: false,
      viewMode: 'live',
    }));

    expect(result.current.isPoolStagesReadonly).toBe(true);
    expect(result.current.isBracketsReadonly).toBe(false);
  });

  it('returns bracket read-only for non-admin on brackets view', () => {
    const { result } = renderHook(() => useLiveTournamentReadonly({
      isAdmin: false,
      viewMode: 'brackets',
    }));

    expect(result.current.isPoolStagesReadonly).toBe(false);
    expect(result.current.isBracketsReadonly).toBe(true);
  });

  it('returns editable flags for admin', () => {
    const { result } = renderHook(() => useLiveTournamentReadonly({
      isAdmin: true,
      viewMode: 'pool-stages',
    }));

    expect(result.current.isPoolStagesReadonly).toBe(false);
    expect(result.current.isBracketsReadonly).toBe(false);
  });
});
