import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import useLiveTournamentParameters from '../../../../src/components/live-tournament/use-live-tournament-parameters';

const navigateTo = (search: string) => {
  globalThis.history.pushState({}, '', `/${search}`);
  globalThis.dispatchEvent(new PopStateEvent('popstate'));
};

describe('useLiveTournamentParameters', () => {
  afterEach(() => {
    navigateTo('');
  });

  it('reads explicit query parameters and detects aggregate live view', () => {
    navigateTo('?view=live&status=LIVE&stageId=s1&bracketId=b1&screen=screen');

    const { result } = renderHook(() => useLiveTournamentParameters());

    expect(result.current.viewMode).toBe('live');
    expect(result.current.viewStatus).toBe('LIVE');
    expect(result.current.stageId).toBe('s1');
    expect(result.current.bracketId).toBe('b1');
    expect(result.current.tournamentId).toBeUndefined();
    expect(result.current.isAggregateView).toBe(true);
    expect(result.current.screenMode).toBe(true);
  });

  it('falls back to live view when status is live and view is missing', () => {
    navigateTo('?status=live&screen=true');

    const { result } = renderHook(() => useLiveTournamentParameters());

    expect(result.current.viewMode).toBe('live');
    expect(result.current.isAggregateView).toBe(true);
    expect(result.current.screenMode).toBe(true);
  });

  it('does not use aggregate view when tournamentId is set', () => {
    navigateTo('?view=pool-stages&tournamentId=t1&screen=1');

    const { result } = renderHook(() => useLiveTournamentParameters());

    expect(result.current.viewMode).toBe('pool-stages');
    expect(result.current.tournamentId).toBe('t1');
    expect(result.current.isAggregateView).toBe(false);
    expect(result.current.screenMode).toBe(true);
  });

  it('returns undefined view mode when neither view nor live status are provided', () => {
    navigateTo('?status=draft&screen=0');

    const { result } = renderHook(() => useLiveTournamentParameters());

    expect(result.current.viewMode).toBeUndefined();
    expect(result.current.isAggregateView).toBe(false);
    expect(result.current.screenMode).toBe(false);
  });
});
