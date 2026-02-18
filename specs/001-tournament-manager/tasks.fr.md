---

description: "Liste de tâches pour l’implémentation du Gestionnaire de Tournois de Fléchettes"
---

# Tâches : Gestionnaire de Tournois de Fléchettes

**Input** : Documents de design depuis `/specs/001-tournament-manager/`  
**Prérequis** : plan.fr.md (requis), spec.fr.md (requis), research.fr.md, data-model.fr.md, contracts/

**Tests** : les tâches ci-dessous incluent des tâches de test (TDD).

**Organisation** : tâches groupées par user story pour implémentation et test indépendants.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : exécutable en parallèle
- **[Story]** : user story associée (ex. US1)
- Inclure les chemins de fichiers exacts

## Conventions de chemins

- **Web app** : `backend/src/`, `frontend/src/`
- Tâches alignées sur l’architecture Node.js + React du plan

## Phase 1 : Setup (infrastructure partagée)

**But** : Initialisation projet et structure de base

- [ ] T001 Créer la structure monorepo avec backend/, frontend/, shared/
- [ ] T002 Initialiser le backend Node.js 20 LTS + TypeScript 5.3+ dans backend/package.json
- [ ] T003 [P] Initialiser le frontend React 18+ + TypeScript dans frontend/package.json
- [ ] T004 [P] Configurer ESLint/Prettier dans .eslintrc.js
- [ ] T005 [P] Configurer Jest 29+ dans backend/jest.config.js
- [ ] T006 [P] Configurer RTL + Jest dans frontend/jest.config.js
- [ ] T007 [P] Configurer Playwright dans playwright.config.ts
- [ ] T008 [P] Configurer Docker dev dans docker-compose.yml
- [ ] T010a [P] Créer install.sh (bootstrap + migrations + seed)
- [ ] T010b [P] Créer restart.sh (start/stop services)
- [ ] T009 [P] Configurer PostgreSQL dans backend/src/config/database.ts
- [ ] T010 [P] Configurer Redis dans backend/src/config/redis.ts

---

## Phase 2 : Fondations (prérequis bloquants)

**But** : Infrastructure core avant user stories

**⚠️ CRITIQUE** : aucune user story ne démarre avant fin de phase

- [ ] T011 Setup schéma Prisma dans backend/prisma/schema.prisma
- [ ] T012 Migrations DB pour Tournament, Player, Match, Target
- [ ] T013 [P] Configurer Express.js dans backend/src/app.ts
- [ ] T014 [P] Setup Socket.io dans backend/src/websocket/server.ts
- [ ] T015 [P] Gestion d’erreurs & logs dans backend/src/middleware/errorHandler.ts
- [ ] T016 [P] Config env dans backend/src/config/environment.ts
- [ ] T017 [P] CORS + sécurité dans backend/src/middleware/security.ts
- [ ] T018 [P] Types partagés dans shared/src/types/
- [ ] T019 [P] Validation API via Zod dans backend/src/middleware/validation.ts
- [ ] T020 [P] Upload fichiers dans backend/src/middleware/upload.ts

## Phase 2b : Authentification (transverse)

- [ ] T200 [P] Config Auth0 dans backend/src/config/environment.ts
- [ ] T201 [P] Middleware JWT dans backend/src/middleware/auth.ts
- [ ] T202 [P] Protéger /api via auth dans backend/src/app.ts
- [ ] T203 [P] Setup Auth0Provider dans frontend/src/main.tsx
- [ ] T204 [P] UI sign-in/out dans frontend/src/App.tsx


**Checkpoint** : fondations prêtes

---

## Phase 3 : User Story 1 - Création & configuration (P1) 🎯 MVP

**But** : permettre la création/configuration de tournois

**Test indépendant** : créer un tournoi, config complète, upload logo, vérifier persistance

### Tests pour User Story 1 ⚠️

> **NOTE : écrire ces tests d’abord, ils doivent échouer**

- [ ] T021 [P] [US1] Test de contrat POST /tournaments dans backend/tests/contract/tournament.test.ts
- [ ] T022 [P] [US1] Test de contrat POST /tournaments/{id}/logo
- [ ] T023 [P] [US1] Test d’intégration création tournoi
- [ ] T024 [P] [US1] Tests unitaires frontend TournamentForm
- [ ] T025 [P] [US1] Test E2E création tournoi

### Implémentation User Story 1

- [ ] T026 [P] [US1] Modèle Tournament dans backend/src/models/Tournament.ts
- [ ] T027 [P] [US1] TournamentService dans backend/src/services/TournamentService.ts
- [ ] T028 [US1] Endpoint POST /tournaments dans backend/src/routes/tournaments.ts
- [ ] T029 [US1] Endpoint logo POST /tournaments/{id}/logo
- [ ] T030 [US1] Validation fichiers JPG/PNG 5 Mo
- [ ] T031 [P] [US1] Composant TournamentForm
- [ ] T032 [P] [US1] UI configuration tournoi
- [ ] T033 [P] [US1] Composant upload logo
- [ ] T034 [US1] Validation formulaire Tournament
- [ ] T035 [US1] Intégration API création tournoi
- [ ] T036 [US1] Logs création tournoi

**Checkpoint** : User Story 1 fonctionnelle

---

## Phase 4 : User Story 2 - Inscription joueurs (P2)

**But** : permettre l’inscription de joueurs avec niveau

**Test indépendant** : inscription, anti-doublon, liste consultable

### Tests pour User Story 2 ⚠️

- [ ] T037 [P] [US2] Test contrat POST /tournaments/{id}/players
- [ ] T038 [P] [US2] Test contrat GET /tournaments/{id}/players
- [ ] T039 [P] [US2] Test d’intégration registration/anti-doublon
- [ ] T040 [P] [US2] Tests unitaires frontend PlayerRegistrationForm
- [ ] T041 [P] [US2] Test E2E inscription joueurs

### Implémentation User Story 2

- [ ] T042 [P] [US2] Modèle Player
- [ ] T043 [P] [US2] PlayerService avec anti-doublon
- [ ] T044 [US2] Endpoint POST /tournaments/{id}/players
- [ ] T045 [US2] Endpoint GET /tournaments/{id}/players
- [ ] T046 [US2] Validation anti-doublon
- [ ] T047 [P] [US2] Composant PlayerRegistrationForm
- [ ] T048 [P] [US2] Composant SkillLevelSelector
- [ ] T049 [P] [US2] Affichage liste joueurs
- [ ] T050 [US2] Validation formulaire joueur
- [ ] T051 [US2] Intégration API joueur
- [ ] T052 [US2] Logs inscription joueur

**Checkpoint** : User Stories 1 et 2 fonctionnelles

---

## Phase 5 : User Story 3 - Affectation poules (P3)

**But** : seeding automatique selon niveaux

**Test indépendant** : seeding équilibré, bye géré

### Tests pour User Story 3 ⚠️

- [ ] T053 [P] [US3] Test contrat POST /tournaments/{id}/pool-assignment
- [ ] T054 [P] [US3] Test unitaire algo de distribution
- [ ] T055 [P] [US3] Test d’intégration pool assignment
- [ ] T056 [P] [US3] Tests unitaires frontend PoolAssignment
- [ ] T057 [P] [US3] Test E2E pool assignment

### Implémentation User Story 3

- [ ] T058 [P] [US3] Modèle PoolStage
- [ ] T059 [P] [US3] Modèle Pool
- [ ] T060 [P] [US3] Algorithme de distribution
- [ ] T061 [US3] PoolAssignmentService
- [ ] T062 [US3] Endpoint POST /tournaments/{id}/pool-assignment
- [ ] T063 [US3] Gestion des byes
- [ ] T064 [P] [US3] Composant PoolAssignment
- [ ] T065 [P] [US3] Composant PoolPreview
- [ ] T066 [US3] Ajustement manuel des pools
- [ ] T067 [US3] Intégration API pool assignment
- [ ] T068 [US3] Logs assignment

**Checkpoint** : User Stories 1-3 fonctionnelles

---

## Phase 6 : User Story 4 - Gestion temps réel (P4)

**But** : scores temps réel, disponibilité cibles, progression auto

**Test indépendant** : score temps réel, affectations, standings

### Tests pour User Story 4 ⚠️

- [ ] T069 [P] [US4] Test contrat PUT /matches/{id}/score
- [ ] T070 [P] [US4] Test contrat GET /tournaments/{id}/targets/available
- [ ] T071 [P] [US4] Test WebSocket scores
- [ ] T072 [P] [US4] Tests unitaires MatchScoreEntry
- [ ] T073 [P] [US4] Test E2E match management

### Implémentation User Story 4

- [ ] T074 [P] [US4] Modèle Match
- [ ] T075 [P] [US4] Modèle Target
- [ ] T076 [P] [US4] MatchService temps réel
- [ ] T077 [US4] Endpoint PUT /matches/{id}/score
- [ ] T078 [US4] Endpoint GET /tournaments/{id}/targets/available
- [ ] T079 [US4] Progression automatique
- [ ] T080 [US4] Événements WebSocket (websocket-events.md)
- [ ] T081 [P] [US4] Composant MatchScoreEntry
- [ ] T082 [P] [US4] Composant TargetStatus
- [ ] T083 [P] [US4] Composant TournamentStandings
- [ ] T084 [US4] Hook WebSocket client
- [ ] T085 [US4] Intégration API matches
- [ ] T086 [US4] Logs match completion

**Checkpoint** : User Stories 1-4 fonctionnelles

---

## Phase 7 : User Story 5 - Génération d’agenda (P5)

**But** : agenda chronologique partageable

**Test indépendant** : agenda respecte les contraintes et se partage

### Tests pour User Story 5 ⚠️

- [ ] T087 [P] [US5] Test contrat POST /tournaments/{id}/schedule
- [ ] T088 [P] [US5] Test unitaire algo scheduling
- [ ] T089 [P] [US5] Test d’intégration schedule generation
- [ ] T090 [P] [US5] Tests unitaires ScheduleDisplay
- [ ] T091 [P] [US5] Test E2E schedule generation

### Implémentation User Story 5

- [ ] T092 [P] [US5] Modèle Schedule
- [ ] T093 [P] [US5] Modèle ScheduledMatch
- [ ] T094 [P] [US5] Algorithme de scheduling
- [ ] T095 [US5] ScheduleService
- [ ] T096 [US5] Endpoint POST /tournaments/{id}/schedule
- [ ] T097 [US5] Validation contraintes durée
- [ ] T098 [P] [US5] Composant ScheduleDisplay
- [ ] T099 [P] [US5] Partage d’agenda
- [ ] T100 [P] [US5] Vue agenda joueur
- [ ] T101 [US5] Export agenda (PDF/CSV)
- [ ] T102 [US5] Intégration API schedule
- [ ] T103 [US5] Logs + monitoring perf

**Checkpoint** : toutes les user stories fonctionnelles

---

## Phase 8 : Finitions & transversal

**But** : améliorations cross-cutting

- [ ] T104 [P] Documentation API via Swagger
- [ ] T105 [P] Monitoring perf dans backend/src/middleware/performance.ts
- [ ] T106 [P] Accessibilité WCAG 2.1 AA
- [ ] T107 [P] Documentation utilisateur docs/user-guide.md
- [ ] T108 Refactor & cleanup
- [ ] T109 [P] Error boundaries React
- [ ] T110 [P] Backup & recovery
- [ ] T111 Audit sécurité
- [ ] T112 Optimisation perf (<2s)
- [ ] T113 [P] Dashboards logs/monitoring
- [ ] T114 Validation quickstart.md

---

## Dépendances & ordre d’exécution

### Dépendances par phase

- **Phase 1** : aucun prérequis
- **Phase 2** : dépend de Phase 1
- **Phase 3-7** : dépend de Phase 2
- **Phase 8** : dépend des user stories souhaitées

### Dépendances par user story

- **US1** : après Phase 2, pas de dépendance
- **US2** : après Phase 2, indépendant
- **US3** : après Phase 2, requiert Player
- **US4** : après Phase 2, requiert Match/Target
- **US5** : après Phase 2, requiert Match

### À l’intérieur d’une user story

- Tests d’abord, ils doivent échouer
- Modèles avant services
- Services avant endpoints
- Endpoints avant composants frontend
- Implémentation avant intégration

### Opportunités de parallélisme

- Toutes les tâches [P] peuvent être parallélisées
- Après Phase 2, les user stories peuvent démarrer en parallèle
- Tests [P] peuvent être écrits en parallèle
- Composants frontend [P] parallèles au backend

---

## Exemple de parallélisme : User Story 1

```bash
# Lancer les tests en parallèle :
Task: "Contract test for POST /tournaments endpoint in backend/tests/contract/tournament.test.ts"
Task: "Frontend unit tests for TournamentForm component in frontend/tests/components/TournamentForm.test.tsx"
Task: "Integration test for tournament creation workflow in backend/tests/integration/tournament-creation.test.ts"

# Lancer les modèles en parallèle :
Task: "Create Tournament model with validation per data-model.md in backend/src/models/Tournament.ts"
Task: "Create TournamentService with creation logic in backend/src/services/TournamentService.ts"

# Composants frontend en parallèle :
Task: "Create TournamentForm React component in frontend/src/components/TournamentForm.tsx"
Task: "Create logo upload UI component in frontend/src/components/LogoUpload.tsx"
```

---

## Stratégie d’implémentation

### MVP d’abord (User Story 1)

1. Phase 1 : Setup (T001-T010)
2. Phase 2 : Fondations (T011-T020)
3. Phase 3 : User Story 1 (T021-T036)
4. **STOP et VALIDATION** : tester US1
5. Déployer/démontrer création de tournoi

### Livraison incrémentale

1. Setup + Fondations
2. US1 → tester → déployer
3. US2 → tester → déployer
4. US3 → tester → déployer
5. US4 → tester → déployer
6. US5 → tester → déployer

### Stratégie équipe parallèle

1. Team complète Setup + Fondations
2. Après fondations :
   - Dev A : US1
   - Dev B : US2
   - Dev C : US3
   - Dev D : US4
   - Dev E : US5
3. Intégration indépendante

---

## Résumé

- **Total tâches** : 114
- **Répartition** :
  - Setup (Phase 1) : 10
  - Fondations (Phase 2) : 10
  - US1 : 16
  - US2 : 16
  - US3 : 16
  - US4 : 18
  - US5 : 17
  - Finitions : 11
- **Parallélisme** : 47 tâches [P]
- **Tests indépendants** : chaque user story a des scénarios d’acceptation
- **MVP** : User Story 1
- **TDD** : tests avant implémentation

---

## Notes

- Tâches [P] = parallélisables
- US1-US5 = traçabilité
- Tests doivent échouer avant implémentation
- Commit après chaque tâche ou groupe
- S’arrêter à chaque checkpoint
- Flux temps réel via WebSocket
- Objectif <2s pour updates temps réel
