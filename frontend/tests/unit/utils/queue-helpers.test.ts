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
});
