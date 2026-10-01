# Biblio FR — catalogue des livres en français

Site statique (HTML / CSS / JavaScript, sans dépendance) qui répertorie les livres disponibles en français :
romans, mangas, bandes dessinées, essais, jeunesse, etc.

## Fonctionnalités

- **Navigation par genre** : 28 genres (Romans, Mangas, BD, Policier, SF, Fantasy, Jeunesse, Histoire…).
- **Navigation par auteur** : auteurs mis en avant filtrables par catégorie + recherche de n'importe quel auteur.
- **Recherche** globale, par titre, par auteur ou par ISBN.
- **Fiche détaillée** de chaque livre (couverture, éditeur, date, ISBN, résumé).
- **Lien d'achat** pour chaque livre (par ISBN quand il est connu) vers Leslibraires.fr, Fnac, Amazon.fr,
  Decitre, Cultura, Place des Libraires ou Rakuten. La librairie par défaut se règle dans les préférences ⚙️.
- Tri par pertinence ou par date, pagination « Charger plus », thème clair/sombre automatique, responsive.

## Données

Aucun catalogue n'est stocké dans le dépôt : le site interroge en direct
[Google Books](https://developers.google.com/books) (filtre `langRestrict=fr`) ou
[Open Library](https://openlibrary.org/developers/api) (filtre `language=fre`), ce qui donne accès à des
centaines de milliers d'ouvrages en français sans maintenance. La source se choisit dans les préférences.

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
