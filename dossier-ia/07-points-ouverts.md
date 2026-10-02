# Points ouverts, limites et pistes

## À vérifier à la main (par le propriétaire)
1. **Publier un avis** avec un compte dont l'e-mail est confirmé, puis le modifier et le supprimer.
2. **Signaler un avis** avec un second compte, puis le traiter depuis la page **Modération** (masquer, réafficher, classer sans suite).
3. **Connexion Google** sur le site en ligne (fenêtre ou redirection).
4. **Résultats réels** des genres très précis (shōnen, shōjo, seinen…), des Nouveautés et des Incontournables : les sources sont imparfaites et n'ont été testées qu'avec des données simulées.
5. **BnF** : vérifier si la mention « BnF » apparaît dans la ligne « source : … » sous les résultats. Si elle n'apparaît jamais, la BnF refuse les appels du navigateur.

## Limites connues
- **Indexation** : les pages sont des routes `#/…` ; seuls l'accueil et les métadonnées générales sont indexables.
- **Sources** : genres approximatifs chez Google (livres *sur* un sujet), couverture inégale des nouveautés françaises, quota Google ~1000 requêtes/jour.
- **Couvertures Amazon** : affichage non garanti depuis un autre site (une couverture dessinée prend le relais).
- **Avis masqués** : filtrés par le site, mais toujours lisibles par l'API (les règles ne peuvent pas filtrer une requête sans contrainte explicite).
- **Notifications** : pastille calculée à la connexion et à la visite du fil ; pas d'e-mail ni de notification push.
- **Avatar** : choix parmi des emojis ; pas d'envoi d'image (Firebase Storage non configuré).
- **Suppression de compte** : les documents « following » créés par d'autres lecteurs vers ce compte restent (sans effet visible).
- **Environnement de développement** : Open Library, la BnF, les sites des libraires et GitHub Pages y étaient inaccessibles ; seules les API Google/Firebase ont pu être appelées en vrai.

## Non fait (et pourquoi)
- **Nom de domaine personnalisé** : nécessite un achat. La procédure est dans le README.
- **Tendances / meilleures ventes** : abandonné par le propriétaire, faute de source gratuite de chiffres de vente.

## Pistes d'évolution
- URL réelles (sans `#`) et pages statiques générées pour indexer les fiches livres.
- Fonctions serveur (Cloud Functions, formule payante Blaze) : proxy pour la BnF et d'autres sources françaises, notifications par e-mail, modération automatique.
- Envoi d'avatar (Firebase Storage).
- Objectifs de lecture annuels, genres préférés, recommandations à partir de la bibliothèque.
- Limitation du nombre d'avis par jour, filtre automatique des insultes.
- Tests automatisés en intégration continue (GitHub Actions) avec les scripts de `outils-de-test/`.
