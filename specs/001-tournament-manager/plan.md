# Implementation Plan: Darts Tournament Manager

**Branch**: `001-tournament-manager` | **Date**: 2026-02-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-tournament-manager/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Comprehensive darts tournament management application for desktop browsers with tournament creation, player registration with skill-based seeding, real-time match management, historical data retention, OAuth login, and scripted installation. Features include visual branding, configurable pool/bracket structures, automatic scheduling, live score tracking, protected API access via Auth0, and a background restart script for services.

## Technical Context

**Language/Version**: Node.js 20 LTS with TypeScript 5.3+  
**Primary Dependencies**: Express.js 4.18+, Socket.io 4.7+, React 18+, PostgreSQL 15+, Redis  
**Storage**: PostgreSQL for permanent historical data, Redis for real-time caching  
**Testing**: Jest 29+, React Testing Library, Playwright for E2E  
**Target Platform**: Desktop web browsers only
**Project Type**: web - React frontend with Node.js/Express backend API  
**Performance Goals**: Schedule generation <30s for 128 participants, real-time updates <2s, target availability <1s  
**Constraints**: 5MB logo uploads JPG/PNG only, OAuth login required, permanent data storage, WCAG 2.1 AA compliance  
**Scale/Scope**: Up to 128 participants per tournament, unlimited concurrent tournaments

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Code Quality**: TypeScript enforces type safety, ESLint/Prettier configured, comprehensive documentation generated  
✅ **Testing Discipline**: TDD framework established (Jest, React Testing Library, Playwright), test structures defined in contracts  
✅ **User Experience Consistency**: WCAG 2.1 AA compliance planned with Chakra UI, desktop-focused responsive design specified  
✅ **Performance Requirements**: Specific metrics defined and architecture supports goals (WebSocket for <2s updates, Bull Queue for <30s scheduling)  
✅ **Technology Stack Documentation**: Complete stack documented in research.md with rationale  
✅ **Security/Privacy Constraints**: File upload validation, rate limiting, audit logging planned for no-auth model  

**POST-DESIGN RE-EVALUATION**: ✅ PASS - All constitution principles satisfied by technical design. Performance architecture directly addresses defined metrics. Testing strategy supports TDD requirements. UX approach ensures consistency and accessibility.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

docs/
└── api/
```

**Structure Decision**: Web application structure selected due to desktop browser target platform and need for API backend to handle database operations, file uploads, and real-time features. Frontend handles UI/UX while backend manages tournament logic, data persistence, and scheduling algorithms.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
