# Modèle de données : Gestionnaire de Tournois de Fléchettes

**Généré** : 2026-02-03  
**But** : Définir les relations et structures de données

## Entités principales

### Tournament

**But** : Représente la configuration et l’état d’un tournoi

**Attributs** :
- `id: string` (UUID, clé primaire)
- `name: string` (nom affiché)
- `logo_url: string?` (chemin du logo)
- `format: enum` (single, double, team_4_player)
- `duration_type: enum` (half_day_morning, half_day_afternoon, half_day_night, full_day, two_day)
- `start_time: datetime` (heure de début)
- `end_time: datetime` (heure de fin)
- `total_participants: integer` (nombre de joueurs/équipes)
- `target_count: integer` (nombre de cibles)
- `status: enum` (draft, open, signature, live, finished)
- `created_at: datetime`
- `completed_at: datetime?`
- `historical_flag: boolean` (marque les tournois terminés)

**Relations** :
- A plusieurs PoolStages
- A plusieurs Brackets
- A plusieurs Players (via participation)
- A plusieurs Matches
- A un Schedule

**Règles de validation** :
- name : 3-100 caractères
- total_participants : 2-128
- target_count : 1-32
- end_time > start_time

### Player

**But** : Représente un participant avec niveau

**Attributs** :
- `id: string` (UUID, clé primaire)
- `tournament_id: string` (clé étrangère)
- `firstname: string`
- `lastname: string`
- `surname: string?` (pseudo)
- `team_name: string?` (formats équipe)
- `mobile_phone: string`
- `skill_level: enum` (novice, intermediate, advanced, expert)
- `registration_order: integer` (ordre d’inscription)
- `created_at: datetime`

**Relations** :
- Appartient à Tournament
- Appartient à Team (optionnel)
- Participe à plusieurs Pools
- Participe à plusieurs Brackets
- Participe à plusieurs Matches

**Règles de validation** :
- firstname : 1-50 caractères, requis
- lastname : 1-50 caractères, requis
- mobile_phone : format téléphone valide
- skill_level : requis pour le seeding

### Team

**But** : Groupe de joueurs pour formats doubles/équipe

**Attributs** :
- `id: string` (UUID, clé primaire)
- `tournament_id: string` (clé étrangère)
- `name: string` (nom d’équipe)
- `derived_skill_level: enum` (calculé)
- `member_count: integer` (2 ou 4)
- `created_at: datetime`

**Relations** :
- Appartient à Tournament
- A plusieurs Players
- Participe aux Pools et Brackets

**Règles de validation** :
- name : 2-50 caractères, unique par tournoi
- member_count : doit correspondre au format

### PoolStage

**But** : Définit une phase de poules

**Attributs** :
- `id: string` (UUID, clé primaire)
- `tournament_id: string` (clé étrangère)
- `stage_number: integer` (1, 2, 3...)
- `pool_count: integer`
- `participants_per_pool: integer`
- `rounds_per_match: integer` (legs en poules)
- `advancement_count: integer` (qualifiés par poule)

**Relations** :
- Appartient à Tournament
- A plusieurs Pools

**Règles de validation** :
- stage_number : séquentiel, débute à 1
- pool_count : 1-16
- participants_per_pool : 2-16

### Pool

**But** : Représente une poule

**Attributs** :
- `id: string` (UUID, clé primaire)
- `pool_stage_id: string` (clé étrangère)
- `pool_number: integer` (A=1, B=2, etc.)
- `seeded: boolean`
- `status: enum` (pending, in_progress, completed)

**Relations** :
- Appartient à PoolStage
- A plusieurs PoolAssignments
- A plusieurs Matches

### Bracket

**But** : Représente les tableaux d’élimination

**Attributs** :
- `id: string` (UUID, clé primaire)
- `tournament_id: string` (clé étrangère)
- `bracket_type: enum` (winner, loser)
- `size: integer` (8, 16, 32, 64)
- `rounds_per_match: integer`
- `current_round: integer`
- `status: enum` (pending, in_progress, completed)

**Relations** :
- Appartient à Tournament
- A plusieurs Bracket Positions
- A plusieurs Matches

### Match

**But** : Représente un match

**Attributs** :
- `id: string` (UUID, clé primaire)
- `tournament_id: string` (clé étrangère)
- `match_type: enum` (pool, bracket)
- `stage_reference: string` (pool_id ou bracket_id)
- `participant_1_id: string` (player ou team)
- `participant_2_id: string` (player ou team)
- `participant_1_score: integer?`
- `participant_2_score: integer?`
- `winner_id: string?`
- `scheduled_time: datetime?`
- `target_number: integer?`
- `status: enum` (scheduled, in_progress, completed, cancelled)
- `completed_at: datetime?`

**Relations** :
- Appartient à Tournament
- Référence des participants
- Assigné à Target

**Règles de validation** :
- scores : 0-999, gagnant par score
- target_number : 1 à tournament.target_count

### Target

**But** : Représente une cible (dartboard)

**Attributs** :
- `id: string` (UUID, clé primaire)
- `tournament_id: string` (clé étrangère)
- `target_number: integer`
- `current_match_id: string?`
- `availability_status: enum` (available, occupied, maintenance)
- `last_match_completed: datetime?`

**Relations** :
- Appartient à Tournament
- A un match courant
- Historique des matchs

### Schedule

**But** : Organisation chronologique des matchs

**Attributs** :
- `id: string` (UUID, clé primaire)
- `tournament_id: string` (clé étrangère)
- `generated_at: datetime`
- `total_estimated_duration: integer` (minutes)
- `sharing_enabled: boolean`
- `sharing_url: string?`

**Relations** :
- Appartient à Tournament
- Référence tous les matchs avec horaires

### Score

**But** : Détail des scores et audit

**Attributs** :
- `id: string` (UUID, clé primaire)
- `match_id: string` (clé étrangère)
- `participant_1_score: integer`
- `participant_2_score: integer`
- `entered_at: datetime`
- `entered_by_ip: string` (audit sans auth)
- `is_final: boolean`

**Relations** :
- Appartient à Match
- Audit des changements de scores

## Résumé des relations

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

## Patterns de flux de données

### Flux de création de tournoi

1. Création de l’entité Tournament
2. Création des PoolStage selon structure
3. Création des Bracket si configurés
4. Création des Target selon target_count
5. Initialisation du Schedule (vide)

### Flux d’inscription des joueurs

1. Création du Player avec validation
2. Création Team si format équipe
3. Seeding auto lorsqu’un seuil est atteint
4. Création des assignations de poules

### Flux d’exécution des matchs

1. Match planifié avec target
2. Target devient occupée
3. Création de Score pour audit
4. Match terminé → target disponible
5. Recalcul des classements
6. Assignation des prochains matchs

### Événements temps réel

- Saisie score → mise à jour classement
- Match terminé → disponibilité cible
- Cible libre → prochain match assigné
- Progression tableau → agenda mis à jour

## Considérations de performance

### Stratégie d’indexation

```sql
-- Index principaux
CREATE INDEX idx_tournament_status ON tournaments(status);
CREATE INDEX idx_player_tournament ON players(tournament_id);
CREATE INDEX idx_match_tournament_status ON matches(tournament_id, status);
CREATE INDEX idx_target_tournament_availability ON targets(tournament_id, availability_status);

-- Optimisation temps réel
CREATE INDEX idx_match_scheduled_time ON matches(scheduled_time) WHERE status = 'scheduled';
CREATE INDEX idx_score_match_final ON scores(match_id) WHERE is_final = true;
```

### Stratégie d’archivage

- Tournois terminés : `historical_flag = true`
- Conservation permanente (exigence)
- Filtres pour données actives
- Index dédiés pour analyse historique
