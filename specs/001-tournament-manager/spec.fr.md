# Spécification Fonctionnelle : Gestionnaire de Tournois de Fléchettes

**Branche** : `001-tournament-manager`  
**Créé** : 2026-02-03  
**Statut** : Draft  
**Input** : Description utilisateur : "Créer une application pour gérer un tournoi de fléchettes. Création de tournoi : nom, visuels/logos, nombre de joueurs/équipes, cibles, phases de poules avec nombre de poules configurable, winner/loser brackets avec tailles configurables, durée (demi/journée complète/deux jours) avec heures de début/fin, vue agenda, configuration des tours/legs. Gestion du tournoi : inscription des joueurs avec niveaux, seeding automatique des poules selon les niveaux, saisie des scores, affichage du prochain match sur cible libre, mises à jour temps réel des scores."

## Scénarios utilisateurs & tests *(obligatoire)*

## Clarifications

### Session 2026-02-03

- Q : Comment l’accès doit-il être contrôlé ? → R : OAuth (Google/Facebook) via Auth0 ; protéger les endpoints API
- Q : Que faire des données après la fin du tournoi ? → R : Conserver de façon permanente pour l’historique et les statistiques
- Q : Quels appareils doivent être supportés ? → R : Navigateur desktop uniquement
- Q : Quelle échelle de niveau ? → R : Catégories traditionnelles (Novice, Intermédiaire, Avancé, Expert)
- Q : Limites sur les logos ? → R : 5 Mo max, JPG/PNG uniquement

## Scénarios utilisateurs & tests *(obligatoire)*

<!--
  IMPORTANT : Les user stories doivent être PRIORISÉES par parcours utilisateur.
  Chaque user story doit être TESTABLE indépendamment.
  Assigner des priorités (P1, P2, P3...).
-->

### User Story 1 - Créer et configurer un tournoi (Priorité : P1)

En tant qu’organisateur, je veux créer un tournoi avec configuration complète : nom, branding visuel (logos), nombre de joueurs/équipes, nombre de cibles, structure détaillée des phases de poules (nombre de phases, poules par phase, joueurs par poule), configuration des winner/loser brackets avec tailles personnalisées, durée du tournoi (demi-journée avec créneaux, journée complète ou deux jours) avec heures de début/fin, et configuration des tours/legs, afin que le tournoi soit adapté à mon événement.

**Pourquoi cette priorité** : la configuration du tournoi est la base de toutes les opérations.

**Test indépendant** : créer des tournois avec configurations variées, téléverser des visuels, configurer poules/tableaux et valider les réglages.

**Scénarios d’acceptation** :
1. **Étant donné** qu’aucun tournoi n’existe, **quand** l’organisateur crée un tournoi avec nom, logo et configuration de base, **alors** le tournoi est créé avec le branding affiché.
2. **Étant donné** un tournoi en création, **quand** l’organisateur configure les phases de poules et tableaux, **alors** le système valide et enregistre la structure complète.
3. **Étant donné** une configuration de tournoi, **quand** l’organisateur définit la durée et les contraintes horaires, **alors** le système crée un cadre d’agenda prêt pour l’affectation des matchs.

---

### User Story 2 - Inscrire des joueurs avec niveau (Priorité : P2)

En tant qu’organisateur, je veux inscrire des joueurs avec informations complètes (prénom, nom, surnom, nom d’équipe, téléphone) et assigner un niveau, afin de suivre tous les participants et permettre un seeding équitable.

**Pourquoi cette priorité** : l’inscription et le niveau sont essentiels pour le seeding.

**Test indépendant** : enregistrer des joueurs avec différents niveaux, vérifier le stockage et la prévention des doublons.

**Scénarios d’acceptation** :
1. **Étant donné** un tournoi configuré, **quand** l’organisateur inscrit un joueur complet avec niveau, **alors** le joueur est ajouté avec niveau enregistré.
2. **Étant donné** des joueurs de niveaux différents, **quand** l’organisateur consulte la liste, **alors** les niveaux sont visibles et éditables.
3. **Étant donné** une inscription en cours, **quand** un doublon est détecté, **alors** le système empêche l’inscription et suggère l’entrée existante.

---

### User Story 3 - Affectation intelligente des poules (Priorité : P3)

En tant qu’organisateur, je veux que le système remplisse automatiquement les poules de la première phase en distribuant les joueurs selon leurs niveaux, afin de séparer les joueurs forts et garantir une compétition équilibrée.

**Pourquoi cette priorité** : un seeding équilibré améliore la qualité du tournoi.

**Test indépendant** : enregistrer des joueurs de niveaux variés, lancer l’assignation auto et vérifier la répartition.

**Scénarios d’acceptation** :
1. **Étant donné** des joueurs avec niveaux, **quand** l’assignation auto est lancée, **alors** la distribution équilibre la force des poules.
2. **Étant donné** des joueurs sans niveau, **quand** l’assignation auto s’exécute, **alors** la distribution est aléatoire mais équilibrée.
3. **Étant donné** un nombre impair de joueurs, **quand** l’assignation se fait, **alors** le système gère les byes correctement.

---

### User Story 4 - Gestion temps réel des matchs (Priorité : P4)

En tant qu’organisateur, je veux saisir les scores en temps réel, voir les cibles libres après un match, afficher les prochains matchs sur cibles libres, et mettre à jour automatiquement les classements, afin que le tournoi avance sans délai.

**Pourquoi cette priorité** : la gestion temps réel est essentielle au bon déroulement.

**Test indépendant** : saisir des scores, vérifier disponibilité des cibles, assignation des prochains matchs et mise à jour des classements.

**Scénarios d’acceptation** :
1. **Étant donné** un match en cours, **quand** l’organisateur saisit le score final, **alors** la cible devient disponible et le prochain match s’affiche.
2. **Étant donné** plusieurs cibles libres, **quand** des matchs se terminent, **alors** le système propose les meilleures affectations.
3. **Étant donné** une saisie de score, **quand** les résultats sont enregistrés, **alors** les classements et tableaux sont mis à jour en temps réel.

---

### User Story 5 - Générer l’agenda du tournoi (Priorité : P5)

En tant qu’organisateur, je veux générer un agenda complet avec les horaires des matchs, afin de partager le planning et informer les joueurs.

**Pourquoi cette priorité** : l’agenda facilite l’exécution et l’information des participants.

**Test indépendant** : générer des agendas pour différentes configurations et vérifier les contraintes de durée.

**Scénarios d’acceptation** :
1. **Étant donné** un tournoi entièrement configuré, **quand** l’agenda est généré, **alors** tous les matchs sont planifiés dans les contraintes horaires.
2. **Étant donné** un agenda généré, **quand** il est partagé, **alors** les joueurs peuvent voir leurs horaires et cibles.
3. **Étant donné** des contraintes, **quand** les matchs sont planifiés, **alors** les disponibilités de cibles et la durée des tours sont respectées.

---

### Cas limites

- Que se passe-t-il si un logo dépasse 5 Mo ou n’est pas JPG/PNG ?
- Comment gérer les joueurs sans niveau lors du seeding ?
- Que faire si la durée est insuffisante pour la configuration ?
- Comment gérer les cibles indisponibles en cours de tournoi ?
- Que se passe-t-il si un score est erroné après progression ?
- Comment gérer les saisies simultanées du même match ?
- Que faire si le nombre de joueurs ne correspond pas à la structure ?
- Comment gérer les joueurs qui se retirent après assignation ?
- Que faire si les tableaux créent des matchs inégaux ?
- Comment gérer les fuseaux horaires ?
- Que faire si des cibles deviennent indisponibles en cours de tournoi ?

## Exigences *(obligatoire)*

<!--
  ACTION REQUIRED : Ces placeholders doivent être complétés.
-->

### Exigences fonctionnelles

- **FR-001** : Le système DOIT permettre la création de tournois avec nom, logo (5 Mo max JPG/PNG), format, durée (demi-journée avec créneaux, journée complète, deux jours) et heures de début/fin pour les utilisateurs authentifiés.
- **FR-002** : Le système DOIT supporter une structure configurable : nombre de joueurs/équipes, cibles, phases de poules, poules par phase, joueurs par poule, tours/legs.
- **FR-003** : Le système DOIT permettre la configuration des winner/loser brackets avec tailles personnalisées et tours/legs.
- **FR-004** : Le système DOIT permettre l’inscription complète des joueurs (prénom, nom, surnom, équipe, téléphone, niveau) sans authentification.
- **FR-005** : Le système DOIT empêcher les inscriptions en doublon et valider les données.
- **FR-006** : Le système DOIT assigner automatiquement les joueurs aux poules de la phase 1, en utilisant les niveaux si disponibles.
- **FR-007** : Le système DOIT permettre l’ajustement manuel avant le démarrage.
- **FR-008** : Le système DOIT permettre la saisie des scores en temps réel avec mise à jour immédiate des classements.
- **FR-009** : Le système DOIT afficher les cibles disponibles et les prochains matchs quand une cible se libère.
- **FR-010** : Le système DOIT générer un agenda complet avec horaires des matchs.
- **FR-011** : Le système DOIT mettre à jour progression et classements en temps réel.
- **FR-012** : Le système DOIT valider toutes les configurations et empêcher les setups invalides.
- **FR-012a** : Le système DOIT supporter les états : draft, open, signature, live, finished.
- **FR-013** : Le système DOIT conserver toutes les données de tournoi de manière permanente.
- **FR-014** : Le système DOIT supporter OAuth Google/Facebook via Auth0.
- **FR-015** : Le système DOIT protéger les endpoints via JWT (issuer + audience).
- **FR-016** : Le système DOIT fournir un script bash d’installation.
- **FR-017** : Le système DOIT fournir un script bash de gestion des services.

### Entités clés

- **Tournament** : Représente un tournoi. Attributs : name, logo, format, durée, start/end, participants, cibles, pools, brackets, schedule, status, etc.
- **Player** : Participant. Attributs : prénom, nom, surnom, équipe, téléphone, niveau, historique.
- **Team** : Groupe pour formats équipe. Attributs : nom, membres, niveau dérivé.
- **PoolStage** : Phase de poules. Attributs : numéro, nombre de poules, joueurs par poule, configuration tours/legs.
- **Pool** : Groupe de joueurs/équipes. Attributs : numéro, participants, classement.
- **Bracket** : Structure finale. Attributs : type, taille, tours, participants.
- **Match** : Match individuel. Attributs : participants, horaire, cible, score, statut.
- **Target** : Cible de jeu. Attributs : numéro, statut, match courant.
- **Score** : Résultat et audit. Attributs : scores, timestamp, audit.
- **Schedule** : Organisation chronologique. Attributs : matches, horaires, partage.
- **SkillLevel** : Niveau joueur (Novice/Intermédiaire/Avancé/Expert).

## Critères de succès *(obligatoire)*

<!--
  ACTION REQUIRED : Définir des critères mesurables.
-->

### Résultats mesurables

- **SC-001** : Les organisateurs peuvent créer un tournoi complet en moins de 10 minutes sans erreur.
- **SC-002** : 100% des inscriptions valides sont stockées ; doublons empêchés.
- **SC-003** : Le seeding automatique équilibre les poules avec 95% de satisfaction organisateur.
- **SC-004** : L’agenda est généré en moins de 30s pour 128 participants.
- **SC-005** : Les mises à jour de score se reflètent en moins de 2s.
- **SC-006** : Disponibilité cible et affectations en moins de 1s.
- **SC-007** : L’agenda respecte les contraintes avec 100% de précision.
- **SC-008** : L’agenda est partageable et accessible sans erreur.
- **SC-009** : 90% des organisateurs terminent la configuration sans support.
