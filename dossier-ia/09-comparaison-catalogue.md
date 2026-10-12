# Comparaison ciblée du catalogue — v11

## Méthode

Une matrice hors réseau a été exécutée sur les sources de la v10 (base de comparaison) et de la v11 (avec variantes ciblées). Les mêmes réponses simulées ont été fournies aux deux versions : la requête principale et la requête simple renvoient zéro livre exploitable, puis une variante de genre renvoie un livre français de test.

Les cas couvrent : littérature française, fantasy, mangas, BD, jeunesse et documentaires jeunesse. Deux garde-fous sont également testés en v11 : arrêt dès qu'une requête principale trouve un livre exploitable et absence d'élargissement d'une recherche exacte par titre.

## Résultats

| Version / test | Résultat |
|---|---:|
| v10 — variantes de secours absentes dans les six scénarios distincts | 0/6 livres retrouvés |
| v11 — variantes ciblées simulées | 6/6 livres retrouvés |
| v11 — arrêt quand la requête principale fonctionne | Réussi |
| v11 — recherche exacte non élargie | Réussi |

La v10 échoue dans ces scénarios parce qu'elle n'essaie que la requête avancée puis la requête simple. La v11 essaie les variantes ciblées quand aucun livre exploitable n'a été obtenu.

## Limites importantes

- Il s'agit de tests déterministes avec réponses simulées, pas de données bibliographiques réelles.
- L'accès réseau à Google Books et Open Library n'était pas disponible pendant cette vérification ; aucun nombre de livres réellement récupérés ne peut donc être annoncé.
- Les tests ne valident pas à eux seuls la précision des genres, la fraîcheur des nouveautés, la qualité des couvertures ni les résultats sur toutes les requêtes possibles.
- Avant publication, il reste nécessaire d'exécuter les tests Playwright et de vérifier le site à 375 px, selon la méthode du projet.

## Exécution reproductible

Depuis le dossier du projet :

```bash
node dossier-ia/outils-de-test/t22-comparaison-catalogue.js
```

Les livres de test ne sont utilisés qu'en mémoire ; aucune écriture n'est effectuée dans Firestore.
