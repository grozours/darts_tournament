import { describe, expect, it } from 'vitest';
import {
  formatParticipantsLabel,
  formatTargetLabel,
  getMatchStatusLabel,
  getPlayerLabel,
} from '../../../../src/components/targets-view/target-labels';

describe('targets-view target-labels', () => {
  const t = (key: string) => key;

  it('formats match status labels using i18n keys', () => {
    expect(getMatchStatusLabel('SCHEDULED', t)).toBe('status.match.scheduled');
    expect(getMatchStatusLabel('IN_PROGRESS', t)).toBe('status.match.in_progress');
    expect(getMatchStatusLabel('COMPLETED', t)).toBe('status.match.completed');
    expect(getMatchStatusLabel('CANCELLED', t)).toBe('status.match.cancelled');
    expect(getMatchStatusLabel('UNKNOWN', t)).toBe('UNKNOWN');
  });

  it('prefers group label over player names when mapping is provided', () => {
    const label = getPlayerLabel(
      { id: 'p1', firstName: 'Alice', lastName: 'Doe' },
      new Map([['p1', 'Doublette Alpha']])
    );
    expect(label).toBe('Doublette Alpha');
  });

  it('formats participants labels with fallback', () => {
    expect(formatParticipantsLabel(['A', 'B'], 'fallback')).toBe('A · B');
    expect(formatParticipantsLabel([], 'fallback')).toBe('fallback');
  });

  it('formats target labels consistently', () => {
    expect(formatTargetLabel('target12', t)).toBe('targets.target 12');
    expect(formatTargetLabel('Board A', t)).toBe('Board A');
  });
});
