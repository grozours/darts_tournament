import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import TournamentController from '../controllers/TournamentController';
import { validate } from '../middleware/validation';
import { uploadTournamentLogo } from '../middleware/upload';
import { z } from 'zod';
import { TournamentFormat, DurationType, TournamentStatus, SkillLevel } from '../../../shared/src/types';

// Initialize Prisma client
const prisma = new PrismaClient();
const tournamentController = new TournamentController(prisma);

const router = Router();

// Validation schemas
const createTournamentSchema = {
  body: z.object({
    name: z.string({ required_error: 'Tournament name is required' })
      .min(3, 'Tournament name must be at least 3 characters long')
      .max(100, 'Tournament name cannot exceed 100 characters')
      .trim(),
    format: z.nativeEnum(TournamentFormat, {
      required_error: 'Format is required',
      invalid_type_error: 'Invalid tournament format',
    }),
    durationType: z.nativeEnum(DurationType, {
      required_error: 'Duration type is required',
      invalid_type_error: 'Invalid duration type',
    }),
    startTime: z.string({ required_error: 'Start time is required' })
      .datetime({ message: 'Invalid start time format' })
      .refine((val) => new Date(val) > new Date(), {
        message: 'Start time must be in the future',
      }),
    endTime: z.string({ required_error: 'End time is required' })
      .datetime({ message: 'Invalid end time format' }),
    totalParticipants: z.number({ required_error: 'Total participants is required' })
      .int({ message: 'Total participants must be an integer' })
      .min(2, 'Tournament must have at least 2 participants')
      .max(128, 'Tournament cannot exceed 128 participants'),
    targetCount: z.number({ required_error: 'Target count is required' })
      .int({ message: 'Target count must be an integer' })
      .min(1, 'Tournament must have at least 1 target')
      .max(32, 'Tournament cannot exceed 32 targets'),
  }).refine((data) => {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    return endTime > startTime;
  }, {
    message: 'End time must be after start time',
    path: ['endTime'],
  }).refine((data) => {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const duration = endTime.getTime() - startTime.getTime();
    const minDuration = 60 * 60 * 1000; // 1 hour
    return duration >= minDuration;
  }, {
    message: 'Tournament duration must be at least 1 hour',
    path: ['endTime'],
  }).refine((data) => {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const duration = endTime.getTime() - startTime.getTime();
    const maxDuration = 24 * 60 * 60 * 1000; // 24 hours
    return duration <= maxDuration;
  }, {
    message: 'Tournament duration cannot exceed 24 hours',
    path: ['endTime'],
  }),
};

const updateTournamentSchema = {
  body: z.object({
    name: z.string()
      .min(3, 'Tournament name must be at least 3 characters long')
      .max(100, 'Tournament name cannot exceed 100 characters')
      .trim()
      .optional(),
    format: z.nativeEnum(TournamentFormat).optional(),
    durationType: z.nativeEnum(DurationType).optional(),
    startTime: z.string()
      .datetime({ message: 'Invalid start time format' })
      .optional(),
    endTime: z.string()
      .datetime({ message: 'Invalid end time format' })
      .optional(),
    totalParticipants: z.number()
      .int({ message: 'Total participants must be an integer' })
      .min(2, 'Tournament must have at least 2 participants')
      .max(512, 'Tournament cannot exceed 512 participants')
      .optional(),
    targetCount: z.number()
      .int({ message: 'Target count must be an integer' })
      .min(1, 'Tournament must have at least 1 target')
      .max(20, 'Tournament cannot exceed 20 targets')
      .optional(),
  }),
};

const uuidSchema = {
  params: z.object({
    id: z.string().uuid('Invalid UUID format'),
  }),
};

const getTournamentsSchema = {
  query: z.object({
    status: z.preprocess((val) => typeof val === 'string' ? val.toUpperCase() : val,
      z.nativeEnum(TournamentStatus, {
        errorMap: () => ({ message: 'Invalid tournament status' }),
      })
    ).optional(),
    format: z.preprocess((val) => typeof val === 'string' ? val.toUpperCase() : val,
      z.nativeEnum(TournamentFormat, {
        errorMap: () => ({ message: 'Invalid tournament format' }),
      })
    ).optional(),
    name: z.string()
      .min(1, 'Name search term must be at least 1 character')
      .max(100, 'Name search term cannot exceed 100 characters')
      .optional(),
    page: z.string()
      .regex(/^\d+$/, 'Page must be a positive integer')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0, 'Page must be greater than 0')
      .optional(),
    limit: z.string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100')
      .optional(),
    sortBy: z.enum(['name', 'startTime', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
};

const dateRangeSchema = {
  query: z.object({
    startDate: z.string()
      .datetime({ message: 'Invalid start date format' }),
    endDate: z.string()
      .datetime({ message: 'Invalid end date format' }),
  }).refine((data) => {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    return endDate > startDate;
  }, {
    message: 'End date must be after start date',
    path: ['endDate'],
  }),
};

const createPlayerSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
  }),
  body: z.object({
    firstName: z.string()
      .min(2, 'First name must be at least 2 characters long')
      .max(50, 'First name cannot exceed 50 characters')
      .trim(),
    lastName: z.string()
      .min(2, 'Last name must be at least 2 characters long')
      .max(50, 'Last name cannot exceed 50 characters')
      .trim(),
    email: z.string()
      .email('Invalid email address')
      .optional(),
    phone: z.string()
      .min(5, 'Phone number must be at least 5 characters long')
      .max(20, 'Phone number cannot exceed 20 characters')
      .optional(),
    skillLevel: z.nativeEnum(SkillLevel).optional(),
  }),
};

const updatePlayerSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
    playerId: z.string().uuid('Invalid player ID'),
  }),
  body: z.object({
    firstName: z.string()
      .min(2, 'First name must be at least 2 characters long')
      .max(50, 'First name cannot exceed 50 characters')
      .trim(),
    lastName: z.string()
      .min(2, 'Last name must be at least 2 characters long')
      .max(50, 'Last name cannot exceed 50 characters')
      .trim(),
    email: z.string()
      .email('Invalid email address')
      .optional(),
    phone: z.string()
      .min(5, 'Phone number must be at least 5 characters long')
      .max(20, 'Phone number cannot exceed 20 characters')
      .optional(),
    skillLevel: z.nativeEnum(SkillLevel).optional(),
  }),
};

// Routes

/**
 * @route   GET /api/tournaments
 * @desc    Get all tournaments with filtering and pagination
 * @access  Public
 */
router.get(
  '/',
  validate(getTournamentsSchema),
  tournamentController.getTournaments
);

/**
 * @route   GET /api/tournaments/date-range
 * @desc    Get tournaments by date range
 * @access  Public
 * @note    This route must come before /:id to avoid conflicts
 */
router.get(
  '/date-range',
  validate(dateRangeSchema),
  tournamentController.getTournamentsByDateRange
);

/**
 * @route   GET /api/tournaments/check-name/:name
 * @desc    Check if tournament name is available
 * @access  Public
 */
router.get(
  '/check-name/:name',
  tournamentController.checkTournamentNameAvailability
);

/**
 * @route   GET /api/tournaments/stats
 * @desc    Get overall tournament statistics
 * @access  Public
 */
router.get(
  '/stats',
  tournamentController.getOverallTournamentStats
);

/**
 * @route   POST /api/tournaments
 * @desc    Create a new tournament
 * @access  Public
 */
router.post(
  '/',
  validate(createTournamentSchema),
  tournamentController.createTournament
);

/**
 * @route   GET /api/tournaments/:id
 * @desc    Get tournament by ID
 * @access  Public
 */
router.get(
  '/:id',
  validate(uuidSchema),
  tournamentController.getTournament
);

/**
 * @route   GET /api/tournaments/:id/live
 * @desc    Get tournament live view
 * @access  Public
 */
router.get(
  '/:id/live',
  validate(uuidSchema),
  tournamentController.getTournamentLiveView
);

/**
 * @route   PUT /api/tournaments/:id
 * @desc    Update tournament
 * @access  Public
 */
router.put(
  '/:id',
  validate(uuidSchema),
  validate(updateTournamentSchema),
  tournamentController.updateTournament
);

/**
 * @route   DELETE /api/tournaments/:id
 * @desc    Delete tournament
 * @access  Public
 */
router.delete(
  '/:id',
  validate(uuidSchema),
  tournamentController.deleteTournament
);

/**
 * @route   POST /api/tournaments/:id/logo
 * @desc    Upload tournament logo
 * @access  Public
 */
router.post(
  '/:id/logo',
  validate(uuidSchema),
  uploadTournamentLogo,
  tournamentController.uploadTournamentLogo
);

/**
 * @route   GET /api/tournaments/:id/stats
 * @desc    Get tournament statistics
 * @access  Public
 */
router.get(
  '/:id/stats',
  validate(uuidSchema),
  tournamentController.getTournamentStats
);

/**
 * @route   POST /api/tournaments/:id/register
 * @desc    Register player for tournament
 * @access  Public
 */
router.post(
  '/:id/register',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
    }),
    body: z.object({
      playerId: z.string().uuid('Invalid player ID'),
    }),
  }),
  tournamentController.registerPlayer
);

/**
 * @route   DELETE /api/tournaments/:id/register/:playerId
 * @desc    Unregister player from tournament
 * @access  Public
 */
router.delete(
  '/:id/register/:playerId',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
      playerId: z.string().uuid('Invalid player ID'),
    }),
  }),
  tournamentController.unregisterPlayer
);

/**
 * @route   GET /api/tournaments/:id/participants
 * @desc    Get tournament participants
 * @access  Public
 */
router.get(
  '/:id/participants',
  validate(uuidSchema),
  tournamentController.getTournamentParticipants
);

/**
 * @route   GET /api/tournaments/:id/players
 * @desc    Get tournament players
 * @access  Public
 */
router.get(
  '/:id/players',
  validate(uuidSchema),
  tournamentController.getTournamentPlayers
);

/**
 * @route   GET /api/tournaments/:id/pool-stages
 * @desc    Get pool stages
 * @access  Public
 */
router.get(
  '/:id/pool-stages',
  validate(uuidSchema),
  tournamentController.getPoolStages
);

/**
 * @route   POST /api/tournaments/:id/pool-stages
 * @desc    Create pool stage
 * @access  Public
 */
router.post(
  '/:id/pool-stages',
  validate({
    params: z.object({ id: z.string().uuid('Invalid tournament ID') }),
    body: z.object({
      stageNumber: z.number().int().min(1),
      name: z.string().min(1).max(100),
      poolCount: z.number().int().min(1).max(16),
      playersPerPool: z.number().int().min(2).max(16),
      advanceCount: z.number().int().min(1).max(16),
    }),
  }),
  tournamentController.createPoolStage
);

/**
 * @route   PATCH /api/tournaments/:id/pool-stages/:stageId
 * @desc    Update pool stage
 * @access  Public
 */
router.patch(
  '/:id/pool-stages/:stageId',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
      stageId: z.string().uuid('Invalid pool stage ID'),
    }),
    body: z.object({
      stageNumber: z.number().int().min(1).optional(),
      name: z.string().min(1).max(100).optional(),
      poolCount: z.number().int().min(1).max(16).optional(),
      playersPerPool: z.number().int().min(2).max(16).optional(),
      advanceCount: z.number().int().min(1).max(16).optional(),
      status: z.enum(['NOT_STARTED', 'EDITION', 'IN_PROGRESS', 'COMPLETED']).optional(),
    }),
  }),
  tournamentController.updatePoolStage
);

/**
 * @route   DELETE /api/tournaments/:id/pool-stages/:stageId
 * @desc    Delete pool stage
 * @access  Public
 */
router.delete(
  '/:id/pool-stages/:stageId',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
      stageId: z.string().uuid('Invalid pool stage ID'),
    }),
  }),
  tournamentController.deletePoolStage
);

/**
 * @route   GET /api/tournaments/:id/pool-stages/:stageId/pools
 * @desc    Get pools for a pool stage
 * @access  Public
 */
router.get(
  '/:id/pool-stages/:stageId/pools',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
      stageId: z.string().uuid('Invalid pool stage ID'),
    }),
  }),
  tournamentController.getPoolStagePools
);

/**
 * @route   PUT /api/tournaments/:id/pool-stages/:stageId/assignments
 * @desc    Update pool assignments for a pool stage
 * @access  Public
 */
router.put(
  '/:id/pool-stages/:stageId/assignments',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
      stageId: z.string().uuid('Invalid pool stage ID'),
    }),
    body: z.object({
      assignments: z.array(
        z.object({
          poolId: z.string().uuid('Invalid pool ID'),
          playerId: z.string().uuid('Invalid player ID'),
          assignmentType: z.enum(['SEEDED', 'RANDOM', 'BYE']),
          seedNumber: z.number().int().min(1).optional(),
        })
      ),
    }),
  }),
  tournamentController.updatePoolStageAssignments
);

/**
 * @route   GET /api/tournaments/:id/brackets
 * @desc    Get brackets
 * @access  Public
 */
router.get(
  '/:id/brackets',
  validate(uuidSchema),
  tournamentController.getBrackets
);

/**
 * @route   POST /api/tournaments/:id/brackets
 * @desc    Create bracket
 * @access  Public
 */
router.post(
  '/:id/brackets',
  validate({
    params: z.object({ id: z.string().uuid('Invalid tournament ID') }),
    body: z.object({
      name: z.string().min(1).max(100),
      bracketType: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION']),
      totalRounds: z.number().int().min(1).max(10),
    }),
  }),
  tournamentController.createBracket
);

/**
 * @route   PATCH /api/tournaments/:id/brackets/:bracketId
 * @desc    Update bracket
 * @access  Public
 */
router.patch(
  '/:id/brackets/:bracketId',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
      bracketId: z.string().uuid('Invalid bracket ID'),
    }),
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      bracketType: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION']).optional(),
      totalRounds: z.number().int().min(1).max(10).optional(),
      status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
    }),
  }),
  tournamentController.updateBracket
);

/**
 * @route   DELETE /api/tournaments/:id/brackets/:bracketId
 * @desc    Delete bracket
 * @access  Public
 */
router.delete(
  '/:id/brackets/:bracketId',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
      bracketId: z.string().uuid('Invalid bracket ID'),
    }),
  }),
  tournamentController.deleteBracket
);

/**
 * @route   POST /api/tournaments/:id/players
 * @desc    Register player with details
 * @access  Public
 */
router.post(
  '/:id/players',
  validate(createPlayerSchema),
  tournamentController.registerPlayerDetails
);

/**
 * @route   PATCH /api/tournaments/:id/players/:playerId
 * @desc    Update player details
 * @access  Public
 */
router.patch(
  '/:id/players/:playerId',
  validate(updatePlayerSchema),
  tournamentController.updateTournamentPlayer
);

/**
 * @route   PATCH /api/tournaments/:id/players/:playerId/check-in
 * @desc    Update player check-in status
 * @access  Public
 */
router.patch(
  '/:id/players/:playerId/check-in',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
      playerId: z.string().uuid('Invalid player ID'),
    }),
    body: z.object({
      checkedIn: z.boolean({ required_error: 'checkedIn is required' }),
    }),
  }),
  tournamentController.updateTournamentPlayerCheckIn
);

/**
 * @route   DELETE /api/tournaments/:id/players/:playerId
 * @desc    Remove player from tournament
 * @access  Public
 */
router.delete(
  '/:id/players/:playerId',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
      playerId: z.string().uuid('Invalid player ID'),
    }),
  }),
  tournamentController.deleteTournamentPlayer
);

/**
 * @route   GET /api/tournaments/:id/registration-validation/:playerId
 * @desc    Validate registration constraints for player
 * @access  Public
 */
router.get(
  '/:id/registration-validation/:playerId',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
      playerId: z.string().uuid('Invalid player ID'),
    }),
  }),
  tournamentController.validateRegistration
);

/**
 * @route   PATCH /api/tournaments/:id/status
 * @desc    Update tournament status
 * @access  Public
 */
router.patch(
  '/:id/status',
  validate({
    params: z.object({
      id: z.string().uuid('Invalid tournament ID'),
    }),
    body: z.object({
      status: z.enum(['DRAFT', 'OPEN', 'SIGNATURE', 'LIVE', 'FINISHED']),
      force: z.boolean().optional(),
    }),
  }),
  tournamentController.updateTournamentStatus
);

/**
 * @route   POST /api/tournaments/:id/open-registration
 * @desc    Open tournament registration
 * @access  Public
 */
router.post(
  '/:id/open-registration',
  validate(uuidSchema),
  tournamentController.openTournamentRegistration
);

/**
 * @route   POST /api/tournaments/:id/start
 * @desc    Start tournament
 * @access  Public
 */
router.post(
  '/:id/start',
  validate(uuidSchema),
  tournamentController.startTournament
);

/**
 * @route   POST /api/tournaments/:id/complete
 * @desc    Complete tournament
 * @access  Public
 */
router.post(
  '/:id/complete',
  validate(uuidSchema),
  tournamentController.completeTournament
);

export default router;