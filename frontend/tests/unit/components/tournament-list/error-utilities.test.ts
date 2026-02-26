import { describe, expect, it } from 'vitest';
import { getErrorMessage } from '../../../../src/components/tournament-list/error-utilities';

describe('getErrorMessage', () => {
  it('extracts nested message from Error and JSON string', () => {
    expect(getErrorMessage(new Error('{"error":{"message":"boom"}}'), 'fallback')).toBe('boom');
  });

  it('returns raw string for non-json string', () => {
    expect(getErrorMessage('plain error', 'fallback')).toBe('plain error');
  });

  it('extracts object error message and fallbacks otherwise', () => {
    expect(getErrorMessage({ error: { message: 'obj boom' } }, 'fallback')).toBe('obj boom');
    expect(getErrorMessage({ foo: 'bar' }, 'fallback')).toBe('fallback');
  });
});
