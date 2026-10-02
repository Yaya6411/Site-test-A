# Données et sécurité

## Collections Firestore

| Chemin | Champs | Qui lit | Qui écrit |
|---|---|---|---|
| `reviews/{uid}__{bookKey}` | `uid`, `bookKey`, `title`, `rating` (1–5), `name`, `comment` (≤ 2000), `createdAt` (serveur), `updatedAt` (serveur), `hidden` | Tout le monde (les avis masqués sont filtrés par le site) | Création : compte à l'e-mail vérifié, un avis par livre. Modification : l'auteur (note, commentaire, pseudo) ou un modérateur (`hidden`). Suppression : l'auteur ou un modérateur. |
| `reports/{uidSignaleur}__{idAvis}` | `reviewId`, `reviewUid`, `bookKey`, `title`, `reason` (spam, abuse, spoiler, offtopic, other), `reporterUid`, `createdAt` (serveur) | Modérateurs | Tout compte connecté, un signalement par avis ; suppression par un modérateur |
| `admins/{uid}` | quelconque | Le compte concerné seulement | Console Firebase uniquement |
| `usernames/{pseudo en minuscules}` | `uid` | Tout le monde | Le propriétaire du compte, en même temps que son profil |
| `users/{uid}` | `name` (2–30, unique), `nameLower`, `createdAt`, `photoURL`, `avatar`, `showLibrary` | Tout le monde | Le compte lui-même ; doit posséder le pseudo correspondant |
| `users/{uid}/library/{bookKey}` | `title`, `authors`, `cover`, `isbn`, `year`, `pages`, `status` (vide, to-read, reading, read), `favorite`, `addedAt`, `updatedAt`, `readAt` | Le compte, ou tout le monde si `showLibrary` | Le compte |
| `users/{uid}/lists/{listId}` | `name`, `public`, `items` (≤ 200), `createdAt`, `updatedAt` | Le compte, ou tout le monde si `public` | Le compte |
| `users/{uid}/following/{autre}` et `users/{autre}/followers/{uid}` | `createdAt` (serveur) | Tout le monde | Le compte qui suit, les deux documents ensemble |

Ne sont **jamais** stockés dans Firestore : l'adresse e-mail et le mot de passe (Firebase Authentication), l'historique de consultation, les préférences et le cache (navigateur).

## Points clés des règles (`firestore.rules`)

- Fonctions : `signedIn()`, `isUser(uid)`, `isAdmin()` (existence de `admins/{uid}`), `verified()` (`email_verified`), `changed()` (champs modifiés).
- Les dates `createdAt`/`updatedAt` des avis doivent valoir `request.time` : elles ne peuvent pas être falsifiées.
- Unicité des pseudos : `users` exige un document `usernames/{nameLower}` qui appartient au compte (`getAfter`), et `usernames` exige que le profil pointe vers ce pseudo.
- Abonnements : `following` et `followers` exigent chacun l'existence de l'autre (`existsAfter`), ce qui empêche les faux abonnés.
- Toutes les écritures contrôlent la liste des champs autorisés, leurs types et leurs longueurs.

## Vérifications réalisées sur la vraie base

Les tests ont été faits avec des comptes temporaires créés par l'API, puis **supprimés avec toutes leurs données**.

**Première série (avis et profils, avant la feuille de route)** : création de compte, connexion, session, connexion Google disponible, domaines autorisés ; avis accepté, doublon refusé, avis au nom d'un autre refusé, sans connexion refusé ; modification par l'auteur acceptée, refusée pour les autres, note invalide, commentaire trop long, changement d'`uid` ou de `bookKey` refusés ; profils et recherche de lecteurs.

**Dernière série (règles v1.2 à v2.0) : 31/31 réussies.**
- Pseudos : réservation, pseudo pris refusé, utilisation sans réservation refusée, changement avec libération de l'ancien, suppression par un autre refusée.
- Profil : avatar accepté, avatar trop long refusé.
- Avis : publication refusée pour un e-mail non vérifié.
- Bibliothèque : écriture par le propriétaire, statut invalide refusé, écriture par un autre refusée, lecture privée par défaut puis publique sur choix.
- Listes : privée illisible, publique lisible sans compte, modification par un autre refusée.
- Abonnements : suivre et se désabonner, faux abonnement et faux abonné refusés, abonnés lisibles.
- Modération : motif invalide et signalement au nom d'un autre refusés, lecture des signalements et masquage refusés aux non-modérateurs, statut de modérateur lisible seulement pour soi.

**Non testé automatiquement** (à faire à la main) :
- publication d'un avis par un compte vérifié : les comptes de test ne peuvent pas confirmer leur e-mail ;
- création réelle d'un signalement : ne pas laisser de faux signalement en base ;
- actions d'un modérateur.
