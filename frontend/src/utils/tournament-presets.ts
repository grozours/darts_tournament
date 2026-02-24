import { BracketType, TournamentFormat } from '@shared/types';

export type PresetType = 'single-pool-stage' | 'three-pool-stages' | 'custom';

export type TournamentPresetTemplateConfig = {
  format: TournamentFormat;
  stages: Array<{
    name: string;
    poolCount: number;
    playersPerPool: number;
    advanceCount: number;
  }>;
  brackets: Array<{
    name: string;
    totalRounds: number;
  }>;
  routingRules: Array<{
    stageNumber: number;
    position: number;
    destinationType: 'BRACKET' | 'POOL_STAGE' | 'ELIMINATED';
    destinationBracketName?: string | undefined;
    destinationStageNumber?: number | undefined;
  }>;
};

export type PresetTemplate = {
  format: TournamentFormat;
  stages: Array<{
    stageNumber: number;
    name: string;
    poolCount: number;
    playersPerPool: number;
    advanceCount: number;
    losersAdvanceToBracket: boolean;
  }>;
  brackets: Array<{
    name: string;
    bracketType: BracketType;
    totalRounds: number;
  }>;
};

type DoublePresetStageRef = {
  id: string;
  stageNumber: number;
};

type DoublePresetBracketRef = {
  id: string;
  name: string;
};

export type StageRoutingUpdate = {
  stageId: string;
  rankingDestinations: Array<{
    position: number;
    destinationType: 'BRACKET' | 'POOL_STAGE' | 'ELIMINATED';
    bracketId?: string;
    poolStageId?: string;
  }>;
};

const getPresetPoolCounts = (totalParticipants: number) => {
  const safeParticipants = Number.isFinite(totalParticipants) && totalParticipants > 0
    ? totalParticipants
    : 16;
  const stage1PoolCount = Math.max(1, Math.floor(safeParticipants / 5));
  const stage2PoolCount = Math.max(1, Math.ceil(stage1PoolCount / 2));
  const stage3PoolCount = Math.max(1, Math.ceil(stage1PoolCount / 2));
  return { stage1PoolCount, stage2PoolCount, stage3PoolCount };
};

export const getDefaultPresetTemplateConfig = (
  preset: PresetType,
  totalParticipants = 16
): TournamentPresetTemplateConfig => {
  const { stage1PoolCount, stage2PoolCount, stage3PoolCount } = getPresetPoolCounts(totalParticipants);

  if (preset === 'single-pool-stage') {
    return {
      format: TournamentFormat.SINGLE,
      stages: [
        {
          name: 'Stage 1',
          poolCount: stage1PoolCount,
          playersPerPool: 5,
          advanceCount: 2,
        },
      ],
      brackets: [
        { name: 'Loser Bracket', totalRounds: 3 },
        { name: 'Winner Bracket', totalRounds: 3 },
      ],
      routingRules: [
        { stageNumber: 1, position: 1, destinationType: 'BRACKET', destinationBracketName: 'Winner Bracket' },
        { stageNumber: 1, position: 2, destinationType: 'BRACKET', destinationBracketName: 'Winner Bracket' },
        { stageNumber: 1, position: 3, destinationType: 'BRACKET', destinationBracketName: 'Loser Bracket' },
        { stageNumber: 1, position: 4, destinationType: 'BRACKET', destinationBracketName: 'Loser Bracket' },
        { stageNumber: 1, position: 5, destinationType: 'BRACKET', destinationBracketName: 'Loser Bracket' },
      ],
    };
  }

  return {
    format: TournamentFormat.DOUBLE,
    stages: [
      {
        name: 'Brassage',
        poolCount: stage1PoolCount,
        playersPerPool: 5,
        advanceCount: 5,
      },
      {
        name: 'Niveau A',
        poolCount: stage2PoolCount,
        playersPerPool: 4,
        advanceCount: 2,
      },
      {
        name: 'Niveau B',
        poolCount: stage3PoolCount,
        playersPerPool: 4,
        advanceCount: 2,
      },
    ],
    brackets: [
      { name: 'Niveau A', totalRounds: 3 },
      { name: 'Niveau B', totalRounds: 3 },
      { name: 'Niveau C', totalRounds: 3 },
    ],
    routingRules: [
      { stageNumber: 1, position: 1, destinationType: 'POOL_STAGE', destinationStageNumber: 2 },
      { stageNumber: 1, position: 2, destinationType: 'POOL_STAGE', destinationStageNumber: 2 },
      { stageNumber: 1, position: 3, destinationType: 'POOL_STAGE', destinationStageNumber: 3 },
      { stageNumber: 1, position: 4, destinationType: 'POOL_STAGE', destinationStageNumber: 3 },
      { stageNumber: 1, position: 5, destinationType: 'BRACKET', destinationBracketName: 'Niveau C' },
      { stageNumber: 2, position: 1, destinationType: 'BRACKET', destinationBracketName: 'Niveau A' },
      { stageNumber: 2, position: 2, destinationType: 'BRACKET', destinationBracketName: 'Niveau A' },
      { stageNumber: 2, position: 3, destinationType: 'ELIMINATED' },
      { stageNumber: 2, position: 4, destinationType: 'ELIMINATED' },
      { stageNumber: 3, position: 1, destinationType: 'BRACKET', destinationBracketName: 'Niveau B' },
      { stageNumber: 3, position: 2, destinationType: 'BRACKET', destinationBracketName: 'Niveau B' },
      { stageNumber: 3, position: 3, destinationType: 'ELIMINATED' },
      { stageNumber: 3, position: 4, destinationType: 'ELIMINATED' },
    ],
  };
};

export const buildTournamentPresetTemplate = (
  preset: { presetType: PresetType; templateConfig?: TournamentPresetTemplateConfig },
  totalParticipants: number
): PresetTemplate => {
  const config = preset.templateConfig ?? getDefaultPresetTemplateConfig(preset.presetType, totalParticipants);
  return {
    format: config.format,
    stages: config.stages.map((stage, index) => ({
      stageNumber: index + 1,
      name: stage.name,
      poolCount: stage.poolCount,
      playersPerPool: stage.playersPerPool,
      advanceCount: stage.advanceCount,
      losersAdvanceToBracket: config.routingRules.some(
        (rule) => rule.stageNumber === index + 1 && rule.destinationType === 'BRACKET'
      ),
    })),
    brackets: config.brackets.map((bracket) => ({
      name: bracket.name,
      bracketType: BracketType.SINGLE_ELIMINATION,
      totalRounds: bracket.totalRounds,
    })),
  };
};

export const buildPresetRoutingUpdates = (
  config: TournamentPresetTemplateConfig | undefined,
  stages: DoublePresetStageRef[],
  brackets: DoublePresetBracketRef[]
): StageRoutingUpdate[] => {
  if (!config || config.routingRules.length === 0) {
    return [];
  }

  const stageByNumber = new Map(stages.map((stage) => [stage.stageNumber, stage.id]));
  const bracketByName = new Map(brackets.map((bracket) => [bracket.name, bracket.id]));
  const groupedRules = new Map<number, TournamentPresetTemplateConfig['routingRules']>();

  for (const rule of config.routingRules) {
    const stageRules = groupedRules.get(rule.stageNumber) ?? [];
    stageRules.push(rule);
    groupedRules.set(rule.stageNumber, stageRules);
  }

  const updates: StageRoutingUpdate[] = [];
  for (const [stageNumber, rules] of groupedRules.entries()) {
    const stageId = stageByNumber.get(stageNumber);
    if (!stageId) {
      continue;
    }

    const rankingDestinations = rules
      .toSorted((first, second) => first.position - second.position)
      .map((rule) => {
        if (rule.destinationType === 'POOL_STAGE') {
          const poolStageId = rule.destinationStageNumber
            ? stageByNumber.get(rule.destinationStageNumber)
            : undefined;
          if (!poolStageId) {
            return undefined;
          }
          return {
            position: rule.position,
            destinationType: 'POOL_STAGE' as const,
            poolStageId,
          };
        }

        if (rule.destinationType === 'BRACKET') {
          const bracketId = rule.destinationBracketName
            ? bracketByName.get(rule.destinationBracketName)
            : undefined;
          if (!bracketId) {
            return undefined;
          }
          return {
            position: rule.position,
            destinationType: 'BRACKET' as const,
            bracketId,
          };
        }

        return {
          position: rule.position,
          destinationType: 'ELIMINATED' as const,
        };
      })
      .filter((destination): destination is NonNullable<typeof destination> => destination !== undefined);

    if (rankingDestinations.length > 0) {
      updates.push({ stageId, rankingDestinations });
    }
  }

  return updates;
};
