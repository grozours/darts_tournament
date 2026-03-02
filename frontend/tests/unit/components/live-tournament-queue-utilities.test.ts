import { describe, expect, it } from 'vitest';
import { buildMatchQueue } from '../../../src/components/live-tournament/queue-utilities';
import type {
  LiveViewData,
  LiveViewMatch,
  LiveViewMatchPlayer,
  LiveViewPoolStage,
} from '../../../src/components/live-tournament/types';

const makePlayer = (
  id: string,
  firstName: string,
  lastName: string,
  position: number,
  surname?: string
): LiveViewMatchPlayer => ({
  player: {
    id,
    firstName,
    lastName,
    ...(surname ? { surname } : {}),
  },
  playerPosition: position,
});

const makeMatch = (overrides: Partial<LiveViewMatch> & Pick<LiveViewMatch, 'id'>): LiveViewMatch => ({
  id: overrides.id,
  matchNumber: overrides.matchNumber ?? 1,
  roundNumber: overrides.roundNumber ?? 1,
  status: overrides.status ?? 'PENDING',
  playerMatches: overrides.playerMatches ?? [],
  target: overrides.target,
});

const buildPoolStages = (): LiveViewPoolStage[] => [
  {
    id: 'stage-1',
    stageNumber: 1,
    name: 'Stage 1',
    status: 'IN_PROGRESS',
    pools: [
      {
        id: 'pool-1',
        poolNumber: 1,
        name: 'Pool 1',
        status: 'IN_PROGRESS',
        matches: [
          makeMatch({
            id: 'm1',
            status: 'IN_PROGRESS',
            matchNumber: 1,
            roundNumber: 1,
            playerMatches: [
              makePlayer('p1', 'Alice', 'Adams', 1),
              makePlayer('p2', 'Ben', 'Baker', 2),
            ],
          }),
          makeMatch({
            id: 'm2',
            matchNumber: 2,
            roundNumber: 1,
            playerMatches: [
              makePlayer('p3', 'Cara', 'Cook', 1),
              makePlayer('p4', 'Dan', 'Dove', 2),
            ],
            target: {
              targetNumber: 1,
              targetCode: 'A1',
            },
          }),
          makeMatch({
            id: 'm3',
            matchNumber: 3,
            roundNumber: 1,
            playerMatches: [
              makePlayer('p1', 'Alice', 'Adams', 1),
              makePlayer('p5', 'Eli', 'Edge', 2),
            ],
          }),
          makeMatch({
            id: 'm4-cancelled',
            status: 'CANCELLED',
            matchNumber: 4,
            roundNumber: 1,
            playerMatches: [
              makePlayer('p6', 'Finn', 'Frost', 1),
              makePlayer('p7', 'Gail', 'Grove', 2),
            ],
          }),
        ],
      },
      {
        id: 'pool-2',
        poolNumber: 2,
        name: 'Pool 2',
        status: 'IN_PROGRESS',
        matches: [
          makeMatch({
            id: 'm6',
            matchNumber: 1,
            roundNumber: 1,
            playerMatches: [
              makePlayer('p8', 'Hana', 'Holt', 1),
              makePlayer('p9', 'Ivan', 'Ives', 2),
            ],
            target: {
              targetNumber: 4,
            },
          }),
          makeMatch({
            id: 'm5',
            matchNumber: 2,
            roundNumber: 1,
            playerMatches: [
              makePlayer('p10', 'Jill', 'Jones', 1),
              makePlayer('p11', 'Kai', 'Knox', 2),
            ],
          }),
          makeMatch({
            id: 'm7',
            matchNumber: 3,
            roundNumber: 2,
            playerMatches: [
              makePlayer('sam-other', 'Sam', 'Star', 1),
              makePlayer('p12', 'Lia', 'Lake', 2),
            ],
          }),
        ],
      },
    ],
  },
  {
    id: 'stage-2',
    stageNumber: 2,
    name: 'Stage 2',
    status: 'COMPLETED',
    pools: [
      {
        id: 'pool-3',
        poolNumber: 1,
        name: 'Pool 3',
        status: 'COMPLETED',
        matches: [
          makeMatch({
            id: 'm8',
            matchNumber: 1,
            roundNumber: 1,
            playerMatches: [
              makePlayer('p13', 'Mia', 'Moon', 1),
              makePlayer('p14', 'Noah', 'North', 2),
            ],
          }),
        ],
      },
    ],
  },
];

const buildView = (): LiveViewData => ({
  id: 't-1',
  name: 'City Open',
  status: 'IN_PROGRESS',
  brackets: [
    {
      id: 'b-1',
      name: 'Bracket',
      bracketType: 'MAIN',
      status: 'IN_PROGRESS',
      matches: [
        makeMatch({
          id: 'bm-1',
          status: 'IN_PROGRESS',
          matchNumber: 1,
          roundNumber: 1,
          playerMatches: [
            makePlayer('sam-1', 'Sam', 'Star', 1),
            makePlayer('p15', 'Owen', 'Oak', 2),
          ],
        }),
      ],
    },
  ],
});

describe('live tournament queue utilities', () => {
  it('builds an interleaved queue and filters blocked or final matches', () => {
    const poolStages = buildPoolStages();
    const view = buildView();

    const queue = buildMatchQueue(view, poolStages);

    expect(queue.map((item) => item.matchId)).toEqual(['m6', 'm2', 'm5']);
    expect(queue.find((item) => item.matchId === 'm1')).toBeUndefined();
    expect(queue.find((item) => item.matchId === 'm3')).toBeUndefined();
    expect(queue.find((item) => item.matchId === 'm7')).toBeUndefined();
    expect(queue.find((item) => item.matchId === 'm8')).toBeUndefined();

    const itemWithTargetCode = queue.find((item) => item.matchId === 'm2');
    expect(itemWithTargetCode?.targetCode).toBe('A1');
    expect(itemWithTargetCode?.targetNumber).toBe(1);
    expect(itemWithTargetCode?.players).toEqual(['Cara Cook', 'Dan Dove']);

    const itemWithTargetNumber = queue.find((item) => item.matchId === 'm6');
    expect(itemWithTargetNumber?.targetNumber).toBe(4);
  });

  it('uses surnames in queue for single tournaments', () => {
    const poolStages = [
      {
        id: 'stage-single',
        stageNumber: 1,
        name: 'Stage Single',
        status: 'IN_PROGRESS',
        pools: [
          {
            id: 'pool-single',
            poolNumber: 1,
            name: 'Pool Single',
            status: 'IN_PROGRESS',
            matches: [
              makeMatch({
                id: 'sm-1',
                status: 'SCHEDULED',
                matchNumber: 1,
                roundNumber: 1,
                playerMatches: [
                  makePlayer('sp1', 'Anna', 'Able', 1, 'Arrow'),
                  makePlayer('sp2', 'Ben', 'Bale', 2, 'Bolt'),
                ],
              }),
            ],
          },
        ],
      },
    ] as LiveViewPoolStage[];

    const view = {
      id: 't-single',
      name: 'Single Open',
      status: 'IN_PROGRESS',
      format: 'SINGLE',
      brackets: [],
    } as LiveViewData;

    const queue = buildMatchQueue(view, poolStages);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.players).toEqual(['Arrow', 'Bolt']);
  });
});
