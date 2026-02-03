---

description: "Task list for Darts Tournament Manager implementation"
---

# Tasks: Darts Tournament Manager

**Input**: Design documents from `/specs/001-tournament-manager/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The tasks below include test tasks per constitution requirement for TDD workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`
- Tasks below follow the Node.js + React architecture from plan.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure per constitution requirements

- [ ] T001 Create monorepo project structure with backend/, frontend/, shared/ directories
- [ ] T002 Initialize Node.js 20 LTS backend with TypeScript 5.3+ in backend/package.json
- [ ] T003 [P] Initialize React 18+ frontend with TypeScript in frontend/package.json
- [ ] T004 [P] Configure ESLint/Prettier per constitution code quality standards in .eslintrc.js
- [ ] T005 [P] Setup Jest 29+ testing framework with TypeScript support in backend/jest.config.js
- [ ] T006 [P] Setup React Testing Library and Jest for frontend testing in frontend/jest.config.js
- [ ] T007 [P] Configure Playwright for E2E testing per constitution requirements in playwright.config.ts
- [ ] T008 [P] Setup Docker development environment per quickstart.md in docker-compose.yml
- [ ] T009 [P] Configure PostgreSQL 15+ database with connection pooling in backend/src/config/database.ts
- [ ] T010 [P] Setup Redis for real-time data caching in backend/src/config/redis.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T011 Setup database schema with all entities from data-model.md using Prisma in backend/prisma/schema.prisma
- [ ] T012 Create database migrations for Tournament, Player, Match, Target entities in backend/prisma/migrations/
- [ ] T013 [P] Configure Express.js 4.18+ server with middleware in backend/src/app.ts
- [ ] T014 [P] Setup Socket.io 4.7+ for real-time communication in backend/src/websocket/server.ts
- [ ] T015 [P] Implement base API error handling and logging per constitution in backend/src/middleware/errorHandler.ts
- [ ] T016 [P] Create environment configuration management in backend/src/config/environment.ts
- [ ] T017 [P] Setup CORS and security middleware in backend/src/middleware/security.ts
- [ ] T018 [P] Create shared TypeScript types from data-model.md in shared/src/types/
- [ ] T019 [P] Setup API validation middleware with Zod schemas in backend/src/middleware/validation.ts
- [ ] T020 [P] Configure file upload handling for tournament logos in backend/src/middleware/upload.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Tournament Creation & Configuration (Priority: P1) 🎯 MVP

**Goal**: Enable organizers to create and configure tournaments with basic settings, format selection, and logo upload

**Independent Test**: Can create a tournament, configure all settings (name, format, duration, targets), upload a logo, and verify configuration is saved correctly

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T021 [P] [US1] Contract test for POST /tournaments endpoint in backend/tests/contract/tournament.test.ts
- [ ] T022 [P] [US1] Contract test for POST /tournaments/{id}/logo endpoint in backend/tests/contract/tournament-logo.test.ts
- [ ] T023 [P] [US1] Integration test for tournament creation workflow in backend/tests/integration/tournament-creation.test.ts
- [ ] T024 [P] [US1] Frontend unit tests for TournamentForm component in frontend/tests/components/TournamentForm.test.tsx
- [ ] T025 [P] [US1] E2E test for complete tournament creation flow in tests/e2e/tournament-creation.spec.ts

### Implementation for User Story 1

- [ ] T026 [P] [US1] Create Tournament model with validation per data-model.md in backend/src/models/Tournament.ts
- [ ] T027 [P] [US1] Create TournamentService with creation logic in backend/src/services/TournamentService.ts
- [ ] T028 [US1] Implement POST /tournaments endpoint with validation in backend/src/routes/tournaments.ts
- [ ] T029 [US1] Implement logo upload endpoint POST /tournaments/{id}/logo in backend/src/routes/tournaments.ts
- [ ] T030 [US1] Add file validation for JPG/PNG and 5MB size limit in backend/src/utils/fileValidation.ts
- [ ] T031 [P] [US1] Create TournamentForm React component in frontend/src/components/TournamentForm.tsx
- [ ] T032 [P] [US1] Create tournament configuration UI with format selection in frontend/src/pages/CreateTournament.tsx
- [ ] T033 [P] [US1] Implement logo upload UI component in frontend/src/components/LogoUpload.tsx
- [ ] T034 [US1] Add form validation and error handling for tournament creation in frontend/src/hooks/useTournamentForm.ts
- [ ] T035 [US1] Integrate frontend with tournament creation API in frontend/src/api/tournaments.ts
- [ ] T036 [US1] Add tournament creation logging per constitution requirements in backend/src/services/TournamentService.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Player Registration (Priority: P2)

**Goal**: Enable organizers to register players with contact information and skill level assessment

**Independent Test**: Can register players with complete information, assign skill levels, prevent duplicate registration, and view/edit registration list

### Tests for User Story 2 ⚠️

- [ ] T037 [P] [US2] Contract test for POST /tournaments/{id}/players endpoint in backend/tests/contract/player-registration.test.ts
- [ ] T038 [P] [US2] Contract test for GET /tournaments/{id}/players endpoint in backend/tests/contract/player-list.test.ts
- [ ] T039 [P] [US2] Integration test for player registration and duplicate prevention in backend/tests/integration/player-registration.test.ts
- [ ] T040 [P] [US2] Frontend unit tests for PlayerRegistrationForm component in frontend/tests/components/PlayerRegistrationForm.test.tsx
- [ ] T041 [P] [US2] E2E test for complete player registration flow in tests/e2e/player-registration.spec.ts

### Implementation for User Story 2

- [ ] T042 [P] [US2] Create Player model with skill level enum per data-model.md in backend/src/models/Player.ts
- [ ] T043 [P] [US2] Create PlayerService with registration logic and duplicate detection in backend/src/services/PlayerService.ts
- [ ] T044 [US2] Implement POST /tournaments/{id}/players endpoint with validation in backend/src/routes/players.ts
- [ ] T045 [US2] Implement GET /tournaments/{id}/players endpoint with skill level display in backend/src/routes/players.ts
- [ ] T046 [US2] Add duplicate player validation using email/name matching in backend/src/utils/duplicateDetection.ts
- [ ] T047 [P] [US2] Create PlayerRegistrationForm React component in frontend/src/components/PlayerRegistrationForm.tsx
- [ ] T048 [P] [US2] Create skill level selection UI component in frontend/src/components/SkillLevelSelector.tsx
- [ ] T049 [P] [US2] Create player list display with edit capabilities in frontend/src/components/PlayerList.tsx
- [ ] T050 [US2] Add player registration validation and error handling in frontend/src/hooks/usePlayerRegistration.ts
- [ ] T051 [US2] Integrate frontend with player registration API in frontend/src/api/players.ts
- [ ] T052 [US2] Add player registration logging and audit trail in backend/src/services/PlayerService.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Intelligent Pool Assignment (Priority: P3)

**Goal**: Automatically distribute players into pools based on skill levels to ensure fair competition

**Independent Test**: Can register players with various skill levels, trigger automatic pool assignment, and verify fair distribution with stronger players separated

### Tests for User Story 3 ⚠️

- [ ] T053 [P] [US3] Contract test for POST /tournaments/{id}/pool-assignment endpoint in backend/tests/contract/pool-assignment.test.ts
- [ ] T054 [P] [US3] Unit test for pool distribution algorithm in backend/tests/unit/poolDistribution.test.ts
- [ ] T055 [P] [US3] Integration test for skill-based pool assignment logic in backend/tests/integration/pool-assignment.test.ts
- [ ] T056 [P] [US3] Frontend unit tests for PoolAssignment component in frontend/tests/components/PoolAssignment.test.tsx
- [ ] T057 [P] [US3] E2E test for automatic pool assignment flow in tests/e2e/pool-assignment.spec.ts

### Implementation for User Story 3

- [ ] T058 [P] [US3] Create PoolStage model per data-model.md in backend/src/models/PoolStage.ts
- [ ] T059 [P] [US3] Create Pool model with player assignments in backend/src/models/Pool.ts
- [ ] T060 [P] [US3] Implement pool distribution algorithm with skill-based balancing in backend/src/utils/poolDistribution.ts
- [ ] T061 [US3] Create PoolAssignmentService with automatic assignment logic in backend/src/services/PoolAssignmentService.ts
- [ ] T062 [US3] Implement POST /tournaments/{id}/pool-assignment endpoint in backend/src/routes/poolAssignment.ts
- [ ] T063 [US3] Add bye assignment handling for uneven player counts in backend/src/utils/byeAssignment.ts
- [ ] T064 [P] [US3] Create PoolAssignment React component with visualization in frontend/src/components/PoolAssignment.tsx
- [ ] T065 [P] [US3] Create pool distribution preview UI in frontend/src/components/PoolPreview.tsx
- [ ] T066 [US3] Add manual pool adjustment capabilities in frontend/src/components/PoolEditor.tsx
- [ ] T067 [US3] Integrate frontend with pool assignment API in frontend/src/api/poolAssignment.ts
- [ ] T068 [US3] Add pool assignment logging and validation in backend/src/services/PoolAssignmentService.ts

**Checkpoint**: User Stories 1, 2, and 3 should all work independently

---

## Phase 6: User Story 4 - Real-Time Match Management (Priority: P4)

**Goal**: Enable real-time match score entry, target availability tracking, and automatic tournament progression

**Independent Test**: Can enter match scores in real-time, verify target availability updates, confirm next match assignments, and ensure standings update immediately

### Tests for User Story 4 ⚠️

- [ ] T069 [P] [US4] Contract test for PUT /matches/{id}/score endpoint in backend/tests/contract/match-score.test.ts
- [ ] T070 [P] [US4] Contract test for GET /tournaments/{id}/targets/available endpoint in backend/tests/contract/target-availability.test.ts
- [ ] T071 [P] [US4] WebSocket integration test for real-time score updates in backend/tests/integration/websocket-scores.test.ts
- [ ] T072 [P] [US4] Frontend unit tests for MatchScoreEntry component in frontend/tests/components/MatchScoreEntry.test.tsx
- [ ] T073 [P] [US4] E2E test for real-time match management flow in tests/e2e/match-management.spec.ts

### Implementation for User Story 4

- [ ] T074 [P] [US4] Create Match model with score tracking per data-model.md in backend/src/models/Match.ts
- [ ] T075 [P] [US4] Create Target model with availability status in backend/src/models/Target.ts
- [ ] T076 [P] [US4] Create MatchService with real-time score updates in backend/src/services/MatchService.ts
- [ ] T077 [US4] Implement PUT /matches/{id}/score endpoint with WebSocket broadcast in backend/src/routes/matches.ts
- [ ] T078 [US4] Implement GET /tournaments/{id}/targets/available with real-time updates in backend/src/routes/targets.ts
- [ ] T079 [US4] Add automatic tournament progression logic in backend/src/services/TournamentProgressionService.ts
- [ ] T080 [US4] Implement WebSocket events for real-time updates per websocket-events.md in backend/src/websocket/events.ts
- [ ] T081 [P] [US4] Create MatchScoreEntry React component with validation in frontend/src/components/MatchScoreEntry.tsx
- [ ] T082 [P] [US4] Create real-time target availability display in frontend/src/components/TargetStatus.tsx
- [ ] T083 [P] [US4] Create tournament standings display with auto-updates in frontend/src/components/TournamentStandings.tsx
- [ ] T084 [US4] Add WebSocket client integration for real-time updates in frontend/src/hooks/useWebSocket.ts
- [ ] T085 [US4] Integrate real-time match management with tournament state in frontend/src/api/matches.ts
- [ ] T086 [US4] Add match completion logging and audit trail in backend/src/services/MatchService.ts

**Checkpoint**: User Stories 1, 2, 3, and 4 should all work independently

---

## Phase 7: User Story 5 - Tournament Schedule Generation (Priority: P5)

**Goal**: Generate comprehensive tournament agenda with chronological match scheduling and participant sharing

**Independent Test**: Can generate schedules for different tournament configurations, verify time assignments respect constraints, and confirm agenda can be shared

### Tests for User Story 5 ⚠️

- [ ] T087 [P] [US5] Contract test for POST /tournaments/{id}/schedule endpoint in backend/tests/contract/schedule-generation.test.ts
- [ ] T088 [P] [US5] Unit test for scheduling algorithm with time constraints in backend/tests/unit/scheduleGeneration.test.ts
- [ ] T089 [P] [US5] Integration test for complete schedule generation in backend/tests/integration/schedule-generation.test.ts
- [ ] T090 [P] [US5] Frontend unit tests for ScheduleDisplay component in frontend/tests/components/ScheduleDisplay.test.tsx
- [ ] T091 [P] [US5] E2E test for schedule generation and sharing flow in tests/e2e/schedule-generation.spec.ts

### Implementation for User Story 5

- [ ] T092 [P] [US5] Create Schedule model with match timing per data-model.md in backend/src/models/Schedule.ts
- [ ] T093 [P] [US5] Create ScheduledMatch model with target and time assignments in backend/src/models/ScheduledMatch.ts
- [ ] T094 [P] [US5] Implement scheduling algorithm with duration constraints in backend/src/utils/scheduleGeneration.ts
- [ ] T095 [US5] Create ScheduleService with chronological match ordering in backend/src/services/ScheduleService.ts
- [ ] T096 [US5] Implement POST /tournaments/{id}/schedule endpoint with validation in backend/src/routes/schedule.ts
- [ ] T097 [US5] Add tournament duration validation against match count in backend/src/utils/durationValidation.ts
- [ ] T098 [P] [US5] Create ScheduleDisplay React component with chronological view in frontend/src/components/ScheduleDisplay.tsx
- [ ] T099 [P] [US5] Create schedule sharing functionality in frontend/src/components/ScheduleShare.tsx
- [ ] T100 [P] [US5] Create player schedule view with personal matches in frontend/src/components/PlayerSchedule.tsx
- [ ] T101 [US5] Add schedule export capabilities (PDF/CSV) in frontend/src/utils/scheduleExport.ts
- [ ] T102 [US5] Integrate frontend with schedule generation API in frontend/src/api/schedule.ts
- [ ] T103 [US5] Add schedule generation logging and performance monitoring in backend/src/services/ScheduleService.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final system integration

- [ ] T104 [P] Add comprehensive API documentation using Swagger UI in backend/src/docs/
- [ ] T105 [P] Implement performance monitoring per constitution requirements in backend/src/middleware/performance.ts
- [ ] T106 [P] Add accessibility features per WCAG 2.1 AA standards in frontend/src/components/
- [ ] T107 [P] Create comprehensive user documentation in docs/user-guide.md
- [ ] T108 Code cleanup and refactoring across all components for maintainability
- [ ] T109 [P] Add comprehensive error boundaries in React application in frontend/src/components/ErrorBoundary.tsx
- [ ] T110 [P] Implement data backup and recovery procedures in backend/src/utils/backup.ts
- [ ] T111 Security audit and hardening across all endpoints and components
- [ ] T112 Performance optimization for <2s real-time update target per constitution
- [ ] T113 [P] Add comprehensive logging and monitoring dashboards
- [ ] T114 Run complete quickstart.md validation and documentation updates

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with Tournament model but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Requires Player model but independently testable
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Requires Match/Target models but independently testable
- **User Story 5 (P5)**: Can start after Foundational (Phase 2) - Requires Match model but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation per constitution TDD requirement
- Models before services
- Services before endpoints
- API endpoints before frontend components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Within each user story, all tests marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Frontend components marked [P] can run in parallel with backend development

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for POST /tournaments endpoint in backend/tests/contract/tournament.test.ts"
Task: "Frontend unit tests for TournamentForm component in frontend/tests/components/TournamentForm.test.tsx"
Task: "Integration test for tournament creation workflow in backend/tests/integration/tournament-creation.test.ts"

# Launch all models for User Story 1 together:
Task: "Create Tournament model with validation per data-model.md in backend/src/models/Tournament.ts"
Task: "Create TournamentService with creation logic in backend/src/services/TournamentService.ts"

# Launch frontend components in parallel with API development:
Task: "Create TournamentForm React component in frontend/src/components/TournamentForm.tsx"
Task: "Create logo upload UI component in frontend/src/components/LogoUpload.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T010)
2. Complete Phase 2: Foundational (T011-T020) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T021-T036)
4. **STOP and VALIDATE**: Test User Story 1 independently with tournament creation
5. Deploy/demo basic tournament creation functionality

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: Tournament Creation!)
3. Add User Story 2 → Test independently → Deploy/Demo (Add: Player Registration)
4. Add User Story 3 → Test independently → Deploy/Demo (Add: Smart Pool Assignment)
5. Add User Story 4 → Test independently → Deploy/Demo (Add: Real-time Management)
6. Add User Story 5 → Test independently → Deploy/Demo (Add: Schedule Generation)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Tournament Creation)
   - Developer B: User Story 2 (Player Registration)
   - Developer C: User Story 3 (Pool Assignment)
   - Developer D: User Story 4 (Match Management)
   - Developer E: User Story 5 (Schedule Generation)
3. Stories complete and integrate independently

---

## Summary

- **Total Tasks**: 114 implementation tasks
- **Task Distribution**:
  - Setup (Phase 1): 10 tasks
  - Foundational (Phase 2): 10 tasks
  - User Story 1: 16 tasks (5 tests + 11 implementation)
  - User Story 2: 16 tasks (5 tests + 11 implementation)
  - User Story 3: 16 tasks (5 tests + 11 implementation)
  - User Story 4: 18 tasks (5 tests + 13 implementation)
  - User Story 5: 17 tasks (5 tests + 12 implementation)
  - Polish & Cross-cutting: 11 tasks
- **Parallel Opportunities**: 47 tasks marked [P] for parallel execution
- **Independent Test Criteria**: Each user story has complete acceptance scenarios from spec.md
- **MVP Scope**: User Story 1 (Tournament Creation) provides immediately usable tournament management foundation
- **TDD Compliance**: All user stories include failing tests before implementation per constitution requirements

---

## Notes

- [P] tasks = different files, no dependencies - can run in parallel
- [US1-US5] labels map tasks to specific user stories for traceability
- Each user story should be independently completable and testable
- Tests must fail before implementing per constitution TDD requirement
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- File paths follow Node.js + React architecture from plan.md
- Real-time features use WebSocket per performance requirements
- All tasks support the <2s update target per constitution