import { describe, expect, it } from 'vitest';
import {
  getStatusLabel,
  normalizeStageStatus,
  normalizeTournamentStatus,
} from '../../../../src/components/tournament-list/tournament-status-helpers';

describe('tournament-status-helpers', () => {
  const t = (key: string) => `tr:${key}`;

  it('maps stage and bracket labels and keeps unknown', () => {
    expect(getStatusLabel(t, 'stage', 'IN_PROGRESS')).toBe('tr:status.stage.in_progress');
    expect(getStatusLabel(t, 'bracket', 'COMPLETED')).toBe('tr:status.bracket.completed');
    expect(getStatusLabel(t, 'stage', 'CUSTOM')).toBe('CUSTOM');
  });

  it('normalizes tournament statuses', () => {
    expect(normalizeTournamentStatus('registration_open')).toBe('OPEN');
    expect(normalizeTournamentStatus('IN_PROGRESS')).toBe('LIVE');
    expect(normalizeTournamentStatus('archived')).toBe('FINISHED');
    expect(normalizeTournamentStatus(' draft ')).toBe('DRAFT');
    expect(normalizeTournamentStatus(undefined)).toBe('');
  });

  it('normalizes stage status', () => {
    expect(normalizeStageStatus(' in_progress ')).toBe('IN_PROGRESS');
    expect(normalizeStageStatus(undefined)).toBe('');
  });
});
