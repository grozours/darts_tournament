// Server entry point for Darts Tournament Manager
import App from './app';
import logger from './utils/logger';

// Handle uncaught exceptions per constitution error handling
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', {
    metadata: {
      errorMessage: error.message,
      stack: error.stack,
    },
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled promise rejection', {
    metadata: {
      reason: reason instanceof Error ? reason.message : String(reason),
      promiseType: Object.prototype.toString.call(promise),
    },
  });
  process.exit(1);
});

// Start the application
const app = new App();

const startServer = async () => {
  try {
    await app.start();
  } catch (error) {
    logger.error('Failed to start application', {
      metadata: {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    process.exit(1);
  }
};

void startServer();

// Export for testing
export default app;