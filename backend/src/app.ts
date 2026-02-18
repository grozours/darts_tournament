import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import morgan from 'morgan';
import { config } from './config/environment';
import { database } from './config/database';
import { redis } from './config/redis';
import { errorHandler } from './middleware/error-handler';
import { securityMiddleware } from './middleware/security';
import { validationMiddleware } from './middleware/validation';
import { correlationIdMiddleware } from './middleware/correlation-id';
import { optionalAuth } from './middleware/auth';
import { setupWebSocketServer } from './websocket/server';
import logger, { stream } from './utils/logger';
import tournamentRoutes from './routes/tournaments';
import authRoutes from './routes/auth';
class App {
  public app: Express;
  public server: HttpServer;
  public io: SocketServer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: {
        origin: config.cors.origins,
        credentials: true,
      },
    });

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.setupWebSocket();
  }

  private initializeMiddleware(): void {
    // Correlation ID middleware - must be first to ensure all logs have correlation IDs
    this.app.use(correlationIdMiddleware);

    // HTTP request logging with Morgan
    this.app.use(
      morgan(
        ':method :url :status :res[content-length] - :response-time ms',
        { stream }
      )
    );

    // Security middleware per constitution
    this.app.use(helmet());
    this.app.use(securityMiddleware);

    // CORS configuration
    this.app.use(
      cors({
        origin: config.cors.origins,
        credentials: true,
        optionsSuccessStatus: 200,
      })
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Serve static files (uploads)
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

    // Request validation middleware
    this.app.use(validationMiddleware);

    // Performance monitoring per constitution
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > config.performance.maxResponseTime) {
          logger.warn(
            `Slow response: ${req.method} ${req.path} took ${duration}ms (target: ${config.performance.maxResponseTime}ms)`,
            {
              correlationId: req.correlationId,
              method: req.method,
              path: req.path,
              duration,
              target: config.performance.maxResponseTime,
              metadata: {
                responseTime: duration,
                slowRequest: true,
              }
            }
          );
        }

        if (res.statusCode >= 500) {
          logger.error('Response finished with server error', {
            correlationId: req.correlationId,
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
            },
          });
        }
      });
      
      next();
    });
  }

  private initializeRoutes(): void {
    const authMiddleware = config.auth.enabled
      ? optionalAuth
      : (req: Request, res: Response, next: NextFunction) => next();

    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      const dbHealth = await database.healthCheck();
      const redisHealth = await redis.healthCheck();

      const health = {
        status: dbHealth && redisHealth ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth ? 'healthy' : 'unhealthy',
          redis: redisHealth ? 'healthy' : 'unhealthy',
        },
        version: config.app.version,
      };

      res.status(dbHealth && redisHealth ? 200 : 503).json(health);
    });

    // API routes will be added here
    this.app.use('/api/tournaments', authMiddleware, tournamentRoutes);
    this.app.use('/api/auth', authMiddleware, authRoutes);
    
    this.app.get('/api', authMiddleware, (req: Request, res: Response) => {
      res.json({
        name: config.app.name,
        version: config.app.version,
        environment: config.env,
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  private setupWebSocket(): void {
    setupWebSocketServer(this.io);
  }

  public async start(): Promise<void> {
    try {
      // Connect to databases
      await database.connect();
      await redis.connect();

      // Start server
      this.server.listen(config.port, () => {
        console.log(`🚀 ${config.app.name} v${config.app.version}`);
        console.log(`📡 Server running on port ${config.port} in ${config.env} mode`);
        console.log(`🏥 Health check available at http://localhost:${config.port}/health`);
        console.log(`🔗 API available at http://localhost:${config.port}/api`);
        if (config.isDevelopment) {
          console.log(`📝 Database: ${config.database.url.split('@')[1]}`);
          console.log(`📦 Redis: ${config.redis.host}:${config.redis.port}`);
        }
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(signal: string): Promise<void> {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    try {
      // Close server
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          console.log('📡 HTTP server closed');
          resolve();
        });
      });

      // Close database connections
      await database.disconnect();
      await redis.disconnect();

      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

export default App;