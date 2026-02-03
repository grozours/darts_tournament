# Data Model: Darts Tournament Manager

**Generated**: 2026-02-03  
**Purpose**: Define entity relationships and data structures for tournament management system

## Core Entities

### Tournament

**Purpose**: Represents a complete darts tournament configuration and state

**Attributes**:
- `id: string` (UUID, primary key)
- `name: string` (tournament display name)
- `logo_url: string?` (path to uploaded logo file)
- `format: enum` (single, double, team_4_player)
- `duration_type: enum` (half_day_morning, half_day_afternoon, half_day_night, full_day, two_day)
- `start_time: datetime` (tournament start time)
- `end_time: datetime` (tournament end time)
- `total_participants: integer` (configured number of players/teams)
- `target_count: integer` (number of dartboards available)
- `status: enum` (draft, registration_open, in_progress, completed, archived)
- `created_at: datetime`
- `completed_at: datetime?`
- `historical_flag: boolean` (marks completed tournaments)

**Relationships**:
- Has many PoolStages
- Has many Brackets
- Has many Players (through participation)
- Has many Matches
- Has one Schedule

**Validation Rules**:
- name: 3-100 characters
- total_participants: 2-128
- target_count: 1-32
- end_time > start_time

### Player

**Purpose**: Represents individual tournament participants with skill assessment

**Attributes**:
- `id: string` (UUID, primary key)
- `tournament_id: string` (foreign key)
- `firstname: string`
- `lastname: string`
- `surname: string?` (nickname/alias)
- `team_name: string?` (for team formats)
- `mobile_phone: string`
- `skill_level: enum` (novice, intermediate, advanced, expert)
- `registration_order: integer` (order of registration)
- `created_at: datetime`

**Relationships**:
- Belongs to Tournament
- Belongs to Team (optional, for team formats)
- Participates in many Pools
- Participates in many Brackets
- Has many Match participations

**Validation Rules**:
- firstname: 1-50 characters, required
- lastname: 1-50 characters, required
- mobile_phone: valid phone number format
- skill_level: required for seeding algorithm

### Team

**Purpose**: Groups players for double/4-player tournament formats

**Attributes**:
- `id: string` (UUID, primary key)
- `tournament_id: string` (foreign key)
- `name: string` (team display name)
- `derived_skill_level: enum` (calculated from member skills)
- `member_count: integer` (2 for doubles, 4 for team)
- `created_at: datetime`

**Relationships**:
- Belongs to Tournament
- Has many Players
- Participates in Pools and Brackets as unit

**Validation Rules**:
- name: 2-50 characters, unique per tournament
- member_count: must match tournament format

### PoolStage

**Purpose**: Defines a complete pool stage configuration

**Attributes**:
- `id: string` (UUID, primary key)
- `tournament_id: string` (foreign key)
- `stage_number: integer` (1, 2, 3... sequential)
- `pool_count: integer` (number of pools in this stage)
- `participants_per_pool: integer`
- `rounds_per_match: integer` (legs in pool matches)
- `advancement_count: integer` (how many advance from each pool)

**Relationships**:
- Belongs to Tournament
- Has many Pools

**Validation Rules**:
- stage_number: sequential, starts at 1
- pool_count: 1-16
- participants_per_pool: 2-16

### Pool

**Purpose**: Represents individual pool within a stage

**Attributes**:
- `id: string` (UUID, primary key)
- `pool_stage_id: string` (foreign key)
- `pool_number: integer` (A=1, B=2, etc.)
- `seeded: boolean` (whether seeding algorithm was applied)
- `status: enum` (pending, in_progress, completed)

**Relationships**:
- Belongs to PoolStage
- Has many Pool Assignments (players/teams)
- Has many Matches

### Bracket

**Purpose**: Represents final elimination brackets (winner/loser)

**Attributes**:
- `id: string` (UUID, primary key)
- `tournament_id: string` (foreign key)
- `bracket_type: enum` (winner, loser)
- `size: integer` (8, 16, 32, 64)
- `rounds_per_match: integer` (legs in bracket matches)
- `current_round: integer`
- `status: enum` (pending, in_progress, completed)

**Relationships**:
- Belongs to Tournament
- Has many Bracket Positions
- Has many Matches

### Match

**Purpose**: Represents individual match/game between participants

**Attributes**:
- `id: string` (UUID, primary key)
- `tournament_id: string` (foreign key)
- `match_type: enum` (pool, bracket)
- `stage_reference: string` (pool_id or bracket_id)
- `participant_1_id: string` (player or team)
- `participant_2_id: string` (player or team)
- `participant_1_score: integer?`
- `participant_2_score: integer?`
- `winner_id: string?`
- `scheduled_time: datetime?`
- `target_number: integer?`
- `status: enum` (scheduled, in_progress, completed, cancelled)
- `completed_at: datetime?`

**Relationships**:
- Belongs to Tournament
- References Participants (Players or Teams)
- Assigned to Target

**Validation Rules**:
- scores: 0-999, winner determined by higher score
- target_number: 1 to tournament.target_count

### Target

**Purpose**: Represents physical dartboard playing surface

**Attributes**:
- `id: string` (UUID, primary key)
- `tournament_id: string` (foreign key)
- `target_number: integer` (1, 2, 3...)
- `current_match_id: string?` (active match)
- `availability_status: enum` (available, occupied, maintenance)
- `last_match_completed: datetime?`

**Relationships**:
- Belongs to Tournament
- Has current Match assignment
- Has Match history

### Schedule

**Purpose**: Chronological organization of all tournament matches

**Attributes**:
- `id: string` (UUID, primary key)
- `tournament_id: string` (foreign key)
- `generated_at: datetime`
- `total_estimated_duration: integer` (minutes)
- `sharing_enabled: boolean`
- `sharing_url: string?` (public access link)

**Relationships**:
- Belongs to Tournament
- References all Matches with time assignments

### Score

**Purpose**: Detailed score tracking and audit trail

**Attributes**:
- `id: string` (UUID, primary key)
- `match_id: string` (foreign key)
- `participant_1_score: integer`
- `participant_2_score: integer`
- `entered_at: datetime`
- `entered_by_ip: string` (audit trail without authentication)
- `is_final: boolean`

**Relationships**:
- Belongs to Match
- Audit trail for score changes

## Entity Relationships Summary

```text
Tournament (1) ──── (many) Player
Tournament (1) ──── (many) Team
Tournament (1) ──── (many) PoolStage ──── (many) Pool
Tournament (1) ──── (many) Bracket
Tournament (1) ──── (many) Match
Tournament (1) ──── (many) Target
Tournament (1) ──── (1) Schedule

Player (many) ──── (many) Match [participation]
Team (many) ──── (many) Match [participation]
Match (1) ──── (many) Score [audit trail]
Target (1) ──── (many) Match [assignments]
```

## Data Flow Patterns

### Tournament Creation Flow

1. Tournament entity created with configuration
2. PoolStage entities created based on structure
3. Bracket entities created if configured
4. Target entities created based on target_count
5. Schedule entity initialized (empty)

### Player Registration Flow

1. Player entity created with validation
2. Team entity created if team format
3. Automatic seeding triggers when threshold reached
4. Pool assignments created through seeding algorithm

### Match Execution Flow

1. Match entity scheduled with target assignment
2. Target availability updated (occupied)
3. Score entities created for audit trail
4. Match completion updates Target (available)
5. Tournament standings recalculated
6. Next match assignments determined

### Real-time Update Events

- Score entry → Tournament standings update
- Match completion → Target availability change
- Target free → Next match assignment
- Bracket progression → Schedule updates

## Performance Considerations

### Database Indexing Strategy

```sql
-- Core lookup indexes
CREATE INDEX idx_tournament_status ON tournaments(status);
CREATE INDEX idx_player_tournament ON players(tournament_id);
CREATE INDEX idx_match_tournament_status ON matches(tournament_id, status);
CREATE INDEX idx_target_tournament_availability ON targets(tournament_id, availability_status);

-- Real-time query optimization
CREATE INDEX idx_match_scheduled_time ON matches(scheduled_time) WHERE status = 'scheduled';
CREATE INDEX idx_score_match_final ON scores(match_id) WHERE is_final = true;
```

### Data Archiving Strategy

- Completed tournaments: Mark `historical_flag = true`
- Archive strategy: Keep all data permanently per requirements
- Optimize queries: Use status/historical filters for active data
- Reporting: Separate indexes for historical analysis