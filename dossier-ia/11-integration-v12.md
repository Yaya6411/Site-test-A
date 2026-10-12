# Intégration de la v12 (travail d'une autre IA) — 12/10

Le propriétaire a fourni l'archive `Biblio-FR-dossier-transmission-IA-v12.zip`, produite par une autre IA à partir de la v2.0. Elle a été examinée, testée, corrigée puis intégrée.

## Contenu de la v12
- **Catalogue (v11)** : variantes de recherche de secours par genre (`GENRE_QUERY_FALLBACKS` dans `js/services/sources.js`), essayées seulement quand la requête principale ne donne aucun livre exploitable ; mots-clés pris en compte dans la pertinence (`quality.js`). Tests `t21-catalogue.js` et `t22-comparaison-catalogue.js`.
- **Refonte visuelle** : nouvel accueil (bandeau illustré, 6 cartes d'univers, étagères « Sorties récentes » et « Incontournables »), polices DM Sans et Libre Baskerville (Google Fonts), icônes de menu, logo `assets/brand-book.svg`, bouton de thème clair/sombre, palette « librairie chaleureuse ».
- **Documentation** : `COMMENCER-ICI-POUR-UNE-AUTRE-IA.md`, `dossier-ia/08` à `10`.

## Vérifications faites à l'intégration
- Contenu de l'archive : seuls 7 fichiers modifiés et des ajouts (images, documents, tests) ; aucun fichier supprimé ; images SVG sans contenu actif.
- `node --check` sur tout le JavaScript ; `t21` réussi ; `t22` 8/8 ; `tq.js` ; tests Playwright existants (t8, t9, t14 à t20) sans erreur JavaScript ni défilement horizontal à 375 px.
- Contrôle visuel (nouveau test `t23-visuel-v12.mjs`) : accueil sur ordinateur, mobile, thème sombre, page genres, résultats sur mobile.
- Mesure des couleurs réelles par thème (nouveau test `t25-couleurs-themes.mjs`).

## Défauts trouvés et corrigés
1. **Thème sombre de l'appareil illisible** : sans clic sur le bouton de thème, un appareil réglé en sombre affichait un en-tête sombre mais une page claire, avec des liens de menu sombres sur fond sombre. Correction : un petit script dans `<head>` applique dès l'affichage `data-theme` (choix enregistré, sinon réglage de l'appareil), et `util.js` suit les changements de réglage tant qu'aucun choix n'est enregistré.
2. **Badge « Nouveau » masquant le titre** des livres sur les étagères de l'accueil : déplacé en haut à gauche de la couverture ; sur les couvertures dessinées, le titre commence sous le badge.
3. **« Tout » tronqué en « Tou »** dans la barre de recherche sur mobile : largeur minimale du sélecteur.
4. **Lettrages des illustrations visibles sous le texte** des cartes d'univers : voile renforcé (clair et sombre).

Les corrections sont regroupées à la fin de `style.css` (« Corrections après vérification visuelle »).

## Ce qui reste non démontré
- **Effet réel des variantes de recherche** : depuis l'environnement de développement, Google Books répond le plus souvent « 503 » et renvoie des résultats peu pertinents ; la comparaison avant/après sur l'API réelle est donc **non concluante**. À vérifier dans un navigateur (pages Fantasy, Mangas, BD, Jeunesse, Nouveautés).
- **Quota Google** : l'étagère « Incontournables » de l'accueil cherche jusqu'à 10 livres (une recherche chacun) pour un nouveau visiteur, mis en cache 7 jours ensuite ; les variantes de genre ajoutent quelques requêtes quand une recherche est vide. À surveiller (quota d'environ 1000 requêtes/jour).
- **Polices Google Fonts** : chargées depuis `fonts.googleapis.com` ; repli sur les polices système si indisponibles.
