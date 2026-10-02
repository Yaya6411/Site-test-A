# Dossier de reprise — Biblio FR

Ce dossier rassemble tout le travail réalisé sur **Biblio FR** depuis le début du projet, pour qu'une autre IA (ou un développeur) puisse le reprendre sans rien perdre.

## Biblio FR en une phrase

Site web gratuit qui répertorie les livres disponibles en français (romans, mangas, BD, essais, jeunesse…), les classe par genre et par auteur, renvoie vers des librairies en ligne pour l'achat, et propose des avis de lecteurs, des comptes, une bibliothèque personnelle et des fonctions communautaires.

- **Site en ligne** : https://yaya6411.github.io/Site-test-A/
- **Dépôt GitHub** : https://github.com/Yaya6411/Site-test-A (public)
- **Branche de travail et de publication** : `claude/youthful-archimedes-zcrfu4`
- **Propriétaire** : non-développeur, francophone. Toutes les explications doivent être en français simple, avec des étapes précises quand il doit agir dans une console (GitHub, Google Cloud, Firebase).

## Contenu du dossier

| Fichier | Contenu |
|---|---|
| `00-LISEZ-MOI.md` | Ce fichier : présentation, ordre de lecture, consignes pour l'IA qui reprend. |
| `01-historique-complet.md` | Chronologie de toutes les demandes, des problèmes rencontrés et des décisions prises, du premier message à aujourd'hui. |
| `02-etat-actuel.md` | Ce que fait le site aujourd'hui, page par page, et comment le code est organisé. |
| `03-configuration-des-services.md` | GitHub Pages, les deux projets Google Cloud, les clés API, Firebase Authentication, Firestore, modérateurs. |
| `04-donnees-et-securite.md` | Modèle de données Firestore, règles de sécurité expliquées, résultats des vérifications sur la vraie base. |
| `05-feuille-de-route.md` | La feuille de route d'amélioration fournie par le propriétaire et l'état de chaque point. |
| `06-methode-et-tests.md` | Méthode de travail à conserver et outils de test fournis. |
| `07-points-ouverts.md` | Ce qui reste à faire, les limites connues et les pistes d'évolution. |
| `firestore.rules` | Copie des règles de sécurité actuellement publiées. |
| `outils-de-test/` | Scripts de test (Playwright avec API simulées, vérification des règles sur la vraie base). |

À la racine du dépôt, `README.md` (documentation utilisateur) et `RECAPITULATIF.md` (fiche technique condensée) complètent ce dossier.

## Ordre de lecture conseillé

1. `02-etat-actuel.md` pour comprendre le site tel qu'il est.
2. `03-configuration-des-services.md` et `04-donnees-et-securite.md` avant de toucher aux comptes, aux avis ou à Firestore.
3. `07-points-ouverts.md` pour savoir quoi faire ensuite.
4. `01-historique-complet.md` pour le contexte et les raisons de chaque choix.

## Consignes pour l'IA qui reprend le projet

- **Langue** : répondre et écrire le site, les messages et les commits en français.
- **Pas d'outil de build** : HTML/CSS/JavaScript « vanilla », scripts classiques chargés dans un ordre précis par `index.html`. Ne pas migrer vers un framework sans l'accord du propriétaire (la feuille de route le déconseille).
- **Sécurité** : toujours échapper le texte injecté dans le HTML avec `esc()` et encoder les URL avec `enc()`.
- **Firestore** : toute modification de `firestore.rules` doit être recopiée par le propriétaire dans la console Firebase (Firestore → Règles → Publier), puis vérifiée sur la vraie base avec des comptes de test temporaires supprimés ensuite (voir `outils-de-test/verify4.py`).
- **Avant chaque mise en ligne** : `node --check` sur les fichiers JS modifiés, tests Playwright, aucune erreur JavaScript, vérification mobile à 375 px sans défilement horizontal, puis contrôle de la publication GitHub Pages.
- **Ne jamais** publier de faux avis ou de fausses données dans la vraie base : les tests réels se font avec des comptes temporaires et sont nettoyés.
- **Principe directeur** fixé par le propriétaire : privilégier la fiabilité, la pertinence et l'agrément d'utilisation plutôt que l'ajout de fonctionnalités.
