# Transmission v12 — catalogue

## Version fournie

Cette archive est basée sur `Biblio-FR-catalogue-verifie-v12.zip`, qui inclut les changements de recherche de secours de la v11, le test de comparaison `dossier-ia/outils-de-test/t22-comparaison-catalogue.js` et le rapport `dossier-ia/09-comparaison-catalogue.md`.

## Objectif utilisateur

Enrichir le catalogue existant sans changer son architecture, avec ces priorités :
- davantage de livres français ;
- mangas et BD ;
- recherche plus pertinente ;
- fantasy et science-fiction ;
- nouveautés plus fiables ;
- couvertures et fiches plus complètes ;
- jeunesse et essais.

## Ce qui est connu

- La stratégie de recherche de secours et ses variantes sont documentées dans `08-ameliorations-catalogue-v11.md`.
- Les tests du dossier comparent des réponses simulées.
- Le score de réussite des tests simulés ne mesure pas le volume ou la qualité des résultats d'API réelles.
- Les sources mentionnées par le projet sont Google Books, Open Library et une intégration expérimentale de la BnF.
- Les limites connues incluent la couverture inégale, les faux positifs de genres, les quotas d'API et la disponibilité variable des couvertures.

## Prochaines étapes recommandées

1. Lire les documents de reprise et inspecter le code réel, notamment `js/services/sources.js`, `js/services/search.js`, `js/services/quality.js`, `js/views/discover.js` et `data.js`.
2. Préparer un protocole reproductible d'échantillonnage pour les genres demandés (littérature française, mangas, BD, fantasy, science-fiction, jeunesse, essais et nouveautés).
3. Dans un environnement réseau autorisé, exécuter la même liste de requêtes sur les API réelles avant/après et consigner : nombre de résultats, pertinence manuelle, langue, faux positifs, doublons, métadonnées et couverture.
4. Respecter les quotas ; ne pas ajouter de requêtes parallèles inutiles et ne pas contourner les limites des fournisseurs.
5. Corriger uniquement les problèmes démontrés, ajouter des tests de non-régression, exécuter `node --check` et les tests existants.
6. Tester visuellement et avec Playwright sur ordinateur et à 375 px. Si Chromium n'est pas disponible, noter clairement ce qui n'a pas été testé.
7. Livrer une nouvelle archive testable et un rapport de modifications ; ne jamais publier sans autorisation explicite.

## Sécurité et données

Ne pas écrire de faux livres dans le catalogue comme s'ils provenaient des sources. Les données de test doivent rester simulées ou utiliser des comptes temporaires explicitement nettoyés. Ne pas changer les règles Firestore ni toucher à la vraie base pour une amélioration purement catalogue.
