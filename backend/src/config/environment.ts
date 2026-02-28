import dotenv from 'dotenv';
import logger from '../utils/logger';

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
    prismaUrl: string;
    maxConnections: number;
    poolTimeout: number;
    idleTimeout: number;
    connectionTimeout: number;
    healthCheckMaxConnections: number;
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
    liveEndpointCacheTtlSeconds: number;
    rateLimitEnabled: boolean;
  };
  auth: {
    issuerBaseURL: string;
    audience: string;
    enabled: boolean;
    adminEmails: string[];
    devAutoLoginEnabled: boolean;
    devAutoLoginMode?: 'anonymous' | 'player' | 'admin';
    devAutoLoginAdminEmail?: string;
    devAutoLoginPlayerEmail?: string;
  };
}

const normalizeDevelopmentAutoLoginMode = (value: string | undefined): 'anonymous' | 'player' | 'admin' | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'anonymous' || normalized === 'player' || normalized === 'admin') {
    return normalized;
  }
  return undefined;
};

const developmentAutoLoginMode = normalizeDevelopmentAutoLoginMode(process.env.AUTH_DEV_AUTOLOGIN_MODE);

const parseLiveEndpointCacheTtlSeconds = (value: string | undefined): number => {
  const parsed = Number.parseInt(value || '3', 10);
  if (!Number.isFinite(parsed)) {
    return 3;
  }
  return Math.min(5, Math.max(2, parsed));
};

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const buildPrismaDatasourceUrl = (
  rawDatabaseUrl: string,
  maxConnections: number,
  poolTimeoutMs: number
): string => {
  try {
    const parsedUrl = new URL(rawDatabaseUrl);
    if (!parsedUrl.searchParams.has('connection_limit')) {
      parsedUrl.searchParams.set('connection_limit', String(maxConnections));
    }

    if (!parsedUrl.searchParams.has('pool_timeout')) {
      const poolTimeoutSeconds = Math.max(1, Math.ceil(poolTimeoutMs / 1000));
      parsedUrl.searchParams.set('pool_timeout', String(poolTimeoutSeconds));
    }

    if (!parsedUrl.searchParams.has('connect_timeout')) {
      const connectTimeoutSeconds = Math.max(1, Math.ceil(poolTimeoutMs / 1000));
      parsedUrl.searchParams.set('connect_timeout', String(connectTimeoutSeconds));
    }

    return parsedUrl.toString();
  } catch {
    return rawDatabaseUrl;
  }
};

const databaseUrl = process.env.DATABASE_URL || '';
const databaseMaxConnections = toPositiveInt(process.env.DB_MAX_CONNECTIONS, 20);
const databasePoolTimeout = toPositiveInt(process.env.DB_POOL_TIMEOUT, 10 * 1000);
const databaseIdleTimeout = toPositiveInt(process.env.DB_IDLE_TIMEOUT, 30 * 1000);
const databaseConnectionTimeout = toPositiveInt(process.env.DB_CONNECTION_TIMEOUT, 2 * 1000);
const databaseHealthCheckMaxConnections = toPositiveInt(process.env.DB_HEALTH_MAX_CONNECTIONS, 1);

const config: Config = {
  app: {
    name: process.env.APP_NAME || 'Darts Tournament Manager',
    version: process.env.APP_VERSION || '1.0.0',
    port: Number.parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  port: Number.parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  database: {
    url: databaseUrl,
    prismaUrl: buildPrismaDatasourceUrl(databaseUrl, databaseMaxConnections, databasePoolTimeout),
    maxConnections: databaseMaxConnections,
    poolTimeout: databasePoolTimeout,
    idleTimeout: databaseIdleTimeout,
    connectionTimeout: databaseConnectionTimeout,
    healthCheckMaxConnections: databaseHealthCheckMaxConnections,
    ssl: process.env.DB_SSL === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  },
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
    credentials: true,
  },
  upload: {
    maxSize: Number.parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10),
    maxFileSize: Number.parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10),
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
    maxResponseTime: Number.parseInt(process.env.MAX_RESPONSE_TIME || '2000', 10),
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    liveEndpointCacheTtlSeconds: parseLiveEndpointCacheTtlSeconds(process.env.LIVE_ENDPOINT_CACHE_TTL_SECONDS),
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  },
  auth: {
    issuerBaseURL: process.env.AUTH_ISSUER_BASE_URL || '',
    audience: process.env.AUTH_AUDIENCE || '',
    enabled:
      process.env.AUTH_ENABLED === 'true' &&
      Boolean(process.env.AUTH_ISSUER_BASE_URL && process.env.AUTH_AUDIENCE),
    adminEmails: process.env.AUTH_ADMIN_EMAILS
      ? process.env.AUTH_ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase())
      : [],
    devAutoLoginEnabled: process.env.AUTH_DEV_AUTOLOGIN_ENABLED === 'true',
    ...(developmentAutoLoginMode
      ? {
          devAutoLoginMode: developmentAutoLoginMode,
        }
      : {}),
    ...(process.env.AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL?.trim()
      ? {
          devAutoLoginAdminEmail:
            process.env.AUTH_DEV_AUTOLOGIN_ADMIN_EMAIL.trim().toLowerCase(),
        }
      : {}),
    ...(process.env.AUTH_DEV_AUTOLOGIN_PLAYER_EMAIL?.trim()
      ? {
          devAutoLoginPlayerEmail:
            process.env.AUTH_DEV_AUTOLOGIN_PLAYER_EMAIL.trim().toLowerCase(),
        }
      : {}),
  },
};

// Validation
if (!config.database.url) {
  throw new Error('DATABASE_URL environment variable is required');
}

if (config.auth.enabled === false) {
  // OAuth is optional in development; protect routes only when configured.
  logger.warn('Auth0 is not configured. API routes are public.', {
    metadata: {
      authEnabled: config.auth.enabled,
      env: config.env,
    },
  });
}

export { config };