import {
  MATCH_FORMAT_PRESETS,
  type MatchFormatPreset,
  type MatchFormatPresetSegment,
} from '@shared/types';

let matchFormatPresets: MatchFormatPreset[] = [...MATCH_FORMAT_PRESETS];

const rebuildPresetMap = () => new Map<string, MatchFormatPreset>(
  matchFormatPresets.map((preset) => [String(preset.key), preset])
);

let presetByKey = rebuildPresetMap();

export const setMatchFormatPresets = (presets: MatchFormatPreset[]) => {
  matchFormatPresets = presets.length > 0 ? presets : [...MATCH_FORMAT_PRESETS];
  presetByKey = rebuildPresetMap();
};

export const getMatchFormatPresets = (): MatchFormatPreset[] => matchFormatPresets;

const gameLabelByCode: Record<MatchFormatPresetSegment['game'], string> = {
  '501_DO': '501 DO',
  'CRICKET': 'Cricket',
  '701_DO': '701 DO',
};

const exactPresetDescriptions: Record<string, string[]> = {
  BO3: [
    '501 DO - 4 Tableaux',
    'Cricket - 2 Tableaux',
    '501 DO - 2 Tableaux',
  ],
  BO5: [
    '501 DO - 4 Tableaux',
    'Cricket - 2 Tableaux',
    '501 DO - 4 Tableaux',
    'Cricket 2 -Tableaux',
    '501 - 2 Tableaux',
  ],
  BO5_F: [
    '501 DO – 4 Tableaux',
    'Cricket - 2 Tableaux',
    '501 DO – 4 Tableaux',
    'Cricket - 2 Tableaux',
    '701 DO – 2 Tableaux',
  ],
};

export const getSegmentGameLabel = (game: MatchFormatPresetSegment['game']): string => (
  gameLabelByCode[game] ?? game
);

export const formatSegmentDescription = (segment: MatchFormatPresetSegment): string => (
  `${getSegmentGameLabel(segment.game)} - ${segment.targetCount} Tableaux`
);

export const formatPresetSegmentDescription = (
  presetKey: string,
  segmentIndex: number,
  segment: MatchFormatPresetSegment
): string => {
  const exact = exactPresetDescriptions[presetKey]?.[segmentIndex];
  return exact ?? formatSegmentDescription(segment);
};

export const getMatchFormatTooltip = (matchFormatKey?: string) => {
  if (!matchFormatKey) {
    return '';
  }
  const preset = presetByKey.get(matchFormatKey);
  if (!preset) {
    return matchFormatKey;
  }
  const segmentLines = preset.segments
    .map((segment, index) => `- ${formatPresetSegmentDescription(preset.key, index, segment)}`)
    .join('\n');

  return [
    `key: ${preset.key}`,
    segmentLines,
  ].join('\n');
};
