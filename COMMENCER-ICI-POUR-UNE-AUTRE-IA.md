# Biblio FR — dossier de transmission à une autre IA

## Point de départ

Ce dossier contient le projet Biblio FR dans son état de travail **v12 — catalogue vérifié**, avec le code, les ressources graphiques, les règles Firestore copiées dans le dossier de documentation, les scripts de test disponibles et les documents de reprise existants.

**Commencer par lire dans cet ordre :**
1. `dossier-ia/00-LISEZ-MOI.md` — consignes obligatoires.
2. `dossier-ia/02-etat-actuel.md` — architecture et fonctionnalités documentées.
3. `dossier-ia/07-points-ouverts.md` — limites et vérifications restantes.
4. `dossier-ia/08-ameliorations-catalogue-v11.md` — changements d'enrichissement du catalogue.
5. `dossier-ia/09-comparaison-catalogue.md` — résultats et limites des tests simulés.
6. `dossier-ia/10-transmission-v12.md` — état de cette livraison et prochaines étapes.

## Consignes prioritaires

- Répondre, documenter et rédiger les commits en français simple.
- Garder HTML/CSS/JavaScript vanilla et l'ordre de chargement des scripts de `index.html` ; ne pas migrer vers un framework.
- Avant de modifier le code, comparer l'état réel du dépôt avec les documents de reprise : certains documents décrivent l'état initial du projet et ne reflètent pas forcément chaque finition visuelle apportée ensuite.
- Sécurité : utiliser `esc()` pour le texte injecté dans le HTML et `enc()` pour les URL.
- Ne jamais publier de faux avis ni de fausses données dans la base réelle.
- Ne modifier les règles Firestore que si nécessaire. Toute modification doit être reportée manuellement par le propriétaire dans Firebase puis vérifiée sur la vraie base avec des comptes temporaires supprimés ensuite.
- Ne pas publier automatiquement. Toute publication nécessite l'accord explicite du propriétaire.
- Avant une publication : `node --check` sur les JS modifiés, tests disponibles, tests Playwright, aucune erreur JS, contrôle mobile à 375 px sans défilement horizontal, puis vérification GitHub Pages.

## État de validation honnête

Les scripts de test de catalogue inclus vérifient des scénarios simulés. Ils ne démontrent pas à eux seuls que Google Books, Open Library ou la BnF renvoient effectivement davantage de livres en conditions réelles. Les appels réels aux API, la comparaison avant/après sur un échantillon réel, Playwright/Chromium et le contrôle visuel mobile restent à réaliser dans un environnement qui le permet.

Ne pas présenter les tests simulés comme une validation en production. Ne pas prétendre que la version est prête à publier tant que les contrôles manquants n'ont pas été exécutés.
