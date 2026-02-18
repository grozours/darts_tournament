# Plan d’implémentation : Gestionnaire de Tournois de Fléchettes

**Branche** : `001-tournament-manager` | **Date** : 2026-02-03 | **Spec** : [spec.fr.md](spec.fr.md)
**Input** : Spécification fonctionnelle depuis `/specs/001-tournament-manager/spec.fr.md`

**Note** : Ce template est rempli par la commande `/speckit.plan`. Voir `.specify/templates/commands/plan.md` pour le workflow.

## Résumé

Application complète de gestion de tournois de fléchettes pour navigateurs desktop : création de tournois, inscription des joueurs avec seeding par niveau, gestion temps réel, conservation des données, OAuth, script d’installation. Inclut branding visuel, configuration des poules/tableaux, planification automatique, suivi des scores, protection API via Auth0, et script de gestion des services.

## Contexte technique

**Langage/Version** : Node.js 20 LTS avec TypeScript 5.3+  
**Dépendances principales** : Express.js 4.18+, Socket.io 4.7+, React 18+, PostgreSQL 15+, Redis  
**Stockage** : PostgreSQL pour données historiques, Redis pour cache temps réel  
**Tests** : Jest 29+, React Testing Library, Playwright E2E  
**Plateforme cible** : Navigateurs desktop uniquement
**Type de projet** : web - frontend React avec backend Node.js/Express  
**Objectifs perf** : génération agenda <30s pour 128 participants, updates temps réel <2s, dispo cibles <1s  
**Contraintes** : uploads logo 5 Mo JPG/PNG, OAuth requis, stockage permanent, conformité WCAG 2.1 AA  
**Échelle** : jusqu’à 128 participants, tournois concurrents illimités

## Constitution Check

*GATE : doit passer avant la phase 0.*

✅ **Qualité code** : TypeScript, ESLint/Prettier, documentation complète  
✅ **Discipline tests** : TDD (Jest, RTL, Playwright), contrats définis  
✅ **UX cohérente** : WCAG 2.1 AA prévu, design desktop  
✅ **Perf** : métriques définies, architecture adaptée (WebSocket <2s, Bull Queue <30s)  
✅ **Stack documentée** : stack complète dans research.fr.md  
✅ **Sécurité/Privacy** : validation upload, rate limiting, audit logging

**POST-DESIGN RE-EVALUATION** : ✅ PASS - principes respectés.

## Structure du projet

### Documentation (feature)

```text
specs/[###-feature]/
├── plan.md              # Ce fichier (/speckit.plan)
├── research.md          # Phase 0 (/speckit.plan)
├── data-model.md        # Phase 1 (/speckit.plan)
├── quickstart.md        # Phase 1 (/speckit.plan)
├── contracts/           # Phase 1 (/speckit.plan)
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Code source (racine)

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

**Décision de structure** : architecture web classique adaptée au besoin d’un backend pour DB, uploads et temps réel. Frontend pour UI/UX, backend pour logique, persistance et scheduling.

## Suivi de complexité

> **À remplir uniquement en cas de violation de constitution**

| Violation | Pourquoi nécessaire | Alternative rejetée |
|-----------|---------------------|--------------------|
| [ex. 4e projet] | [besoin] | [pourquoi pas 3 projets] |
