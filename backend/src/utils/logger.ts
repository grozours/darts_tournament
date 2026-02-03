import winston from 'winston';
import path from 'path';

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

// Define the custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    if (info.correlationId) {
      return `${info.timestamp} [${info.level}] [${info.correlationId}]: ${info.message}`;
    }
    return `${info.timestamp} [${info.level}]: ${info.message}`;
  })
);

// Define log file format (without colors for file output)
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.json(),
  winston.format.printf((info) => {
    const logObject: Record<string, any> = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
    };
    
    if (info.correlationId) logObject.correlationId = info.correlationId;
    if (info.userId) logObject.userId = info.userId;
    if (info.tournamentId) logObject.tournamentId = info.tournamentId;
    if (info.playerId) logObject.playerId = info.playerId;
    if (info.metadata) logObject.metadata = info.metadata;
    
    return JSON.stringify(logObject);
  })
);

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');

// Define which transports to use based on environment
const transports = [];

// Console transport for all environments
transports.push(
  new winston.transports.Console({
    format: logFormat,
  })
);

// File transports for non-test environments
if (process.env.NODE_ENV !== 'test') {
  // Error logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileLogFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileLogFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Tournament-specific logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'tournaments.log'),
      format: fileLogFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: process.env.NODE_ENV !== 'test' ? [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileLogFormat,
    })
  ] : [],
  rejectionHandlers: process.env.NODE_ENV !== 'test' ? [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileLogFormat,
    })
  ] : [],
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