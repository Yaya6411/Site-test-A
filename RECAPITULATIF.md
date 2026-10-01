# Biblio FR — récapitulatif du projet (pour reprise par une autre IA)

Ce document résume tout le travail réalisé sur le site **Biblio FR** : objectif, architecture, configuration des services externes, modèle de données, règles de sécurité, décisions prises et limites connues. Il est destiné à une IA ou à un développeur qui reprend le projet.

---

## 1. Objectif et contexte

- **Demande initiale** : un site qui répertorie les livres disponibles en français (romans, mangas, BD, essais, jeunesse…), navigable **par genre** et **par auteur**, avec pour chaque livre un **lien vers une plateforme qui le vend**.
- **Langue** : tout le site, les messages et les commits sont **en français**. Le propriétaire n'est pas développeur : les explications doivent être en français simple, avec des étapes cliquables précises quand il doit agir dans une console (Firebase, Google Cloud, GitHub).
- **Contrainte de départ** : il n'existe pas de catalogue libre et complet de « tous les livres en français ». Le site interroge donc **en direct** des API publiques plutôt que de stocker un catalogue.

## 2. Hébergement et dépôt

| Élément | Valeur |
|---|---|
| Dépôt GitHub | `Yaya6411/Site-test-A` (public) |
| Branche de travail et de publication | `claude/youthful-archimedes-zcrfu4` |
| Site en ligne (GitHub Pages) | https://yaya6411.github.io/Site-test-A/ |
| Publication | GitHub Pages en mode « Deploy from a branch », dossier `/ (root)`. Chaque push sur la branche republie le site (1–2 min). |
| `.nojekyll` | Présent à la racine : les fichiers sont servis tels quels. |

**Pas d'outil de build** : HTML, CSS et JavaScript « vanilla » (scripts classiques, pas de modules ES, pas de bundler, pas de npm côté site). Toutes les fonctions et constantes de premier niveau sont partagées entre fichiers via la portée globale ; **l'ordre des `<script>` dans `index.html` compte**.

## 3. Structure des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Squelette : en-tête (recherche, menu, bouton compte), `<main id="app">`, boîtes de dialogue (fiche livre, connexion, préférences), pied de page, scripts. |
| `style.css` | Mise en forme, thème clair/sombre automatique (`prefers-color-scheme`), responsive (mobile ≥ 375 px sans défilement horizontal). |
| `data.js` | **Configuration et données statiques** : clés API, ID Firebase, `GENRE_GROUPS`/`GENRES` (70 genres en 6 familles), `HOME_GENRES`, `FEATURED_AUTHORS` (333 auteurs, 15 catégories), `MUST_READS` (133 incontournables en 9 catégories), `STORES` (7 librairies). |
| `vendor/firebase-app-compat.js`, `vendor/firebase-auth-compat.js` | Firebase JS SDK **12.19.0** (builds « compat » UMD, licence Apache 2.0), récupérés depuis npm et inclus dans le dépôt. |
| `app.js` | Cœur : préférences, sources de données (Google Books / Open Library), filtre des « non-livres », couvertures, cache, routeur, vues (accueil, genres, auteurs, résultats), fiche livre (modale). |
| `auth.js` | Comptes (Firebase Authentication) : bouton d'en-tête, fenêtre connexion/inscription/mot de passe oublié, page « Mon compte ». |
| `reviews.js` | Notes et commentaires : stockage local ou Firestore (API REST), section « Avis des lecteurs » de la fiche, publication, modification, suppression. |
| `profiles.js` | Profils publics (collection `users`), recherche de lecteurs, page de profil. |
| `rankings.js` | Classement des livres les plus commentés, Nouveautés (sorties récentes), Incontournables. |
| `firestore.rules` | Règles de sécurité Firestore (à copier dans la console Firebase). |
| `README.md` | Documentation utilisateur et procédures de configuration. |

**Ordre de chargement** : `data.js` → `vendor/firebase-app-compat.js` → `vendor/firebase-auth-compat.js` → `app.js` → `auth.js` → `reviews.js` → `profiles.js` → `rankings.js`.
Le premier affichage (`route()`) est déclenché sur `DOMContentLoaded`, une fois tous les scripts chargés.

## 4. Routes (routage par hash)

| URL | Vue | Fichier |
|---|---|---|
| `#/` | Accueil : genres, auteurs, incontournables, étagères « Sorties récentes », « Mangas », « Romans » | `app.js` |
| `#/genres` | 70 genres groupés par famille | `app.js` |
| `#/genre/<id>` | Livres d'un genre | `app.js` |
| `#/auteurs` | Auteurs mis en avant + filtre par catégorie + recherche libre | `app.js` |
| `#/auteur/<nom>` | Livres d'un auteur | `app.js` |
| `#/recherche/<mode>/<texte>` | Résultats ; `mode` = `all`, `title`, `author`, `isbn` | `app.js` |
| `#/classement` | Livres les plus commentés (semaine / mois / depuis toujours) | `rankings.js` |
| `#/nouveautes[/<genreId>]` | Sorties récentes (année en cours et précédente) | `rankings.js` |
| `#/incontournables[/<slug-catégorie>]` | 133 livres de référence | `rankings.js` |
| `#/lecteurs[/<texte>]` | Recherche de lecteurs par début de pseudo / derniers inscrits | `profiles.js` |
| `#/lecteur/<uid>` | Profil public d'un lecteur | `profiles.js` |
| `#/compte` | Mon compte | `auth.js` |

## 5. Sources de données des livres

### 5.1 Google Books API
- `https://www.googleapis.com/books/v1/volumes` avec `langRestrict=fr`, `country=FR`, `printType=books`, `maxResults=40`, `orderBy=relevance|newest`, `key=GOOGLE_API_KEY`.
- Requêtes « avancées » : `subject:"…"`, `inauthor:"…"`, `intitle:…`, `isbn:…`.
- **Particularités constatées** :
  - Sans clé, le quota anonyme global est épuisé (erreur 429) → une **clé API est obligatoire**.
  - Sans `country`, l'API répond « Cannot determine user location » depuis certains serveurs.
  - Depuis l'environnement de développement, les requêtes avancées renvoyaient souvent 0 résultat et Google renvoie parfois moins de résultats que demandé. D'où une **seconde tentative en recherche simple** (`plainQuery`) quand la requête avancée ne renvoie rien, et un `hasMore` calculé sur `totalItems`.
  - `langRestrict` n'est pas fiable : filtre supplémentaire côté client sur `volumeInfo.language === "fr"`.

### 5.2 Open Library
- `https://openlibrary.org/search.json` avec `language=fre` et le paramètre `fields`, qui inclut **`editions`** pour obtenir l'**édition française** (titre, ISBN, couverture, éditeur, date) plutôt que l'œuvre originale.
- Paramètres utilisés : `subject`, `author`, `title`, `isbn`, `q` ; `sort=new` pour les nouveautés.

### 5.3 Combinaison des sources (`searchBooks` dans `app.js`)
- Préférence utilisateur (⚙️) : **« Toutes les sources »** (défaut), « Google Books uniquement », « Open Library uniquement ».
- Mode « toutes » : les deux sources sont interrogées en parallèle, puis leurs résultats sont **entremêlés et dédoublonnés** (par ISBN, sinon titre + auteur).
- Une source qui échoue est mise de côté **5 minutes** (`SOURCE_COOLDOWN_MS`) et l'autre prend le relais. Les raisons d'échec s'affichent sous le titre des résultats.
- Les résultats sont gardés en mémoire (`resultCache`) et les livres sont indexés dans `bookCache` (id → livre) pour la fiche.
- Format normalisé d'un livre : `{ id, title, authors[], year, publisher, pages, categories[], description, isbn, covers[], link }`.

### 5.4 Filtre des « non-livres »
`isLowContent(title, subtitle, categories)` dans `app.js` écarte : agendas, calendriers, planners, coloriages, mandalas, carnets et cahiers vierges ou lignés, bullet journals, sudoku, mots croisés/fléchés/mêlés, livres d'activités et d'autocollants (`LOW_CONTENT_PATTERNS`, sans accents, en minuscules). « Livre d'or » a été volontairement retiré de la liste (« Le Livre d'or de la science-fiction » est une vraie anthologie).

### 5.5 Couvertures
Chaque livre a une liste `covers[]` essayée dans l'ordre (`coverCandidates`) :
1. image de la source (Google en haute définition via `&fife=w480-h720`, puis sans ce paramètre ; Open Library : couverture de l'édition française puis de l'œuvre, format `-L`) ;
2. Open Library par ISBN (`?default=false`) ;
3. Amazon par ISBN-10 (converti depuis l'ISBN-13). Une image de moins de 20 px est considérée comme vide.

Si aucune image ne fonctionne, le site dessine une **couverture générée** (titre + auteur, couleur dérivée du titre).

### 5.6 Liens d'achat
`STORES` dans `data.js` : Leslibraires.fr (défaut), Fnac, Amazon.fr, Decitre, Cultura, Place des Libraires, Rakuten. La librairie préférée se choisit dans ⚙️.
**Les liens cherchent par titre + premier auteur**, pas par ISBN : une recherche par ISBN menait à des pages vides quand le revendeur ne connaissait pas l'édition précise.

## 6. Services Google / Firebase

### 6.1 Deux projets Google Cloud distincts (point important)
Ils portent tous les deux le nom affiché « test biblio » :

| Usage | Projet | Clé API (`data.js`) | Restrictions de la clé |
|---|---|---|---|
| Google Books | projet n° 996347818998 | `GOOGLE_API_KEY` (commence par `AIzaSyCrrm7…`) | Sites web : `https://yaya6411.github.io/*` ; API : Books API (+ d'autres ajoutées sans effet) |
| Firebase (comptes, base de données) | **`test-biblio-998a1`** (n° 929493062325) | `FIREBASE_API_KEY` (commence par `AIzaSyB7UPM…`, « Browser key (auto created by Firebase) ») | Sites web : `https://yaya6411.github.io/*` et `https://test-biblio-998a1.firebaseapp.com/*` ; API : réglées par Firebase |

- Les clés sont visibles dans `data.js` (dépôt public). C'est normal pour ce type de clé : la **restriction par site web** empêche leur usage ailleurs, et elle a été vérifiée (un autre domaine est bloqué).
- Erreur rencontrée : utiliser la clé Books pour Firebase Auth renvoyait `CONFIGURATION_NOT_FOUND`, parce que la clé appartenait à l'autre projet. D'où la clé dédiée `FIREBASE_API_KEY`.

### 6.2 Firebase Authentication
- Fournisseurs activés : **E-mail/Mot de passe** et **Google**.
- Domaines autorisés : `localhost`, `test-biblio-998a1.firebaseapp.com`, `test-biblio-998a1.web.app`, `yaya6411.github.io`.
- Initialisation dans `auth.js` : `apiKey = FIREBASE_API_KEY || GOOGLE_API_KEY`, `authDomain = <projet>.firebaseapp.com`, `languageCode = "fr"`.
- Connexion Google : `signInWithPopup`, puis `signInWithRedirect` si la fenêtre est bloquée.
- Inscription : pseudo (2–30 caractères), e-mail, mot de passe (8 caractères minimum), `updateProfile({displayName})`, envoi de l'e-mail de vérification (non bloquant).
- Messages d'erreur Firebase traduits en français (`AUTH_ERRORS`).
- Page « Mon compte » : changer de pseudo (le changement est répercuté sur le profil public et sur tous ses avis), statut de vérification de l'e-mail et renvoi, changement de mot de passe par e-mail, liste « Mes avis » (modifier / supprimer), déconnexion, suppression du compte (supprime d'abord ses avis et son profil ; confirmation en deux clics).

### 6.3 Cloud Firestore (API REST, sans SDK)
- Base `(default)` du projet `test-biblio-998a1`, créée en **mode production** (région choisie par le propriétaire, `europe-west` recommandée).
- Accès via `fetch` sur `https://firestore.googleapis.com/v1/projects/test-biblio-998a1/databases/(default)/documents…?key=FIREBASE_API_KEY`, avec `Authorization: Bearer <idToken>` quand l'utilisateur est connecté (objet `firestore` dans `reviews.js`).
- Requêtes via `:runQuery` (pas d'`orderBy` combiné à un filtre d'égalité, pour éviter les index composites ; tri côté client).

#### Collection `reviews`
- **ID du document** : `<uid>__<bookKey>`, ce qui garantit **un seul avis par compte et par livre**.
- Champs : `uid`, `bookKey`, `title`, `rating` (entier 1–5), `name` (pseudo affiché, ≤ 50), `comment` (≤ 2000), `createdAt` (timestamp), `updatedAt` (timestamp, optionnel, ajouté à la modification).
- `bookKey` = `reviewKey(book)` = « titre principal normalisé | nom de famille du premier auteur » (sans accents ni ponctuation, en minuscules). Exemple : `le petit prince|exupery`. Toutes les éditions d'un même livre partagent donc leurs avis.

#### Collection `users` (profils publics)
- ID = `uid`. Champs : `name` (1–30), `nameLower` (= `name.toLowerCase()`, pour la recherche par préfixe), `createdAt` (date de création du compte Firebase), `photoURL` (≤ 500, photo Google éventuelle).
- **Jamais d'e-mail.** Le profil est créé ou mis à jour à chaque connexion (`syncProfile`, PATCH avec `updateMask`).
- Recherche : `nameLower >= q` et `< q + ""`, triée par `nameLower`. Derniers inscrits : tri par `createdAt` décroissant.

#### Règles de sécurité (`firestore.rules`, publiées dans la console)
- `reviews` : lecture publique. Création par un compte connecté uniquement, avec ID = `uid__bookKey`, champs autorisés limités, types et longueurs contrôlés, `uid` = compte connecté. **Modification par l'auteur** limitée à `name`, `rating`, `comment` et `updatedAt`, avec les mêmes contrôles. **Suppression par l'auteur** uniquement.
- `users` : lecture publique ; création, modification et suppression **uniquement de son propre profil** ; champs limités (`name`, `nameLower`, `createdAt`, `photoURL`) ; `nameLower == name.lower()`.
- Toute modification de `firestore.rules` dans le dépôt doit être **recopiée à la main** par le propriétaire dans Firebase → Firestore → Règles → Publier.

#### Vérifications effectuées sur les vrais services (avec des comptes de test supprimés ensuite)
- Création de compte, connexion, renouvellement de session, connexion Google disponible, domaines autorisés.
- Avis : création acceptée ; doublon refusé (409) ; avis au nom d'un autre, sans connexion, ou suppression par un tiers refusés (403).
- Modification : acceptée pour l'auteur ; refusée pour un autre compte, sans connexion, avec une note de 9, un commentaire trop long, un changement d'`uid` ou de `bookKey`.
- Profils : création du sien acceptée ; `nameLower` incohérent, champ e-mail, profil d'un autre ou écriture sans connexion refusés ; recherche par préfixe et « derniers inscrits » fonctionnelles.
- Requête « avis des 7 derniers jours » (`createdAt >=`) fonctionnelle.

## 7. Fonctionnalités en détail

- **Catalogue** : recherche (tout / titre / auteur / ISBN), tri par pertinence ou par date, « Charger plus », fiche livre en modale (couverture, auteurs cliquables, éditeur, date, pages, ISBN, catégories, résumé, liens d'achat, avis).
- **Genres** : 70 genres en 6 familles (Littérature, Imaginaire, Mangas & BD, Jeunesse, Savoirs & essais, Vie pratique). Chaque genre a une requête `google` (pour `subject:`) et une requête `openlibrary` (paramètre `subject`).
- **Auteurs** : 333 auteurs en 15 catégories, filtrables, plus une recherche libre.
- **Incontournables** : 133 titres en 9 catégories. La fiche réelle est retrouvée automatiquement (recherche titre + auteur, correspondance par `reviewKey` ou par préfixe du titre + nom de l'auteur), puis gardée **7 jours** dans le `localStorage` (`bibliofr.mustReads`) pour économiser le quota Google.
- **Nouveautés** : parutions de l'année en cours et de la précédente (filtre côté client, années futures aberrantes exclues), badge « Nouveau » pour l'année en cours, filtres par genre, étagère sur l'accueil.
- **Classement** : agrégation côté client des avis Firestore par `bookKey`, tri par nombre d'avis puis par note moyenne. Périodes : 7 jours, 30 jours, depuis toujours. Couverture et auteur retrouvés pour les 10 premiers.
- **Avis** : note 1–5 étoiles (boutons radio stylés), commentaire facultatif, moyenne et nombre d'avis, badge « Vous », « modifié le … », modification en place (`openReviewEditor`), suppression avec confirmation. Il faut être connecté pour publier si Firebase est configuré ; sinon, les avis sont stockés localement dans le navigateur (mode de repli).
- **Lecteurs** : recherche au fil de la frappe, cartes de lecteurs, page de profil (statistiques, répartition des notes en barres, liste des avis). Les pseudos sont cliquables dans les avis.
- **Préférences** (⚙️, `localStorage`) : source du catalogue, librairie préférée.

## 8. Historique des étapes (commits)

1. Création du site (catalogue, genres, auteurs, liens d'achat).
2. `.nojekyll` pour déclencher la première publication GitHub Pages.
3. Bascule automatique sur Open Library quand Google Books est saturé.
4. Sources de couvertures multiples, plus de genres et d'auteurs, mode « toutes les sources ».
5. Liens d'achat par titre + auteur ; éditions françaises (Open Library) ; prise en charge d'une clé Google.
6. Activation de la clé Google Books (+ `country=FR`, seconde tentative en recherche simple).
7. Notes et commentaires (local, puis Firestore).
8. Activation de Firestore (projet `test-biblio-998a1`).
9. Comptes utilisateurs (Firebase Auth, SDK inclus dans `vendor/`).
10. Clé API dédiée au projet Firebase.
11. Classement des lecteurs et sorties récentes.
12. Filtre des agendas et coloriages ; 333 auteurs, 70 genres, page Incontournables.
13. Recherche de lecteurs et profils publics.
14. Modification de sa note et de son commentaire.

Une demande d'onglet « Tendances / plus vendus » a été **abandonnée** à la demande du propriétaire, au profit du classement basé sur les avis du site et de l'onglet Nouveautés. Il n'existe pas de source gratuite des vrais chiffres de vente en France.

## 9. Limites connues et points d'attention

- **Qualité des sources** : Google Books classe parfois mal les genres (il renvoie des livres *sur* un sujet plutôt que *du* genre) ; Open Library couvre moins bien les titres français récents. Les genres très précis (shōnen, shōjo, seinen…) peuvent donner peu de résultats.
- **Quota Google Books** : environ 1000 requêtes par jour par défaut sur la clé. Le mode « toutes les sources », les étagères de l'accueil et les Incontournables consomment des requêtes (atténué par les caches).
- **Couvertures Amazon** : leur affichage depuis un autre site n'est pas garanti ; la couverture générée prend le relais.
- **Avis** : n'importe quel compte peut publier, l'e-mail n'a pas besoin d'être vérifié et il n'y a pas de modération intégrée. La modération se fait à la main dans la console Firebase (Firestore → `reviews` → supprimer le document). Le `createdAt` est fixé par le client (il n'est pas forcé à l'heure du serveur).
- **Nom du pseudo** : il n'y a pas d'unicité des pseudos ; deux lecteurs peuvent porter le même.
- **Environnement de développement utilisé** : le réseau y bloquait Open Library, les sites des libraires et GitHub Pages. Les interfaces ont été testées avec Playwright et des réponses d'API simulées ; les règles Firebase et l'authentification ont été vérifiées sur les vrais services par des appels REST.

## 10. Méthode de travail suivie (à conserver)

- Avant chaque push : `node --check` sur les fichiers JS modifiés, puis tests Playwright (Chromium) avec des API simulées. Ils couvrent le parcours fonctionnel, l'absence d'erreur JavaScript, l'absence de défilement horizontal à 375 px, et des captures d'écran clair/mobile.
- Toute modification des règles Firestore est vérifiée ensuite sur la vraie base avec des **comptes de test temporaires**, supprimés en fin de test avec leurs données.
- Commits en français, descriptifs, poussés sur `claude/youthful-archimedes-zcrfu4` (GitHub Pages republie automatiquement).
- Échapper systématiquement le texte injecté dans le HTML (`esc()`), encoder les URL (`enc()`).

## 11. Pistes d'évolution possibles

- Modération des avis (signalement, rôle administrateur), exigence d'un e-mail vérifié pour publier.
- Pseudos uniques, abonnements entre lecteurs (« suivre »), listes de lecture (« à lire », « lu »).
- `createdAt` imposé par le serveur (transformation `REQUEST_TIME` via un commit Firestore).
- Source de données supplémentaire pour les nouveautés françaises (par exemple la BnF), si une API compatible avec le navigateur est disponible.
- Nom de domaine personnalisé pour GitHub Pages (à ajouter ensuite aux restrictions des clés et aux domaines autorisés Firebase).
