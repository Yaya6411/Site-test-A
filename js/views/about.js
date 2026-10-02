"use strict";

/* =========================================================================
 *  Page « À propos » : présentation, sources, données personnelles.
 * ========================================================================= */

function viewAbout() {
  document.title = "À propos — Biblio FR";
  setPageMeta("Biblio FR : catalogue des livres en français, sources des données, avis des lecteurs et données personnelles.");
  app.innerHTML = `
    <article class="about">
      <h1 class="page-title">À propos de Biblio FR</h1>
      <p>Biblio FR aide à trouver des livres disponibles en français (romans, mangas, BD, essais, jeunesse…),
        à les noter, à organiser sa bibliothèque et à les acheter chez une librairie en ligne.
        Le site est gratuit, sans publicité, et ne touche aucune commission sur les achats.</p>

      <h2>D'où viennent les livres ?</h2>
      <p>Il n'existe pas de catalogue libre et complet de tous les livres en français. Biblio FR interroge donc
        en direct plusieurs bases bibliographiques ouvertes, puis regroupe les éditions d'une même œuvre,
        écarte les doublons et les ouvrages qui ne sont pas des livres à lire (agendas, coloriages…),
        et classe les résultats selon leur pertinence.</p>
      <ul>
        <li><a href="https://books.google.fr" target="_blank" rel="noopener">Google Books</a> : la source la plus fournie en éditions françaises.</li>
        <li><a href="https://openlibrary.org" target="_blank" rel="noopener">Open Library</a> (Internet Archive) : catalogue collaboratif, éditions françaises et couvertures.</li>
        <li><a href="https://catalogue.bnf.fr" target="_blank" rel="noopener">Bibliothèque nationale de France</a> : utilisée à titre expérimental quand votre navigateur peut l'interroger directement.</li>
      </ul>
      <p>Les couvertures proviennent de ces sources ou d'Amazon (par ISBN). Les informations peuvent être incomplètes :
        en cas de doute, la fiche du revendeur fait foi.</p>

      <h2>Liens d'achat</h2>
      <p>Les boutons « Acheter » ouvrent une recherche du livre (titre et auteur) chez la librairie choisie dans les préférences ⚙️ :
        Leslibraires.fr, Fnac, Amazon, Decitre, Cultura, Place des Libraires ou Rakuten. Les prix et la disponibilité sont ceux du revendeur.</p>

      <h2>Avis et modération</h2>
      <p>Pour publier un avis, il faut un compte dont l'adresse e-mail a été confirmée. Chaque lecteur donne un seul avis par livre,
        qu'il peut modifier ou supprimer. Un avis problématique peut être signalé (bouton « Signaler ») ; les modérateurs
        peuvent alors le masquer ou le supprimer.</p>

      <h2>Vos données</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Donnée</th><th>Où</th><th>Qui la voit</th></tr></thead>
          <tbody>
            <tr><td>Adresse e-mail, mot de passe</td><td>Firebase Authentication (Google)</td><td>Vous seul ; jamais affichée sur le site</td></tr>
            <tr><td>Pseudo, avatar, date d'inscription</td><td>Base de données du site</td><td>Tout le monde (profil public)</td></tr>
            <tr><td>Avis (note, commentaire)</td><td>Base de données du site</td><td>Tout le monde</td></tr>
            <tr><td>Bibliothèque (Lus, À lire, En cours, Favoris)</td><td>Votre compte, ou votre navigateur sans compte</td><td>Vous seul, sauf si vous choisissez de l'afficher sur votre profil</td></tr>
            <tr><td>Listes</td><td>Votre compte, ou votre navigateur</td><td>Vous seul, sauf les listes que vous rendez publiques</td></tr>
            <tr><td>Lecteurs suivis</td><td>Base de données du site</td><td>Tout le monde (nombre d'abonnés et d'abonnements)</td></tr>
            <tr><td>Historique des livres consultés, préférences, cache</td><td>Votre navigateur uniquement</td><td>Vous seul</td></tr>
          </tbody>
        </table>
      </div>
      <p>Vous pouvez supprimer à tout moment votre compte depuis « Mon compte » : vos avis, votre profil, votre bibliothèque
        et vos listes sont alors effacés. Aucune donnée n'est revendue ni utilisée à des fins publicitaires.</p>

      <h2>Accessibilité</h2>
      <p>Le site se parcourt au clavier (lien « Aller au contenu », autocomplétion avec les flèches, fenêtres fermées avec Échap),
        respecte le réglage « réduire les animations » de votre appareil et s'adapte au thème clair ou sombre.
        Un problème d'accessibilité ? Signalez-le au propriétaire du site.</p>
    </article>`;
}
