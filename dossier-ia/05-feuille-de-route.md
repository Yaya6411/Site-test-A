# Feuille de route et état d'avancement

Document fourni par le propriétaire (« Biblio FR — Feuille de route d'amélioration ») et état de chaque point après application.

**Principe directeur du document** : rendre Biblio FR plus fiable, plus pertinent et plus agréable avant d'ajouter des fonctionnalités.

Légende : ✅ fait · 🟡 fait partiellement ou à vérifier · ⏳ non fait (raison indiquée)

## Phase 1 — Fiabiliser le catalogue (v1.1)
- ✅ Dédoublonnage au-delà de l'ISBN et du couple titre + auteur (clé d'œuvre, fusion des fiches)
- ✅ Score de pertinence local
- ✅ Filtrage des faux positifs de genre (fiches de lecture, critique, guides scolaires)
- ✅ Distinction œuvre / édition (éditions regroupées, tomes distincts)
- ✅ Validation renforcée de la langue française (Open Library)
- ✅ Fiabilisation des couvertures (chaîne de sources, adresses en échec mémorisées)

## Phase 2 — Améliorer la recherche (v1.1)
- ✅ Recherche sans accents
- ✅ Tolérance aux fautes de frappe
- ✅ Recherche partielle et variantes de noms d'auteurs (nom de famille seul)
- ✅ Autocomplétion des titres et auteurs (index local : auteurs, incontournables, genres)
- ✅ Filtres combinables genre / auteur / année
- ✅ Classement local par pertinence
- ✅ Message et suggestions quand rien n'est trouvé

## Phase 3 — Bibliothèque personnelle (v1.2)
- ✅ À lire, Lu, En cours, Favoris
- ✅ Listes personnalisées (publiques et partageables)
- ✅ Historique des livres consultés
- ✅ Statistiques personnelles

## Phase 4 — Avis et communauté (v1.3, v2.0)
- ✅ E-mail vérifié avant publication (option retenue)
- ✅ Bouton « Signaler cet avis »
- ✅ Mécanisme de modération et rôle administrateur
- ✅ Masquer ou supprimer un avis
- ✅ Date serveur pour `createdAt` (et `updatedAt`)
- ✅ Pseudos uniques
- ✅ Avatar (emojis ; pas d'envoi d'image, faute de stockage de fichiers configuré)
- ✅ Statistiques de lecture, listes publiques, livres lus / à lire sur le profil
- ✅ Suivre un lecteur, voir son activité (fil d'actualité), partager une liste
- 🟡 Notifications : pastille de nouveautés dans le menu ; pas de notifications par e-mail ou push

## Phase 5 — Réduire la dépendance aux API (v1.4)
- ✅ Cache persistant
- ✅ Requêtes identiques évitées (mutualisées)
- ✅ Requêtes simultanées limitées (4)
- ✅ Durées de cache par type de donnée
- ✅ Bascule entre sources conservée

## Phase 6 — Architecture
- ✅ Services API, recherche, cache, couvertures, composants, authentification, profils, avis, classements et routage séparés (dossier `js/`). Réalisé en premier, avant la v1.1, pour faciliter la suite.
- ✅ Pas de migration vers un framework (conformément au document)

## Phase 7 — Source bibliographique française (v2.0)
- 🟡 BnF ajoutée (API SRU), **à titre expérimental** : impossible de vérifier depuis l'environnement de développement si elle accepte les appels d'un navigateur (CORS). Le site la teste et l'ignore si elle refuse. Architecture cible respectée : sources → normalisation → déduplication → score → affichage.

## Phase 8 — Finition professionnelle (v2.0)
- ⏳ Nom de domaine personnalisé : nécessite un achat par le propriétaire (procédure dans le README)
- ✅ Favicon et identité visuelle (icône SVG/PNG, manifeste, image de partage)
- ✅ Partage des fiches livres
- ✅ Métadonnées SEO (description, canonical, Open Graph, JSON-LD, robots.txt, sitemap.xml)
- 🟡 Indexation : limitée à l'accueil tant que les pages sont des routes `#/…`
- ✅ Accessibilité (lien d'évitement, focus visibles, dialogues nommés, réduction des animations, autocomplétion au clavier)
- ✅ États de chargement soignés (cartes grisées)
- ✅ Expérience mobile (nouvel en-tête, menu défilant, 375 px sans défilement horizontal)
- ✅ Page « À propos » et présentation des sources

## Versions publiées
| Version | Contenu | Commit |
|---|---|---|
| préparation | modules `js/` | 2a1e14f |
| 1.1 | recherche, pertinence, dédoublonnage, genres | 2ff7790 |
| 1.2 | bibliothèque personnelle | 5457037 |
| 1.3 | modération, e-mail vérifié, pseudos uniques, date serveur | 37abbd3 |
| 1.4 | cache et optimisation des API | cbc4f25 |
| 2.0 | BnF, social, domaine (procédure), SEO, finitions | 6ff7919 |
