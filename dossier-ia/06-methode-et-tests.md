# Méthode de travail et outils de test

## Méthode à conserver (fixée par la feuille de route)
1. `node --check` sur chaque fichier JavaScript modifié.
2. Tests Playwright/Chromium après chaque évolution importante, avec des API simulées.
3. Aucune erreur JavaScript (`pageerror`) tolérée.
4. Vérification mobile à 375 px : pas de défilement horizontal (`scrollWidth > innerWidth`).
5. Règles Firestore modifiées → le propriétaire les publie → test réel avec des comptes temporaires, supprimés ensuite.
6. Commits en français, descriptifs, sur `claude/youthful-archimedes-zcrfu4`.
7. Contrôle de la publication GitHub Pages après chaque push (onglet Actions, workflow « pages build and deployment »).
8. Échappement HTML avec `esc()` et encodage des URL avec `enc()`.
9. Captures d'écran pour contrôler le rendu (clair, mobile).

## Outils fournis (`outils-de-test/`)

Les scripts utilisent le chemin absolu `/home/user/Site-test-A` et Chromium installé en `/opt/pw-browsers/chromium`. Il faut adapter ces chemins à l'environnement. Installation : `npm i playwright`.

| Fichier | Rôle |
|---|---|
| `fsmock.mjs` | Simulateur de l'API REST Firestore (documents, collections, `runQuery`, `:commit` avec préconditions et dates serveur) + helpers d'installation des routes. |
| `fakefb.js` | Faux SDK Firebase Auth, injecté à la place de `vendor/firebase-*.js` (comptes `u123`, mot de passe valide `goodpass1`, vérification d'e-mail simulée). |
| `tq.js` | Tests unitaires du service qualité (normalisation, fautes, clé d'œuvre, dédoublonnage, faux positifs, pertinence, suggestions). Exécution : `node tq.js`. |
| `t14.mjs` | v1.1 : faux positifs de genre, fusion des éditions, filtres, autocomplétion, aucun résultat, mobile. |
| `t15.mjs` | v1.2 : bibliothèque sans compte puis avec compte (transfert), listes publiques, profil. |
| `t16.mjs` | v1.3 : pseudos (pris, invalides, renommage), e-mail non vérifié, signalement, modération, avatar. |
| `t17.mjs` | Avis : création, modification, suppression avec la méthode d'écriture serveur. |
| `t18.mjs` | v1.4 : nombre de requêtes, cache, mutualisation, parallélisme. |
| `t19.mjs` | v2.0 : BnF (lecture SRU, fusion) et repli si la BnF est refusée. |
| `t20.mjs` | v2.0 : en-tête, accessibilité, à propos, lien partagé, suivre, fil d'actualité, pastille. |
| `verify4.py` | Vérification **sur la vraie base** des règles (31 tests) avec deux comptes temporaires, nettoyage inclus. Exécution : `python3 verify4.py`. |
| `gen-img.mjs` | Génère les PNG (icônes, image de partage) à partir de `icon.svg`. |

## Simuler sans réseau
Les tests interceptent :
- `https://www.googleapis.com/**` et `https://openlibrary.org/**` pour fournir des livres ;
- `https://firestore.googleapis.com/**` via `fsmock.mjs` ;
- les fichiers `vendor/firebase-*.js` via `fakefb.js`.

Ils chargent ensuite `file:///…/index.html#/…`.
