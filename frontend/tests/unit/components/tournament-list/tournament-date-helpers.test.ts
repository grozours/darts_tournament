import { describe, expect, it } from 'vitest';
import { formatToLocalInput, localInputToIso } from '../../../../src/components/tournament-list/tournament-date-helpers';

describe('tournament-date-helpers', () => {
  it('formats ISO date to local input format', () => {
    expect(formatToLocalInput('2026-03-01T08:30:00.000Z')).toMatch(/^2026-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('parses local datetime with optional seconds', () => {
    const formatted = formatToLocalInput('2026-03-01T08:30:12');
    expect(formatted).toMatch(/^2026-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('returns empty string for missing or invalid format input', () => {
    expect(formatToLocalInput()).toBe('');
    expect(formatToLocalInput('not-a-date')).toBe('');
  });

  it('converts local input to ISO string', () => {
    const iso = localInputToIso('2026-03-01T10:45');
    expect(iso).toContain('2026-03-01T');
    expect(iso?.endsWith('Z')).toBe(true);
  });

  it('keeps invalid or empty values unchanged for localInputToIso', () => {
    expect(localInputToIso()).toBeUndefined();
    expect(localInputToIso('')).toBe('');
    expect(localInputToIso('not-a-date')).toBe('not-a-date');
  });
});
