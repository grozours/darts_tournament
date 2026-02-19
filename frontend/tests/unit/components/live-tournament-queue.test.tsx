import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MatchQueueSection from '../../../src/components/live-tournament/match-queue-section';
import { getServiceMocks, makeMatch, translate } from './live-tournament/live-tournament-test-mocks';

const serviceMocks = getServiceMocks();

beforeEach(() => {
  serviceMocks.fetchTournamentLiveView.mockReset();
  serviceMocks.updateMatchStatus.mockReset();
  serviceMocks.completeMatch.mockReset();
  serviceMocks.updateCompletedMatchScores.mockReset();
  serviceMocks.updatePoolStage.mockReset();
  serviceMocks.deletePoolStage.mockReset();
  serviceMocks.completePoolStageWithScores.mockReset();
  serviceMocks.completeBracketRoundWithScores.mockReset();
});

describe('live tournament match queue', () => {
  it('renders match queue items and start actions', () => {
    const onStartMatch = vi.fn();
    const onTargetSelectionChange = vi.fn();
    const queue = [
      {
        tournamentId: 't1',
        tournamentName: 'Open',
        stageId: 's1',
        stageName: 'Stage 1',
        stageNumber: 1,
        poolId: 'p1',
        poolName: 'Pool 1',
        poolNumber: 1,
        matchId: 'm1',
        matchNumber: 1,
        roundNumber: 1,
        status: 'SCHEDULED',
        targetNumber: 3,
        players: ['Ava', 'Bea'],
        match: makeMatch('m1', 'SCHEDULED'),
      },
    ];

    render(
      <MatchQueueSection
        t={translate}
        queue={queue}
        showTournamentName={true}
        availableTargetsByTournament={new Map([
          ['t1', [{ id: 'target-3', targetNumber: 3 }]],
        ])}
        matchTargetSelections={{ 't1:m1': '3' }}
        updatingMatchId=""
        isPoolStagesReadonly={false}
        getMatchKey={(tournamentId, matchId) => `${tournamentId}:${matchId}`}
        getTargetIdForSelection={() => 'target-3'}
        onTargetSelectionChange={onTargetSelectionChange}
        onStartMatch={onStartMatch}
        getStatusLabel={(_, status) => status ?? ''}
        formatTargetLabel={(value) => value}
        getTargetLabel={(target) => String(target.targetNumber)}
      />
    );

    expect(screen.getByText('live.queue.title')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'live.startMatch' });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onStartMatch).toHaveBeenCalledWith('t1', 'm1', 'target-3');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });
    expect(onTargetSelectionChange).toHaveBeenCalledWith('t1:m1', '3');
  });
});
