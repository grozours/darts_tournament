import { Server as SocketServer } from 'socket.io';
import { config } from '../config/environment';
import logger from '../utils/logger';
import { handleSocketConnection } from './socket-connection-handler';
import { WebSocketService } from './websocket-service';
export type { WebSocketEvents } from './websocket-types';
export { WebSocketService } from './websocket-service';
export { default } from './websocket-service';

// WebSocket server setup per constitution real-time requirements
export const setupWebSocketServer = (io: SocketServer): void => {
  webSocketService = new WebSocketService(io);
  io.on('connection', handleSocketConnection);

  // Performance monitoring per constitution
  const monitorConnections = (): void => {
    const connectionCount = io.sockets.sockets.size;
    
    if (config.performance.enableMetrics) {
      logger.debug('WebSocket connection count', {
        metadata: { connectionCount },
      });
    }
    
    // Performance warning if too many connections
    if (connectionCount > 1000) {
      logger.warn('High WebSocket connection count', {
        metadata: { connectionCount },
      });
    }
  };

  // Monitor every 30 seconds
  const monitorInterval = setInterval(monitorConnections, 30_000);
  monitorInterval.unref?.();

  logger.info('WebSocket server initialized', {
    metadata: { realtimeSupport: true },
  });
};

let webSocketService: WebSocketService | undefined;

export const getWebSocketService = () => webSocketService;