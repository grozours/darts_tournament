import { Pool } from 'pg';
import { config } from './environment';
import logger from '../utils/logger';

class DatabaseConfig {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: config.database.healthCheckMaxConnections,
      idleTimeoutMillis: config.database.idleTimeout,
      connectionTimeoutMillis: config.database.connectionTimeout,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    });

    // Handle connection errors
    this.pool.on('error', (error) => {
      logger.error('Unexpected database error on idle client', {
        metadata: {
          errorMessage: error.message,
        },
      });
    });
  }

  public async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      logger.info('Database connected successfully');
      client.release();
    } catch (error) {
      logger.error('Database connection failed', {
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await this.pool.end();
    logger.info('Database disconnected');
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT 1');
      client.release();
      return result.rowCount === 1;
    } catch (error) {
      logger.debug('Database health check failed', {
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      return false;
    }
  }
}

export const database = new DatabaseConfig();