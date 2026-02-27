import { describe, expect, it } from 'vitest';
import {
  formatPresetSegmentDescription,
  formatSegmentDescription,
  getMatchFormatPresets,
  getMatchFormatTooltip,
  getSegmentGameLabel,
  setMatchFormatPresets,
} from '../../../src/utils/match-format-presets';

describe('match-format-presets utils', () => {
  it('resolves known and unknown segment labels', () => {
    expect(getSegmentGameLabel('501_DO')).toBe('501 DO');
    expect(getSegmentGameLabel('CRICKET')).toBe('Cricket');
    expect(getSegmentGameLabel('UNKNOWN' as never)).toBe('UNKNOWN');
  });

  it('formats exact and generic segment descriptions', () => {
    expect(formatPresetSegmentDescription('BO3', 0, { game: '501_DO', targetCount: 4 })).toContain('501 DO');
    expect(formatPresetSegmentDescription('X', 0, { game: '701_DO', targetCount: 2 })).toBe('701 DO - 2 Tableaux');
    expect(formatSegmentDescription({ game: 'CRICKET', targetCount: 1 })).toBe('Cricket - 1 Tableaux');
  });

  it('returns tooltip for known key and fallbacks for unknown/empty', () => {
    setMatchFormatPresets([
      { key: 'K1', durationMinutes: 20, segments: [{ game: '501_DO', targetCount: 2 }] },
    ] as never);

    expect(getMatchFormatTooltip('K1')).toContain('key: K1');
    expect(getMatchFormatTooltip('UNKNOWN')).toBe('UNKNOWN');
    expect(getMatchFormatTooltip()).toBe('');
  });

  it('restores defaults when presets list is empty', () => {
    setMatchFormatPresets([] as never);
    expect(getMatchFormatPresets().length).toBeGreaterThan(0);
  });
});
