# Tests automatiques, classement préparé, pages auteurs et genres — 20/10

## Tests automatiques (`.github/workflows/tests.yml`)
- Ils se lancent à chaque modification poussée sur `claude/youthful-archimedes-zcrfu4`, à chaque pull request, et à la main depuis Actions → « Tests ».
- Script `dossier-ia/outils-de-test/lancer-tests.sh` :
  - `node --check` sur tout le JavaScript ;
  - `tq.js`, `t21`, `t22` ;
  - Playwright `t14` à `t20`, `t26`, `t27`, `t28`, avec des API simulées et le site servi en HTTP local.
- Le passage échoue sur : un code de sortie non nul, une erreur JavaScript (`errs [ '…`), un défilement horizontal, ou un « ÉCHEC » affiché.
- GitHub envoie un e-mail au propriétaire en cas d'échec.
- Variables : `SITE_DIR`, `CHROMIUM`, `NODE_PATH_PW`, `PORT`. Les tests acceptent `CHROMIUM` pour le navigateur ; `t21` et `t22` acceptent `SITE_DIR`.
- Dans GitHub Actions, le dépôt est relié à `/home/user/Site-test-A`, le chemin utilisé par les tests.
- **Limite** : GitHub Pages publie directement la branche, donc un test en échec ne bloque pas la mise en ligne, il prévient seulement. Pour bloquer, il faudrait passer Pages en mode « GitHub Actions » (déploiement après les tests). Les robots, dont les commits ne déclenchent pas les workflows, devraient alors lancer eux-mêmes le déploiement.

## Classement préparé (`scripts/robot-classement.mjs`, `.github/workflows/classement.yml`)
- Chaque jour à 3 h 41 UTC, le robot lit une fois tous les avis publics et calcule les classements semaine, mois et depuis toujours, avec les mêmes règles que `rankBooks`. Il retrouve aussi la fiche des 10 premiers de chaque période (gardée 30 jours).
- Il écrit `data/classement.json` si le classement change, et au moins tous les 3 jours.
- La page Classement lit ce fichier (`loadRankingFile`) et affiche « mis à jour chaque matin ». Elle calcule en direct si le fichier manque ou a plus de 8 jours.
- **Conséquence** : un avis publié aujourd'hui entre dans le classement le lendemain matin.
- Les deux robots partagent le groupe de concurrence `robots-donnees` et font `git pull --rebase` avant d'envoyer.

## Pages auteurs et genres (`scripts/robot-nouveautes.mjs` + `scripts/pages-livres.mjs`)
- `data/auteurs-genres.json` est rempli par Open Library uniquement (aucun quota Google), en ne gardant que les éditions françaises (lien `/books/…`), sinon Open Library donne le titre original (« The Stranger »). Correctif du 26/10 : les titres manifestement anglais sont aussi écartés (version 3 du fichier). Chaque semaine : les 74 genres (24 livres) et les 80 auteurs mis en avant dont la liste est la plus ancienne (12 livres). Chaque liste est gardée 60 jours ; les 572 auteurs sont couverts en environ 7 semaines.
- Pages générées :
  - `livres/genre-<id>.html` si le genre a au moins 4 livres ou des nouveautés ;
  - `livres/auteur-<nom>.html` si l'auteur a au moins 2 livres ou un incontournable.
- Chaque page contient une grille de couvertures (avec secours dessiné), un lien vers la page interactive (`#/genre/…`, `#/auteur/…`), des liens vers les genres proches ou les autres auteurs de la même catégorie, et des données structurées (`CollectionPage`, `ProfilePage`).
- Le sommaire `livres/` commence par Genres et Auteurs. Tout figure dans `sitemap.xml`.
- `scripts/contexte-site.mjs` regroupe le chargement du code du site dans Node, commun aux deux robots.
