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
  - `data/incontournables.json` : fiche de chaque incontournable, avec la même correspondance que `findMustRead`. Une fiche trouvée est gardée 90 jours ; les livres non trouvés sont retentés chaque semaine. Cette étape est limitée à 10 minutes (4 recherches en parallèle, 20 s maximum par requête) ; ce qui reste est repris la semaine suivante.
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
- **Passages réels du 12/10** : 306 nouveautés trouvées (Google Books, Open Library, BnF) ; 81 incontournables préparés sur 258 au premier enregistrement, le reste est complété chaque semaine. Genres encore maigres dans la sélection : manga (4), BD (1), young adult (1) ; pour eux, le site cherche en direct (seuil de 8 livres).

## Améliorations du 20/10
- **Genres maigres** (mangas, BD, young adult, jeunesse) : en plus de la recherche par sujet, le robot interroge les catalogues d'éditeurs spécialisés (`PUBLISHER_QUERIES` : Ki-oon, Kana, Pika… ; Dargaud, Dupuis, Le Lombard… ; Pocket Jeunesse, Rageot… ; L'École des loisirs…) dans Google Books (`inpublisher:`), Open Library (`publisher=`) et la BnF (`bib.publisher`). Un livre est gardé s'il est récent et si ses catégories, quand il en a, correspondent au genre (`GENRE_FIT`).
- **Liste « Tout »** : elle mélange les genres (romans, polars, fantasy, mangas, BD…) avant les résultats généraux, pour ne plus être dominée par les essais et les guides pratiques.
- **Couvertures vérifiées** : chaque image candidate est téléchargée une fois. Le robot garde la première qui fonctionne, ou aucune (le site dessine alors une couverture). Open Library limite les recherches par ISBN : 80 au plus par passage. Le résultat est mémorisé (`coversChecked`). Ordre d'affichage : année, puis livres avec couverture.
- **Incontournables** : correspondance plus souple dans `bestMustMatch`. Le nom de l'auteur est comparé mot à mot, quel que soit l'ordre (catalogues japonais « Isayama Hajime »). Sont aussi acceptés le titre suivi d'un tome et un titre long contenu dans le titre de l'édition (« Millénium 1 — Les hommes qui n'aimaient pas les femmes »). Deuxième essai par titre seul.
- **Pages pour les moteurs de recherche** (`scripts/pages-livres.mjs`) : une vraie page HTML par livre dans `livres/` (incontournables et nouveautés). Chaque page contient le titre, l'auteur, l'éditeur, l'ISBN, le résumé, la couverture avec secours dessiné, des données structurées schema.org `Book`, les 7 librairies et un lien vers la fiche interactive (avis, notes). S'y ajoutent un sommaire `livres/index.html` et un `sitemap.xml` régénéré. Une page n'est réécrite que si son contenu change ; les pages des livres sortis des listes sont supprimées. Le pied de page du site renvoie vers `livres/`.
- **Liens partagés** : `#/livre/<id>` ouvre directement les fiches préparées par le robot, sans appel aux sources (y compris les fiches BnF).
- **Workflow** : `actions/checkout@v5`, `actions/setup-node@v5`, Node 22 (fin de Node 20 sur GitHub).
- **Correctif après le passage réel du 20/10** : des éditeurs généralistes (Glénat : BD et jeunesse ; Casterman : romans) faisaient entrer des intrus dans les mangas et le young adult. Les éditeurs sont désormais classés « exclusifs » (livre sans catégorie accepté) ou « mixtes » (une catégorie doit confirmer le genre), et l'éditeur du livre doit correspondre exactement (« Kana » ≠ « Kanaé »). Biographies et développement personnel ne font plus partie du mélange « Tout ». `FILTER_VERSION` : quand les règles changent, les listes concernées repartent de zéro.
