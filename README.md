# Biblio FR — catalogue des livres en français

Site statique (HTML / CSS / JavaScript, sans dépendance) qui répertorie les livres disponibles en français :
romans, mangas, bandes dessinées, essais, jeunesse, etc.

## Fonctionnalités

- **Navigation par genre** : 70 genres regroupés en 6 familles (Littérature, Imaginaire, Mangas & BD — dont shōnen, shōjo, seinen —, Jeunesse, Savoirs & essais, Vie pratique).
- **Navigation par auteur** : plus de 330 auteurs mis en avant, filtrables par catégorie, + recherche de n'importe quel auteur.
- **Couvertures** : image de la source, puis Open Library et Amazon via l'ISBN ; à défaut, une couverture est dessinée avec le titre.
- **Incontournables** : 133 livres de référence en 9 catégories (classiques, mangas, BD, essais…).
- **Classement** des livres les plus commentés et **Nouveautés** (parutions récentes).
- **Filtre** des agendas, calendriers, coloriages, carnets vierges et livres de grilles.
- **Recherche** globale, par titre, par auteur ou par ISBN.
- **Fiche détaillée** de chaque livre (couverture, éditeur, date, ISBN, résumé).
- **Lien d'achat** pour chaque livre (par ISBN quand il est connu) vers Leslibraires.fr, Fnac, Amazon.fr,
  Decitre, Cultura, Place des Libraires ou Rakuten. La librairie par défaut se règle dans les préférences ⚙️.
- Tri par pertinence ou par date, pagination « Charger plus », thème clair/sombre automatique, responsive.

## Données

Aucun catalogue n'est stocké dans le dépôt : le site interroge en direct
[Google Books](https://developers.google.com/books) (filtre `langRestrict=fr`) ou
[Open Library](https://openlibrary.org/developers/api) (filtre `language=fre`), ce qui donne accès à des
centaines de milliers d'ouvrages en français sans maintenance. Par défaut les deux sources sont interrogées
en parallèle et leurs résultats fusionnés (sans doublons) ; si l'une est indisponible, l'autre prend le relais.
Le choix se fait dans les préférences.

## Lancer le site

Ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

Le site peut être publié tel quel sur GitHub Pages, Netlify, Vercel…

## Structure

| Fichier      | Rôle                                                   |
|--------------|--------------------------------------------------------|
| `index.html` | Squelette de la page                                   |
| `style.css`  | Mise en forme                                          |
| `data.js`    | Genres, auteurs mis en avant et librairies en ligne    |
| `app.js`     | Routage, appels aux API, affichage                     |

## Clé API Google Books (recommandée)

Sans clé, Google Books partage un quota journalier entre tous les sites qui l'appellent sans clé, et il est
généralement épuisé (erreur 429). Le site bascule alors sur Open Library, mais avec moins de résultats.

1. Aller sur https://console.cloud.google.com/ et créer un projet (gratuit).
2. Menu **API et services → Bibliothèque** : rechercher **Books API** et cliquer sur **Activer**.
3. Menu **API et services → Identifiants** : **Créer des identifiants → Clé API**.
4. Restreindre la clé (recommandé) : **Restrictions d'application → Sites web**, ajouter
   `https://yaya6411.github.io/*` ; **Restrictions d'API → Books API**.
5. Coller la clé dans `data.js` : `const GOOGLE_API_KEY = "votre-clé";`

La clé est visible dans le code du site : c'est normal pour cette API, la restriction au domaine empêche
qu'elle soit utilisée ailleurs.

## Notes et commentaires

Chaque fiche livre propose une note de 1 à 5 étoiles et un commentaire. Les avis sont regroupés par
titre + auteur, donc partagés entre les différentes éditions d'un même livre.

- **Sans configuration** : les avis sont enregistrés uniquement dans le navigateur du visiteur.
- **Avec Firebase (gratuit)** : les avis sont partagés entre tous les visiteurs.

### Activer les avis partagés

1. Aller sur https://console.firebase.google.com/ → **Créer un projet** → choisir le projet Google Cloud
   existant (celui de la clé Google Books).
2. Menu **Build → Firestore Database → Créer une base de données** (mode production, région `europe-west`).
3. Onglet **Règles** : coller le contenu du fichier `firestore.rules` puis **Publier**.
4. Dans https://console.cloud.google.com/apis/credentials, ouvrir la clé API et ajouter
   **Cloud Firestore API** dans **Restrictions d'API** (à côté de Books API).
5. Dans `data.js`, renseigner `const FIREBASE_PROJECT_ID = "identifiant-du-projet";`
   (visible dans Firebase → ⚙️ Paramètres du projet).

## Comptes utilisateurs

Création de compte par e-mail + mot de passe ou avec Google (Firebase Authentication), connexion,
mot de passe oublié et page **Mon compte** (pseudo, vérification de l'e-mail, liste et suppression de ses
avis, déconnexion, suppression du compte). Quand les avis partagés sont activés, il faut être connecté
pour publier un avis : un seul avis par compte et par livre, que seul son auteur peut supprimer.

La bibliothèque Firebase (version 12.19.0, licence Apache 2.0) est incluse dans `vendor/`.

### Activer les comptes

1. Firebase → **Build → Authentication → Commencer**.
2. Onglet **Sign-in method** : activer **Adresse e-mail/Mot de passe** et **Google**.
3. Onglet **Paramètres → Domaines autorisés** : ajouter `yaya6411.github.io`.
4. Clé API (console Google Cloud → Identifiants) :
   - **Restrictions d'API** : ajouter **Identity Toolkit API** et **Token Service API** ;
   - **Sites Web** : ajouter `https://test-biblio-998a1.firebaseapp.com/*` (utilisé par la connexion Google).
5. Firestore → **Règles** : publier le nouveau contenu de `firestore.rules`.

## Lecteurs et profils publics

Onglet **Lecteurs** : recherche d'un lecteur par le début de son pseudo (sans tenir compte des majuscules)
et liste des derniers inscrits. Chaque lecteur a une page de profil (`#/lecteur/<id>`) : pseudo, date
d'inscription, nombre de livres notés et de commentaires, note moyenne, répartition des notes et liste
de ses avis. Les pseudos sont cliquables dans les avis. Le profil public (collection `users`) ne contient
jamais l'adresse e-mail ; il est créé à la connexion et mis à jour quand le pseudo change.
