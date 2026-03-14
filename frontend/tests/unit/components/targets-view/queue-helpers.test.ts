import { describe, expect, it } from 'vitest';
import { buildGlobalMatchQueue, buildMatchQueue } from '../../../../src/components/targets-view/queue-helpers';

const createView = (id: string, matchId: string, matchNumber: number) => ({
  id,
  name: `Tournament ${id}`,
  poolStages: [
    {
      id: `${id}-stage-1`,
      stageNumber: 1,
      status: 'IN_PROGRESS',
      pools: [
        {
          id: `${id}-pool-1`,
          poolNumber: 1,
          name: 'Pool 1',
          assignments: [
            { player: { id: `${id}-p1`, firstName: 'A', lastName: 'One' } },
            { player: { id: `${id}-p2`, firstName: 'B', lastName: 'Two' } },
          ],
          matches: [
            {
              id: matchId,
              matchNumber,
              roundNumber: 1,
              status: 'SCHEDULED',
              playerMatches: [
                { player: { id: `${id}-p1`, firstName: 'A', lastName: 'One' } },
                { player: { id: `${id}-p2`, firstName: 'B', lastName: 'Two' } },
              ],
            },
          ],
        },
      ],
    },
  ],
  brackets: [],
});

describe('targets queue helpers', () => {
  it('builds queue entries for pool matches', () => {
    const view = createView('t1', 'm1', 1);

    const queue = buildMatchQueue(view as never);

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      tournamentId: 't1',
      source: 'pool',
      matchId: 'm1',
      matchNumber: 1,
    });
  });

  it('interleaves queues across tournaments in global mode', () => {
    const viewA = createView('t1', 'm1', 1);
    const viewB = createView('t2', 'm2', 2);

    const globalQueue = buildGlobalMatchQueue([viewA as never, viewB as never]);

    expect(globalQueue).toHaveLength(2);
    expect(globalQueue.map((item) => item.tournamentId)).toEqual(['t1', 't2']);
  });
});
