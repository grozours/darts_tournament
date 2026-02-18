import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { AppError } from './error-handler';

// Request validation middleware per constitution requirements
export const validationMiddleware = (
  request: Request,
  _response: Response,
  next: NextFunction
): void => {
  // Basic request validation
  if (
    (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH')
    && request.is('application/json')
    && !request.body
  ) {
    throw new AppError('Request body is required', 400, 'MISSING_BODY');
  }

  next();
};

// Validation helper function
const buildValidationError = (error: ZodError): AppError => {
  const formattedError = new AppError(
    error.errors && error.errors.length > 0 && error.errors[0]
      ? error.errors[0].message
      : 'Validation failed',
    400,
    'VALIDATION_ERROR'
  );
  const details = error.errors.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    value: 'received' in issue ? (issue as { received?: unknown }).received : undefined,
  }));
  (formattedError as AppError & { details?: unknown }).details = details;
  return formattedError;
};

export const validate = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  const parseRequest = (request: Request): void => {
    if (schema.body && request.body) {
      request.body = schema.body.parse(request.body);
    }

    if (schema.query && request.query) {
      request.query = schema.query.parse(request.query);
    }

    if (schema.params && request.params) {
      request.params = schema.params.parse(request.params);
    }
  };

  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      parseRequest(request);

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(buildValidationError(error));
      } else {
        next(error);
      }
    }
  };
};

// Common validation schemas per data model
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),
  
  // Tournament validation
  tournamentId: z.string().uuid('Invalid tournament ID'),
  
  // Player validation
  playerId: z.string().uuid('Invalid player ID'),
  
  // Pagination
  pagination: z.object({
    page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }),

  // File upload validation
  file: z.object({
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z.enum(['image/jpeg', 'image/png'], {
      errorMap: () => ({ message: 'Only JPEG and PNG files are allowed' }),
    }),
    size: z.number().max(5_242_880, 'File size must be less than 5MB'),
    buffer: z.instanceof(Buffer),
  }),

  // Tournament creation validation
  createTournament: z.object({
    name: z.string().min(3, 'Name must be at least 3 characters').max(100, 'Name must be less than 100 characters'),
    format: z.enum(['SINGLE', 'DOUBLE', 'TEAM_4_PLAYER'], {
      errorMap: () => ({ message: 'Format must be SINGLE, DOUBLE, or TEAM_4_PLAYER' }),
    }),
    durationType: z.enum(['HALF_DAY_MORNING', 'HALF_DAY_AFTERNOON', 'HALF_DAY_NIGHT', 'FULL_DAY', 'TWO_DAY'], {
      errorMap: () => ({ message: 'Invalid duration type' }),
    }),
    startTime: z.string().pipe(z.coerce.date()),
    endTime: z.string().pipe(z.coerce.date()),
    totalParticipants: z.number().int().min(2, 'Must have at least 2 participants').max(128, 'Maximum 128 participants'),
    targetCount: z.number().int().min(1, 'Must have at least 1 target').max(32, 'Maximum 32 targets'),
  }).refine(data => data.endTime > data.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  }),

  // Player registration validation
  createPlayer: z.object({
    firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
    surname: z.string().max(50, 'Surname must be less than 50 characters').optional(),
    teamName: z.string().max(100, 'Team name must be less than 100 characters').optional(),
    email: z.string().email('Invalid email address').max(255).optional(),
    phone: z.string().max(20, 'Phone number must be less than 20 characters').optional(),
    skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  }),

  // Match score validation
  matchScore: z.object({
    playerId: z.string().uuid('Invalid player ID'),
    setNumber: z.number().int().positive('Set number must be positive'),
    legNumber: z.number().int().positive('Leg number must be positive'),
    dartThrow: z.number().int().min(1).max(3, 'Dart throw must be between 1 and 3'),
    score: z.number().int().min(0).max(180, 'Score must be between 0 and 180'),
    remaining: z.number().int().min(0, 'Remaining score cannot be negative'),
    isFinish: z.boolean().default(false),
  }),

  // Tournament status updates
  updateTournamentStatus: z.object({
    status: z.enum(['DRAFT', 'OPEN', 'SIGNATURE', 'LIVE', 'FINISHED'], {
      errorMap: () => ({ message: 'Invalid tournament status' }),
    }),
  }),
};

// Middleware for specific validations
export const validateTournamentCreation = validate({
  body: commonSchemas.createTournament,
});

export const validatePlayerCreation = validate({
  body: commonSchemas.createPlayer,
});

export const validateUuidParameter = (parameterName: string = 'id') => validate({
  params: z.object({
    [parameterName]: commonSchemas.uuid,
  }),
});

export const validatePagination = validate({
  query: commonSchemas.pagination,
});

export const validateMatchScore = validate({
  body: commonSchemas.matchScore,
});