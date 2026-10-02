# Historique complet du projet

Chronologie des demandes du propriétaire, des problèmes rencontrés et des réponses apportées. Les identifiants entre crochets sont les commits Git correspondants.

## Journée 1 — Création et premières fonctionnalités

### 1. Demande initiale
> « Un site répertoriant l'intégralité des livres disponibles en français, y compris les mangas, classés par genre ou par auteur, avec pour chaque livre un lien vers une plateforme qui le vend. »

- **Constat** : il n'existe aucun catalogue libre et complet de tous les livres en français. Le site interroge donc **en direct** des API publiques (Google Books avec `langRestrict=fr`, Open Library avec `language=fre`) au lieu de stocker un catalogue.
- Création d'un site statique : 28 genres, 30 auteurs mis en avant, recherche (tout, titre, auteur, ISBN), fiche livre en fenêtre, 7 librairies (Leslibraires.fr, Fnac, Amazon.fr, Decitre, Cultura, Place des Libraires, Rakuten). [20a9e96]

### 2. Obtenir un lien testable
- Impossible de publier comme « artifact » : les pages hébergées par Claude bloquent les appels aux API externes.
- Le dépôt était **privé** : le propriétaire l'a rendu public et a activé **GitHub Pages** (Deploy from a branch, `/ (root)`).
- Problème : un domaine personnalisé « test » avait été saisi par erreur (bandeau d'erreur) → conseil de le laisser vide.
- Problème : page 404 → aucune publication n'avait été lancée. Ajout de `.nojekyll`, ce qui a déclenché la publication. [2fa2145]

### 3. « Google Books limite temporairement les requêtes »
- Bascule automatique vers Open Library quand une source échoue (la source en échec est mise de côté 5 minutes), cache en mémoire, bouton « Réessayer ». [355b0e6]

### 4. Plus de sources de couvertures et plus de références
- Couvertures essayées en chaîne (source → Open Library par ISBN → Amazon par ISBN-10), sinon couverture dessinée (titre et auteur).
- Mode « toutes les sources » par défaut (résultats fusionnés et dédoublonnés), 58 genres, plus de 140 auteurs. [981694c]

### 5. Google ne marche pour aucun livre ; liens d'achat vers des pages vides ; couvertures en version française
- **Diagnostic** : l'API Google Books répond « Quota exceeded … Queries per day ». Sans clé, le quota est partagé entre tous les sites → une clé API est nécessaire.
- **Liens d'achat** : la recherche par ISBN donnait des pages vides chez les revendeurs → passage à une recherche **titre + auteur** (formats d'URL de Leslibraires, Decitre et Cultura vérifiés).
- **Open Library** : récupération de l'**édition française** (champ `editions`), donc titre, couverture, ISBN et éditeur français. [e8b42c2]

### 6. Clé Google Books fournie
- Clé ajoutée. Google exigeait `country=FR`. Les recherches avancées (`inauthor:`, `subject:`…) renvoyaient 0 résultat depuis le serveur de développement → seconde tentative automatique en recherche simple.
- Le propriétaire a restreint la clé à son site ; une restriction trop précise (`…/Site-test-A/`) a été corrigée en `https://yaya6411.github.io/*`. [f6f83f2]

### 7. Notes et commentaires
- Note de 1 à 5 étoiles et commentaire, regroupés par titre + auteur (toutes les éditions partagent leurs avis). D'abord stockés dans le navigateur. [9a3f21b]
- Pour des avis partagés entre visiteurs : création de **Cloud Firestore** (mode production) et de règles de sécurité. Projet Firebase `test-biblio-998a1`. [7f2f74c]

### 8. Système de création de compte
- **Firebase Authentication** (e-mail + mot de passe, connexion Google), SDK 12.19.0 inclus dans `vendor/` (le CDN était bloqué en développement). Page « Mon compte ». Avis réservés aux comptes, un seul par compte et par livre. [cf84cf7]
- **Problème** : `CONFIGURATION_NOT_FOUND`. La clé Books appartenait à un **autre projet Google Cloud** (n° 996347818998) que Firebase (n° 929493062325) ; les deux s'appellent « test biblio ». Solution : enregistrer une application web dans Firebase et utiliser sa propre clé (`FIREBASE_API_KEY`), restreinte au site et à `test-biblio-998a1.firebaseapp.com`. [c84f30d]

### 9. Onglet tendances / plus vendus → classement et nouveautés
- La demande « tendances du moment ou plus vendus » a été **abandonnée** par le propriétaire en cours de route (aucune source gratuite de chiffres de vente en France).
- Remplacée par : **Classement** des livres les plus commentés (semaine, mois, depuis toujours) et **Nouveautés** (parutions de l'année et de l'année précédente). [01f3056]

### 10. Retirer les agendas et coloriages, élargir auteurs et ouvrages
- Filtre des « non-livres » : agendas, calendriers, coloriages, mandalas, carnets vierges, sudoku, mots croisés, livres d'activités. « Livre d'or » volontairement retiré du filtre (vraie anthologie de SF).
- 333 auteurs en 15 catégories, 70 genres, page **Incontournables** (133 livres de référence en 9 catégories). [c6b6ddc]

### 11. Chercher des utilisateurs et voir leurs avis
- Profils publics (collection `users`, jamais d'e-mail), onglet **Lecteurs** (recherche par début de pseudo), page de profil (statistiques, répartition des notes, avis), pseudos cliquables. [af867cb]

### 12. Modifier son avis sans le republier
- Bouton « Modifier » (note et commentaire), mention « modifié le … », règles mises à jour. [15f5269]

### 13. Récapitulatif pour une autre IA
- Création de `RECAPITULATIF.md`. [f7ff405]

## Journée 2 — Application de la feuille de route

Le propriétaire a fourni un document « Feuille de route Biblio FR » (voir `05-feuille-de-route.md`). Il a été appliqué dans l'ordre recommandé, une version par publication :

| Étape | Contenu | Commit |
|---|---|---|
| Préparation | Découpage de `app.js` en modules `js/` (aucun changement de comportement) | 2a1e14f |
| v1.1 | Recherche sans accents, tolérante aux fautes, autocomplétion, filtres combinables, « Vouliez-vous dire » ; regroupement des éditions ; pertinence locale ; faux positifs de genre ; langue contrôlée ; couvertures en échec mémorisées | 2ff7790 |
| v1.2 | Bibliothèque personnelle : À lire / En cours / Lu / Favoris, listes (publiques et partageables), historique, statistiques ; option d'affichage sur le profil | 5457037 |
| v1.3 | E-mail vérifié pour publier, signalement, modération (rôle `admins`), pseudos uniques, date serveur, avatars | 37abbd3 |
| v1.4 | Cache persistant à durée par type, requêtes mutualisées, 4 requêtes max en parallèle | cbc4f25 |
| v2.0 | Source BnF expérimentale, suivre un lecteur, fil d'actualité, partage, nouvel en-tête, icône, SEO, à propos, accessibilité | 6ff7919 |

Ensuite :
- Le propriétaire a publié les nouvelles règles Firestore → **31 vérifications sur 31 réussies** sur la vraie base (voir `04-donnees-et-securite.md`).
- Le propriétaire s'est désigné modérateur (`admins/ILPYJs7k2aZDJFNUoskozqQBk6G2`, pseudo **yaya6411**) ; l'identifiant a été contrôlé.
- Création du présent dossier.

## Principales leçons (à retenir)

1. Les deux projets Google Cloud portent le même nom : toujours vérifier l'**ID** (`test-biblio-998a1` pour Firebase).
2. Une restriction de clé par site web doit se terminer par `/*`, et le domaine `firebaseapp.com` doit être autorisé pour la connexion Google.
3. Le réseau de l'environnement de développement bloquait Open Library, la BnF, les sites des libraires et GitHub Pages : les interfaces ont été testées avec des API simulées, et seules les API Google/Firebase ont pu être appelées en vrai.
4. Les règles Firestore sont la vraie protection du site : le code du navigateur peut être contourné.
