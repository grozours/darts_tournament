import Redis from 'ioredis';
import { config } from './environment';
import logger from '../utils/logger';

class RedisConfig {
  private readonly client: Redis;
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor() {
    const redisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      ...(config.redis.password && { password: config.redis.password }),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    this.client = new Redis(redisOptions);
    this.publisher = new Redis(redisOptions);
    this.subscriber = new Redis(redisOptions);

    // Handle connection events
    this.client.on('connect', () => {
      logger.debug('Redis client connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', {
        metadata: {
          errorMessage: error.message,
        },
      });
    });

    this.publisher.on('error', (error) => {
      logger.error('Redis publisher error', {
        metadata: {
          errorMessage: error.message,
        },
      });
    });

    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber error', {
        metadata: {
          errorMessage: error.message,
        },
      });
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      await this.publisher.connect();
      await this.subscriber.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Redis connection failed', {
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    this.client.disconnect();
    this.publisher.disconnect();
    this.subscriber.disconnect();
    logger.info('Redis disconnected');
  }

  public getClient(): Redis {
    return this.client;
  }

  public getPublisher(): Redis {
    return this.publisher;
  }

  public getSubscriber(): Redis {
    return this.subscriber;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.debug('Redis health check failed', {
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      return false;
    }
  }
}

export const redis = new RedisConfig();