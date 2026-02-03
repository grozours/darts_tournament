// Server entry point for Darts Tournament Manager
import App from './app';
import { config } from './config/environment';

// Handle uncaught exceptions per constitution error handling
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
const app = new App();

app.start().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});

// Export for testing
export default app;