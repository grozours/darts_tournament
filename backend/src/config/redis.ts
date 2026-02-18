import Redis from 'ioredis';
import { config } from './environment';

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
      console.log('Redis client connected');
    });

    this.client.on('error', (error) => {
      console.error('Redis client error:', error);
    });

    this.publisher.on('error', (error) => {
      console.error('Redis publisher error:', error);
    });

    this.subscriber.on('error', (error) => {
      console.error('Redis subscriber error:', error);
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      await this.publisher.connect();
      await this.subscriber.connect();
      console.log('Redis connected successfully');
    } catch (error) {
      console.error('Redis connection failed:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    this.client.disconnect();
    this.publisher.disconnect();
    this.subscriber.disconnect();
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