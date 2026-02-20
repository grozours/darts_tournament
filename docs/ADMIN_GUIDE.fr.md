# Guide Admin (court, fonctionnel)

## Objectif
Piloter le tournoi du debut a la fin.

## Etapes d'un tournoi
1. Creation : nom, format, dates, nombre de cibles.
2. Inscriptions : joueurs enregistres et presents.
3. Poules : generation des poules et controle des affectations.
4. Matchs de poule : lancement et suivi des scores.
5. Arbres : lancement des matchs a elimination.
6. Cloture : validation des derniers matchs et fin de tournoi.

## Avant
- Creer le tournoi et choisir le format.
- Configurer les poules et les cibles.
- Verifier que les joueurs sont bien inscrits.

## Pendant
- Lancer un match depuis une poule ou la vue cibles.
- Prioriser un autre match en annulant celui en cours (il retourne en file).
- Corriger un score si necessaire.

## Boutons speciaux
- Remise a zero (poule ou arbre) : reinitialise les matchs de la zone.
- Completer le tour : termine un tour d'arbre automatiquement.
- Annuler un match (vue cibles) : libere la cible et remet le match en file.
- Recalculer la progression : reconstruit les phases suivantes.

## Apres
- Completer les tours d'arbres restants.
- Verifier que le tournoi est termine.

## Liens utiles
- [Configuration admin](./ADMIN_SETUP.fr.md)
- [Commandes](./COMMANDS.fr.md)
- [API](./API.fr.md)
- [Tests](./TESTING.fr.md)
- [Deploiement](./DEPLOYMENT.fr.md)
- [Index documentation](./README.fr.md)
