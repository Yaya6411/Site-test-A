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

Depuis la feuille de route (versions 1.1 à 2.0), le JavaScript est découpé en modules dans `js/` (scripts classiques, portée globale partagée) :

| Fichier | Rôle |
|---|---|
| `index.html` | Squelette : en-tête (logo, recherche, ⚙️ + compte, menu défilant), `<main id="app">`, dialogues (fiche livre, connexion, préférences), métadonnées SEO/Open Graph, scripts. |
| `style.css` | Mise en forme, thème clair/sombre, responsive (≥ 375 px sans défilement horizontal), focus visibles, réduction des animations. |
| `data.js` | Configuration (`GOOGLE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`) et données : `GENRE_GROUPS`/`GENRES` (70), `HOME_GENRES`, `FEATURED_AUTHORS` (333), `MUST_READS` (133), `STORES` (7). |
| `js/core/util.js` | `PAGE_SIZE`, `app`, `bookCache`, `prefs`, `getSource`, `getStore`, `esc`, `enc`, `authorLink`, `storeUrl`, `loadingHtml`, `setPageMeta`, `DEFAULT_DESCRIPTION`. |
| `js/services/cache.js` | Cache persistant `localStorage` à durée de vie par type (`CACHE_TTL`), `dedupedFetch` (requêtes identiques mutualisées), `limited` (4 requêtes max en parallèle). |
| `js/services/sources.js` | `sources.google`, `sources.openlibrary`, `sources.bnf` (expérimental, auto-détecté), normalisation, `isLowContent`, `coverCandidates`, `fetchBookById` (liens partagés). |
| `js/services/quality.js` | `norm`, `levenshtein`, `tokenMatch`, `workKey`/`dedupeWorks`/`mergeBooks` (œuvre vs édition), `isGenreFalsePositive`, `relevance`/`rankByRelevance`, `suggest` (autocomplétion), `didYouMean`, `authorVariant`. |
| `js/services/search.js` | `fetchFrom` (mémoire → cache → réseau), `fetchSources` (bascule / toutes les sources), `searchBooks` (pipeline complet). |
| `js/services/firestore.js` | Objet `firestore` : `request`, `get`, `list`, `patch`, `remove`, `runQuery`, `commit`, `docName` ; conversion `toFirestore`/`fromFirestore`, `ts()`. |
| `js/ui/components.js` | Couvertures (adresses en échec mémorisées), cartes livre (pastilles bibliothèque), squelettes de chargement. |
| `js/ui/autocomplete.js` | Liste de suggestions accessible (combobox, flèches, Entrée, Échap). |
| `js/ui/book.js` | Fiche livre en modale, `currentBook`, partage (`shareBook`, `#/livre/<id>`). |
| `js/views/catalog.js` | Accueil, genres, auteurs, résultats (filtres combinables, aucun résultat → suggestions). |
| `js/views/discover.js` | Classement, Nouveautés, Incontournables. |
| `js/views/about.js` | Page « À propos » (sources, avis, données personnelles, accessibilité). |
| `js/features/auth.js` | Firebase Auth, fenêtre connexion/inscription, page « Mon compte ». |
| `js/features/reviews.js` | Avis : lecture, création (`commit`, date serveur), modification, suppression, signalement, e-mail vérifié. |
| `js/features/profiles.js` | Profils publics, pseudos uniques, avatars, recherche de lecteurs, page de profil. |
| `js/features/library.js` | Bibliothèque personnelle, listes, historique, statistiques, listes publiques. |
| `js/features/moderation.js` | Signalements, rôle modérateur, page de modération. |
| `js/features/social.js` | Abonnements, fil d'actualité, pastille de nouveautés. |
| `js/router.js` | Routeur (`route()` au `DOMContentLoaded`), menu courant, lien d'évitement, recherche d'en-tête, préférences. |
| `firestore.rules` | Règles Firestore complètes (à copier dans la console). |
| `icon.svg`, `*.png`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml` | Identité visuelle, aperçu de partage, référencement. |

L'ordre des `<script>` dans `index.html` est significatif (chaque fichier utilise les précédents).

## 4. Routes (routage par hash)

| URL | Vue |
|---|---|
| `#/` | Accueil |
| `#/genres`, `#/genre/<id>` | Genres, livres d'un genre |
| `#/auteurs`, `#/auteur/<nom>` | Auteurs, livres d'un auteur |
| `#/recherche/<all|title|author|isbn>/<texte>` | Résultats |
| `#/livre/<id>` | Lien partagé : la fiche s'ouvre sur l'accueil (`g-…` Google, `ol-…` Open Library) |
| `#/classement` | Livres les plus commentés |
| `#/nouveautes[/<genreId>]` | Sorties récentes |
| `#/incontournables[/<slug>]` | 133 livres de référence |
| `#/bibliotheque[/<en-cours|a-lire|lus|favoris|listes|historique>]` | Ma bibliothèque |
| `#/liste/<uid>/<listId>` | Liste publique partagée |
| `#/lecteurs[/<texte>]`, `#/lecteur/<uid>` | Recherche de lecteurs, profil public |
| `#/fil` | Fil d'actualité (lecteurs suivis) |
| `#/compte` | Mon compte |
| `#/moderation` | Modération (administrateurs) |
| `#/a-propos` | À propos |

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

### 5.3 Combinaison des sources et qualité (`js/services/search.js`, `quality.js`)
- Préférence utilisateur (⚙️) : **« Toutes les sources »** (défaut), « Google Books uniquement », « Open Library uniquement ».
- Mode « toutes » : les deux sources sont interrogées en parallèle, puis leurs résultats sont **entremêlés et dédoublonnés** (par ISBN, sinon titre + auteur).
- Une source qui échoue est mise de côté **5 minutes** (`SOURCE_COOLDOWN_MS`) et l'autre prend le relais. Les raisons d'échec s'affichent sous le titre des résultats.
- Pipeline : sources → (variante « nom de famille » pour les auteurs peu fournis) → exclusion des faux positifs de genre → **regroupement des éditions** par `workKey` (titre sans mentions d'édition + n° de tome + nom de l'auteur) avec fusion des fiches → **classement par pertinence** (`relevance`).
- Open Library : seules les œuvres avec une édition française ou la langue `fre` sont gardées.
- **BnF (expérimental)** : API SRU (`catalogue.bnf.fr/api/SRU`, Dublin Core). Testée une fois par visite ; si le navigateur refuse l'appel (CORS), elle est ignorée silencieusement (`bnfState` en `sessionStorage`). Non vérifiable depuis l'environnement de développement.
- **Cache** (`cache.js`) : mémoire de la page, puis `localStorage` (ISBN 7 j, genres/auteurs 24 h, recherches 12 h, nouveautés 6 h, 60 entrées max), puis réseau mutualisé et limité à 4 requêtes simultanées. Bouton « Vider le cache » dans ⚙️. Les incontournables ont leur propre cache de 7 jours.
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

#### Collection `users` (profils publics) et sous-collections
- `users/{uid}` : `name` (2–30, **unique**), `nameLower`, `createdAt`, `photoURL`, `avatar` (emoji, facultatif), `showLibrary` (booléen). Jamais d'e-mail. Créé/mis à jour à la connexion (`syncProfile`).
- `users/{uid}/library/{bookKey}` : `title`, `authors`, `cover`, `isbn`, `year`, `pages`, `status` (`''|to-read|reading|read`), `favorite`, `addedAt`, `updatedAt`, `readAt`. Lisible par tous seulement si `showLibrary`.
- `users/{uid}/lists/{listId}` : `name`, `public`, `items` (≤ 200 résumés de livres), `createdAt`, `updatedAt`. Lisible par tous si `public`.
- `users/{uid}/following/{autre}` et `users/{autre}/followers/{uid}` : `createdAt` (serveur), écrits ensemble.

#### Autres collections
- `usernames/{pseudo en minuscules}` : `{ uid }`, réservation atomique du pseudo (commit avec `users/{uid}`).
- `reports/{uidSignaleur__idAvis}` : `reviewId`, `reviewUid`, `bookKey`, `title`, `reason`, `reporterUid`, `createdAt` (serveur). Lisibles par les modérateurs.
- `admins/{uid}` : **créé à la main** dans la console pour désigner un modérateur.
- `reviews/{uid__bookKey}` : champs déjà décrits + `hidden` (masqué par un modérateur). `createdAt` et `updatedAt` sont fixés par le **serveur** (`REQUEST_TIME` via `:commit`).

#### Règles de sécurité (`firestore.rules`)
Fonctions `signedIn`, `isUser`, `isAdmin` (existence de `admins/{uid}`), `verified` (`email_verified`). Avis : création par un compte vérifié, `createdAt == request.time` ; modification par l'auteur (note, commentaire, pseudo, `updatedAt == request.time`) ou par un modérateur (`hidden` seulement) ; suppression par l'auteur ou un modérateur. Pseudos : réservation liée au profil via `getAfter`. Bibliothèque, listes, abonnements : écriture par le propriétaire uniquement, champs et tailles contrôlés.
**Les règles de la v1.2–2.0 doivent être publiées par le propriétaire et vérifiées** (voir section 9).

#### Vérifications effectuées sur les vrais services (avec des comptes de test supprimés ensuite)
- Création de compte, connexion, renouvellement de session, connexion Google disponible, domaines autorisés.
- Avis : création acceptée ; doublon refusé (409) ; avis au nom d'un autre, sans connexion, ou suppression par un tiers refusés (403).
- Modification : acceptée pour l'auteur ; refusée pour un autre compte, sans connexion, avec une note de 9, un commentaire trop long, un changement d'`uid` ou de `bookKey`.
- Profils : création du sien acceptée ; `nameLower` incohérent, champ e-mail, profil d'un autre ou écriture sans connexion refusés ; recherche par préfixe et « derniers inscrits » fonctionnelles.
- Requête « avis des 7 derniers jours » (`createdAt >=`) fonctionnelle.

## 7. Fonctionnalités en détail

- **Recherche (v1.1)** : sans accents, fautes de frappe tolérées, autocomplétion locale (auteurs, incontournables, genres ; aucune requête réseau), filtres combinables Année / Auteur / Genre sur les résultats chargés, « Vouliez-vous dire » + pistes si aucun résultat, cartes grisées pendant le chargement.
- **Bibliothèque (v1.2)** : statuts À lire / En cours / Lu, Favoris, listes (créer, renommer, supprimer, publique + lien), historique local (60 derniers), statistiques (lus, lus dans l'année, pages, avis, note moyenne). Sans compte : navigateur ; avec compte : Firestore, avec transfert à la connexion. Option d'affichage sur le profil public.
- **Communauté (v1.3)** : avis réservés aux e-mails vérifiés ; signalement (5 motifs) ; modération (masquer, réafficher, supprimer, classer) ; pseudos uniques ; avatar emoji ; identifiant de compte visible dans « Mon compte ».
- **Performance (v1.4)** : cache persistant, requêtes mutualisées, parallélisme limité ; mesuré : une page revisitée ne déclenche aucune requête.
- **Finitions (v2.0)** : source BnF expérimentale ; suivre un lecteur, fil d'actualité, pastille de nouveautés ; partage d'une fiche ou d'une liste ; nouvel en-tête ; icône SVG/PNG, manifeste, Open Graph, JSON-LD, robots.txt, sitemap.xml ; page « À propos » ; lien d'évitement, focus visibles, menu courant signalé.
- Fonctions antérieures : catalogue par genre/auteur, incontournables, nouveautés, classement des plus commentés, fiche livre, liens d'achat, avis modifiables, profils publics.

## 8. Historique des étapes (commits)

Versions initiales : création du site ; GitHub Pages ; bascule entre sources ; couvertures ; éditions françaises ; clé Google ; avis ; Firestore ; comptes ; clé Firebase dédiée ; classement et nouveautés ; filtre des agendas, 333 auteurs, 70 genres, incontournables ; profils publics ; modification des avis ; récapitulatif.

Feuille de route (document « Feuille de route Biblio FR ») :
1. Découpage du JavaScript en modules (préparation, sans changement de comportement).
2. **v1.1** Recherche, pertinence, dédoublonnage, qualité des genres.
3. **v1.2** Bibliothèque personnelle.
4. **v1.3** Modération, e-mail vérifié, pseudos uniques, date serveur, avatars.
5. **v1.4** Cache renforcé, mutualisation et limitation des requêtes.
6. **v2.0** Source BnF expérimentale, fonctions sociales, finitions (en-tête, SEO, icône, partage, à propos, accessibilité).

Une demande d'onglet « Tendances / plus vendus » a été abandonnée au profit du classement par avis et des Nouveautés.

## 9. Limites connues et points d'attention

- **À faire par le propriétaire** : publier la dernière version de `firestore.rules` dans la console, puis faire vérifier les règles (comptes de test temporaires) ; créer `admins/{uid}` pour chaque modérateur.
- **E-mail vérifié** : la création d'un avis par un compte vérifié n'a pas pu être testée automatiquement (un compte de test créé par API n'est pas vérifié) ; le refus pour un compte non vérifié, lui, est testable.
- **BnF** : non testée en conditions réelles (réseau bloqué en développement) ; ignorée si l'API refuse les appels du navigateur.
- **Indexation** : les pages sont des routes `#/…` ; les moteurs n'indexent que l'accueil. Un passage à des URL réelles nécessiterait un rendu côté serveur ou des pages statiques générées.
- **Nom de domaine** : non configuré (procédure dans le README).
- Qualité variable des sources (genres approximatifs chez Google, couverture inégale des nouveautés françaises) ; quota Google Books d'environ 1000 requêtes/jour (atténué par le cache).
- Avis masqués : filtrés côté site (les règles n'empêchent pas leur lecture par l'API).
- Pas de notifications push : la pastille du fil est calculée à la connexion et à chaque visite du fil.

## 10. Méthode de travail suivie (à conserver)

- Avant chaque push : `node --check` sur les fichiers JS modifiés, puis tests Playwright (Chromium) avec des API simulées. Ils couvrent le parcours fonctionnel, l'absence d'erreur JavaScript, l'absence de défilement horizontal à 375 px, et des captures d'écran clair/mobile.
- Toute modification des règles Firestore est vérifiée ensuite sur la vraie base avec des **comptes de test temporaires**, supprimés en fin de test avec leurs données.
- Commits en français, descriptifs, poussés sur `claude/youthful-archimedes-zcrfu4` (GitHub Pages republie automatiquement).
- Échapper systématiquement le texte injecté dans le HTML (`esc()`), encoder les URL (`enc()`).

## 11. Pistes d'évolution possibles

- URL réelles (sans `#`) avec pages statiques générées pour l'indexation des fiches livres.
- Notifications (e-mail ou push) pour les nouveaux abonnés et les avis des lecteurs suivis.
- Proxy serveur (Cloud Functions) pour fiabiliser la BnF et d'autres sources françaises (Electre, Dilicom… si accès).
- Statistiques de lecture avancées (genres préférés, objectifs annuels).
- Modération assistée (filtre automatique des insultes, limitation du nombre d'avis par jour).
