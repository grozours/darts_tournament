import { describe, expect, it } from 'vitest';
import { parseTournamentGroupPayload } from '../../../src/components/notifications/use-match-started-notifications';

describe('parseTournamentGroupPayload', () => {
  it('returns payload directly when API already responds with an array', () => {
    const payload = [{ members: [{ playerId: 'p1', email: 'a@b.c' }] }];

    const parsed = parseTournamentGroupPayload(payload, 'doublettes');

    expect(parsed).toEqual(payload);
  });

  it('extracts doublettes from object response', () => {
    const payload = {
      doublettes: [{ members: [{ playerId: 'p1' }, { playerId: 'p2' }] }],
      totalCount: 1,
    };

    const parsed = parseTournamentGroupPayload(payload, 'doublettes');

    expect(parsed).toEqual(payload.doublettes);
  });

  it('extracts equipes from object response', () => {
    const payload = {
      equipes: [{ members: [{ playerId: 'p3' }, { playerId: 'p4' }] }],
      totalCount: 1,
    };

    const parsed = parseTournamentGroupPayload(payload, 'equipes');

    expect(parsed).toEqual(payload.equipes);
  });

  it('returns empty array when response has no expected group collection', () => {
    const payload = { totalCount: 0 };

    const parsedDoublettes = parseTournamentGroupPayload(payload, 'doublettes');
    const parsedEquipes = parseTournamentGroupPayload(payload, 'equipes');

    expect(parsedDoublettes).toEqual([]);
    expect(parsedEquipes).toEqual([]);
  });
});
