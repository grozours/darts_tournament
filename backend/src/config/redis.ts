import Redis from 'ioredis';
import { config } from './environment';

class RedisConfig {
  private client: Redis;
  private publisher: Redis;
  private subscriber: Redis;

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
      console.log('Redis client connected');
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    this.publisher.on('error', (err) => {
      console.error('Redis publisher error:', err);
    });

    this.subscriber.on('error', (err) => {
      console.error('Redis subscriber error:', err);
    });
  }

  public async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.publisher.connect(),
        this.subscriber.connect(),
      ]);
      console.log('Redis connected successfully');
    } catch (error) {
      console.error('Redis connection failed:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await Promise.all([
      this.client.disconnect(),
      this.publisher.disconnect(),
      this.subscriber.disconnect(),
    ]);
    console.log('Redis disconnected');
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
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

export const redis = new RedisConfig();