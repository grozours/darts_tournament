import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PoolStageCard, {
  buildOptimisticPoolQueues,
  buildPoolAvailabilityByPoolId,
  computeOptimisticStartTimes,
  findBestOptimisticCandidate,
  findEarliestAvailabilityIndex,
  formatScheduledMatchTime,
  getBestTargetAndPoolSlot,
  getEstimatedMatchDurationMinutes,
  getOptimisticScheduleBaseDateTime,
  getPoolMaxConcurrentMatches,
  isRemainingStage,
  toValidDate,
} from '../../../src/components/live-tournament/pool-stage-card';

vi.mock('../../../src/components/live-tournament/match-score-inputs', () => ({
  default: () => <div>match-score-inputs</div>,
}));

vi.mock('../../../src/components/live-tournament/match-target-selector', () => ({
  default: () => <div>match-target-selector</div>,
}));

const baseProperties = {
  t: (key: string) => key,
  tournamentId: 't1',
  tournamentStartTime: new Date('2026-04-10T10:00:00.000Z').toISOString(),
  tournamentStatus: 'LIVE',
  doubleStageEnabled: false,
  stage: {
    id: 'stage-1',
    stageNumber: 1,
    name: 'Stage 1',
    status: 'IN_PROGRESS',
    playersPerPool: 4,
    pools: [],
  },
  estimatedStartOffsetMinutes: 0,
  isAdmin: true,
  isPoolStagesReadonly: false,
  getStatusLabel: (_scope: string, status?: string) => status ?? '',
  getMatchTargetLabel: () => 'Target',
  getTargetLabel: () => 'Target',
  matchScores: {},
  matchTargetSelections: {},
  updatingMatchId: '',
  resettingPoolId: '',
  editingMatchId: '',
  availableTargetsByTournament: new Map(),
  schedulableTargetCount: 1,
  getMatchKey: () => 'key',
  getTargetIdForSelection: () => '',
  onTargetSelectionChange: vi.fn(),
  onScoreChange: vi.fn(),
  onStartMatch: vi.fn(),
  onCompleteMatch: vi.fn(),
  onCancelMatch: vi.fn(),
  onEditMatch: vi.fn(),
  onSaveMatchScores: vi.fn(),
  onCancelMatchEdit: vi.fn(),
  onResetPoolMatches: vi.fn(),
  onEditStage: vi.fn(),
  onCancelEditStage: vi.fn(),
  onUpdateStage: vi.fn(),
  onCompleteStageWithScores: vi.fn(),
  onDeleteStage: vi.fn(),
  onRecomputeDoubleStage: vi.fn(),
  onStagePoolCountChange: vi.fn(),
  onStagePlayersPerPoolChange: vi.fn(),
  onStageStatusChange: vi.fn(),
  onLaunchStage: vi.fn(),
  onResetStage: vi.fn(),
  canDeleteStage: true,
  preferredPlayerId: undefined,
  editingStageId: undefined,
  updatingStageId: undefined,
  stageStatusDrafts: {},
  stagePoolCountDrafts: {},
  stagePlayersPerPoolDrafts: {},
};

describe('PoolStageCard', () => {
  it('shows empty pools message when no pools exist', () => {
    render(<PoolStageCard {...baseProperties} isPoolStagesReadonly={true} />);
    expect(screen.getByText('live.noPools')).toBeInTheDocument();
  });

  it('shows stage actions when editable', () => {
    render(<PoolStageCard {...baseProperties} />);

    expect(screen.getByText('live.completeStage')).toBeInTheDocument();
    expect(screen.getByText('live.editStage')).toBeInTheDocument();
    expect(screen.getByText('common.delete')).toBeInTheDocument();

    fireEvent.click(screen.getByText('live.completeStage'));
    expect(baseProperties.onCompleteStageWithScores).toHaveBeenCalledWith('t1', baseProperties.stage);
  });

  it('renders edit controls when editing stage', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        editingStageId="stage-1"
        stagePoolCountDrafts={{ 'stage-1': '3' }}
        stagePlayersPerPoolDrafts={{ 'stage-1': '4' }}
        stageStatusDrafts={{ 'stage-1': 'EDITION' }}
      />
    );

    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('EDITION')).toBeInTheDocument();
  });

  it('renders pool assignments for the active pool', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          pools: [
            {
              id: 'p1',
              poolNumber: 1,
              name: 'Pool 1',
              status: 'IN_PROGRESS',
              assignments: [
                {
                  id: 'a1',
                  player: { id: 'pl1', firstName: 'Ava', lastName: 'Archer' },
                },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getAllByText('Ava Archer').length).toBeGreaterThan(0);
  });

  it('hides fill and edit stage actions when dependent stages are not completed', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          status: 'EDITION',
        }}
        canManageStageActions={false}
      />
    );

    expect(screen.queryByText('live.fillStage')).not.toBeInTheDocument();
    expect(screen.queryByText('live.editStage')).not.toBeInTheDocument();
    expect(screen.getByText('live.resetStage')).toBeInTheDocument();
  });

  it('shows fill and edit stage actions when dependent stages are completed', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          status: 'EDITION',
        }}
        canManageStageActions={true}
      />
    );

    expect(screen.getByText('live.fillStage')).toBeInTheDocument();
    expect(screen.getByText('live.editStage')).toBeInTheDocument();
  });

  it('shows recompute action for completed double-stage and triggers callback', () => {
    const onRecomputeDoubleStage = vi.fn();
    render(
      <PoolStageCard
        {...baseProperties}
        doubleStageEnabled
        onRecomputeDoubleStage={onRecomputeDoubleStage}
        stage={{
          ...baseProperties.stage,
          stageNumber: 2,
          status: 'COMPLETED',
        }}
      />
    );

    fireEvent.click(screen.getByText('live.recomputeDoubleStage'));
    expect(onRecomputeDoubleStage).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'stage-1' }));
  });

  it('shows launch label when assignments exist and toggles completed matches visibility', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          status: 'EDITION',
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ada', lastName: 'L' } }],
              matches: [
                {
                  id: 'm1',
                  status: 'COMPLETED',
                  matchNumber: 1,
                  roundNumber: 1,
                  playerMatches: [
                    { playerPosition: 1, player: { id: 'p1', firstName: 'Ada', lastName: 'L' }, scoreTotal: 3 },
                    { playerPosition: 2, player: { id: 'p2', firstName: 'Bob', lastName: 'K' }, scoreTotal: 1 },
                  ],
                },
                {
                  id: 'm2',
                  status: 'SCHEDULED',
                  matchNumber: 2,
                  roundNumber: 1,
                  playerMatches: [
                    { playerPosition: 1, player: { id: 'p1', firstName: 'Ada', lastName: 'L' } },
                    { playerPosition: 2, player: { id: 'p2', firstName: 'Bob', lastName: 'K' } },
                  ],
                },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getByText('live.launchStage')).toBeInTheDocument();
    expect(screen.queryByText('Match 1 · Round 1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('live.showCompletedMatches'));
    expect(screen.getByText('Match 1 · Round 1')).toBeInTheDocument();
    expect(screen.getByText('live.hideCompletedMatches')).toBeInTheDocument();
  });

  it('respects confirmation before resetting a pool or cancelling an in-progress match', () => {
    const onResetPoolMatches = vi.fn();
    const onCancelMatch = vi.fn();
    const confirmSpy = vi.spyOn(globalThis, 'confirm');

    confirmSpy.mockReturnValueOnce(false).mockReturnValueOnce(true).mockReturnValueOnce(true);

    render(
      <PoolStageCard
        {...baseProperties}
        onResetPoolMatches={onResetPoolMatches}
        onCancelMatch={onCancelMatch}
        stage={{
          ...baseProperties.stage,
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ada', lastName: 'L' } }],
              matches: [
                {
                  id: 'm1',
                  status: 'IN_PROGRESS',
                  matchNumber: 1,
                  roundNumber: 1,
                  playerMatches: [
                    { playerPosition: 1, player: { id: 'p1', firstName: 'Ada', lastName: 'L' } },
                    { playerPosition: 2, player: { id: 'p2', firstName: 'Bob', lastName: 'K' } },
                  ],
                },
              ],
            },
          ],
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'live.resetPool' }));
    expect(onResetPoolMatches).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'live.resetPool' }));
    expect(onResetPoolMatches).toHaveBeenCalledWith('t1', 'stage-1', 'pool-1');

    fireEvent.click(screen.getByText('targets.cancelMatch'));
    expect(onCancelMatch).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'm1' }));

    confirmSpy.mockRestore();
  });

  it('toggles readonly match list visibility', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        isPoolStagesReadonly
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'IN_PROGRESS',
            assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ada', lastName: 'L' } }],
            matches: [{
              id: 'm1',
              status: 'SCHEDULED',
              matchNumber: 1,
              roundNumber: 1,
              playerMatches: [],
            }],
          }],
        }}
      />
    );

    expect(screen.queryByText('Match 1 · Round 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('live.showMatches'));
    expect(screen.getByText('Match 1 · Round 1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('live.hideMatches'));
    expect(screen.queryByText('Match 1 · Round 1')).not.toBeInTheDocument();
  });

  it('renders scheduled/in-progress/completed match actions and handlers', () => {
    const onEditMatch = vi.fn();
    const onSaveMatchScores = vi.fn();
    const onCancelMatchEdit = vi.fn();
    const onStartMatch = vi.fn();
    const getTargetIdForSelection = vi.fn((_tId: string, number_: string) => (number_ === '7' ? 'target-7' : undefined));
    const getMatchKey = vi.fn((_tId: string, matchId: string) => `k-${matchId}`);
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    render(
      <PoolStageCard
        {...baseProperties}
        onEditMatch={onEditMatch}
        onSaveMatchScores={onSaveMatchScores}
        onCancelMatchEdit={onCancelMatchEdit}
        onStartMatch={onStartMatch}
        getTargetIdForSelection={getTargetIdForSelection}
        getMatchKey={getMatchKey}
        editingMatchId="k-c1"
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'IN_PROGRESS',
            assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ada', lastName: 'L' } }],
            matches: [
              {
                id: 's1',
                status: 'SCHEDULED',
                matchNumber: 1,
                roundNumber: 1,
                scheduledAt: 'invalid-date',
                playerMatches: [],
              },
              {
                id: 'p1',
                status: 'IN_PROGRESS',
                matchNumber: 2,
                roundNumber: 1,
                target: { id: 'tid-1', targetNumber: 4 },
                playerMatches: [],
              },
              {
                id: 'c1',
                status: 'COMPLETED',
                matchNumber: 3,
                roundNumber: 1,
                target: { id: 'tid-7', targetNumber: 7 },
                playerMatches: [
                  { playerPosition: 1, player: { id: 'p1', firstName: 'Ada', lastName: 'L' }, scoreTotal: 3 },
                  { playerPosition: 2, player: { id: 'p2', firstName: 'Bob', lastName: 'K' }, scoreTotal: 1 },
                ],
                winner: { id: 'p1', firstName: 'Ada', lastName: 'L' },
              },
            ],
          }],
        }}
      />
    );

    expect(screen.getByText((text) => text.includes('live.matchStartTime'))).toBeInTheDocument();
    expect(screen.getByText('match-target-selector')).toBeInTheDocument();
    expect(screen.getByText('live.queue.targetLabel: Target')).toBeInTheDocument();
    expect(screen.getAllByText('match-score-inputs').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('live.showCompletedMatches'));

    fireEvent.click(screen.getAllByText('live.saveScores')[0] as HTMLButtonElement);
    fireEvent.click(screen.getByText('common.cancel'));
    expect(onSaveMatchScores).toHaveBeenCalled();
    expect(onCancelMatchEdit).toHaveBeenCalledTimes(1);
    expect(getTargetIdForSelection).toHaveBeenCalledWith('t1', '7');
    expect(onStartMatch).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('reopens a completed match when target mapping exists and confirmation is accepted', () => {
    const onStartMatch = vi.fn();
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    render(
      <PoolStageCard
        {...baseProperties}
        onStartMatch={onStartMatch}
        getMatchKey={(_tId: string, matchId: string) => `k-${matchId}`}
        getTargetIdForSelection={(_tId: string, number_: string) => (number_ === '12' ? 'target-12' : undefined)}
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'IN_PROGRESS',
            assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ada', lastName: 'L' } }],
            matches: [{
              id: 'c3',
              status: 'COMPLETED',
              matchNumber: 1,
              roundNumber: 1,
              target: { id: 'tid-12', targetNumber: 12 },
              playerMatches: [
                { playerPosition: 1, player: { id: 'p1', firstName: 'Ada', lastName: 'L' }, scoreTotal: 3 },
                { playerPosition: 2, player: { id: 'p2', firstName: 'Bob', lastName: 'K' }, scoreTotal: 2 },
              ],
            }],
          }],
        }}
      />
    );

    fireEvent.click(screen.getByText('live.showCompletedMatches'));
    fireEvent.click(screen.getByText('live.reopenMatch'));

    expect(onStartMatch).toHaveBeenCalledWith('t1', 'c3', 'target-12');
    confirmSpy.mockRestore();
  });

  it('disables reopen when completed match has no target mapping and supports custom participant labels', () => {
    const getParticipantLabel = vi.fn((player?: { id?: string }) => `P:${player?.id ?? 'x'}`);
    const onEditMatch = vi.fn();

    render(
      <PoolStageCard
        {...baseProperties}
        getParticipantLabel={getParticipantLabel}
        onEditMatch={onEditMatch}
        getTargetIdForSelection={() => undefined}
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'IN_PROGRESS',
            assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ada', lastName: 'L' } }],
            matches: [{
              id: 'c2',
              status: 'COMPLETED',
              matchNumber: 1,
              roundNumber: 1,
              playerMatches: [
                { playerPosition: 1, player: { id: 'p1', firstName: 'Ada', lastName: 'L' }, scoreTotal: 3 },
                { playerPosition: 2, player: { id: 'p2', firstName: 'Bob', lastName: 'K' }, scoreTotal: 1 },
              ],
              winner: { id: 'p1', firstName: 'Ada', lastName: 'L' },
            }],
          }],
        }}
      />
    );

    fireEvent.click(screen.getByText('live.showCompletedMatches'));
    const reopen = screen.getByText('live.reopenMatch');
    expect(reopen).toBeDisabled();

    fireEvent.click(screen.getByText('live.editScore'));
    expect(onEditMatch).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'c2' }));
    expect(screen.getAllByText('P:p1').length).toBeGreaterThan(0);
  });

  it('handles non-admin multi-pool selection and active pool switching', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        isAdmin={false}
        stage={{
          ...baseProperties.stage,
          pools: [
            {
              id: 'pool-a',
              poolNumber: 1,
              name: 'Pool A',
              status: 'IN_PROGRESS',
              assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'A', lastName: 'A' } }],
              matches: [],
            },
            {
              id: 'pool-b',
              poolNumber: 2,
              name: 'Pool B',
              status: 'NOT_STARTED',
              assignments: [{ id: 'a2', player: { id: 'p2', firstName: 'B', lastName: 'B' } }],
              matches: [],
            },
          ],
        }}
      />
    );

    expect(screen.queryByRole('button', { name: 'live.resetPool' })).not.toBeInTheDocument();
    expect(screen.getByText('Pool 1 of 2: Pool A')).toBeInTheDocument();

    fireEvent.click(screen.getByText('02 · Pool B'));
    expect(screen.getByText('Pool 2 of 2: Pool B')).toBeInTheDocument();
  });

  it('renders no-assignment/no-standings/no-matches fallbacks and completed-only hidden state', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'IN_PROGRESS',
            assignments: [],
            matches: [{
              id: 'c-only',
              status: 'COMPLETED',
              matchNumber: 1,
              roundNumber: 1,
              playerMatches: [],
            }],
          }],
        }}
      />
    );

    expect(screen.getByText('live.noAssignments')).toBeInTheDocument();
    expect(screen.getAllByText('live.noStandings').length).toBeGreaterThan(0);
    expect(screen.getByText('live.noMatches')).toBeInTheDocument();
    fireEvent.click(screen.getByText('live.showCompletedMatches'));
    expect(screen.getByText('Match 1 · Round 1')).toBeInTheDocument();
  });

  it('disables stage reset/launch outside LIVE and shows updating labels', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        tournamentStatus="OPEN"
        updatingStageId="stage-1"
        stage={{
          ...baseProperties.stage,
          status: 'EDITION',
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'NOT_STARTED',
            assignments: [],
            matches: [],
          }],
        }}
      />
    );

    expect(screen.getByText('live.resettingStage')).toBeDisabled();
    expect(screen.getByText('live.fillingStage')).toBeDisabled();
  });

  it('supports stage editing callbacks and shows stage format chip', () => {
    const onStagePoolCountChange = vi.fn();
    const onStagePlayersPerPoolChange = vi.fn();
    const onStageStatusChange = vi.fn();
    const onUpdateStage = vi.fn();
    const onCancelEditStage = vi.fn();

    render(
      <PoolStageCard
        {...baseProperties}
        editingStageId="stage-1"
        stage={{
          ...baseProperties.stage,
          matchFormatKey: 'BO5',
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'IN_PROGRESS',
            assignments: [],
            matches: [],
          }],
        }}
        stagePoolCountDrafts={{ 'stage-1': '3' }}
        stagePlayersPerPoolDrafts={{ 'stage-1': '5' }}
        stageStatusDrafts={{ 'stage-1': 'NOT_STARTED' }}
        onStagePoolCountChange={onStagePoolCountChange}
        onStagePlayersPerPoolChange={onStagePlayersPerPoolChange}
        onStageStatusChange={onStageStatusChange}
        onUpdateStage={onUpdateStage}
        onCancelEditStage={onCancelEditStage}
      />
    );

    expect(screen.getByText('BO5')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '4' } });
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '6' } });
    fireEvent.change(screen.getByDisplayValue('NOT_STARTED'), { target: { value: 'EDITION' } });
    fireEvent.click(screen.getByText('live.updateStage'));
    fireEvent.click(screen.getByText('common.cancel'));

    expect(onStagePoolCountChange).toHaveBeenCalledWith('stage-1', '4');
    expect(onStagePlayersPerPoolChange).toHaveBeenCalledWith('stage-1', '6');
    expect(onStageStatusChange).toHaveBeenCalledWith('stage-1', 'EDITION');
    expect(onUpdateStage).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'stage-1' }));
    expect(onCancelEditStage).toHaveBeenCalledTimes(1);
  });

  it('auto-selects pool from preferred player assignment', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        preferredPlayerId="target-player"
        stage={{
          ...baseProperties.stage,
          pools: [
            {
              id: 'pool-a',
              poolNumber: 1,
              name: 'Pool A',
              status: 'IN_PROGRESS',
              assignments: [{ id: 'a1', player: { id: 'other', firstName: 'A', lastName: 'A' } }],
              matches: [],
            },
            {
              id: 'pool-b',
              poolNumber: 2,
              name: 'Pool B',
              status: 'IN_PROGRESS',
              assignments: [{ id: 'a2', player: { id: 'target-player', firstName: 'B', lastName: 'B' } }],
              matches: [],
            },
          ],
        }}
      />
    );

    expect(screen.getByText('Pool 2 of 2: Pool B')).toBeInTheDocument();
  });

  it('triggers reset/launch/edit/delete stage callbacks', () => {
    const onResetStage = vi.fn();
    const onLaunchStage = vi.fn();
    const onEditStage = vi.fn();
    const onDeleteStage = vi.fn();

    render(
      <PoolStageCard
        {...baseProperties}
        onResetStage={onResetStage}
        onLaunchStage={onLaunchStage}
        onEditStage={onEditStage}
        onDeleteStage={onDeleteStage}
        stage={{
          ...baseProperties.stage,
          status: 'EDITION',
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'NOT_STARTED',
            assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'A', lastName: 'A' } }],
            matches: [],
          }],
        }}
      />
    );

    fireEvent.click(screen.getByText('live.resetStage'));
    fireEvent.click(screen.getByText('live.launchStage'));
    fireEvent.click(screen.getByText('live.editStage'));
    fireEvent.click(screen.getByText('common.delete'));

    expect(onResetStage).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'stage-1' }));
    expect(onLaunchStage).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'stage-1' }));
    expect(onEditStage).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'stage-1' }));
    expect(onDeleteStage).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'stage-1' }));
  });

  it('shows updating labels for in-progress and completed edit actions', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        editingMatchId="k-completed"
        updatingMatchId="k-in-progress"
        getMatchKey={(_t, m) => `k-${m}`}
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'IN_PROGRESS',
            assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'A', lastName: 'A' } }],
            matches: [
              {
                id: 'scheduled',
                status: 'SCHEDULED',
                matchNumber: 1,
                roundNumber: 1,
                scheduledAt: '2026-04-10T12:10:00.000Z',
                matchFormatKey: 'BO3',
                playerMatches: [],
              },
              {
                id: 'in-progress',
                status: 'IN_PROGRESS',
                matchNumber: 2,
                roundNumber: 1,
                playerMatches: [],
              },
              {
                id: 'completed',
                status: 'COMPLETED',
                matchNumber: 3,
                roundNumber: 1,
                target: { id: 't1', targetNumber: 5 },
                playerMatches: [
                  { playerPosition: 1, player: { id: 'p1', firstName: 'A', lastName: 'A' }, scoreTotal: 3 },
                  { playerPosition: 2, player: { id: 'p2', firstName: 'B', lastName: 'B' }, scoreTotal: 2 },
                ],
              },
            ],
          }],
        }}
      />
    );

    fireEvent.click(screen.getByText('live.showCompletedMatches'));
    expect(screen.getAllByText('live.savingMatch').length).toBeGreaterThan(0);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes('live.matchStartTime'))).toBeInTheDocument();
  });

  it('resets active pool when pools list changes or disappears', () => {
    const { rerender } = render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-a',
            poolNumber: 1,
            name: 'Pool A',
            status: 'IN_PROGRESS',
            assignments: [],
            matches: [],
          }],
        }}
      />
    );

    expect(screen.getByText('Pool 1 of 1: Pool A')).toBeInTheDocument();

    rerender(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-b',
            poolNumber: 2,
            name: 'Pool B',
            status: 'IN_PROGRESS',
            assignments: [],
            matches: [],
          }],
        }}
      />
    );

    expect(screen.getByText('Pool 2 of 1: Pool B')).toBeInTheDocument();

    rerender(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          pools: [],
        }}
      />
    );

    expect(screen.getByText('live.noPools')).toBeInTheDocument();
  });

  it('uses duration and schedule overrides in stage header', () => {
    const start = new Date('2026-04-10T10:00:00.000Z');
    const end = new Date('2026-04-10T12:30:00.000Z');

    render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          status: 'IN_PROGRESS',
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'COMPLETED',
            assignments: [],
            matches: [],
          }],
        }}
        estimatedDurationMinutesOverride={150}
        estimatedStartTimeOverride={start}
        estimatedEndTimeOverride={end}
        optimisticStartTimeByMatchIdOverride={new Map([['m1', '10:00']])}
      />
    );

    expect(screen.getByText('02:30')).toBeInTheDocument();
  });

  it('shows completed winner with fallback name formatting', () => {
    render(
      <PoolStageCard
        {...baseProperties}
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'IN_PROGRESS',
            assignments: [],
            matches: [{
              id: 'cw',
              status: 'COMPLETED',
              matchNumber: 1,
              roundNumber: 1,
              playerMatches: [
                { playerPosition: 1, player: { id: 'p1', firstName: 'A', lastName: 'A' }, scoreTotal: 3 },
                { playerPosition: 2, player: { id: 'p2', firstName: 'B', lastName: 'B' }, scoreTotal: 2 },
              ],
              winner: { firstName: 'Winner', lastName: 'Name' },
            }],
          }],
        }}
      />
    );

    fireEvent.click(screen.getByText('live.showCompletedMatches'));
    expect(screen.getByText('live.winner: Winner Name')).toBeInTheDocument();
  });

  it('triggers complete action for in-progress match and handles reopen confirm rejection', () => {
    const onCompleteMatch = vi.fn();
    const onStartMatch = vi.fn();
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);

    render(
      <PoolStageCard
        {...baseProperties}
        onCompleteMatch={onCompleteMatch}
        onStartMatch={onStartMatch}
        getTargetIdForSelection={(_t, number_) => (number_ === '9' ? 'target-9' : undefined)}
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'IN_PROGRESS',
            assignments: [],
            matches: [
              {
                id: 'in-1',
                status: 'IN_PROGRESS',
                matchNumber: 1,
                roundNumber: 1,
                playerMatches: [],
              },
              {
                id: 'co-1',
                status: 'COMPLETED',
                matchNumber: 2,
                roundNumber: 1,
                target: { id: 'tid-9', targetNumber: 9 },
                playerMatches: [{ playerPosition: 1, player: { id: 'p1', firstName: 'A', lastName: 'A' }, scoreTotal: 3 }],
              },
            ],
          }],
        }}
      />
    );

    fireEvent.click(screen.getByText('live.completeMatch'));
    expect(onCompleteMatch).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'in-1' }));

    fireEvent.click(screen.getByText('live.showCompletedMatches'));
    fireEvent.click(screen.getByText('live.reopenMatch'));
    expect(onStartMatch).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('invokes cancel, reopen, completed-save and unknown-status section paths', () => {
    const onCancelMatch = vi.fn();
    const onStartMatch = vi.fn();
    const onSaveMatchScores = vi.fn();
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    render(
      <PoolStageCard
        {...baseProperties}
        onCancelMatch={onCancelMatch}
        onStartMatch={onStartMatch}
        onSaveMatchScores={onSaveMatchScores}
        editingMatchId="k-c-edit"
        getMatchKey={(_t, m) => `k-${m}`}
        getTargetIdForSelection={(_t, number_) => (number_ === '3' ? 'target-3' : undefined)}
        stage={{
          ...baseProperties.stage,
          pools: [{
            id: 'pool-1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'IN_PROGRESS',
            assignments: [],
            matches: [
              { id: 'i-cancel', status: 'IN_PROGRESS', matchNumber: 1, roundNumber: 1, playerMatches: [] },
              {
                id: 'c-open',
                status: 'COMPLETED',
                matchNumber: 2,
                roundNumber: 1,
                target: { id: 'target-3', targetNumber: 3 },
                playerMatches: [{ playerPosition: 1, player: { id: 'p1', firstName: 'A', lastName: 'A' }, scoreTotal: 3 }],
              },
              {
                id: 'c-edit',
                status: 'COMPLETED',
                matchNumber: 3,
                roundNumber: 1,
                playerMatches: [{ playerPosition: 1, player: { id: 'p1', firstName: 'A', lastName: 'A' }, scoreTotal: 2 }],
              },
              { id: 'x-unknown', status: 'UNKNOWN', matchNumber: 4, roundNumber: 1, playerMatches: [] },
            ],
          }],
        }}
      />
    );

    fireEvent.click(screen.getByText('targets.cancelMatch'));
    expect(onCancelMatch).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'i-cancel' }));

    fireEvent.click(screen.getByText('live.showCompletedMatches'));
    fireEvent.click(screen.getByText('live.reopenMatch'));
    expect(onStartMatch).toHaveBeenCalledWith('t1', 'c-open', 'target-3');

    const saveButtons = screen.getAllByText('live.saveScores');
    fireEvent.click(saveButtons.at(-1) as HTMLButtonElement);
    expect(onSaveMatchScores).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'c-edit' }));

    expect(screen.getByText('Match 4 · Round 1')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});

describe('computeOptimisticStartTimes', () => {
  type OptimisticPools = Parameters<typeof computeOptimisticStartTimes>[0]['pools'];

  it('returns zero estimated duration when there are no matches', () => {
    const result = computeOptimisticStartTimes({
      pools: [],
      schedulableTargetCount: 0,
      nowTimestamp: 0,
      resolveDurationMinutes: () => 10,
    });

    expect(result.optimisticById.size).toBe(0);
    expect(result.finishTimestampByMatchId.size).toBe(0);
    expect(result.estimatedDurationMinutes).toBe(0);
  });

  it('reserves in-progress matches and computes optimistic slots for scheduled matches', () => {
    const pools = [
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
        matches: [
          {
            id: 'm-in-progress',
            status: 'IN_PROGRESS',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
          },
          {
            id: 'm-next-1',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 2,
            playerMatches: [{ player: { id: 'p3' } }, { player: { id: 'p4' } }],
          },
        ],
      },
      {
        id: 'pool-2',
        poolNumber: 2,
        assignments: [{ player: { id: 'p5' } }, { player: { id: 'p6' } }],
        matches: [
          {
            id: 'm-next-2',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p5' } }, { player: { id: 'p6' } }],
          },
        ],
      },
    ] as unknown as OptimisticPools;

    const durationById: Record<string, number> = {
      'm-in-progress': 12,
      'm-next-1': 8,
      'm-next-2': 6,
    };

    const result = computeOptimisticStartTimes({
      pools,
      stagePlayersPerPool: 4,
      schedulableTargetCount: 1,
      nowTimestamp: 0,
      resolveDurationMinutes: (match) => durationById[match.id] ?? 10,
    });

    expect(result.finishTimestampByMatchId.get('m-in-progress')).toBe(12 * 60_000);
    expect(result.optimisticById.has('m-next-1')).toBe(true);
    expect(result.optimisticById.has('m-next-2')).toBe(true);
    expect(result.estimatedDurationMinutes).toBeGreaterThan(12);
  });

  it('uses fallback concurrency with stagePlayersPerPool when player assignments are missing', () => {
    const pools = [
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [],
        matches: [
          {
            id: 'm1',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [],
          },
          {
            id: 'm2',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 2,
            playerMatches: [],
          },
        ],
      },
    ] as unknown as OptimisticPools;

    const result = computeOptimisticStartTimes({
      pools,
      stagePlayersPerPool: 4,
      schedulableTargetCount: 2,
      nowTimestamp: 0,
      resolveDurationMinutes: () => 5,
    });

    expect(result.optimisticById.size).toBe(2);
    expect(result.estimatedDurationMinutes).toBeGreaterThanOrEqual(5);
  });

  it('falls back to global best queue when fairness queue would delay start despite idle target', () => {
    const pools = [
      {
        id: 'pool-fair',
        poolNumber: 1,
        assignments: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
        matches: [
          {
            id: 'm-delayed',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
          },
        ],
      },
      {
        id: 'pool-loaded',
        poolNumber: 2,
        assignments: [
          { player: { id: 'p3' } },
          { player: { id: 'p4' } },
          { player: { id: 'p7' } },
          { player: { id: 'p8' } },
        ],
        matches: [
          {
            id: 'm-in-progress',
            status: 'IN_PROGRESS',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
          },
          {
            id: 'm-ready-now',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 2,
            playerMatches: [{ player: { id: 'p3' } }, { player: { id: 'p4' } }],
          },
          {
            id: 'm-completed',
            status: 'COMPLETED',
            roundNumber: 1,
            matchNumber: 3,
            playerMatches: [{ player: { id: 'p5' } }, { player: { id: 'p6' } }],
          },
        ],
      },
    ] as unknown as OptimisticPools;

    const result = computeOptimisticStartTimes({
      pools,
      schedulableTargetCount: 2,
      nowTimestamp: 0,
      prioritizeLeastProgressedPools: true,
      resolveDurationMinutes: () => 10,
    });

    expect(result.finishTimestampByMatchId.get('m-in-progress')).toBe(600_000);
    expect(result.finishTimestampByMatchId.get('m-ready-now')).toBe(600_000);
    expect(result.finishTimestampByMatchId.get('m-delayed')).toBe(1_200_000);
  });

  it('limits in-progress reservation to available targets', () => {
    const pools = [
      {
        id: 'pool-1',
        poolNumber: 1,
        matches: [
          {
            id: 'm-in-progress-1',
            status: 'IN_PROGRESS',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p1' } }, { player: { id: 'p2' } }],
          },
        ],
      },
      {
        id: 'pool-2',
        poolNumber: 2,
        matches: [
          {
            id: 'm-in-progress-2',
            status: 'IN_PROGRESS',
            roundNumber: 1,
            matchNumber: 1,
            playerMatches: [{ player: { id: 'p3' } }, { player: { id: 'p4' } }],
          },
          {
            id: 'm-scheduled',
            status: 'SCHEDULED',
            roundNumber: 1,
            matchNumber: 2,
            playerMatches: [{ player: { id: 'p5' } }, { player: { id: 'p6' } }],
          },
        ],
      },
    ] as unknown as OptimisticPools;

    const result = computeOptimisticStartTimes({
      pools,
      schedulableTargetCount: 1,
      nowTimestamp: 0,
      resolveDurationMinutes: () => 7,
    });

    expect(result.finishTimestampByMatchId.has('m-in-progress-1')).toBe(true);
    expect(result.finishTimestampByMatchId.has('m-in-progress-2')).toBe(false);
    expect(result.finishTimestampByMatchId.has('m-scheduled')).toBe(true);
  });

  it('handles sorted rounds and multi-slot in-progress allocation', () => {
    const result = computeOptimisticStartTimes({
      pools: [
        {
          id: 'pool-1',
          poolNumber: 1,
          assignments: [
            { player: { id: 'a' } },
            { player: { id: 'b' } },
            { player: { id: 'c' } },
            { player: { id: 'd' } },
          ],
          matches: [
            { id: 'in-1', status: 'IN_PROGRESS', roundNumber: 1, matchNumber: 1, playerMatches: [{ player: { id: 'a' } }, { player: { id: 'b' } }] },
            { id: 'in-2', status: 'IN_PROGRESS', roundNumber: 1, matchNumber: 2, playerMatches: [{ player: { id: 'c' } }, { player: { id: 'd' } }] },
            { id: 's-2', status: 'SCHEDULED', roundNumber: 2, matchNumber: 1, playerMatches: [] },
            { id: 's-1', status: 'SCHEDULED', roundNumber: 1, matchNumber: 3, playerMatches: [] },
          ],
        },
      ] as never,
      stagePlayersPerPool: 4,
      schedulableTargetCount: 2,
      nowTimestamp: 0,
      resolveDurationMinutes: () => 10,
    });

    expect(result.finishTimestampByMatchId.get('in-1')).toBe(600_000);
    expect(result.finishTimestampByMatchId.get('in-2')).toBe(600_000);
    expect(result.optimisticById.has('s-1')).toBe(true);
    expect(result.optimisticById.has('s-2')).toBe(true);
  });
});

describe('pool-stage-card helper coverage', () => {
  it('covers formatting/status/concurrency helper edge cases', () => {
    expect(formatScheduledMatchTime(undefined)).toBeUndefined();
    expect(formatScheduledMatchTime('not-a-date')).toBeUndefined();
    expect(getEstimatedMatchDurationMinutes(undefined)).toBe(12);
    expect(getEstimatedMatchDurationMinutes('UNKNOWN')).toBe(12);
    expect(isRemainingStage('COMPLETED')).toBe(false);
    expect(isRemainingStage('CANCELLED')).toBe(false);
    expect(isRemainingStage('IN_PROGRESS')).toBe(true);
    expect(getPoolMaxConcurrentMatches({ assignments: [] } as never, 1)).toBe(1);
    expect(getPoolMaxConcurrentMatches({ assignments: [] } as never, 4)).toBe(2);
    expect(toValidDate(undefined)).toBeUndefined();
    expect(toValidDate('invalid')).toBeUndefined();
    expect(toValidDate('2026-01-01T10:00:00.000Z')).toBeInstanceOf(Date);
  });

  it('covers slot and candidate helper branches', () => {
    expect(findEarliestAvailabilityIndex([12, 3, 9])).toBe(1);
    expect(getBestTargetAndPoolSlot([5, 0], [4, 2], 1)).toEqual({
      bestTargetIndex: 1,
      bestPoolSlotIndex: 1,
      bestStartTimestamp: 2,
    });

    const queues = buildOptimisticPoolQueues([
      {
        id: 'pool-1',
        poolNumber: 1,
        assignments: [],
        matches: [
          { id: 'm2', status: 'SCHEDULED', roundNumber: 2, matchNumber: 1, playerMatches: [] },
          { id: 'm1', status: 'SCHEDULED', roundNumber: 1, matchNumber: 2, playerMatches: [] },
          { id: 'm3', status: 'IN_PROGRESS', roundNumber: 1, matchNumber: 1, playerMatches: [] },
        ],
      },
    ] as never, 4);
    expect(queues[0]?.queuedMatches.map((match) => match.id)).toEqual(['m1', 'm2']);

    const poolAvailability = buildPoolAvailabilityByPoolId([
      { poolId: 'p1', maxConcurrentMatches: 2 },
    ] as never, 50);
    expect(poolAvailability.get('p1')).toEqual([50, 50]);

    const noCandidate = findBestOptimisticCandidate(
      [],
      [0],
      new Map(),
      new Map(),
      0,
      true,
      () => 5
    );
    expect(noCandidate).toBeUndefined();

    const past = getOptimisticScheduleBaseDateTime('2000-01-01T10:00:00.000Z', 0);
    expect(past).toBeInstanceOf(Date);

    const shifted = getOptimisticScheduleBaseDateTime(undefined, 15);
    expect(shifted.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});
