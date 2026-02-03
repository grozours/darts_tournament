import { Pool } from 'pg';
import { config } from './environment';

class DatabaseConfig {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: config.database.maxConnections,
      idleTimeoutMillis: config.database.idleTimeout,
      connectionTimeoutMillis: config.database.connectionTimeout,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    });

    // Handle connection errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  public async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      console.log('Database connected successfully');
      client.release();
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await this.pool.end();
    console.log('Database disconnected');
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
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

export const database = new DatabaseConfig();