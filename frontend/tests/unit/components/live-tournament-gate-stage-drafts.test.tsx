import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LiveTournamentGate from '../../../src/components/live-tournament/live-tournament-gate';
import useLiveTournamentStageDrafts from '../../../src/components/live-tournament/use-live-tournament-stage-drafts';
import { HookHarness } from './live-tournament/live-tournament-hook-harness';
import { getServiceMocks, translate } from './live-tournament/live-tournament-test-mocks';

const serviceMocks = getServiceMocks();

beforeEach(() => {
  serviceMocks.fetchTournamentLiveView.mockReset();
  serviceMocks.updateMatchStatus.mockReset();
  serviceMocks.completeMatch.mockReset();
  serviceMocks.saveMatchScores.mockReset();
  serviceMocks.updatePoolStage.mockReset();
  serviceMocks.deletePoolStage.mockReset();
  serviceMocks.completePoolStageWithScores.mockReset();
  serviceMocks.completeBracketRoundWithScores.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('live tournament gate', () => {
  it('renders gate states for auth, error, and selection', () => {
    const { rerender } = render(
      <LiveTournamentGate
        authLoading={true}
        authEnabled={false}
        isAuthenticated={false}
        requireTournamentId={false}
        loading={false}
        onRetry={vi.fn()}
        t={translate}
      />
    );

    expect(screen.getByText('auth.checkingSession')).toBeInTheDocument();

    globalThis.window?.history.pushState({}, '', '/?code=abc');
    rerender(
      <LiveTournamentGate
        authLoading={false}
        authEnabled={true}
        isAuthenticated={false}
        requireTournamentId={false}
        loading={false}
        onRetry={vi.fn()}
        t={translate}
      />
    );

    expect(screen.getByText('auth.signInToViewLive')).toBeInTheDocument();
    expect(screen.getByText('Auth callback detected but session not established.')).toBeInTheDocument();

    rerender(
      <LiveTournamentGate
        authLoading={false}
        authEnabled={true}
        isAuthenticated={true}
        authError={new Error('boom')}
        tournamentId="t1"
        requireTournamentId={false}
        loading={false}
        onRetry={vi.fn()}
        t={translate}
      />
    );

    expect(screen.getByText('auth.signInFailed')).toBeInTheDocument();
    expect(screen.getAllByText((_content, element) => (element?.textContent ?? '').includes('boom')).length).toBeGreaterThan(0);
  });

  it('renders tournament selection, loading and retry error states', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <LiveTournamentGate
        authLoading={false}
        authEnabled={false}
        isAuthenticated={false}
        requireTournamentId={true}
        loading={false}
        onRetry={onRetry}
        t={translate}
      />
    );

    expect(screen.getByText('live.select')).toBeInTheDocument();

    rerender(
      <LiveTournamentGate
        authLoading={false}
        authEnabled={false}
        isAuthenticated={false}
        requireTournamentId={false}
        tournamentId="t1"
        loading={true}
        onRetry={onRetry}
        t={translate}
      />
    );
    expect(screen.getByText('live.loading')).toBeInTheDocument();

    rerender(
      <LiveTournamentGate
        authLoading={false}
        authEnabled={false}
        isAuthenticated={false}
        requireTournamentId={false}
        tournamentId="t1"
        loading={false}
        error="boom"
        onRetry={onRetry}
        t={translate}
      />
    );
    expect(screen.getAllByText((_content, element) => (element?.textContent ?? '').includes('boom')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows auth error details and allows anonymous live views without sign-in', () => {
    const error = Object.assign(new Error('failure'), {
      name: 'AuthError',
      error: 'access_denied',
      error_description: 'bad callback',
      state: 's1',
    });

    const { rerender, container } = render(
      <LiveTournamentGate
        authLoading={false}
        authEnabled={true}
        isAuthenticated={true}
        authError={error}
        requireTournamentId={false}
        loading={false}
        onRetry={vi.fn()}
        t={translate}
      />
    );

    expect(screen.getByText('Code:')).toBeInTheDocument();
    expect(screen.getByText('access_denied')).toBeInTheDocument();
    expect(screen.getByText('Description:')).toBeInTheDocument();
    expect(screen.getByText('bad callback')).toBeInTheDocument();
    expect(screen.getByText('Type:')).toBeInTheDocument();
    expect(screen.getByText('AuthError')).toBeInTheDocument();

    rerender(
      <LiveTournamentGate
        authLoading={false}
        authEnabled={true}
        isAuthenticated={false}
        viewMode="live"
        requireTournamentId={false}
        loading={false}
        onRetry={vi.fn()}
        t={translate}
      />
    );

    expect(screen.queryByText('auth.signInToViewLive')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('shows callback hint when sessionStorage timestamp is recent', () => {
    globalThis.window?.history.pushState({}, '', '/');
    globalThis.window?.sessionStorage.setItem('auth0:callback', String(Date.now()));

    render(
      <LiveTournamentGate
        authLoading={false}
        authEnabled={true}
        isAuthenticated={false}
        requireTournamentId={false}
        loading={false}
        onRetry={vi.fn()}
        t={translate}
      />
    );

    expect(screen.getByText('Auth callback detected but session not established.')).toBeInTheDocument();
  });
});

describe('live tournament stage drafts', () => {
  it('manages stage drafts and updates', async () => {
    let drafts: ReturnType<typeof useLiveTournamentStageDrafts> | undefined;
    const stage = {
      id: 'stage-1',
      stageNumber: 1,
      name: 'Stage 1',
      status: 'IN_PROGRESS',
      pools: [
        { id: 'p1', poolNumber: 1, name: 'Pool 1', status: 'IN_PROGRESS' },
        { id: 'p2', poolNumber: 2, name: 'Pool 2', status: 'IN_PROGRESS' },
      ],
      playersPerPool: 4,
    };

    render(
      <HookHarness
        useHook={() => useLiveTournamentStageDrafts()}
        onUpdate={(value) => {
          drafts = value;
        }}
      />
    );

    act(() => {
      drafts?.handleEditStage(stage);
    });

    await waitFor(() => {
      expect(drafts?.editingStageId).toBe('stage-1');
      expect(drafts?.stageStatusDrafts['stage-1']).toBe('IN_PROGRESS');
      expect(drafts?.stagePoolCountDrafts['stage-1']).toBe('2');
      expect(drafts?.stagePlayersPerPoolDrafts['stage-1']).toBe('4');
    });

    act(() => {
      drafts?.handleStageStatusChange('stage-1', 'COMPLETED');
      drafts?.handleStagePoolCountChange('stage-1', '3');
      drafts?.handleStagePlayersPerPoolChange('stage-1', '5');
    });

    await waitFor(() => {
      expect(drafts?.stageStatusDrafts['stage-1']).toBe('COMPLETED');
      expect(drafts?.stagePoolCountDrafts['stage-1']).toBe('3');
      expect(drafts?.stagePlayersPerPoolDrafts['stage-1']).toBe('5');
    });

    act(() => {
      drafts?.cancelEditStage();
    });

    await waitFor(() => {
      expect(drafts?.editingStageId).toBeUndefined();
    });
  });
});
