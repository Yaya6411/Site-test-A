# Version de travail v11 — enrichissement du catalogue

## Objectif
Améliorer la découverte des livres français, en particulier dans les genres dont les libellés sont parfois indexés différemment par les catalogues externes, sans changer l'architecture du site.

## Modifications
- `js/services/sources.js` : ajout de variantes de recherche ciblées pour littérature française, fantasy, science-fiction, mangas (shōnen, shōjo, seinen, light novels), BD/comics/romans graphiques/manhwa, albums et romans jeunesse, Young Adult et documentaires jeunesse.
- Les variantes sont interrogées uniquement lorsqu'une recherche de genre/récente ne retourne aucun livre exploitable. Les recherches exactes par ISBN, titre, auteur et les recherches globales ne sont pas élargies.
- Google Books : si la première requête contient des résultats mais que tous sont filtrés, les variantes peuvent maintenant être essayées au lieu de conclure immédiatement à une recherche vide.
- Open Library : les variantes des recherches par genre restent des recherches par sujet, avec le filtre de langue française, afin d'éviter d'élargir inutilement aux livres simplement mentionnant le genre.
- `js/services/quality.js` : les mots-clés de ces variantes sont aussi pris en compte dans le score de pertinence d'un genre.
- Ajout du test hors réseau `dossier-ia/outils-de-test/t21-catalogue.js` pour vérifier le repli ciblé de Google Books.

## Garde-fous
- Aucun livre, avis, auteur ou résultat fictif n'est ajouté au catalogue réel.
- Aucun changement de `data.js`, `firestore.rules`, Firebase, comptes ou données Firestore.
- Les nouveautés restent limitées à l'année courante et à la précédente par la fonction existante `recentOnly()` de `js/views/discover.js`.
- Les nouvelles requêtes peuvent consommer quelques appels API supplémentaires, mais uniquement en cas de résultat vide/non exploitable. Les résultats continuent d'utiliser le cache existant.

## Vérifications réalisées
- `node --check` sur les fichiers JavaScript du projet.
- `dossier-ia/outils-de-test/tq.js` exécuté après adaptation temporaire de son chemin local absolu ; tous les contrôles affichés sont cohérents.
- `dossier-ia/outils-de-test/t21-catalogue.js` exécuté : test de repli ciblé réussi sans accès réseau réel.

## Limites non validées
- Les résultats réels des API Google Books et Open Library n'ont pas été exhaustivement comparés depuis cet environnement.
- Les tests Playwright/Chromium complets et le contrôle visuel à 375 px restent à effectuer avant toute publication, conformément à `06-methode-et-tests.md`.
