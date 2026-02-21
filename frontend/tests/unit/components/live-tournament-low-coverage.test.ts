import { describe, expect, it } from 'vitest';
import type { LiveViewMatch, LiveViewPoolStage } from '../../../src/components/live-tournament/types';
import {
  filterBracketsForView,
  filterPoolStagesForView,
  getPoolStageStats,
} from '../../../src/components/live-tournament/view-utilities';
import {
  getVisibleLiveViews,
  hasActiveBrackets,
  hasActivePoolStages,
  resolveEmptyLiveCopy,
} from '../../../src/utils/live-view-helpers';
import useLiveTournamentMatchKey from '../../../src/components/live-tournament/use-live-tournament-match-key';
import validateMatchScores from '../../../src/components/live-tournament/use-live-tournament-score-validation';

const translate = (key: string) => key;

const makeMatch = (id: string, status: string): LiveViewMatch => ({
  id,
  matchNumber: 1,
  roundNumber: 1,
  status,
});

describe('live tournament view filters', () => {
  it('filters pool stages based on view mode and status', () => {
    const stages: LiveViewPoolStage[] = [
      {
        id: 's1',
        stageNumber: 1,
        name: 'Stage 1',
        status: 'NOT_STARTED',
        pools: [
          {
            id: 'p1',
            poolNumber: 1,
            name: 'Pool 1',
            status: 'NOT_STARTED',
            assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } }],
          },
        ],
      },
      {
        id: 's2',
        stageNumber: 2,
        name: 'Stage 2',
        status: 'EDITION',
        pools: [
          {
            id: 'p2',
            poolNumber: 1,
            name: 'Pool 2',
            status: 'NOT_STARTED',
            assignments: [{ id: 'a2', player: { id: 'p2', firstName: 'Bea', lastName: 'Bell' } }],
          },
        ],
      },
      {
        id: 's3',
        stageNumber: 3,
        name: 'Stage 3',
        status: 'COMPLETED',
        pools: [],
      },
      {
        id: 's4',
        stageNumber: 4,
        name: 'Stage 4',
        status: 'COMPLETED',
        pools: [
          {
            id: 'p4',
            poolNumber: 1,
            name: 'Pool 4',
            status: 'COMPLETED',
            assignments: [{ id: 'a4', player: { id: 'p4', firstName: 'Cal', lastName: 'Cross' } }],
          },
        ],
      },
    ];

    expect(filterPoolStagesForView('live', 'LIVE', stages)).toHaveLength(3);
    expect(filterPoolStagesForView('pool-stages', 'FINISHED', stages).map((stage) => stage.id)).toEqual(['s4']);
    expect(filterPoolStagesForView('pool-stages', 'LIVE', stages, true).map((stage) => stage.id)).toEqual([
      's1',
      's2',
      's4',
    ]);
    expect(filterPoolStagesForView('pool-stages', 'LIVE', [
      {
        id: 's5',
        stageNumber: 5,
        name: 'Stage 5',
        status: 'EDITION',
        poolCount: 2,
      },
    ], true, true).map((stage) => stage.id)).toEqual(['s5']);
  });

  it('filters brackets based on view mode and status', () => {
    const brackets = [
      {
        id: 'b1',
        name: 'Bracket 1',
        bracketType: 'MAIN',
        status: 'COMPLETED',
        entries: [{ id: 'e1', seedNumber: 1, player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } }],
        matches: [makeMatch('m1', 'COMPLETED')],
      },
      {
        id: 'b2',
        name: 'Bracket 2',
        bracketType: 'MAIN',
        status: 'COMPLETED',
        entries: [],
        matches: [],
      },
      {
        id: 'b3',
        name: 'Bracket 3',
        bracketType: 'MAIN',
        status: 'IN_PROGRESS',
        entries: [{ id: 'e3', seedNumber: 1, player: { id: 'p3', firstName: 'Cal', lastName: 'Cross' } }],
        matches: [makeMatch('m2', 'IN_PROGRESS')],
      },
    ];

    expect(filterBracketsForView('live', 'LIVE', brackets)).toHaveLength(3);
    expect(filterBracketsForView('brackets', 'LIVE', brackets)).toHaveLength(2);
    expect(filterBracketsForView('brackets', 'FINISHED', brackets).map((bracket) => bracket.id)).toEqual(['b1']);
  });
});

describe('live tournament stats', () => {
  it('summarizes pool stage stats', () => {
    const stages: LiveViewPoolStage[] = [
      {
        id: 's1',
        stageNumber: 1,
        name: 'Stage 1',
        status: 'NOT_STARTED',
        pools: [
          { id: 'p1', poolNumber: 1, name: 'Pool 1', status: 'NOT_STARTED' },
          { id: 'p2', poolNumber: 2, name: 'Pool 2', status: 'NOT_STARTED' },
        ],
      },
      {
        id: 's2',
        stageNumber: 2,
        name: 'Stage 2',
        status: 'COMPLETED',
        pools: [{ id: 'p3', poolNumber: 1, name: 'Pool 3', status: 'COMPLETED' }],
      },
    ];

    expect(getPoolStageStats(stages)).toEqual({
      poolStageCount: 2,
      totalPools: 3,
      poolsPerStage: [2, 1],
    });
  });

  it('evaluates pool stage visibility and active brackets', () => {
    const viewWithStages = {
      id: 't1',
      name: 'Tournament 1',
      status: 'LIVE',
      poolStages: [
        {
          status: 'IN_PROGRESS',
          pools: [
            {
              id: 'p1',
              poolNumber: 1,
              name: 'Pool 1',
              status: 'IN_PROGRESS',
              assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } }],
            },
          ],
        },
        { status: 'COMPLETED', pools: [] },
      ],
    };

    expect(hasActivePoolStages(viewWithStages, 'LIVE', false)).toBe(true);
    expect(hasActivePoolStages(viewWithStages, 'FINISHED', false)).toBe(false);

    const viewWithBrackets = {
      id: 't2',
      name: 'Tournament 2',
      status: 'LIVE',
      brackets: [
        { status: 'IN_PROGRESS', matches: [{ id: 'm1' }] },
        { status: 'COMPLETED', matches: [] },
      ],
    };

    expect(hasActiveBrackets(viewWithBrackets, 'LIVE')).toBe(true);
    expect(hasActiveBrackets(viewWithBrackets, 'FINISHED')).toBe(false);
  });

  it('filters live views and resolves empty copy', () => {
    const views = [
      {
        id: 't1',
        name: 'One',
        status: 'LIVE',
        poolStages: [
          {
            status: 'IN_PROGRESS',
            pools: [
              {
                id: 'p1',
                poolNumber: 1,
                name: 'Pool 1',
                status: 'IN_PROGRESS',
                assignments: [{ id: 'a1', player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } }],
              },
            ],
          },
        ],
      },
      { id: 't2', name: 'Two', status: 'LIVE', brackets: [{ status: 'IN_PROGRESS', matches: [{ id: 'm2' }] }] },
    ];

    expect(getVisibleLiveViews('pool-stages', views).map((view) => view.id)).toEqual(['t1']);
    expect(getVisibleLiveViews('brackets', views, 'LIVE').map((view) => view.id)).toEqual(['t2']);
    expect(getVisibleLiveViews('live', views)).toHaveLength(2);
    expect(getVisibleLiveViews(undefined, views)).toHaveLength(2);

    expect(resolveEmptyLiveCopy('brackets', translate)).toBe('live.noneBrackets');
    expect(resolveEmptyLiveCopy('pool-stages', translate)).toBe('live.nonePoolStages');
    expect(resolveEmptyLiveCopy('live', translate)).toBe('live.none');
  });
});

describe('live tournament match helpers', () => {
  it('builds match keys', () => {
    const { getMatchKey } = useLiveTournamentMatchKey();
    expect(getMatchKey('t-1', 'm-9')).toBe('t-1:m-9');
  });

  it('validates match scores with errors and success', () => {
    const insufficient = validateMatchScores({
      id: 'm1',
      matchNumber: 1,
      roundNumber: 1,
      status: 'PENDING',
      playerMatches: [],
    }, {}, 'Need more players');
    expect(insufficient).toEqual({ error: 'Need more players' });

    const invalidScores = validateMatchScores({
      id: 'm2',
      matchNumber: 1,
      roundNumber: 1,
      status: 'PENDING',
      playerMatches: [
        { player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' }, playerPosition: 1 },
        { player: { id: 'p2', firstName: 'Bea', lastName: 'Bell' }, playerPosition: 2 },
      ],
    }, { p1: '10', p2: 'nope' }, 'Need more players');
    expect(invalidScores).toEqual({ error: 'Please enter valid scores for all players.' });

    const validScores = validateMatchScores({
      id: 'm3',
      matchNumber: 1,
      roundNumber: 1,
      status: 'PENDING',
      playerMatches: [
        { player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' }, playerPosition: 1 },
        { player: { id: 'p2', firstName: 'Bea', lastName: 'Bell' }, playerPosition: 2 },
      ],
    }, { p1: '10', p2: '15' }, 'Need more players');
    expect(validScores).toEqual({
      scores: [
        { playerId: 'p1', scoreTotal: 10 },
        { playerId: 'p2', scoreTotal: 15 },
      ],
    });
  });
});
