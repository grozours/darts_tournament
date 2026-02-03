# Quickstart: Darts Tournament Manager

**Generated**: 2026-02-03  
**Purpose**: Rapid setup and validation guide for development

## Development Setup

### Prerequisites
```bash
# Required software
node --version  # v20.x LTS required
npm --version   # v10.x required
docker --version # For PostgreSQL and Redis
git --version   # For version control
```

### Initial Setup
```bash
# Clone and setup project
git clone <repository-url>
cd darts-tournament-manager
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start database services
docker-compose up -d postgres redis

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev:backend    # Terminal 1 - API server on :3000
npm run dev:frontend   # Terminal 2 - React app on :5173
```

### Project Structure
```
backend/
├── src/
│   ├── models/          # Database models (Prisma)
│   ├── services/        # Business logic
│   ├── api/            # Route handlers
│   └── websocket/      # Socket.io event handlers
├── tests/              # Test files
└── prisma/             # Database schema and migrations

frontend/
├── src/
│   ├── components/     # React components
│   ├── pages/         # Page-level components
│   ├── services/      # API client and WebSocket
│   └── hooks/         # Custom React hooks
└── tests/             # Frontend tests
```

## Quick Validation

### 1. Tournament Creation (5 minutes)

**Test via API**:
```bash
# Create tournament
curl -X POST http://localhost:3000/api/tournaments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Tournament",
    "format": "single",
    "duration_type": "half_day_morning",
    "start_time": "2026-02-04T09:00:00Z",
    "end_time": "2026-02-04T13:00:00Z",
    "total_participants": 16,
    "target_count": 4,
    "pool_stages": [
      {
        "stage_number": 1,
        "pool_count": 4,
        "participants_per_pool": 4,
        "rounds_per_match": 3,
        "advancement_count": 2
      }
    ],
    "brackets": [
      {
        "bracket_type": "winner",
        "size": 8,
        "rounds_per_match": 5
      }
    ]
  }'
```

**Test via Frontend**:
1. Navigate to http://localhost:5173
2. Click "Create Tournament"
3. Fill out form with test data
4. Verify tournament appears in list

**Expected Results**:
- ✅ Tournament created with unique ID
- ✅ Database records created
- ✅ Tournament visible in UI

### 2. Player Registration (3 minutes)

**Test Players API**:
```bash
TOURNAMENT_ID="<id-from-step-1>"

# Register test players
for i in {1..16}; do
  curl -X POST http://localhost:3000/api/tournaments/${TOURNAMENT_ID}/players \
    -H "Content-Type: application/json" \
    -d "{
      \"firstname\": \"Player\",
      \"lastname\": \"$i\",
      \"mobile_phone\": \"+1555000000$i\",
      \"skill_level\": \"intermediate\"
    }"
done
```

**Expected Results**:
- ✅ 16 players registered
- ✅ No duplicate phone number errors
- ✅ Players visible in UI list

### 3. Pool Seeding (2 minutes)

**Test Seeding**:
```bash
# Trigger automatic seeding
curl -X POST http://localhost:3000/api/tournaments/${TOURNAMENT_ID}/pools/seed
```

**Expected Results**:
- ✅ Players distributed across 4 pools
- ✅ Each pool has 4 players
- ✅ Pool assignments visible in UI

### 4. Real-time Features (3 minutes)

**Test WebSocket Connection**:
```javascript
// Open browser console on frontend
const socket = io('http://localhost:3000');
socket.emit('join_tournament', { tournament_id: 'TOURNAMENT_ID' });
socket.on('tournament_joined', (data) => console.log('Joined:', data));
```

**Test Score Entry**:
```bash
# Get first match ID
MATCH_ID=$(curl -s http://localhost:3000/api/tournaments/${TOURNAMENT_ID}/matches | jq -r '.matches[0].id')

# Enter score
curl -X POST http://localhost:3000/api/tournaments/${TOURNAMENT_ID}/matches/${MATCH_ID}/score \
  -H "Content-Type: application/json" \
  -d '{
    "participant_1_score": 501,
    "participant_2_score": 387
  }'
```

**Expected Results**:
- ✅ WebSocket events received in console
- ✅ UI updates with new score
- ✅ Target availability changes
- ✅ Standings update

### 5. File Upload (2 minutes)

**Test Logo Upload**:
```bash
# Create test image (requires imagemagick)
convert -size 200x200 xc:blue test-logo.png

# Upload logo
curl -X POST http://localhost:3000/api/tournaments/${TOURNAMENT_ID}/logo \
  -F "logo=@test-logo.png"
```

**Expected Results**:
- ✅ Logo uploaded successfully
- ✅ File size validation works
- ✅ Logo displays in tournament details

## Performance Verification

### Database Performance
```bash
# Run with test data
npm run test:performance

# Check query execution times
npm run db:analyze
```

**Targets**:
- Tournament creation: < 2 seconds
- Player registration: < 500ms
- Score entry: < 1 second
- Standings calculation: < 2 seconds

### Real-time Performance
```javascript
// Frontend performance test
console.time('score-update');
// Enter score via UI
// Measure time until standings update
console.timeEnd('score-update'); // Should be < 2000ms
```

## Common Issues

### Database Connection Issues
```bash
# Check database status
docker-compose ps

# View logs
docker-compose logs postgres

# Reset database
npm run db:reset
```

### WebSocket Connection Issues
```bash
# Check Socket.io connection
curl http://localhost:3000/socket.io/?transport=polling

# Monitor WebSocket traffic
npm run dev:debug  # Enables Socket.io debug logs
```

### File Upload Issues
```bash
# Check upload directory permissions
ls -la uploads/
mkdir -p uploads/logos
chmod 755 uploads/logos

# Test file size limits
dd if=/dev/zero of=test-large.png bs=1M count=6  # Should fail
```

## Test Suite Execution

### Run All Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests  
cd frontend && npm test

# End-to-end tests
npm run test:e2e

# Performance tests
npm run test:performance
```

### TDD Workflow Example
```bash
# 1. Write failing test
npm test -- --watch tournament.test.js

# 2. Run specific test
npm test -- tournament.test.js -t "should create tournament with pools"

# 3. Implement feature
# Edit src/services/tournamentService.js

# 4. Watch test pass
# Test should turn green
```

## Production Readiness Checklist

### Code Quality
- [ ] All tests passing
- [ ] ESLint errors resolved
- [ ] TypeScript compilation clean
- [ ] Test coverage > 80%

### Performance
- [ ] Schedule generation < 30s for 128 participants
- [ ] Real-time updates < 2s latency
- [ ] Target availability < 1s update time
- [ ] Database queries optimized

### Security
- [ ] File upload validation working
- [ ] Rate limiting configured
- [ ] Input sanitization tested
- [ ] CORS properly configured

### Accessibility
- [ ] WCAG 2.1 AA compliance verified
- [ ] Keyboard navigation working
- [ ] Screen reader compatibility tested
- [ ] Color contrast validated

## Next Steps

1. **Run full test suite**: `npm run test:all`
2. **Performance benchmark**: `npm run benchmark`
3. **Generate API documentation**: `npm run docs:api`
4. **Setup CI/CD pipeline**: Configure GitHub Actions
5. **Deploy staging environment**: Follow deployment guide

For detailed implementation guidance, see:
- [Architecture Guide](../architecture.md) 
- [API Documentation](../contracts/api.yaml)
- [Testing Strategy](../testing.md)