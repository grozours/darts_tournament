import { describe, expect, it } from 'vitest';
import { buildMatchMaps, buildSharedTargets } from '../../../src/components/targets-view/match-maps';
import type { LiveViewData } from '../../../src/components/targets-view/types';

const t = (key: string) => key;

describe('match-maps', () => {
  it('prefers in-progress match info for a target', () => {
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
                  targetId: 'target-1',
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
      targets: [{ id: 'target-1', targetNumber: 1 }],
    };

    const viewTwo: LiveViewData = {
      id: 't-2',
      name: 'Beta',
      status: 'LIVE',
      poolStages: [],
      brackets: [
        {
          id: 'bracket-1',
          name: 'Main',
          matches: [
            {
              id: 'match-2',
              matchNumber: 1,
              roundNumber: 1,
              status: 'IN_PROGRESS',
              targetId: 'target-1',
              playerMatches: [
                { player: { firstName: 'Cia', lastName: 'Lee' } },
                { player: { firstName: 'Drew', lastName: 'Ng' } },
              ],
            },
          ],
        },
      ],
      targets: [{ id: 'target-1', targetNumber: 1 }],
    };

    const maps = buildMatchMaps([viewOne, viewTwo], t);
    const targetInfo = maps.matchByTargetId.get('target-1');

    expect(targetInfo?.status).toBe('IN_PROGRESS');
    expect(maps.matchById.get('match-1')).toBeDefined();
    expect(maps.matchById.get('match-2')).toBeDefined();
  });

  it('builds shared target usage and ordering', () => {
    const view: LiveViewData = {
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
                  status: 'COMPLETED',
                  targetId: 'target-1',
                  playerMatches: [
                    { player: { firstName: 'Ana', lastName: 'Diaz' } },
                    { player: { firstName: 'Bo', lastName: 'Kim' } },
                  ],
                },
                {
                  id: 'match-2',
                  matchNumber: 2,
                  roundNumber: 1,
                  status: 'IN_PROGRESS',
                  targetId: 'target-2',
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
      targets: [
        { id: 'target-1', targetNumber: 1, status: 'IN_USE', currentMatchId: 'match-1' },
        { id: 'target-2', targetNumber: 2, status: 'IN_USE', currentMatchId: 'match-2' },
      ],
    };

    const maps = buildMatchMaps([view], t);
    const sharedTargets = buildSharedTargets([view], maps.matchByTargetId, maps.matchById, t);

    expect(sharedTargets[0]?.targetNumber).toBe(1);
    expect(sharedTargets[1]?.targetNumber).toBe(2);
    expect(sharedTargets[0]?.isInUse).toBe(false);
    expect(sharedTargets[1]?.isInUse).toBe(true);
    expect(sharedTargets[1]?.activeMatchInfo?.matchId).toBe('match-2');
  });
});
