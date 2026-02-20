# 📚 Index de la documentation

Bienvenue dans la documentation du Gestionnaire de Tournois de Fléchettes. Cet index vous aide à trouver rapidement l’information utile.

---

## 🚀 Démarrage rapide

**Nouveau sur le projet ?** Commencez ici :

1. **[README](../README.fr.md)** - Présentation et démarrage rapide
2. **[Installation](#installation)** - Lancer le projet en local
3. **[Référence des commandes](./COMMANDS.fr.md)** - Commandes essentielles

---

## 📄 Sommaire des fichiers Markdown

### Racine
- [README.md](../README.md)
- [README.fr.md](../README.fr.md)
- [LICENSE](../LICENSE)

### Docs
- [docs/ADMIN_GUIDE.fr.md](./ADMIN_GUIDE.fr.md)
- [docs/PLAYER_GUIDE.fr.md](./PLAYER_GUIDE.fr.md)
- [docs/COMMANDS.md](./COMMANDS.md)
- [docs/COMMANDS.fr.md](./COMMANDS.fr.md)
- [docs/DEPLOYMENT.md](./DEPLOYMENT.md)
- [docs/DEPLOYMENT.fr.md](./DEPLOYMENT.fr.md)
- [docs/FRONTEND.md](./FRONTEND.md)
- [docs/FRONTEND.fr.md](./FRONTEND.fr.md)
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/ARCHITECTURE.fr.md](./ARCHITECTURE.fr.md)
- [docs/API.md](./API.md)
- [docs/API.fr.md](./API.fr.md)
- [docs/TESTING.md](./TESTING.md)
- [docs/TESTING.fr.md](./TESTING.fr.md)
- [docs/ADMIN_SETUP.md](./ADMIN_SETUP.md)
- [docs/ADMIN_SETUP.fr.md](./ADMIN_SETUP.fr.md)
- [docs/AUTH0_EMAIL_SETUP.md](./AUTH0_EMAIL_SETUP.md)
- [docs/AUTH0_EMAIL_SETUP.fr.md](./AUTH0_EMAIL_SETUP.fr.md)
- [docs/README.md](./README.md)
- [docs/README.fr.md](./README.fr.md)

### Specs
- [specs/001-tournament-manager/spec.md](../specs/001-tournament-manager/spec.md)
- [specs/001-tournament-manager/spec.fr.md](../specs/001-tournament-manager/spec.fr.md)
- [specs/001-tournament-manager/plan.md](../specs/001-tournament-manager/plan.md)
- [specs/001-tournament-manager/plan.fr.md](../specs/001-tournament-manager/plan.fr.md)
- [specs/001-tournament-manager/quickstart.md](../specs/001-tournament-manager/quickstart.md)
- [specs/001-tournament-manager/quickstart.fr.md](../specs/001-tournament-manager/quickstart.fr.md)
- [specs/001-tournament-manager/data-model.md](../specs/001-tournament-manager/data-model.md)
- [specs/001-tournament-manager/data-model.fr.md](../specs/001-tournament-manager/data-model.fr.md)
- [specs/001-tournament-manager/research.md](../specs/001-tournament-manager/research.md)
- [specs/001-tournament-manager/research.fr.md](../specs/001-tournament-manager/research.fr.md)
- [specs/001-tournament-manager/tasks.md](../specs/001-tournament-manager/tasks.md)
- [specs/001-tournament-manager/tasks.fr.md](../specs/001-tournament-manager/tasks.fr.md)

---

## 📖 Documentation principale

### Pour les développeurs

| Document | Description | Quand l’utiliser |
|----------|-------------|-----------------|
| **[Architecture](./ARCHITECTURE.fr.md)** | Design système, patterns, flux de données | Comprendre le fonctionnement, décisions d’architecture |
| **[Documentation API](./API.fr.md)** | Référence REST complète | Intégration backend, endpoints |
| **[Guide Frontend](./FRONTEND.fr.md)** | Architecture React et composants | Développer l’UI, patterns frontend |
| **[Tests](./TESTING.fr.md)** | Stratégie et exemples | Écrire des tests, objectifs de couverture |
| **[Référence des commandes](./COMMANDS.fr.md)** | Toutes les commandes | Tâches quotidiennes, dépannage |

### Pour DevOps / Déploiement

| Document | Description | Quand l’utiliser |
|----------|-------------|-----------------|
| **[Guide de déploiement](./DEPLOYMENT.fr.md)** | Déploiement production | Serveurs, cloud, Docker |
| **[Configuration admin](./ADMIN_SETUP.fr.md)** | Configuration authentification admin | Mise en place des admins |
| **[Configuration email Auth0](./AUTH0_EMAIL_SETUP.fr.md)** | Claim email Auth0 | Configurer l’authentification |

---

## 🎯 Par tâche

### Je veux...

#### Démarrer
- **Installer le projet en local** → [Démarrage rapide](../README.fr.md#-démarrage-rapide)
- **Comprendre la structure du projet** → [Architecture : Structure](./ARCHITECTURE.fr.md#structure-des-dossiers)
- **Lancer le serveur de développement** → [Commandes : Développement](./COMMANDS.fr.md#commandes-de-développement)

#### Développement
- **Créer une fonctionnalité** → [Architecture](./ARCHITECTURE.fr.md) + [Tests](./TESTING.fr.md)
- **Ajouter un endpoint API** → [Documentation API](./API.fr.md) + [Structure backend](./ARCHITECTURE.fr.md#architecture-backend)
- **Construire un composant** → [Guide Frontend](./FRONTEND.fr.md) + [Architecture des composants](./FRONTEND.fr.md#architecture-des-composants)
- **Écrire des tests** → [Documentation tests](./TESTING.fr.md)

#### Base de données
- **Lancer les migrations** → [Commandes : Base de données](./COMMANDS.fr.md#commandes-base-de-données)
- **Peupler des données de test** → [Commandes : Seeding](./COMMANDS.fr.md#seeding)
- **Comprendre le schéma** → [Architecture : Schéma BD](./ARCHITECTURE.fr.md#schéma-de-base-de-données)
- **Sauvegarder la base** → [Déploiement : Base de données](./DEPLOYMENT.fr.md#configuration-de-la-base-de-données)

#### Intégration API
- **Lister les endpoints** → [Documentation API](./API.fr.md)
- **Comprendre l’authentification** → [API : Authentification](./API.fr.md#authentification) + [Configuration admin](./ADMIN_SETUP.fr.md)
- **Gérer les erreurs** → [API : Validation et erreurs](./API.fr.md#validation--erreurs)
- **Utiliser les WebSockets** → [API : Événements WebSocket](./API.fr.md#événements-websocket)

#### Déploiement
- **Déployer en production** → [Guide de déploiement](./DEPLOYMENT.fr.md)
- **Utiliser Docker** → [Déploiement Docker](./DEPLOYMENT.fr.md#déploiement-docker)
- **Déployer sur AWS/DigitalOcean** → [Déploiement cloud](./DEPLOYMENT.fr.md#déploiement-cloud)
- **Mettre en place le monitoring** → [Déploiement : Monitoring](./DEPLOYMENT.fr.md#monitoring--maintenance)

#### Dépannage
- **Déboguer** → [Commandes : Dépannage](./COMMANDS.fr.md#dépannage)
- **Consulter les logs** → [Commandes : Logs](./COMMANDS.fr.md#gestion-des-logs)
- **Problèmes de performance** → [Déploiement : Dépannage](./DEPLOYMENT.fr.md#dépannage)

---

## 📁 Documentation par composant

### Backend

- **Architecture** → [Architecture backend](./ARCHITECTURE.fr.md#architecture-backend)
- **Endpoints API** → [Documentation API](./API.fr.md)
- **Schéma BD** → [Schéma BD](./ARCHITECTURE.fr.md#schéma-de-base-de-données)
- **Authentification** → [Flux d’authentification](./ARCHITECTURE.fr.md#authentification--autorisation)
- **WebSockets** → [Communication temps réel](./ARCHITECTURE.fr.md#communication-temps-réel)
- **Tests** → [Tests backend](./TESTING.fr.md#tests-backend)

### Frontend

- **Architecture** → [Architecture frontend](./FRONTEND.fr.md#architecture-des-composants)
- **Routing** → [Stratégie de routing](./FRONTEND.fr.md#stratégie-de-routing)
- **Composants** → [Composants principaux](./FRONTEND.fr.md#composants-principaux)
- **State management** → [Gestion d’état](./FRONTEND.fr.md#gestion-de-l-état)
- **Authentification** → [Flux d’authentification](./FRONTEND.fr.md#flux-d-authentification)
- **Tests** → [Tests frontend](./TESTING.fr.md#tests-frontend)

### Base de données

- **Conception du schéma** → [Schéma BD](./ARCHITECTURE.fr.md#schéma-de-base-de-données)
- **Migrations** → [Commandes BD](./COMMANDS.fr.md#migrations)
- **Seeding** → [Commandes BD](./COMMANDS.fr.md#seeding)
- **Backup/Restore** → [Administration BD](./COMMANDS.fr.md#administration-base-de-données)

### DevOps

- **Déploiement production** → [Guide de déploiement](./DEPLOYMENT.fr.md#déploiement-production)
- **Configuration Docker** → [Déploiement Docker](./DEPLOYMENT.fr.md#déploiement-docker)
- **CI/CD** → [Intégration CI/CD](./TESTING.fr.md#intégration-cicd)
- **Monitoring** → [Monitoring & maintenance](./DEPLOYMENT.fr.md#monitoring--maintenance)

---

## 🔍 Recherche par sujet

### Stack technique

- **React** → [Guide Frontend](./FRONTEND.fr.md), [Stack technique](../README.fr.md#-stack-technique)
- **Node.js/Express** → [Architecture backend](./ARCHITECTURE.fr.md#architecture-backend)
- **TypeScript** → Toute la documentation
- **PostgreSQL** → [Schéma BD](./ARCHITECTURE.fr.md#schéma-de-base-de-données)
- **Prisma** → [Commandes BD](./COMMANDS.fr.md#commandes-base-de-données)
- **Redis** → [Architecture : Redis](./ARCHITECTURE.fr.md#architecture-backend)
- **Auth0** → [Configuration admin](./ADMIN_SETUP.fr.md), [Configuration Auth0](./AUTH0_EMAIL_SETUP.fr.md)
- **Docker** → [Déploiement Docker](./DEPLOYMENT.fr.md#déploiement-docker)
- **WebSocket (Socket.io)** → [Fonctionnalités temps réel](./ARCHITECTURE.fr.md#communication-temps-réel)

### Fonctionnalités

- **Tournois** → [API : Tournois](./API.fr.md#tournois)
- **Joueurs** → [API : Joueurs](./API.fr.md#joueurs)
- **Phases de poules** → [API : Phases de poules](./API.fr.md#phases-de-poules)
- **Tableaux** → [API : Tableaux](./API.fr.md#tableaux)
- **Matchs** → [API : Matchs](./API.fr.md#matchs)
- **Cibles** → [Frontend : TargetsView](./FRONTEND.fr.md#composants-principaux)
- **Authentification** → [Configuration admin](./ADMIN_SETUP.fr.md)
- **Mises à jour temps réel** → [Événements WebSocket](./API.fr.md#événements-websocket)

---

## 📚 Spécifications

Documents de spécification et planification :

| Document | Description |
|----------|-------------|
| [spec.fr.md](../specs/001-tournament-manager/spec.fr.md) | User stories et exigences |
| [plan.fr.md](../specs/001-tournament-manager/plan.fr.md) | Plan d’implémentation |
| [data-model.fr.md](../specs/001-tournament-manager/data-model.fr.md) | Schéma BD |
| [research.fr.md](../specs/001-tournament-manager/research.fr.md) | Recherche technique |
| [quickstart.fr.md](../specs/001-tournament-manager/quickstart.fr.md) | Scénarios de test |
| [tasks.fr.md](../specs/001-tournament-manager/tasks.fr.md) | Tâches de développement |

---

## 🎓 Parcours d’apprentissage

### Débutant (nouveau sur le projet)

1. Lire [README](../README.fr.md)
2. Suivre [Démarrage rapide](../README.fr.md#-démarrage-rapide)
3. Consulter [Commandes](./COMMANDS.fr.md)
4. Explorer [Documentation API](./API.fr.md)

### Intermédiaire (développement de fonctionnalités)

1. Étudier [Architecture](./ARCHITECTURE.fr.md)
2. Lire [Guide Frontend](./FRONTEND.fr.md)
3. Consulter [Tests](./TESTING.fr.md)
4. Suivre [Workflow de développement](#développement)

### Avancé (production & optimisation)

1. Étudier [Guide de déploiement](./DEPLOYMENT.fr.md)
2. Revoir [Optimisations de performance](./ARCHITECTURE.fr.md#optimisations-de-performance)
3. Comprendre [Sécurité](./DEPLOYMENT.fr.md#checklist-de-sécurité)
4. Mettre en place [Monitoring](./DEPLOYMENT.fr.md#monitoring--maintenance)

---

## 🔗 Ressources externes

### Documentation officielle

- [Node.js Documentation](https://nodejs.org/docs/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

### Tests

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)

### DevOps

- [Docker Documentation](https://docs.docker.com/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

## 💡 Conseils

### Quick wins

- **Utiliser le script restart** : `./restart.sh both` gère tout
- **Laisser Prisma Studio ouvert** : `npm run db:studio` pour naviguer dans la BD
- **Surveiller les logs** : `./restart.sh logs backend` pour le debug
- **Utiliser les exemples** : la documentation contient des snippets prêts à copier

### Pièges courants

- **Client Prisma désynchronisé** : lancer `npx prisma generate` après modification du schéma
- **Conflits de ports** : `./restart.sh stop` avant de redémarrer
- **Variables d’environnement** : vérifier les `.env` si ça ne marche pas
- **Migrations** : exécuter `npm run db:migrate` après un pull

---

## 🤝 Contribuer

Lors des contributions à la doc :

1. Rester concis et pratique
2. Ajouter des exemples
3. Mettre à jour cet index
4. Respecter le format Markdown
5. Tester les commandes documentées

---

## 📝 Licence

Ce projet est sous licence MIT. Voir [LICENSE](../LICENSE).

---

**Besoin d’aide ?** Consultez [Dépannage](./COMMANDS.fr.md#dépannage) ou la doc ci-dessus.

**Bon code ! 🎯**
