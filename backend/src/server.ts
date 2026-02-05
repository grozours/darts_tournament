// Server entry point for Darts Tournament Manager
import App from './app';

// Handle uncaught exceptions per constitution error handling
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
const app = new App();

const startServer = async () => {
  try {
    await app.start();
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
};

void startServer();

// Export for testing
export default app;