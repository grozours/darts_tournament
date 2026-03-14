import { z } from 'zod';
import {
  DurationType,
  SkillLevel,
  TournamentFormat,
  TournamentStatus,
} from '../../../../shared/src/types';

export const minutesToMs = 60_000;

const skillLevelWithoutAdvancedSchema = z
  .nativeEnum(SkillLevel)
  .refine((value) => value !== SkillLevel.ADVANCED, {
    message: 'ADVANCED skill level is no longer supported',
  });

export const createTournamentSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Tournament name is required' })
      .min(3, 'Tournament name must be at least 3 characters long')
      .max(100, 'Tournament name cannot exceed 100 characters')
      .trim(),
    location: z
      .string()
      .max(150, 'Tournament location cannot exceed 150 characters')
      .trim()
      .optional(),
    format: z.nativeEnum(TournamentFormat, {
      required_error: 'Format is required',
      invalid_type_error: 'Invalid tournament format',
    }),
    durationType: z.nativeEnum(DurationType, {
      required_error: 'Duration type is required',
      invalid_type_error: 'Invalid duration type',
    }),
    startTime: z
      .string({ required_error: 'Start time is required' })
      .datetime({ message: 'Invalid start time format' })
      .refine((value) => new Date(value) > new Date(), {
        message: 'Start time must be in the future',
      }),
    endTime: z
      .string({ required_error: 'End time is required' })
      .datetime({ message: 'Invalid end time format' }),
    totalParticipants: z
      .number({ required_error: 'Total participants is required' })
      .int({ message: 'Total participants must be an integer' })
      .min(2, 'Tournament must have at least 2 participants')
      .max(128, 'Tournament cannot exceed 128 participants'),
    targetCount: z
      .number({ required_error: 'Target count is required' })
      .int({ message: 'Target count must be an integer' })
      .min(1, 'Tournament must have at least 1 target')
      .max(32, 'Tournament cannot exceed 32 targets'),
    targetStartNumber: z
      .number()
      .int({ message: 'Target start number must be an integer' })
      .min(1, 'Target start number must be at least 1')
      .optional(),
    shareTargets: z.boolean().optional(),
    doubleStageEnabled: z.boolean().optional(),
  })
    .refine(
      (data) => {
        const startTime = new Date(data.startTime);
        const endTime = new Date(data.endTime);
        return endTime > startTime;
      },
      {
        message: 'End time must be after start time',
        path: ['endTime'],
      }
    )
    .refine(
      (data) => {
        const startTime = new Date(data.startTime);
        const endTime = new Date(data.endTime);
        const duration = endTime.getTime() - startTime.getTime();
        const minDuration = 60 * minutesToMs; // 1 hour
        return duration >= minDuration;
      },
      {
        message: 'Tournament duration must be at least 1 hour',
        path: ['endTime'],
      }
    )
    .refine(
      (data) => {
        const startTime = new Date(data.startTime);
        const endTime = new Date(data.endTime);
        const duration = endTime.getTime() - startTime.getTime();
        const maxDuration = 24 * 60 * minutesToMs; // 24 hours
        return duration <= maxDuration;
      },
      {
        message: 'Tournament duration cannot exceed 24 hours',
        path: ['endTime'],
      }
    ),
};

export const updateTournamentSchema = {
  body: z.object({
    name: z
      .string()
      .min(3, 'Tournament name must be at least 3 characters long')
      .max(100, 'Tournament name cannot exceed 100 characters')
      .trim()
      .optional(),
    location: z
      .string()
      .max(150, 'Tournament location cannot exceed 150 characters')
      .trim()
      .optional(),
    format: z.nativeEnum(TournamentFormat).optional(),
    durationType: z.nativeEnum(DurationType).optional(),
    startTime: z.string().datetime({ message: 'Invalid start time format' }).optional(),
    endTime: z.string().datetime({ message: 'Invalid end time format' }).optional(),
    totalParticipants: z
      .number()
      .int({ message: 'Total participants must be an integer' })
      .min(2, 'Tournament must have at least 2 participants')
      .max(512, 'Tournament cannot exceed 512 participants')
      .optional(),
    targetCount: z
      .number()
      .int({ message: 'Target count must be an integer' })
      .min(1, 'Tournament must have at least 1 target')
      .max(20, 'Tournament cannot exceed 20 targets')
      .optional(),
    targetStartNumber: z
      .number()
      .int({ message: 'Target start number must be an integer' })
      .min(1, 'Target start number must be at least 1')
      .optional(),
    shareTargets: z.boolean().optional(),
    doubleStageEnabled: z.boolean().optional(),
  }),
};

export const deleteTournamentLogoSchema = {
  body: z.object({
    logoUrl: z.string().trim().min(1, 'Logo URL is required').optional(),
    logo_url: z.string().trim().min(1, 'Logo URL is required').optional(),
  }).refine((value) => Boolean(value.logoUrl ?? value.logo_url), {
    message: 'Logo URL is required',
  }),
};

const tournamentPresetTypeSchema = z.enum(['single-pool-stage', 'three-pool-stages', 'custom']);
const presetMatchFormatSchema = z.string().trim().min(1).max(20);
const presetParallelReferenceSchema = z.string().trim().min(1).max(140);
const matchFormatGameSchema = z.enum(['501_DO', 'CRICKET', '701_DO']);

const matchFormatPresetSegmentSchema = z.object({
  game: matchFormatGameSchema,
  targetCount: z.number().int().min(1).max(10),
});

const matchFormatPresetPayloadSchema = z.object({
  key: z
    .string({ required_error: 'Format key is required' })
    .min(2)
    .max(20)
    .trim(),
  durationMinutes: z.number().int().min(1).max(600),
  segments: z.array(matchFormatPresetSegmentSchema).min(1).max(12),
  isSystem: z.boolean().optional(),
});

const presetRoutingRuleSchema = z
  .object({
    stageNumber: z.number().int().min(1),
    position: z.number().int().min(1),
    destinationType: z.enum(['POOL_STAGE', 'BRACKET', 'ELIMINATED']),
    destinationStageNumber: z.number().int().min(1).optional(),
    destinationBracketName: z.string().min(1).max(100).optional(),
  })
  .superRefine((rule, context) => {
    if (rule.destinationType === 'POOL_STAGE' && rule.destinationStageNumber === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'destinationStageNumber is required when destinationType is POOL_STAGE',
      });
    }

    if (rule.destinationType === 'BRACKET' && !rule.destinationBracketName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'destinationBracketName is required when destinationType is BRACKET',
      });
    }
  });

const presetTemplateConfigSchema = z
  .object({
    format: z.nativeEnum(TournamentFormat),
    stages: z.array(
      z.object({
        name: z.string().min(1).max(100),
        poolCount: z.number().int().min(1).max(256),
        playersPerPool: z.number().int().min(2).max(16),
        advanceCount: z.number().int().min(1).max(16),
        matchFormatKey: presetMatchFormatSchema.optional(),
        inParallelWith: z.array(presetParallelReferenceSchema).max(32).optional(),
      })
    ).min(1).max(16),
    brackets: z.array(
      z.object({
        name: z.string().min(1).max(100),
        totalRounds: z.number().int().min(1).max(16),
        roundMatchFormats: z.record(z.string(), presetMatchFormatSchema).optional(),
        inParallelWith: z.array(presetParallelReferenceSchema).max(32).optional(),
      })
    ).min(1).max(16),
    routingRules: z.array(presetRoutingRuleSchema),
  })
  .superRefine((config, context) => {
    validatePresetRoutingRules(config, context);
    validatePresetBracketRoundMatchFormats(config, context);
    validatePresetParallelReferences(config, context);
  });

type PresetTemplateConfigInput = z.infer<typeof presetTemplateConfigSchema>;

const addCustomIssue = (context: z.RefinementCtx, message: string) => {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message,
  });
};

const validatePresetRoutingRules = (
  config: PresetTemplateConfigInput,
  context: z.RefinementCtx
) => {
  const stageNumbers = new Set(config.stages.map((_, index) => index + 1));
  const bracketNames = new Set(config.brackets.map((bracket) => bracket.name));

  for (const rule of config.routingRules) {
    if (!stageNumbers.has(rule.stageNumber)) {
      addCustomIssue(context, 'routingRules contains invalid stageNumber');
    }

    if (
      rule.destinationType === 'POOL_STAGE'
      && rule.destinationStageNumber !== undefined
      && !stageNumbers.has(rule.destinationStageNumber)
    ) {
      addCustomIssue(context, 'routingRules contains invalid destinationStageNumber');
    }

    if (
      rule.destinationType === 'BRACKET'
      && rule.destinationBracketName
      && !bracketNames.has(rule.destinationBracketName)
    ) {
      addCustomIssue(context, 'routingRules contains unknown destinationBracketName');
    }
  }
};

const validatePresetBracketRoundMatchFormats = (
  config: PresetTemplateConfigInput,
  context: z.RefinementCtx
) => {
  for (const bracket of config.brackets) {
    if (!bracket.roundMatchFormats) {
      continue;
    }

    for (const roundNumber of Object.keys(bracket.roundMatchFormats)) {
      const parsedRound = Number(roundNumber);
      if (!Number.isInteger(parsedRound) || parsedRound < 1 || parsedRound > bracket.totalRounds) {
        addCustomIssue(context, 'roundMatchFormats contains invalid round number');
      }
    }
  }
};

const parseParallelReference = (value: string):
  | { type: 'POOL_STAGE'; stageNumber: number }
  | { type: 'BRACKET'; bracketName: string }
  | undefined => {
  const trimmed = value.trim();
  const separatorIndex = trimmed.indexOf(':');
  if (separatorIndex < 0) {
    return undefined;
  }

  const referenceType = trimmed.slice(0, separatorIndex).trim().toLowerCase();
  const referenceValue = trimmed.slice(separatorIndex + 1).trim();
  if (referenceType === 'stage') {
    if (referenceValue.length === 0) {
      return undefined;
    }

    if (!/^\d+$/.test(referenceValue)) {
      return undefined;
    }
    const stageNumber = Number.parseInt(referenceValue, 10);

    if (stageNumber > 0) {
      return { type: 'POOL_STAGE', stageNumber };
    }

    return undefined;
  }

  if (referenceType === 'bracket' && referenceValue.length > 0) {
    return { type: 'BRACKET', bracketName: referenceValue };
  }

  return undefined;
};

type ParsedParallelReference = Exclude<ReturnType<typeof parseParallelReference>, undefined>;

const validateParsedReferenceForStage = (
  parsed: ParsedParallelReference,
  stageNumber: number,
  stageNumbers: Set<number>,
  bracketNames: Set<string>,
  context: z.RefinementCtx
) => {
  if (parsed.type === 'POOL_STAGE') {
    if (!stageNumbers.has(parsed.stageNumber)) {
      addCustomIssue(context, 'stages.inParallelWith contains unknown stage reference');
    }
    if (parsed.stageNumber === stageNumber) {
      addCustomIssue(context, 'stages.inParallelWith cannot reference itself');
    }
    return;
  }

  if (!bracketNames.has(parsed.bracketName)) {
    addCustomIssue(context, 'stages.inParallelWith contains unknown bracket reference');
  }
};

const validateParsedReferenceForBracket = (
  parsed: ParsedParallelReference,
  bracketName: string,
  stageNumbers: Set<number>,
  bracketNames: Set<string>,
  context: z.RefinementCtx
) => {
  if (parsed.type === 'POOL_STAGE') {
    if (!stageNumbers.has(parsed.stageNumber)) {
      addCustomIssue(context, 'brackets.inParallelWith contains unknown stage reference');
    }
    return;
  }

  if (!bracketNames.has(parsed.bracketName)) {
    addCustomIssue(context, 'brackets.inParallelWith contains unknown bracket reference');
  }
  if (parsed.bracketName === bracketName) {
    addCustomIssue(context, 'brackets.inParallelWith cannot reference itself');
  }
};

const validatePresetReferenceList = (
  references: string[] | undefined,
  invalidMessage: string,
  context: z.RefinementCtx,
  validator: (parsed: ParsedParallelReference) => void
) => {
  for (const reference of references ?? []) {
    const parsed = parseParallelReference(reference);
    if (!parsed) {
      addCustomIssue(context, invalidMessage);
      continue;
    }
    validator(parsed);
  }
};

const validatePresetParallelReferences = (
  config: PresetTemplateConfigInput,
  context: z.RefinementCtx
) => {
  const stageNumbers = new Set(config.stages.map((_, index) => index + 1));
  const bracketNames = new Set(config.brackets.map((bracket) => bracket.name));

  for (const [stageIndex, stage] of config.stages.entries()) {
    const stageNumber = stageIndex + 1;
    validatePresetReferenceList(
      stage.inParallelWith,
      'stages.inParallelWith contains invalid reference (use stage:<number> or bracket:<name>)',
      context,
      (parsed) => validateParsedReferenceForStage(parsed, stageNumber, stageNumbers, bracketNames, context)
    );
  }

  for (const bracket of config.brackets) {
    validatePresetReferenceList(
      bracket.inParallelWith,
      'brackets.inParallelWith contains invalid reference (use stage:<number> or bracket:<name>)',
      context,
      (parsed) => validateParsedReferenceForBracket(parsed, bracket.name, stageNumbers, bracketNames, context)
    );
  }
};

export const createTournamentPresetSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Preset name is required' })
      .min(3, 'Preset name must be at least 3 characters long')
      .max(100, 'Preset name cannot exceed 100 characters')
      .trim(),
    presetType: tournamentPresetTypeSchema,
    totalParticipants: z
      .number({ required_error: 'Total participants is required' })
      .int({ message: 'Total participants must be an integer' })
      .min(4, 'Participants must be at least 4')
      .max(512, 'Participants cannot exceed 512'),
    targetCount: z
      .number({ required_error: 'Target count is required' })
      .int({ message: 'Target count must be an integer' })
      .min(1, 'Target count must be at least 1')
      .max(32, 'Target count cannot exceed 32'),
    templateConfig: presetTemplateConfigSchema.optional(),
  }),
};

export const updateTournamentPresetSchema = {
  body: z
    .object({
      name: z
        .string()
        .min(3, 'Preset name must be at least 3 characters long')
        .max(100, 'Preset name cannot exceed 100 characters')
        .trim()
        .optional(),
      presetType: tournamentPresetTypeSchema.optional(),
      totalParticipants: z
        .number()
        .int({ message: 'Total participants must be an integer' })
        .min(4, 'Participants must be at least 4')
        .max(512, 'Participants cannot exceed 512')
        .optional(),
      targetCount: z
        .number()
        .int({ message: 'Target count must be an integer' })
        .min(1, 'Target count must be at least 1')
        .max(32, 'Target count cannot exceed 32')
        .optional(),
      templateConfig: presetTemplateConfigSchema.optional(),
    })
    .refine(
      (data) =>
        data.name !== undefined
        || data.presetType !== undefined
        || data.totalParticipants !== undefined
        || data.targetCount !== undefined
        || data.templateConfig !== undefined,
      { message: 'At least one field is required for update' }
    ),
};

export const createMatchFormatPresetSchema = {
  body: matchFormatPresetPayloadSchema,
};

export const updateMatchFormatPresetSchema = {
  body: matchFormatPresetPayloadSchema
    .partial()
    .refine(
      (data) =>
        data.key !== undefined
        || data.durationMinutes !== undefined
        || data.segments !== undefined
        || data.isSystem !== undefined,
      { message: 'At least one field is required for update' }
    ),
};

export const uuidSchema = {
  params: z.object({
    id: z.string().uuid('Invalid UUID format'),
  }),
};

export const snapshotHistoryUuidSchema = {
  params: z.object({
    id: z.string().uuid('Invalid UUID format'),
    snapshotId: z.string().min(1, 'Snapshot ID is required'),
  }),
};

export const presetUuidSchema = {
  params: z.object({
    presetId: z.string().uuid('Invalid preset UUID format'),
  }),
};

export const matchFormatPresetUuidSchema = {
  params: z.object({
    formatId: z.string().uuid('Invalid match format preset UUID format'),
  }),
};

export const getTournamentsSchema = {
  query: z.object({
    status: z
      .preprocess(
        (value) => (typeof value === 'string' ? value.toUpperCase() : value),
        z.nativeEnum(TournamentStatus, {
          errorMap: () => ({ message: 'Invalid tournament status' }),
        })
      )
      .optional(),
    format: z
      .preprocess(
        (value) => (typeof value === 'string' ? value.toUpperCase() : value),
        z.nativeEnum(TournamentFormat, {
          errorMap: () => ({ message: 'Invalid tournament format' }),
        })
      )
      .optional(),
    name: z
      .string()
      .min(1, 'Name search term must be at least 1 character')
      .max(100, 'Name search term cannot exceed 100 characters')
      .optional(),
    page: z
      .string()
      .regex(/^\d+$/, 'Page must be a positive integer')
      .transform((value) => Number.parseInt(value, 10))
      .refine((value) => value > 0, 'Page must be greater than 0')
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .transform((value) => Number.parseInt(value, 10))
      .refine((value) => value > 0 && value <= 100, 'Limit must be between 1 and 100')
      .optional(),
    sortBy: z.enum(['name', 'startTime', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
};

export const getLiveSummarySchema = {
  query: z.object({
    status: z
      .preprocess(
        (value) => (typeof value === 'string' ? value.toUpperCase() : value),
        z.nativeEnum(TournamentStatus, {
          errorMap: () => ({ message: 'Invalid tournament status' }),
        })
      )
      .optional(),
    statuses: z
      .string()
      .regex(/^[A-Za-z_,]+$/, 'statuses must be a comma-separated list of status values')
      .optional(),
  }),
};

export const dateRangeSchema = {
  query: z
    .object({
      startDate: z.string().datetime({ message: 'Invalid start date format' }),
      endDate: z.string().datetime({ message: 'Invalid end date format' }),
    })
    .refine(
      (data) => {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        return endDate > startDate;
      },
      {
        message: 'End date must be after start date',
        path: ['endDate'],
      }
    ),
};

export const createPlayerSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
  }),
  body: z.object({
    personId: z.string().uuid('Invalid person ID').optional(),
    firstName: z
      .string()
      .min(2, 'First name must be at least 2 characters long')
      .max(50, 'First name cannot exceed 50 characters')
      .trim(),
    lastName: z
      .string()
      .min(2, 'Last name must be at least 2 characters long')
      .max(50, 'Last name cannot exceed 50 characters')
      .trim(),
    surname: z.string().max(50, 'Surname cannot exceed 50 characters').optional(),
    teamName: z.string().max(100, 'Team name cannot exceed 100 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
    skillLevel: skillLevelWithoutAdvancedSchema.optional(),
  }),
};

export const updatePlayerSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
    playerId: z.string().uuid('Invalid player ID'),
  }),
  body: z.object({
    personId: z.string().uuid('Invalid person ID').optional(),
    firstName: z
      .string()
      .min(2, 'First name must be at least 2 characters long')
      .max(50, 'First name cannot exceed 50 characters')
      .trim(),
    lastName: z
      .string()
      .min(2, 'Last name must be at least 2 characters long')
      .max(50, 'Last name cannot exceed 50 characters')
      .trim(),
    surname: z.string().max(50, 'Surname cannot exceed 50 characters').optional(),
    teamName: z.string().max(100, 'Team name cannot exceed 100 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
    skillLevel: skillLevelWithoutAdvancedSchema.optional(),
  }),
};

const groupNameSchema = z
  .string({ required_error: 'Name is required' })
  .min(2, 'Name must be at least 2 characters long')
  .max(120, 'Name cannot exceed 120 characters')
  .trim();

const groupPasswordSchema = z
  .string({ required_error: 'Password is required' })
  .min(4, 'Password must be at least 4 characters long')
  .max(64, 'Password cannot exceed 64 characters');

export const groupListSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
  }),
  query: z.object({
    search: z.string().trim().min(1).max(120).optional(),
  }),
};

export const createGroupSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
  }),
  body: z.object({
    name: groupNameSchema,
    password: groupPasswordSchema,
    skillLevel: skillLevelWithoutAdvancedSchema.nullable().optional(),
    captainPlayerId: z.string().uuid('Invalid captain player ID').optional(),
    memberPlayerIds: z.array(z.string().uuid('Invalid member player ID')).max(8).optional(),
  }),
};

export const updateGroupSchema = {
  body: z.object({
    name: groupNameSchema.optional(),
    skillLevel: skillLevelWithoutAdvancedSchema.nullable().optional(),
  }).refine((data) => data.name !== undefined || data.skillLevel !== undefined, {
    message: 'At least one field is required',
  }),
};

export const joinDoubletteSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
    doubletteId: z.string().uuid('Invalid doublette ID'),
  }),
  body: z.object({
    password: groupPasswordSchema,
  }),
};

export const joinEquipeSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
    equipeId: z.string().uuid('Invalid equipe ID'),
  }),
  body: z.object({
    password: groupPasswordSchema,
  }),
};

export const doubletteRouteSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
    doubletteId: z.string().uuid('Invalid doublette ID'),
  }),
};

export const equipeRouteSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
    equipeId: z.string().uuid('Invalid equipe ID'),
  }),
};

export const updateGroupPasswordSchema = {
  body: z.object({
    password: groupPasswordSchema,
  }),
};

export const groupPlayerSearchSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
  }),
  query: z.object({
    query: z.string().trim().min(1).max(120),
  }),
};

export const addGroupMemberSchema = {
  body: z.object({
    playerId: z.string().uuid('Invalid player ID'),
  }),
};

export const removeDoubletteMemberSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
    doubletteId: z.string().uuid('Invalid doublette ID'),
    playerId: z.string().uuid('Invalid player ID'),
  }),
};

export const removeEquipeMemberSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
    equipeId: z.string().uuid('Invalid equipe ID'),
    playerId: z.string().uuid('Invalid player ID'),
  }),
};
