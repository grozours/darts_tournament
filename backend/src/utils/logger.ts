import winston from 'winston';
import path from 'node:path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for different log levels
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

const toLogString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
};

// Define the custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const correlationId = toLogString(info.correlationId);
    const message = toLogString(info.message) ?? '';
    return correlationId
      ? `${info.timestamp} [${info.level}] [${correlationId}]: ${message}`
      : `${info.timestamp} [${info.level}]: ${message}`;
  })
);

// Define log file format (without colors for file output)
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.json(),
  winston.format.printf((info) => {
    const logObject: Record<string, unknown> = {
      timestamp: info.timestamp,
      level: info.level,
      message: toLogString(info.message) ?? '',
    };
    
    const correlationId = toLogString(info.correlationId);
    if (correlationId) logObject.correlationId = correlationId;
    if (info.userId) logObject.userId = info.userId;
    if (info.tournamentId) logObject.tournamentId = info.tournamentId;
    if (info.playerId) logObject.playerId = info.playerId;
    if (info.metadata) logObject.metadata = info.metadata;
    
    return JSON.stringify(logObject);
  })
);

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');

const isTestEnv = process.env.NODE_ENV === 'test';

const consoleTransport = new winston.transports.Console({
  format: logFormat,
});

const fileTransports = isTestEnv
  ? []
  : [
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: fileLogFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: fileLogFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'tournaments.log'),
        format: fileLogFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 3,
      }),
    ];

const transports = [consoleTransport, ...fileTransports];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: isTestEnv
    ? []
    : [
        new winston.transports.File({
          filename: path.join(logsDir, 'exceptions.log'),
          format: fileLogFormat,
        }),
      ],
  rejectionHandlers: isTestEnv
    ? []
    : [
        new winston.transports.File({
          filename: path.join(logsDir, 'rejections.log'),
          format: fileLogFormat,
        }),
      ],
});

// Create a stream object with a 'write' function for Morgan HTTP logging
const stream = {
  write: (message: string) => {
    // Remove trailing newline
    logger.http(message.trim());
  },
};

export { logger, stream };
export default logger;