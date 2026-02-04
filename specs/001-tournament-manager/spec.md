
# Feature Specification: Darts Tournament Manager

**Feature Branch**: `001-tournament-manager`  
**Created**: 2026-02-03  
**Status**: Draft  
**Input**: User description: "Create an application to manage a darts tournament. Tournament creation: name, visual content/logos, number of players/teams, targets, pool stages with configurable pools per stage, winner/loser brackets with configurable sizes, duration (half/full/two days) with start/end times, agenda view, rounds/legs configuration. Tournament management: player registration with levels, automatic pool seeding based on levels, score entry, next match display for free targets, real-time score updates."

## User Scenarios & Testing *(mandatory)*

## Clarifications

### Session 2026-02-03

- Q: How should tournament access be controlled? → A: OAuth login (Google/Facebook) via Auth0; protect API endpoints
- Q: What happens to tournament data after completion? → A: Keep permanently for historical records and statistics
- Q: What devices/platforms should be supported? → A: Desktop web browser only (traditional tournament management)
- Q: What skill level scale should be used? → A: Traditional dart player categories (Novice, Intermediate, Advanced, Expert)
- Q: What file size/format limits for logos? → A: 5MB max file size, JPG/PNG formats only

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->


### User Story 1 - Create and Configure Tournament (Priority: P1)

As an organizer, I want to create a new darts tournament with comprehensive configuration including tournament name, visual branding (logos), number of players/teams, number of targets, detailed pool stage structure (number of stages, pools per stage, players per pool), winner/loser bracket configuration with customizable sizes, tournament duration (half day with time slots, full day, or two days) with specific start/end times, and rounds/legs configuration for each stage using a desktop web browser, so that the tournament is fully customized to my event needs.

**Why this priority**: Tournament setup with all configuration options is the foundation for all tournament operations and must be completed before any other functionality can be used.

**Independent Test**: Can be fully tested by creating tournaments with various configurations, uploading visual content, setting different durations and times, configuring complex pool/bracket structures, and verifying all settings are saved and displayed correctly.

**Acceptance Scenarios**:
1. **Given** no tournaments exist, **When** the organizer creates a tournament with name, logo, and basic configuration, **Then** the tournament is created with visual branding displayed.
2. **Given** a tournament is being created, **When** the organizer configures pool stages and bracket structures, **Then** the system validates and saves the complete tournament structure.
3. **Given** a tournament configuration, **When** the organizer sets duration and time constraints, **Then** the system creates a schedule framework ready for match assignment.

---


### User Story 2 - Register Players with Level Assessment (Priority: P2)

As an organizer, I want to register players with comprehensive information (firstname, lastname, surname, team name, mobile phone) and assign skill level evaluations, so that I can track all participants and enable intelligent seeding for fair competition.

**Why this priority**: Player registration with level assessment is essential for tournament seeding and participant management.

**Independent Test**: Can be fully tested by registering players with various information completeness levels, assigning skill levels, verifying data storage, and ensuring duplicate prevention works correctly.

**Acceptance Scenarios**:
1. **Given** a configured tournament, **When** the organizer registers a player with complete information and skill level, **Then** the player is added to the roster with level recorded.
2. **Given** players with different skill levels, **When** the organizer reviews the registration list, **Then** skill levels are clearly visible and editable.
3. **Given** registration in progress, **When** duplicate player information is entered, **Then** the system prevents duplicate registration and suggests existing entry.

---


### User Story 3 - Intelligent Pool Assignment (Priority: P3)

As an organizer, I want the system to automatically fill the first stage pools by distributing players based on their skill levels (when known), ensuring stronger players are separated into different pools for fair competition, so that initial stages are balanced and competitive.

**Why this priority**: Intelligent seeding creates fair initial matchups and improves tournament quality.

**Independent Test**: Can be fully tested by registering players with various skill levels, triggering automatic pool assignment, and verifying that players are distributed fairly across pools with stronger players separated.

**Acceptance Scenarios**:
1. **Given** registered players with assigned skill levels, **When** automatic pool assignment is triggered, **Then** players are distributed to balance pool strength.
2. **Given** players without skill levels, **When** automatic assignment runs, **Then** players are distributed randomly but evenly across pools.
3. **Given** an uneven number of players, **When** pool assignment occurs, **Then** the system handles bye assignments appropriately.

---

### User Story 4 - Real-Time Match Management (Priority: P4)

As an organizer, I want to enter match scores in real-time, see which targets are newly available after match completion, view the next matches to be played on available targets, and have tournament standings update automatically, so that the tournament flows smoothly with minimal delays.

**Why this priority**: Real-time match management is essential for efficient tournament execution and participant satisfaction.

**Independent Test**: Can be fully tested by entering match scores, verifying target availability updates, confirming next match assignments, and ensuring standings update immediately.

**Acceptance Scenarios**:
1. **Given** a match in progress, **When** the organizer enters the final score, **Then** the target becomes available and the next match is displayed.
2. **Given** multiple available targets, **When** matches complete, **Then** the system shows the optimal next match assignments for each target.
3. **Given** score entry, **When** results are saved, **Then** tournament standings and bracket progression update in real-time.

---

### User Story 5 - Generate Tournament Schedule and Agenda (Priority: P5)

As an organizer, I want to generate a comprehensive tournament agenda showing all match times in chronological order, so that I can share the schedule with players and ensure everyone knows when and where to play.

**Why this priority**: A detailed schedule enables efficient tournament execution and keeps participants informed.

**Independent Test**: Can be fully tested by generating schedules for different tournament configurations, verifying time assignments respect constraints, and confirming the agenda can be shared with participants.

**Acceptance Scenarios**:
1. **Given** a fully configured tournament, **When** the schedule is generated, **Then** all matches are assigned appropriate times within tournament duration constraints.
2. **Given** a generated schedule, **When** shared with participants, **Then** players can view their match times and target assignments.
3. **Given** schedule constraints, **When** matches are assigned, **Then** target availability and rounds/legs duration are properly accounted for.

---


### Edge Cases

- What happens if visual content (logos) exceed 5MB or are not JPG/PNG format?
- How does the system handle players without skill level assessments during automatic seeding?
- What if tournament duration is too short for the configured number of matches and rounds?
- How are target assignments managed when matches run longer than scheduled?
- What happens when scores are entered incorrectly and need correction after bracket progression?
- How does the system handle simultaneous score entry for the same match?
- What if the number of registered players doesn't match the configured tournament structure?
- How are withdrawn players handled after pool assignments are made?
- What happens when bracket progression creates uneven matches (e.g., loser bracket emptying)?
- How does the system handle time zone differences for tournament scheduling?
- What if targets become unavailable during tournament execution?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->


### Functional Requirements

- **FR-001**: System MUST allow creation of tournaments with name, visual content upload (logos up to 5MB in JPG/PNG format), configurable format, duration (half-day with time slots, full-day, two-day), and start/end times for authenticated users.
- **FR-002**: System MUST support configurable tournament structure including number of players/teams, targets, pool stages, pools per stage, players per pool, and rounds/legs per stage.
- **FR-003**: System MUST allow configuration of winner and loser brackets with customizable bracket sizes and rounds/legs.
- **FR-004**: System MUST allow comprehensive player registration including firstname, lastname, surname, team name, mobile phone, and skill level evaluation without user authentication.
- **FR-005**: System MUST prevent duplicate player registration and validate all registration data.
- **FR-006**: System MUST automatically assign players to first-stage pools, using skill levels when available to separate stronger players across different pools.
- **FR-007**: System MUST allow manual adjustment of automatic pool assignments before tournament start.
- **FR-008**: System MUST support real-time match score entry with immediate tournament standing updates accessible to anyone.
- **FR-009**: System MUST display available targets and next matches to play when targets become free.
- **FR-010**: System MUST generate comprehensive tournament agenda with chronological match times for sharing with participants.
- **FR-011**: System MUST update bracket progression and standings in real-time as scores are entered.
- **FR-012**: System MUST validate all tournament configurations and prevent invalid setups (insufficient time, target conflicts, etc.).
- **FR-013**: System MUST persist all tournament data, configurations, registrations, and match results permanently for historical records and statistical analysis with authenticated access.
- **FR-014**: System MUST support OAuth login with Google and Facebook through Auth0.
- **FR-015**: System MUST protect API endpoints with JWT validation (issuer + audience) and reject unauthenticated requests.
- **FR-016**: System MUST provide an install bash script to set up the application from scratch, including database schema creation and seed data.
- **FR-017**: System MUST provide a restart bash script to start/stop frontend or backend in the background and document its usage.


### Key Entities

- **Tournament**: Represents a darts tournament. Attributes: name, visual content (logos), format, duration type, start/end times, number of players/teams, number of targets, pool configuration, bracket configuration, schedule, status, completion date, historical flag.
- **Player**: Represents an individual participant. Attributes: firstname, lastname, surname, team name, mobile phone, skill level (Novice/Intermediate/Advanced/Expert), assigned pools/brackets, match history.
- **Team**: Represents a group of players (for team formats). Attributes: team name, player list, skill level (derived), tournament association.
- **PoolStage**: Represents a complete pool stage. Attributes: stage number, number of pools in stage, number of players per pool, rounds/legs configuration, tournament association.
- **Pool**: Represents a group of players/teams in a stage. Attributes: pool number, stage number, assigned participants, standings, tournament association.
- **Bracket**: Represents final stage structure. Attributes: bracket type (winner/loser), size, number of rounds/steps, rounds/legs per match, participant assignments, tournament association.
- **Match**: Represents a single match. Attributes: participants, scheduled time, target assignment, stage/bracket association, score, status (scheduled/in-progress/completed).
- **Target**: Represents a playing surface. Attributes: target number, availability status, current match assignment, tournament association.
- **Score**: Represents match results. Attributes: match association, participant scores, timestamp, entered by.
- **Schedule**: Represents chronological match organization. Attributes: match list with times, target assignments, tournament association, sharing status.
- **SkillLevel**: Represents player ability assessment. Attributes: category (Novice/Intermediate/Advanced/Expert), description, player association.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->


### Measurable Outcomes

- **SC-001**: Organizers can create and fully configure a tournament including visual branding in under 10 minutes without errors.
- **SC-002**: 100% of valid player registrations with skill levels are stored and retrievable; duplicate entries are prevented.
- **SC-003**: Automatic pool seeding distributes players fairly with 95% organizer satisfaction on balance.
- **SC-004**: Tournament schedules are generated within 30 seconds for tournaments up to 128 participants.
- **SC-005**: Real-time score updates reflect in tournament standings within 2 seconds of entry.
- **SC-006**: Target availability and next match assignments update immediately (under 1 second) after score entry.
- **SC-007**: Generated tournament agendas respect time and target constraints with 100% accuracy.
- **SC-008**: Match schedules can be shared with participants and accessed without errors on desktop browsers.
- **SC-009**: 90% of organizers successfully complete tournament setup and execution without technical support.
