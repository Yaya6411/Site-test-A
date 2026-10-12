# Robot hebdomadaire et listes allongées — 12/10

## Pourquoi
Les nouveautés étaient cherchées en direct à chaque visite. Cela consommait le quota Google (environ 1000 requêtes par jour), et la page restait vide quand Google était indisponible (erreurs 503). Les incontournables demandaient en plus une recherche par livre et par visiteur.

## Fonctionnement
- `.github/workflows/nouveautes.yml` se lance chaque **lundi à 4 h 17 UTC**. On peut aussi le lancer à la main depuis Actions → « Mise à jour des nouveautés » → « Run workflow ».
- Il exécute `scripts/robot-nouveautes.mjs`, qui charge **le vrai code de recherche du site** (`data.js`, `util.js`, `cache.js`, `sources.js`, `quality.js`, `search.js`) dans Node. Les filtres sont donc identiques : agendas et coloriages exclus, faux positifs de genre retirés, éditions fusionnées.
- **Sources** : Google Books, Open Library et la BnF. Côté serveur, la BnF n'a pas de blocage CORS ; elle est lue avec `@xmldom/xmldom`, installé par le workflow.
- **Clé Google** : le secret GitHub `GOOGLE_BOOKS_KEY` s'il existe. Sinon, le robot utilise la clé de `data.js` en envoyant l'adresse du site comme origine (en-tête `Referer`), puisque cette clé est limitée à `https://yaya6411.github.io/*`.
- **Sorties** :
  - `data/nouveautes.json` : liste « Tout » et une liste par genre de `RECENT_GENRES`, 60 livres au maximum chacune. Les livres de la semaine passent devant, et les anciens restent tant qu'ils sont récents (année en cours ou précédente). Si moins de 20 livres sont trouvés (sources en panne), l'ancien fichier est conservé.
  - `data/incontournables.json` : fiche de chaque incontournable, avec la même correspondance que `findMustRead`. Une fiche trouvée est gardée 90 jours ; les livres non trouvés sont retentés chaque semaine. Cette étape est limitée à 6 minutes (4 recherches en parallèle, 20 s maximum par requête) ; ce qui reste est repris la semaine suivante.
- Le workflow **commit** les fichiers sur `claude/youthful-archimedes-zcrfu4`, puis demande une republication GitHub Pages (`POST /pages/builds`).
- **Coût** : environ 60 requêtes Google pour les nouveautés. Pour les incontournables, environ 260 au premier passage, puis seulement les livres manquants.

## Côté site (`js/views/discover.js`)
- `loadWeeklyRecent()` lit `data/nouveautes.json`. Le fichier est ignoré s'il a plus de 21 jours.
- L'étagère de l'accueil et la première page des Nouveautés utilisent la sélection si elle compte au moins 8 livres.
- « Charger plus » poursuit en direct, sans doublons (identifiant et `workKey`).
- `findMustRead()` regarde d'abord `data/incontournables.json`, puis le cache local, puis le direct.

## Condition GitHub
GitHub ne lance les tâches **planifiées** que depuis la **branche par défaut** du dépôt. Celle-ci doit donc être `claude/youthful-archimedes-zcrfu4` (Settings → General → Default branch).

## Listes allongées
- Auteurs : 333 → **572**, mêmes 14 catégories.
- Incontournables : 133 → **258**, avec une nouvelle catégorie « Romance & feel-good ».
- Genres : 70 → **74** (Espionnage, Western, Fantasy urbaine, Space opera).
- Les compteurs des cartes d'univers de l'accueil sont mis à jour (Littérature 16, Imaginaire 11).

## Tests
- Robot avec API simulées (Google avec erreurs 503, Open Library, BnF XML) : 3 sources lues, agendas exclus, années anciennes exclues, nouvelle tentative après une 503, clé du secret prioritaire, conservation des dates d'ajout d'une semaine à l'autre.
- `t26-robot-nouveautes.mjs` : fichier présent, sur ordinateur et à 375 px ; fichier absent ; fichier trop ancien. Aucune erreur JavaScript et aucun défilement horizontal.
- `t14`, `t20` et `tq.js` passent toujours.
- **Non démontré** : le premier passage réel du robot sur GitHub (à lancer à la main après le changement de branche par défaut).
