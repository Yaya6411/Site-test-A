# Configuration des services externes

## GitHub Pages
- Dépôt public `Yaya6411/Site-test-A`, Settings → Pages → **Deploy from a branch** → branche `claude/youthful-archimedes-zcrfu4`, dossier `/ (root)`.
- Chaque push sur cette branche republie le site en 1 à 2 minutes (workflow « pages build and deployment », visible dans l'onglet Actions).
- Champ « Custom domain » : **vide** (pas de nom de domaine personnalisé).

## Deux projets Google Cloud (point de vigilance)

Les deux projets portent le nom affiché « test biblio ». Il faut toujours vérifier l'**ID**.

| Usage | Projet | Clé dans `data.js` | Restrictions de la clé |
|---|---|---|---|
| Google Books | n° 996347818998 | `GOOGLE_API_KEY` (commence par `AIzaSyCrrm7…`) | Sites web : `https://yaya6411.github.io/*` ; API : Books API (+ Firestore, Identity Toolkit, Token Service ajoutées sans effet) |
| Firebase (comptes, base de données) | **`test-biblio-998a1`** (n° 929493062325) | `FIREBASE_API_KEY` (commence par `AIzaSyB7UPM…`, « Browser key (auto created by Firebase) ») | Sites web : `https://yaya6411.github.io/*` et `https://test-biblio-998a1.firebaseapp.com/*` ; API réglées par Firebase |

- Les clés sont visibles dans le code (dépôt public) : c'est normal pour ces clés « navigateur ». La restriction par site a été **vérifiée** : une requête venant d'un autre domaine est bloquée.
- Le quota Google Books est d'environ 1000 requêtes par jour (atténué par le cache).
- Console des clés Firebase : https://console.cloud.google.com/apis/credentials?project=test-biblio-998a1

## Firebase Authentication
- Fournisseurs activés : **E-mail/Mot de passe** et **Google**.
- Domaines autorisés : `localhost`, `test-biblio-998a1.firebaseapp.com`, `test-biblio-998a1.web.app`, `yaya6411.github.io`.
- Initialisation (`js/features/auth.js`) : `apiKey = FIREBASE_API_KEY`, `authDomain = test-biblio-998a1.firebaseapp.com`, `languageCode = "fr"`.
- Connexion Google par fenêtre, avec repli sur une redirection si la fenêtre est bloquée.
- Un e-mail de vérification est envoyé à l'inscription. Il est obligatoire pour publier un avis.

## Cloud Firestore
- Base `(default)` du projet `test-biblio-998a1`, créée en **mode production**. Formule gratuite **Spark**.
- Accès par l'**API REST** (pas de SDK Firestore), avec `Authorization: Bearer <jeton>` quand l'utilisateur est connecté.
- Les écritures sensibles passent par `:commit` (écritures atomiques, `REQUEST_TIME` pour les dates serveur, préconditions `exists`).
- Règles : fichier `firestore.rules`, **publié à la main** par le propriétaire (Firestore → Règles → Publier).

## Modérateurs
- Collection `admins`, un document par modérateur, dont l'**ID** est l'identifiant de compte (affiché dans « Mon compte »), avec un champ quelconque (`role = "admin"`).
- Modérateur actuel : `ILPYJs7k2aZDJFNUoskozqQBk6G2` (pseudo **yaya6411**, le propriétaire). Correspondance vérifiée.
- Le lien « Modération » apparaît après une nouvelle connexion.

## Sources de livres
- **Google Books** : `https://www.googleapis.com/books/v1/volumes` (`langRestrict=fr`, `country=FR`, `printType=books`, clé).
- **Open Library** : `https://openlibrary.org/search.json` (`language=fre`, champs `editions` pour l'édition française).
- **BnF (expérimental)** : `https://catalogue.bnf.fr/api/SRU` (Dublin Core). Utilisée seulement si le navigateur peut l'interroger (CORS). Non vérifiée en conditions réelles.
- **Couvertures** : Google, Open Library (`covers.openlibrary.org`), Amazon par ISBN-10.

## Nom de domaine (non configuré)
Procédure dans le `README.md` : acheter le domaine, le déclarer dans GitHub Pages, l'ajouter aux restrictions des **deux** clés et aux domaines autorisés de Firebase, puis remplacer l'adresse dans `index.html` (canonical, Open Graph), `robots.txt` et `sitemap.xml`.
