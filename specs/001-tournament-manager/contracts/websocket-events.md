# WebSocket Events: Darts Tournament Manager

**Generated**: 2026-02-03  
**Purpose**: Real-time event contracts for tournament updates

## Connection

### Connect to Tournament
```javascript
// Client connection
socket.emit('join_tournament', {
  tournament_id: 'uuid'
});

// Server acknowledgment
socket.on('tournament_joined', {
  tournament_id: 'uuid',
  current_status: 'in_progress',
  connected_clients: 5
});
```

## Tournament Events

### Score Update
**Trigger**: Match score entry via REST API  
**Direction**: Server → All Clients

```javascript
socket.on('score_updated', {
  tournament_id: 'uuid',
  match_id: 'uuid',
  participant_1_score: 501,
  participant_2_score: 301,
  winner_id: 'uuid', // null if not determined
  timestamp: '2026-02-03T14:30:00Z'
});
```

### Match Completion
**Trigger**: Final score entry completing a match  
**Direction**: Server → All Clients

```javascript
socket.on('match_completed', {
  tournament_id: 'uuid',
  match_id: 'uuid',
  winner_id: 'uuid',
  participant_1_final_score: 501,
  participant_2_final_score: 245,
  completed_at: '2026-02-03T14:30:00Z',
  next_matches: [
    {
      match_id: 'uuid',
      participants: ['player1_id', 'player2_id'],
      scheduled_time: '2026-02-03T14:35:00Z',
      target_number: 3
    }
  ]
});
```

### Target Availability Change
**Trigger**: Match completion or target status update  
**Direction**: Server → All Clients

```javascript
socket.on('target_availability_changed', {
  tournament_id: 'uuid',
  target_updates: [
    {
      target_number: 1,
      availability_status: 'available', // 'occupied', 'maintenance'
      last_match_completed: '2026-02-03T14:30:00Z',
      next_match: {
        match_id: 'uuid',
        participants: ['player1_id', 'player2_id'],
        estimated_start: '2026-02-03T14:35:00Z'
      }
    }
  ]
});
```

### Tournament Standings Update
**Trigger**: Score entry affecting standings  
**Direction**: Server → All Clients

```javascript
socket.on('standings_updated', {
  tournament_id: 'uuid',
  updated_at: '2026-02-03T14:30:00Z',
  pool_standings: [
    {
      pool_id: 'uuid',
      pool_number: 1,
      standings: [
        {
          participant_id: 'uuid',
          participant_name: 'John Doe',
          position: 1,
          matches_played: 3,
          matches_won: 2,
          points_for: 1403,
          points_against: 1201
        }
      ]
    }
  ],
  bracket_progression: [
    {
      bracket_id: 'uuid',
      bracket_type: 'winner',
      advanced_participants: ['uuid1', 'uuid2'],
      eliminated_participants: ['uuid3']
    }
  ]
});
```

### Next Match Assignment
**Trigger**: Target becomes available and matches are queued  
**Direction**: Server → All Clients

```javascript
socket.on('next_match_assigned', {
  tournament_id: 'uuid',
  assignments: [
    {
      match_id: 'uuid',
      target_number: 2,
      participant_1: {
        id: 'uuid',
        name: 'Alice Smith',
        skill_level: 'advanced'
      },
      participant_2: {
        id: 'uuid',
        name: 'Bob Johnson',
        skill_level: 'intermediate'
      },
      estimated_start: '2026-02-03T14:35:00Z',
      match_type: 'pool', // or 'bracket'
      stage_info: 'Pool A - Round 2'
    }
  ]
});
```

### Tournament Status Change
**Trigger**: Tournament phase transitions  
**Direction**: Server → All Clients

```javascript
socket.on('tournament_status_changed', {
  tournament_id: 'uuid',
  old_status: 'open',
  new_status: 'live',
  changed_at: '2026-02-03T14:00:00Z',
  message: 'Tournament has started - Pool stage beginning'
});
```

## Client Events

### Request Live Updates
**Direction**: Client → Server

```javascript
socket.emit('request_live_data', {
  tournament_id: 'uuid',
  data_types: ['standings', 'targets', 'next_matches']
});
```

### Heartbeat
**Direction**: Bidirectional

```javascript
// Client ping
socket.emit('ping', { timestamp: Date.now() });

// Server pong
socket.on('pong', { timestamp: Date.now(), server_time: '2026-02-03T14:30:00Z' });
```

## Error Events

### Tournament Error
**Direction**: Server → Client

```javascript
socket.on('tournament_error', {
  tournament_id: 'uuid',
  error_type: 'invalid_score_entry',
  message: 'Score entry failed: Match already completed',
  match_id: 'uuid',
  timestamp: '2026-02-03T14:30:00Z'
});
```

### Connection Error
**Direction**: Server → Client

```javascript
socket.on('connection_error', {
  error_type: 'tournament_not_found',
  message: 'Tournament ID does not exist or is finished',
  tournament_id: 'uuid'
});
```

## Event Ordering & Reliability

### Event Sequence Guarantee
- All events include `tournament_id` for filtering
- Events include `timestamp` for ordering
- Score updates precede standings updates
- Match completion precedes target availability changes

### Rate Limiting
- Maximum 10 events per second per client connection
- Batch similar events (multiple target updates in single message)
- Debounce rapid standings calculations (max every 2 seconds)

### Error Recovery
- Client reconnection automatically re-joins tournament
- Server sends current state snapshot on reconnection
- Missing events can be recovered via REST API polling

## Implementation Notes

### Server-Side Event Triggers
```javascript
// After score entry in REST API
await updateMatch(matchId, scores);
io.to(`tournament_${tournamentId}`).emit('score_updated', eventData);
await recalculateStandings(tournamentId);
io.to(`tournament_${tournamentId}`).emit('standings_updated', standingsData);
```

### Client-Side Event Handling
```javascript
// React component integration
useEffect(() => {
  socket.on('score_updated', handleScoreUpdate);
  socket.on('standings_updated', handleStandingsUpdate);
  
  return () => {
    socket.off('score_updated', handleScoreUpdate);
    socket.off('standings_updated', handleStandingsUpdate);
  };
}, []);
```

### Performance Considerations
- Use Socket.IO rooms for tournament isolation
- Implement event batching for rapid updates
- Consider event compression for large tournaments
- Monitor connection count per tournament (recommend < 50 concurrent viewers)