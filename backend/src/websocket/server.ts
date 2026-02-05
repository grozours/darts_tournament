import { Server as SocketServer, Socket } from 'socket.io';
import { redis } from '../config/redis';
import { config } from '../config/environment';

type PlayerSummary = {
  id?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
};

type ScorePayload = Record<string, unknown>;
type PoolAssignmentPayload = Record<string, unknown>;
type SchedulePayload = Record<string, unknown>;

// WebSocket events per constitution real-time requirements
export interface WebSocketEvents {
  // Tournament events
  'tournament:updated': (data: { tournamentId: string; status: string }) => void;
  'tournament:player-registered': (data: { tournamentId: string; player: PlayerSummary }) => void;
  
  // Match events
  'match:started': (data: { matchId: string; tournamentId: string }) => void;
  'match:score-updated': (data: { matchId: string; tournamentId: string; score: ScorePayload }) => void;
  'match:completed': (data: { matchId: string; tournamentId: string; winner: PlayerSummary }) => void;
  
  // Target events
  'target:available': (data: { targetId: string; tournamentId: string }) => void;
  'target:in-use': (data: { targetId: string; matchId: string; tournamentId: string }) => void;
  
  // Pool events
  'pool:assigned': (data: { tournamentId: string; poolAssignments: PoolAssignmentPayload[] }) => void;
  
  // Schedule events
  'schedule:generated': (data: { tournamentId: string; schedule: SchedulePayload }) => void;
  'schedule:updated': (data: { tournamentId: string; changes: SchedulePayload }) => void;
  
  // Error events
  'error': (data: { message: string; code?: string }) => void;
  
  // Connection events
  'connect': () => void;
  'disconnect': (reason: string) => void;
}

// WebSocket server setup per constitution real-time requirements
export const setupWebSocketServer = (io: SocketServer): void => {
  // Connection handling
  io.on('connection', (socket: Socket) => {
    console.log(`🔗 WebSocket client connected: ${socket.id}`);

    // Join tournament room
    socket.on('join-tournament', async (tournamentId: string) => {
      if (!tournamentId || typeof tournamentId !== 'string') {
        socket.emit('error', { message: 'Invalid tournament ID', code: 'INVALID_TOURNAMENT_ID' });
        return;
      }

      try {
        await socket.join(`tournament-${tournamentId}`);
        console.log(`👤 Client ${socket.id} joined tournament ${tournamentId}`);
        
        // Store in Redis for tracking
        await redis.getClient().sadd(`tournament:${tournamentId}:clients`, socket.id);
        
        socket.emit('joined-tournament', { tournamentId, clientId: socket.id });
      } catch (error) {
        console.error('Error joining tournament room:', error);
        socket.emit('error', { message: 'Failed to join tournament', code: 'JOIN_FAILED' });
      }
    });

    // Leave tournament room
    socket.on('leave-tournament', async (tournamentId: string) => {
      if (!tournamentId || typeof tournamentId !== 'string') {
        return;
      }

      try {
        await socket.leave(`tournament-${tournamentId}`);
        console.log(`👋 Client ${socket.id} left tournament ${tournamentId}`);
        
        // Remove from Redis tracking
        await redis.getClient().srem(`tournament:${tournamentId}:clients`, socket.id);
        
        socket.emit('left-tournament', { tournamentId, clientId: socket.id });
      } catch (error) {
        console.error('Error leaving tournament room:', error);
      }
    });

    // Heartbeat for connection monitoring
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', async (reason: string) => {
      console.log(`❌ WebSocket client disconnected: ${socket.id} (${reason})`);
      
      try {
        // Clean up Redis tracking for all tournaments
        const keys = await redis.getClient().keys('tournament:*:clients');
        for (const key of keys) {
          await redis.getClient().srem(key, socket.id);
        }
      } catch (error) {
        console.error('Error cleaning up client tracking:', error);
      }
    });

    // Error handling
    socket.on('error', (error: Error) => {
      console.error(`❌ WebSocket error for client ${socket.id}:`, error);
    });
  });

  // Performance monitoring per constitution
  const monitorConnections = (): void => {
    const connectionCount = io.sockets.sockets.size;
    
    if (config.performance.enableMetrics) {
      console.log(`📊 WebSocket connections: ${connectionCount}`);
    }
    
    // Performance warning if too many connections
    if (connectionCount > 1000) {
      console.warn(`⚠️  High WebSocket connection count: ${connectionCount}`);
    }
  };

  // Monitor every 30 seconds
  const monitorInterval = setInterval(monitorConnections, 30000);
  monitorInterval.unref?.();

  console.log('🚀 WebSocket server initialized with real-time tournament support');
};

// WebSocket event emitters for use in services
export class WebSocketService {
  private readonly io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
  }

  // Tournament events
  async emitTournamentUpdated(tournamentId: string, status: string): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('tournament:updated', { tournamentId, status });
      
      // Cache the event in Redis for reliability
      await redis.getClient().setex(
        `event:tournament:${tournamentId}:updated`,
        300, // 5 minutes TTL
        JSON.stringify({ tournamentId, status, timestamp: Date.now() })
      );
      
      console.log(`📡 Tournament updated event sent: ${tournamentId} -> ${status}`);
    } catch (error) {
      console.error('Error emitting tournament updated event:', error);
    }
  }

  async emitPlayerRegistered(tournamentId: string, player: PlayerSummary): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('tournament:player-registered', { 
        tournamentId, 
        player 
      });
      
      console.log(`📡 Player registered event sent: ${tournamentId} -> ${player.firstName} ${player.lastName}`);
    } catch (error) {
      console.error('Error emitting player registered event:', error);
    }
  }

  // Match events per <2s constitution requirement
  async emitMatchScoreUpdated(matchId: string, tournamentId: string, score: ScorePayload): Promise<void> {
    try {
      const startTime = Date.now();
      
      this.io.to(`tournament-${tournamentId}`).emit('match:score-updated', { 
        matchId, 
        tournamentId, 
        score 
      });
      
      const duration = Date.now() - startTime;
      if (duration > 100) { // Warning if over 100ms for real-time updates
        console.warn(`⚠️  Slow WebSocket emission: ${duration}ms`);
      }
      
      console.log(`📡 Match score updated: ${matchId} (${duration}ms)`);
    } catch (error) {
      console.error('Error emitting match score update:', error);
    }
  }

  async emitMatchCompleted(matchId: string, tournamentId: string, winner: PlayerSummary): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('match:completed', { 
        matchId, 
        tournamentId, 
        winner 
      });
      
      console.log(`📡 Match completed event sent: ${matchId} -> winner: ${winner?.firstName}`);
    } catch (error) {
      console.error('Error emitting match completed event:', error);
    }
  }

  // Target events
  async emitTargetAvailable(targetId: string, tournamentId: string): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('target:available', { 
        targetId, 
        tournamentId 
      });
      
      console.log(`📡 Target available event sent: ${targetId}`);
    } catch (error) {
      console.error('Error emitting target available event:', error);
    }
  }

  // Pool assignment events
  async emitPoolAssigned(tournamentId: string, poolAssignments: PoolAssignmentPayload[]): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('pool:assigned', { 
        tournamentId, 
        poolAssignments 
      });
      
      console.log(`📡 Pool assigned event sent: ${tournamentId} (${poolAssignments.length} assignments)`);
    } catch (error) {
      console.error('Error emitting pool assigned event:', error);
    }
  }

  // Schedule events
  async emitScheduleGenerated(tournamentId: string, schedule: SchedulePayload): Promise<void> {
    try {
      this.io.to(`tournament-${tournamentId}`).emit('schedule:generated', { 
        tournamentId, 
        schedule 
      });
      
      console.log(`📡 Schedule generated event sent: ${tournamentId}`);
    } catch (error) {
      console.error('Error emitting schedule generated event:', error);
    }
  }

  // Get connected clients count for a tournament
  async getConnectedClientsCount(tournamentId: string): Promise<number> {
    try {
      const clients = await redis.getClient().scard(`tournament:${tournamentId}:clients`);
      return clients;
    } catch (error) {
      console.error('Error getting connected clients count:', error);
      return 0;
    }
  }
}

export default WebSocketService;