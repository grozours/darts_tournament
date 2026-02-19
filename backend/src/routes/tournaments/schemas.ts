import { z } from 'zod';
import {
  DurationType,
  SkillLevel,
  TournamentFormat,
  TournamentStatus,
} from '../../../../shared/src/types';

export const minutesToMs = 60_000;

export const createTournamentSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Tournament name is required' })
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
    doubleStageEnabled: z.boolean().optional(),
  }),
};

export const uuidSchema = {
  params: z.object({
    id: z.string().uuid('Invalid UUID format'),
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
    phone: z
      .string()
      .min(5, 'Phone number must be at least 5 characters long')
      .max(20, 'Phone number cannot exceed 20 characters')
      .optional(),
    skillLevel: z.nativeEnum(SkillLevel).optional(),
  }),
};

export const updatePlayerSchema = {
  params: z.object({
    id: z.string().uuid('Invalid tournament ID'),
    playerId: z.string().uuid('Invalid player ID'),
  }),
  body: z.object({
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
    phone: z
      .string()
      .min(5, 'Phone number must be at least 5 characters long')
      .max(20, 'Phone number cannot exceed 20 characters')
      .optional(),
    skillLevel: z.nativeEnum(SkillLevel).optional(),
  }),
};
