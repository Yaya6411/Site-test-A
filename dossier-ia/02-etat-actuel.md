# État actuel du site (version 2.0)

## Pages et fonctionnalités

| Page (URL) | Ce qu'on y trouve |
|---|---|
| Accueil `#/` | Présentation, genres principaux, auteurs, incontournables, étagères « Sorties récentes », « Mangas », « Romans ». |
| Genres `#/genres`, `#/genre/<id>` | 70 genres en 6 familles (Littérature, Imaginaire, Mangas & BD, Jeunesse, Savoirs & essais, Vie pratique). |
| Auteurs `#/auteurs`, `#/auteur/<nom>` | 333 auteurs en 15 catégories, filtre par catégorie, recherche libre avec autocomplétion. |
| Recherche `#/recherche/<all|title|author|isbn>/<texte>` | Résultats classés par pertinence ou par date, filtres Année / Auteur / Genre, « Charger plus », suggestions si aucun résultat. |
| Fiche livre (fenêtre) | Couverture, auteurs, éditeur, date, pages, ISBN, catégories, résumé, boutons d'achat (7 librairies), partage, statut de lecture et favori, ajout à une liste, avis des lecteurs. |
| Lien partagé `#/livre/<id>` | Ouvre la fiche d'un livre (identifiants `g-…` Google, `ol-…` Open Library). |
| Classement `#/classement` | Livres ayant reçu le plus d'avis (7 jours, 30 jours, depuis toujours). |
| Nouveautés `#/nouveautes[/<genre>]` | Parutions en français de l'année en cours et de la précédente, badge « Nouveau ». |
| Incontournables `#/incontournables[/<catégorie>]` | 133 livres de référence en 9 catégories, fiches retrouvées automatiquement. |
| Lecteurs `#/lecteurs`, `#/lecteur/<uid>` | Recherche par pseudo, profils publics : avatar, statistiques, répartition des notes, avis, bibliothèque et listes publiques, abonnés / abonnements, bouton « Suivre ». |
| Ma bibliothèque `#/bibliotheque/<onglet>` | En cours, À lire, Lus, Favoris, Mes listes, Historique ; statistiques (lus, lus dans l'année, pages, avis, note moyenne). |
| Liste partagée `#/liste/<uid>/<listId>` | Liste publique d'un lecteur. |
| Fil d'actualité `#/fil` | Derniers avis des lecteurs suivis, pastille des nouveautés dans le menu. |
| Mon compte `#/compte` | Pseudo unique, avatar, vérification de l'e-mail, identifiant de compte, confidentialité (afficher sa bibliothèque), mot de passe, mes avis (modifier, supprimer), déconnexion, suppression du compte. |
| Modération `#/moderation` | (Modérateurs) signalements regroupés par avis ; masquer, réafficher, supprimer, classer sans suite ; avis masqués. |
| À propos `#/a-propos` | Projet, sources, liens d'achat, avis et modération, tableau des données personnelles, accessibilité. |
| Préférences ⚙️ | Source du catalogue (toutes, Google, Open Library, BnF expérimentale), librairie préférée, vider le cache. |

## Règles de fonctionnement importantes

- **Avis** : il faut un compte dont l'e-mail est confirmé. Un seul avis par compte et par livre, modifiable et supprimable par son auteur. Les dates sont fixées par le serveur. Bouton « Signaler » sur les avis des autres.
- **Bibliothèque** : enregistrée dans le navigateur sans compte, puis transférée dans le compte à la connexion. Privée sauf choix contraire. L'historique reste toujours dans le navigateur.
- **Pseudos** : uniques (insensibles aux majuscules), 2 à 30 caractères (lettres, chiffres, espaces, `_ . ' -`). Un pseudo libre est attribué automatiquement s'il est déjà pris lors d'une connexion Google.
- **Catalogue** : sources interrogées en parallèle, éditions regroupées, faux positifs de genre écartés, langue française contrôlée, « non-livres » filtrés, résultats en cache (6 h à 7 jours).

## Organisation du code

Site statique sans outil de build. Scripts classiques chargés dans cet ordre par `index.html` (chaque fichier utilise les précédents) :

```
data.js                        configuration (clés, projet Firebase) et données (genres, auteurs, incontournables, librairies)
vendor/firebase-app-compat.js  SDK Firebase 12.19.0 (Apache 2.0)
vendor/firebase-auth-compat.js
js/core/util.js                état global (app, bookCache), préférences, esc(), enc(), storeUrl(), setPageMeta()
js/services/cache.js           cache persistant, requêtes mutualisées, parallélisme limité
js/services/sources.js         Google Books, Open Library, BnF ; normalisation ; couvertures ; filtre des non-livres ; fetchBookById
js/services/quality.js         norm(), fautes de frappe, workKey()/dedupeWorks(), pertinence, suggestions
js/services/search.js          fetchFrom(), fetchSources(), searchBooks() (pipeline complet)
js/services/firestore.js       accès REST à Firestore (get, list, patch, remove, runQuery, commit)
js/ui/components.js            couvertures, cartes livre, squelettes de chargement
js/ui/autocomplete.js          autocomplétion accessible
js/ui/book.js                  fiche livre, partage, liens #/livre/
js/views/catalog.js            accueil, genres, auteurs, résultats (filtres)
js/features/auth.js            comptes, fenêtre de connexion, Mon compte
js/features/reviews.js         avis
js/features/profiles.js        profils publics, pseudos uniques, avatars, lecteurs
js/features/library.js         bibliothèque, listes, historique
js/features/moderation.js      signalements, modérateurs
js/features/social.js          abonnements, fil d'actualité
js/views/discover.js           classement, nouveautés, incontournables
js/views/about.js              à propos
js/router.js                   routeur (au DOMContentLoaded), événements globaux
```

Autres fichiers : `style.css` (thème clair/sombre, responsive), `firestore.rules`, `icon.svg` + PNG, `manifest.webmanifest`, `og-image.png`, `robots.txt`, `sitemap.xml`, `.nojekyll`.

## Format interne d'un livre

```js
{ id, title, authors[], year, publisher, pages, categories[], description, isbn, covers[], link,
  editions?, altIds? }   // editions/altIds : présents quand plusieurs éditions ont été regroupées
```
- `id` : `g-…` (Google), `ol-…` (Open Library), `bnf-…` (BnF), `lib-…` (reconstruit depuis la bibliothèque).
- `reviewKey(book)` = « titre principal normalisé | nom de famille du premier auteur » : clé commune des avis et de la bibliothèque.
- `workKey(book)` = titre sans mentions d'édition + n° de tome + nom de l'auteur : clé de regroupement des éditions.
