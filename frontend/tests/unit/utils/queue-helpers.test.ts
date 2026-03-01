import { describe, expect, it } from 'vitest';
import { buildGlobalMatchQueue, buildMatchQueue } from '../../../src/components/targets-view/queue-helpers';
import type { LiveViewData } from '../../../src/components/targets-view/types';

describe('queue-helpers items', () => {
  it('builds pool and bracket queue items', () => {
    const view: LiveViewData = {
      id: 't-1',
      name: 'Spring Cup',
      status: 'LIVE',
      poolStages: [
        {
          id: 'stage-1',
          stageNumber: 1,
          name: 'Stage 1',
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              name: 'Pool 1',
              matches: [
                {
                  id: 'match-1',
                  matchNumber: 1,
                  roundNumber: 1,
                  status: 'SCHEDULED',
                  playerMatches: [
                    { player: { id: 'p1', firstName: 'Ana', lastName: 'Diaz' } },
                    { player: { id: 'p2', firstName: 'Bo', lastName: 'Kim' } },
                  ],
                },
                {
                  id: 'match-2',
                  matchNumber: 2,
                  roundNumber: 1,
                  status: 'COMPLETED',
                },
              ],
            },
          ],
        },
      ],
      brackets: [
        {
          id: 'bracket-1',
          name: 'Main',
          matches: [
            {
              id: 'match-3',
              matchNumber: 1,
              roundNumber: 1,
              status: 'SCHEDULED',
              playerMatches: [
                { player: { firstName: 'Cia', lastName: 'Lee' } },
                { player: { firstName: 'Drew', lastName: 'Ng' } },
              ],
            },
          ],
        },
      ],
    };

    const queue = buildMatchQueue(view);
    expect(queue).toHaveLength(2);

    const poolItem = queue.find((item) => item.source === 'pool');
    const bracketItem = queue.find((item) => item.source === 'bracket');

    expect(poolItem?.matchId).toBe('match-1');
    expect(poolItem?.blocked).toBe(false);
    expect(bracketItem?.matchId).toBe('match-3');
  });

  it('uses grouped participant labels when mapping is provided', () => {
    const view: LiveViewData = {
      id: 't-1',
      name: 'Spring Cup',
      status: 'LIVE',
      poolStages: [
        {
          id: 'stage-1',
          stageNumber: 1,
          name: 'Stage 1',
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              name: 'Pool 1',
              matches: [
                {
                  id: 'match-1',
                  matchNumber: 1,
                  roundNumber: 1,
                  status: 'SCHEDULED',
                  playerMatches: [
                    { player: { id: 'p1', firstName: 'Ana', lastName: 'Diaz' } },
                    { player: { id: 'p2', firstName: 'Bo', lastName: 'Kim' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
      brackets: [],
    };

    const grouped = new Map<string, string>([
      ['p1', 'Doublette Alpha'],
      ['p2', 'Doublette Alpha'],
    ]);

    const queue = buildMatchQueue(view, grouped);
    expect(queue[0]?.players).toEqual(['Doublette Alpha', 'Doublette Alpha']);
  });
});

describe('queue-helpers interleaving', () => {
  it('interleaves queues across tournaments', () => {
    const viewOne: LiveViewData = {
      id: 't-1',
      name: 'Alpha',
      status: 'LIVE',
      poolStages: [
        {
          id: 'stage-1',
          stageNumber: 1,
          name: 'Stage 1',
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              name: 'Pool 1',
              matches: [
                {
                  id: 'match-1',
                  matchNumber: 1,
                  roundNumber: 1,
                  status: 'SCHEDULED',
                  playerMatches: [
                    { player: { firstName: 'Ana', lastName: 'Diaz' } },
                    { player: { firstName: 'Bo', lastName: 'Kim' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
      brackets: [],
    };

    const viewTwo: LiveViewData = {
      id: 't-2',
      name: 'Beta',
      status: 'LIVE',
      poolStages: [
        {
          id: 'stage-2',
          stageNumber: 1,
          name: 'Stage 1',
          pools: [
            {
              id: 'pool-2',
              poolNumber: 1,
              name: 'Pool 1',
              matches: [
                {
                  id: 'match-2',
                  matchNumber: 1,
                  roundNumber: 1,
                  status: 'SCHEDULED',
                  playerMatches: [
                    { player: { firstName: 'Cia', lastName: 'Lee' } },
                    { player: { firstName: 'Drew', lastName: 'Ng' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
      brackets: [],
    };

    const globalQueue = buildGlobalMatchQueue([viewOne, viewTwo]);
    expect(globalQueue).toHaveLength(2);
    expect(globalQueue[0]?.tournamentId).toBe('t-1');
    expect(globalQueue[1]?.tournamentId).toBe('t-2');
  });

  it('marks pool matches blocked when concurrency limit is reached', () => {
    const view: LiveViewData = {
      id: 't-7',
      name: 'Concurrency Cup',
      status: 'LIVE',
      poolStages: [
        {
          id: 's1',
          stageNumber: 1,
          status: 'IN_PROGRESS',
          name: 'Stage 1',
          pools: [
            {
              id: 'p1',
              poolNumber: 1,
              name: 'Pool 1',
              assignments: [
                { player: { id: 'a' } },
                { player: { id: 'b' } },
              ],
              matches: [
                { id: 'ip1', matchNumber: 1, roundNumber: 1, status: 'IN_PROGRESS' },
                { id: 'sch1', matchNumber: 2, roundNumber: 1, status: 'SCHEDULED' },
              ],
            },
          ],
        },
      ],
      brackets: [],
    };

    const scheduledItem = buildMatchQueue(view).find((item) => item.matchId === 'sch1');
    expect(scheduledItem?.blocked).toBe(true);
  });

  it('includes bracket target ids from bracketTargets fallback', () => {
    const view: LiveViewData = {
      id: 't-8',
      name: 'Bracket Targets Cup',
      status: 'LIVE',
      poolStages: [],
      brackets: [
        {
          id: 'b1',
          name: 'Main',
          bracketTargets: [{ targetId: 'tg-1' }, { targetId: 'tg-2' }],
          matches: [{ id: 'bm1', matchNumber: 1, roundNumber: 1, status: 'SCHEDULED' }],
        },
      ],
    };

    const bracketItem = buildMatchQueue(view).find((item) => item.source === 'bracket');
    expect(bracketItem?.bracketTargetIds).toEqual(['tg-1', 'tg-2']);
  });

  it('uses grouped participant labels map by tournament in global queue', () => {
    const viewOne: LiveViewData = {
      id: 't-1',
      name: 'Alpha',
      status: 'LIVE',
      poolStages: [
        {
          id: 'stage-1',
          stageNumber: 1,
          name: 'Stage 1',
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              name: 'Pool 1',
              matches: [
                {
                  id: 'match-1',
                  matchNumber: 1,
                  roundNumber: 1,
                  status: 'SCHEDULED',
                  playerMatches: [
                    { player: { id: 'p1', firstName: 'Ana', lastName: 'Diaz' } },
                    { player: { id: 'p2', firstName: 'Bo', lastName: 'Kim' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
      brackets: [],
    };

    const groupedByTournament = new Map<string, Map<string, string>>([
      ['t-1', new Map<string, string>([['p1', 'Equipe X'], ['p2', 'Equipe X']])],
    ]);

    const globalQueue = buildGlobalMatchQueue([viewOne], groupedByTournament);
    expect(globalQueue[0]?.players).toEqual(['Equipe X', 'Equipe X']);
  });

  it('orders pool queues with parallel in-progress stage groups', () => {
    const view: LiveViewData = {
      id: 't-4',
      name: 'Parallel Cup',
      status: 'LIVE',
      poolStages: [
        {
          id: 's1',
          stageNumber: 1,
          status: 'IN_PROGRESS',
          inParallelWith: ['stage:2'],
          name: 'Stage 1',
          pools: [
            {
              id: 'p1',
              poolNumber: 1,
              name: 'Pool 1',
              matches: [{ id: 'm1', matchNumber: 1, roundNumber: 1, status: 'SCHEDULED' }],
            },
          ],
        },
        {
          id: 's2',
          stageNumber: 2,
          status: 'IN_PROGRESS',
          inParallelWith: [' stage:1 '],
          name: 'Stage 2',
          pools: [
            {
              id: 'p2',
              poolNumber: 2,
              name: 'Pool 2',
              matches: [{ id: 'm2', matchNumber: 1, roundNumber: 1, status: 'SCHEDULED' }],
            },
          ],
        },
      ],
      brackets: [],
    };

    const queue = buildMatchQueue(view);
    expect(queue.map((item) => item.matchId)).toEqual(['m1', 'm2']);
  });

  it('skips bracket queue when source pool stage is not completed', () => {
    const view: LiveViewData = {
      id: 't-5',
      name: 'Blocked Bracket Cup',
      status: 'LIVE',
      poolStages: [
        {
          id: 'stage-source',
          stageNumber: 1,
          status: 'IN_PROGRESS',
          name: 'Stage Source',
          rankingDestinations: [{ position: 1, destinationType: 'BRACKET', bracketId: 'b-1' }],
          pools: [],
        },
      ],
      brackets: [
        {
          id: 'b-1',
          name: 'Main',
          targetIds: ['target-a'],
          matches: [{ id: 'bm1', matchNumber: 1, roundNumber: 1, status: 'SCHEDULED' }],
        },
      ],
    };

    expect(buildMatchQueue(view).some((item) => item.source === 'bracket')).toBe(false);

    view.poolStages![0]!.status = 'COMPLETED';
    const queueAfterCompletion = buildMatchQueue(view);
    const bracketItem = queueAfterCompletion.find((item) => item.source === 'bracket');
    expect(bracketItem?.matchId).toBe('bm1');
    expect(bracketItem?.bracketTargetIds).toEqual(['target-a']);
    expect(bracketItem?.isBracketFinal).toBe(true);
  });

  it('filters out completed cancelled and in-progress bracket matches', () => {
    const view: LiveViewData = {
      id: 't-6',
      name: 'Bracket Status Filter Cup',
      status: 'LIVE',
      poolStages: [],
      brackets: [
        {
          id: 'b-2',
          name: 'Main',
          bracketTargets: [{ targetId: 'tb-1' }],
          matches: [
            { id: 'keep', matchNumber: 1, roundNumber: 1, status: 'SCHEDULED' },
            { id: 'done', matchNumber: 2, roundNumber: 1, status: 'COMPLETED' },
            { id: 'cancel', matchNumber: 3, roundNumber: 1, status: 'CANCELLED' },
            { id: 'running', matchNumber: 4, roundNumber: 1, status: 'IN_PROGRESS' },
          ],
        },
      ],
    };

    const queue = buildMatchQueue(view);
    const bracketItems = queue.filter((item) => item.source === 'bracket');
    expect(bracketItems).toHaveLength(1);
    expect(bracketItems[0]?.matchId).toBe('keep');
    expect(bracketItems[0]?.bracketTargetIds).toEqual(['tb-1']);
  });

  it('does not queue pool matches when stage is not started', () => {
    const view: LiveViewData = {
      id: 't-9',
      name: 'Not Started Stage Cup',
      status: 'LIVE',
      poolStages: [
        {
          id: 'stage-1',
          stageNumber: 1,
          status: 'NOT_STARTED',
          name: 'Stage 1',
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              name: 'Pool 1',
              matches: [
                { id: 'm-1', matchNumber: 1, roundNumber: 1, status: 'SCHEDULED' },
              ],
            },
          ],
        },
      ],
      brackets: [],
    };

    expect(buildMatchQueue(view)).toHaveLength(0);
  });

  it('does not queue bracket matches when bracket is not started', () => {
    const view: LiveViewData = {
      id: 't-10',
      name: 'Not Started Bracket Cup',
      status: 'LIVE',
      poolStages: [],
      brackets: [
        {
          id: 'b-1',
          name: 'Main',
          status: 'NOT_STARTED',
          matches: [
            { id: 'bm-1', matchNumber: 1, roundNumber: 1, status: 'SCHEDULED' },
          ],
        },
      ],
    };

    expect(buildMatchQueue(view)).toHaveLength(0);
  });

  it('does not queue matches when phase is in EDITION status', () => {
    const view: LiveViewData = {
      id: 't-11',
      name: 'Edition Stage Cup',
      status: 'LIVE',
      poolStages: [
        {
          id: 'stage-1',
          stageNumber: 1,
          status: 'EDITION',
          name: 'Stage 1',
          pools: [
            {
              id: 'pool-1',
              poolNumber: 1,
              name: 'Pool 1',
              matches: [{ id: 'm-1', matchNumber: 1, roundNumber: 1, status: 'SCHEDULED' }],
            },
          ],
        },
      ],
      brackets: [
        {
          id: 'b-1',
          name: 'Main',
          status: 'EDITION',
          matches: [{ id: 'bm-1', matchNumber: 1, roundNumber: 1, status: 'SCHEDULED' }],
        },
      ],
    };

    expect(buildMatchQueue(view)).toHaveLength(0);
  });
});
