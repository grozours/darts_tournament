import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  app: {
    name: string;
    version: string;
    port: number;
    env: string;
  };
  port: number;
  env: string;
  isDevelopment: boolean;
  database: {
    url: string;
    maxConnections: number;
    idleTimeout: number;
    connectionTimeout: number;
    ssl: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  cors: {
    origins: string[];
    credentials: boolean;
  };
  upload: {
    maxSize: number;
    maxFileSize: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    uploadDir: string;
    directory: string;
  };
  logging: {
    level: string;
    format: string;
  };
  performance: {
    maxResponseTime: number;
    enableMetrics: boolean;
  };
  auth: {
    issuerBaseURL: string;
    audience: string;
  };
}

const config: Config = {
  app: {
    name: process.env.APP_NAME || 'Darts Tournament Manager',
    version: process.env.APP_VERSION || '1.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://darts_user:darts_password@localhost:5432/darts_tournament',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
    ssl: process.env.DB_SSL === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  },
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
    credentials: true,
  },
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10),
    maxFileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10),
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    directory: process.env.UPLOAD_DIR || './uploads',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
  performance: {
    maxResponseTime: parseInt(process.env.MAX_RESPONSE_TIME || '2000', 10),
    enableMetrics: process.env.ENABLE_METRICS === 'true',
  },
  auth: {
    issuerBaseURL: process.env.AUTH_ISSUER_BASE_URL || '',
    audience: process.env.AUTH_AUDIENCE || '',
  },
};

// Validation
if (!config.database.url) {
  throw new Error('DATABASE_URL environment variable is required');
}

if (!config.auth.issuerBaseURL || !config.auth.audience) {
  throw new Error('AUTH_ISSUER_BASE_URL and AUTH_AUDIENCE environment variables are required');
}

export { config };