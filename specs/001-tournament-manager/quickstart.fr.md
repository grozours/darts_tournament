# Démarrage rapide : Gestionnaire de Tournois de Fléchettes

**Généré** : 2026-02-03  
**But** : Guide rapide de setup et validation

## Setup développement

### Prérequis
```bash
# Logiciels requis
node --version  # v20.x LTS requis
npm --version   # v10.x requis
docker --version # Pour PostgreSQL et Redis
git --version   # Version control
```

### Setup initial
```bash
# Cloner et préparer le projet
git clone <repository-url>
cd darts-tournament-manager

# Installation en une commande (recommandé)
./install.sh

# Ou installation manuelle
# npm install

# Configurer l’environnement
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Éditer les deux fichiers .env (DB + Auth0)

# Valeurs Auth0 requises
# backend/.env:
# AUTH_ISSUER_BASE_URL=https://your-tenant.eu.auth0.com
# AUTH_AUDIENCE=https://api.yourdomain.com
# frontend/.env:
# VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
# VITE_AUTH0_CLIENT_ID=your_client_id
# VITE_AUTH0_AUDIENCE=https://api.yourdomain.com

# Démarrer les services DB
docker-compose up -d postgres redis

# Migrations DB
npm run db:migrate

# Démarrer les serveurs
./restart.sh both
```

### Gestion des services
```bash
# Démarrer individuellement
./restart.sh backend
./restart.sh frontend

# Arrêter
./restart.sh stop

# Statut
./restart.sh status

# Logs
./restart.sh logs backend
./restart.sh logs frontend
```

### Structure du projet
```
backend/
├── src/
│   ├── models/          # Modèles (Prisma)
│   ├── services/        # Logique métier
│   ├── api/            # Routes
│   └── websocket/      # Handlers Socket.io
├── tests/              # Tests
└── prisma/             # Schéma & migrations

frontend/
├── src/
│   ├── components/     # Composants React
│   ├── pages/         # Pages
│   ├── services/      # Client API et WebSocket
│   └── hooks/         # Hooks custom
└── tests/             # Tests frontend
```

## Validation rapide

### 1. Création de tournoi (5 minutes)

**Test via API :**
```bash
# Créer un tournoi
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

**Test via frontend :**
1. Aller sur http://localhost:5173
2. Cliquer "Create Tournament"
3. Remplir le formulaire
4. Vérifier que le tournoi apparaît

**Résultats attendus :**
- ✅ Tournoi créé avec ID unique
- ✅ Données en base
- ✅ Tournoi visible dans l’UI

### 2. Inscription joueurs (3 minutes)

**Test API joueurs :**
```bash
TOURNAMENT_ID="<id-from-step-1>"

# Inscrire des joueurs
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

**Résultats attendus :**
- ✅ 16 joueurs enregistrés
- ✅ Aucun doublon
- ✅ Joueurs visibles dans l’UI

### 3. Seeding poules (2 minutes)

**Test seeding :**
```bash
# Déclencher le seeding
curl -X POST http://localhost:3000/api/tournaments/${TOURNAMENT_ID}/pools/seed
```

**Résultats attendus :**
- ✅ Répartition sur 4 poules
- ✅ 4 joueurs par poule
- ✅ Visible dans l’UI

### 4. Temps réel (3 minutes)

**Test WebSocket :**
```javascript
// Console navigateur
const socket = io('http://localhost:3000');
socket.emit('join_tournament', { tournament_id: 'TOURNAMENT_ID' });
socket.on('tournament_joined', (data) => console.log('Joined:', data));
```

**Test saisie score :**
```bash
# Récupérer un match
MATCH_ID=$(curl -s http://localhost:3000/api/tournaments/${TOURNAMENT_ID}/matches | jq -r '.matches[0].id')

# Saisir un score
curl -X POST http://localhost:3000/api/tournaments/${TOURNAMENT_ID}/matches/${MATCH_ID}/score \
  -H "Content-Type: application/json" \
  -d '{
    "participant_1_score": 501,
    "participant_2_score": 387
  }'
```

**Résultats attendus :**
- ✅ Événements WebSocket reçus
- ✅ UI mise à jour
- ✅ Disponibilité cible mise à jour
- ✅ Classements mis à jour

### 5. Upload fichier (2 minutes)

**Test upload logo :**
```bash
# Créer une image (imagemagick requis)
convert -size 200x200 xc:blue test-logo.png

# Upload logo
curl -X POST http://localhost:3000/api/tournaments/${TOURNAMENT_ID}/logo \
  -F "logo=@test-logo.png"
```

**Résultats attendus :**
- ✅ Upload réussi
- ✅ Validation taille
- ✅ Logo affiché

## Vérification des performances

### Performance DB
```bash
# Lancer avec données de test
npm run test:performance

# Vérifier les temps d’exécution
npm run db:analyze
```

**Cibles :**
- Création tournoi : < 2s
- Inscription joueur : < 500ms
- Saisie score : < 1s
- Calcul classement : < 2s

### Performance temps réel
```javascript
// Test frontend
console.time('score-update');
// Entrer un score via UI
// Mesurer jusqu’à la mise à jour
console.timeEnd('score-update'); // < 2000ms
```

## Problèmes fréquents

### Problèmes de connexion DB
```bash
# Vérifier DB
docker-compose ps

# Logs
docker-compose logs postgres

# Reset DB
npm run db:reset
```

### Problèmes WebSocket
```bash
# Vérifier la connexion Socket.io
curl http://localhost:3000/socket.io/?transport=polling

# Logs debug Socket.io
npm run dev:debug
```

### Problèmes d’upload
```bash
# Vérifier permissions uploads
ls -la uploads/
mkdir -p uploads/logos
chmod 755 uploads/logos

# Tester limite taille
dd if=/dev/zero of=test-large.png bs=1M count=6  # Doit échouer
```

## Exécution de la suite de tests

### Lancer tous les tests
```bash
# Tests backend
cd backend && npm test

# Tests frontend  
cd frontend && npm test

# Tests end-to-end
npm run test:e2e

# Tests performance
npm run test:performance
```

### Exemple workflow TDD
```bash
# 1. Écrire un test qui échoue
npm test -- --watch tournament.test.js

# 2. Lancer un test spécifique
npm test -- tournament.test.js -t "should create tournament with pools"

# 3. Implémenter
# Edit src/services/tournamentService.js

# 4. Voir le test passer
```

## Checklist readiness production

### Qualité de code
- [ ] Tous les tests passent
- [ ] ESLint sans erreurs
- [ ] TypeScript compile proprement
- [ ] Couverture > 80%

### Performance
- [ ] Génération agenda < 30s pour 128 participants
- [ ] Updates temps réel < 2s
- [ ] Disponibilité cible < 1s
- [ ] Requêtes DB optimisées

### Sécurité
- [ ] Validation upload OK
- [ ] Rate limiting configuré
- [ ] Validation inputs OK
- [ ] CORS configuré

### Accessibilité
- [ ] WCAG 2.1 AA vérifié
- [ ] Navigation clavier OK
- [ ] Lecteur d’écran OK
- [ ] Contraste validé

## Prochaines étapes

1. **Lancer la suite complète** : `npm run test:all`
2. **Benchmark perf** : `npm run benchmark`
3. **Générer la doc API** : `npm run docs:api`
4. **Configurer CI/CD** : GitHub Actions
5. **Déployer en staging** : suivre le guide de déploiement

Pour plus d’informations :
- [Architecture](../../docs/ARCHITECTURE.fr.md)
- [Documentation API](../../docs/API.fr.md)
- [Stratégie de tests](../../docs/TESTING.fr.md)
