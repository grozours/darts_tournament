import { describe, expect, it } from 'vitest';
import {
  buildBracketRounds,
  getBracketPlayerLabel,
  getBracketRoundLabel,
  getBracketTone,
} from '../../../../src/components/live-tournament/bracket-utilities';

const t = (key: string) => key;

describe('bracket-utilities', () => {
  it('formats round labels with known stages and fallback', () => {
    expect(getBracketRoundLabel(4, 4, t)).toBe('live.round.final');
    expect(getBracketRoundLabel(3, 4, t)).toBe('live.round.semiFinal');
    expect(getBracketRoundLabel(2, 4, t)).toBe('live.round.quarterFinal');
    expect(getBracketRoundLabel(1, 4, t)).toBe('live.round.roundOf16');
    expect(getBracketRoundLabel(3, 8, t)).toBe('live.queue.roundLabel 3');
  });

  it('builds player labels with fallbacks', () => {
    expect(getBracketPlayerLabel()).toBe('TBD');
    expect(getBracketPlayerLabel({ playerPosition: 1, player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } })).toBe('Ava Archer');
    expect(getBracketPlayerLabel({ playerPosition: 1, player: { id: 'p2', firstName: 'Ava', lastName: '' } })).toBe('Ava');
  });

  it('builds bracket rounds with placeholders', () => {
    const rounds = buildBracketRounds({
      id: 'br1',
      name: 'Winners',
      bracketType: 'SINGLE',
      status: 'IN_PROGRESS',
      totalRounds: 2,
      entries: [
        { id: 'e1', seedNumber: 1, player: { id: 'p1', firstName: 'Ava', lastName: 'Archer' } },
        { id: 'e2', seedNumber: 2, player: { id: 'p2', firstName: 'Bo', lastName: 'Bowen' } },
        { id: 'e3', seedNumber: 3, player: { id: 'p3', firstName: 'Cory', lastName: 'Cole' } },
        { id: 'e4', seedNumber: 4, player: { id: 'p4', firstName: 'Dara', lastName: 'Duke' } },
      ],
      matches: [
        {
          id: 'm1',
          matchNumber: 1,
          roundNumber: 1,
          status: 'SCHEDULED',
          playerMatches: [],
        },
      ],
    });

    expect(rounds).toHaveLength(2);
    expect(rounds[0].matches).toHaveLength(2);
    expect(rounds[0].matches[1]?.isPlaceholder).toBe(true);
  });

  it('returns tones based on round index', () => {
    const finalTone = getBracketTone(2, 3);
    expect(finalTone.winner).toBe('text-amber-300');

    const evenTone = getBracketTone(0, 3);
    expect(evenTone.winner).toBe('text-emerald-300');

    const oddTone = getBracketTone(1, 3);
    expect(oddTone.row).toBe('bg-slate-950/70 border-slate-700');
  });
});
