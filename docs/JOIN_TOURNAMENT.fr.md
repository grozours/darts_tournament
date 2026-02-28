# Rejoindre un tournoi (joueur / admin)

Ce guide montre les parcours d'inscription:
- simple (individuel)
- doublette
- équipe

## Accès
- Dans l'application: menu `Doc` dans le header.
- Vues utiles:
  - `/?view=registration-players`
  - `/?view=doublettes&tournamentId=<id-tournoi>`
  - `/?view=equipes&tournamentId=<id-tournoi>`

---

## 1) Tournoi simple (individuel)

### Joueur
1. Ouvrir la vue `Inscriptions`.
2. Aller à la section **Tournois individuels**.
3. Vérifier que votre inscription apparaît dans la liste des joueurs du tournoi.

### Admin
1. Ouvrir la vue `Inscriptions`.
2. Contrôler les engagés visibles dans **Tournois individuels**.
3. Compléter les inscriptions manquantes avant le lancement.

![Rejoindre un tournoi simple](assets/screenshots/rejoindre-tournoi-simple.png)

---

## 2) Tournoi doublette

### Joueur
1. Ouvrir la vue `Doublettes` avec le tournoi ciblé.
2. Cliquer **Rejoindre** sur la doublette ouverte.
3. Saisir le mot de passe de la doublette.
4. Vérifier votre présence dans les membres de la doublette.

### Admin
1. Ouvrir la vue `Doublettes` du tournoi.
2. Vérifier la composition des doublettes (membres, capitaine, statut).
3. Valider les doublettes complètes et enregistrées.

![Rejoindre une doublette](assets/screenshots/rejoindre-tournoi-doublette.png)

---

## 3) Tournoi équipe

### Joueur
1. Ouvrir la vue `Équipes` avec le tournoi ciblé.
2. Cliquer **Rejoindre** sur l'équipe ouverte.
3. Saisir le mot de passe de l'équipe.
4. Vérifier votre présence dans l'effectif.

### Admin
1. Ouvrir la vue `Équipes` du tournoi.
2. Contrôler l'effectif, le capitaine et le statut d'enregistrement.
3. Finaliser les équipes complètes avant le démarrage.

![Rejoindre une équipe](assets/screenshots/rejoindre-tournoi-equipe.png)

---

## 4) Inscription équipe depuis la carte tournoi

### Joueur
1. Ouvrir la vue principale des tournois (`/?status=OPEN`).
2. Si vous n'avez pas d'équipe sur ce tournoi, cliquer **Créer son équipe**.
3. Une fois votre équipe complète (4 joueurs), revenir sur la carte tournoi.
4. Cliquer **S'inscrire** pour enregistrer l'équipe au tournoi.

### Admin
1. Vérifier que les cartes équipe affichent bien les actions attendues selon l'état joueur/groupe.
2. Contrôler qu'une équipe incomplète ne peut pas être inscrite depuis la carte.

![Inscription équipe depuis la carte tournoi](assets/screenshots/inscription-equipe-carte.png)

---

## 5) Gérer ton équipe

### Joueur (capitaine)
1. Ouvrir la vue `Équipes` du tournoi (`/?view=equipes&tournamentId=<id-tournoi>`).
2. Gérer ton équipe avec les actions disponibles : **Modifier**, **Inscrire le groupe**, **Quitter**, **Mot de passe**.
3. Vérifier les membres et le statut du groupe avant inscription.

### Admin
1. Contrôler la composition et le statut de chaque équipe.
2. Intervenir si besoin via les actions d'administration.

![Gérer ton équipe](assets/screenshots/gerer-equipe-actions.png)

---

## Rappel métier
- **Simple**: engagement individuel.
- **Doublette**: groupe de 2 joueurs.
- **Équipe**: groupe de 4 joueurs.
- Une inscription est opérationnelle quand le groupe (ou joueur) est complet et enregistré.
