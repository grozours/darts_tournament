import { MATCH_FORMAT_PRESETS } from '../../../../shared/src/types';
import { getWebSocketService } from '../../websocket/server';

type MatchFormatNotificationDependencies = {
  findById: (tournamentId: string) => Promise<{ id: string; name: string } | null | undefined>;
  getMatchDetailsForNotification: (matchId: string) => Promise<{
    id: string;
    matchNumber: number;
    roundNumber: number;
    startedAt?: Date | null;
    target?: {
      id: string;
      targetNumber: number;
      targetCode?: string | null;
      name?: string | null;
    } | null;
    pool?: {
      id: string;
      poolNumber: number;
      poolStage?: {
        stageNumber: number;
      } | null;
    } | null;
    bracket?: {
      name?: string | null;
    } | null;
    playerMatches?: Array<{
      playerId?: string | null;
      player?: {
        id?: string;
        firstName?: string;
        lastName?: string;
        surname?: string | null;
        teamName?: string | null;
      } | null;
    }> | null;
  } | null | undefined>;
};

type MatchDetailsForNotification = Awaited<
  ReturnType<MatchFormatNotificationDependencies['getMatchDetailsForNotification']>
>;

type ResolvedMatchDetailsForNotification = Exclude<MatchDetailsForNotification, null | undefined>;

type MatchDetailsPlayerMatch = NonNullable<ResolvedMatchDetailsForNotification['playerMatches']>[number];

const gameLabelByCode: Record<string, string> = {
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

const formatSegmentDescription = (segment: { game: string; targetCount: number }) => (
  `${gameLabelByCode[segment.game] ?? segment.game} - ${segment.targetCount} Tableaux`
);

const formatPresetSegmentDescription = (
  presetKey: string,
  segmentIndex: number,
  segment: { game: string; targetCount: number }
): string => {
  const exact = exactPresetDescriptions[presetKey]?.[segmentIndex];
  return exact ?? formatSegmentDescription(segment);
};

export const getMatchFormatTooltip = (matchFormatKey?: string): string => {
  if (!matchFormatKey) {
    return '';
  }
  const preset = MATCH_FORMAT_PRESETS.find((item) => item.key === matchFormatKey);
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

const buildNotificationPlayers = (
  playerMatches: MatchDetailsPlayerMatch[]
) => playerMatches.map((playerMatch) => {
  const summary: {
    id?: string;
    firstName?: string;
    lastName?: string;
    surname?: string;
    teamName?: string;
  } = {};
  const playerId = playerMatch.player?.id ?? playerMatch.playerId ?? undefined;
  if (playerId !== undefined) {
    summary.id = playerId;
  }
  if (playerMatch.player?.firstName !== undefined) {
    summary.firstName = playerMatch.player.firstName;
  }
  if (playerMatch.player?.lastName !== undefined) {
    summary.lastName = playerMatch.player.lastName;
  }
  if (playerMatch.player?.surname) {
    summary.surname = playerMatch.player.surname;
  }
  if (playerMatch.player?.teamName) {
    summary.teamName = playerMatch.player.teamName;
  }
  return summary;
});

const buildNotificationMatch = (
  details: ResolvedMatchDetailsForNotification
) => (
  details.pool
    ? {
        source: 'pool' as const,
        matchNumber: details.matchNumber,
        roundNumber: details.roundNumber,
        ...(details.pool.poolStage?.stageNumber === undefined
          ? {}
          : { stageNumber: details.pool.poolStage.stageNumber }),
        poolNumber: details.pool.poolNumber,
        poolId: details.pool.id,
      }
    : {
        source: 'bracket' as const,
        matchNumber: details.matchNumber,
        roundNumber: details.roundNumber,
        bracketName: details.bracket?.name ?? null,
      }
);

const buildNotificationTarget = (
  details: ResolvedMatchDetailsForNotification
) => (
  details.target
    ? {
        id: details.target.id,
        targetNumber: details.target.targetNumber,
        ...(details.target.targetCode ? { targetCode: details.target.targetCode } : {}),
        name: details.target.name ?? null,
      }
    : undefined
);

export const emitMatchFormatChangedNotifications = async (
  dependencies: MatchFormatNotificationDependencies,
  tournamentId: string,
  updates: Array<{ matchId: string; matchFormatKey: string }>
): Promise<void> => {
  if (updates.length === 0) {
    return;
  }

  const webSocketService = getWebSocketService();
  if (!webSocketService) {
    return;
  }

  const tournament = await dependencies.findById(tournamentId);
  if (!tournament) {
    return;
  }

  for (const update of updates) {
    const details = await dependencies.getMatchDetailsForNotification(update.matchId);
    if (!details) {
      continue;
    }
    const players = buildNotificationPlayers(details.playerMatches ?? []);
    const match = buildNotificationMatch(details);
    const target = buildNotificationTarget(details);

    await webSocketService.emitMatchFormatChanged({
      event: 'format_changed',
      matchId: details.id,
      tournamentId,
      tournamentName: tournament.name,
      ...(details.startedAt ? { startedAt: details.startedAt.toISOString() } : {}),
      ...(target ? { target } : {}),
      match,
      players,
      matchFormatKey: update.matchFormatKey,
      matchFormatTooltip: getMatchFormatTooltip(update.matchFormatKey),
    });
  }
};
