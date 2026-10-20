"use strict";

/* =========================================================================
 *  Pages légales : mentions légales, politique de confidentialité, contact.
 *  L'éditeur est un particulier non professionnel qui ne publie pas son
 *  identité (LCEN, art. 6, III, 2) ; on le joint par le formulaire de contact,
 *  dont les messages arrivent dans la page Modération (collection messages).
 * ========================================================================= */

const LEGAL_UPDATED = "20 octobre 2026";

function viewLegalNotice() {
  document.title = "Mentions légales — Biblio FR";
  setPageMeta("Mentions légales de Biblio FR : éditeur, hébergeur, propriété intellectuelle et responsabilité.");
  app.innerHTML = `
    <article class="about">
      <h1 class="page-title">Mentions légales</h1>
      <p class="muted small">Dernière mise à jour : ${LEGAL_UPDATED}</p>

      <h2>Éditeur du site</h2>
      <p>Biblio FR (<a href="https://yaya6411.github.io/Site-test-A/">yaya6411.github.io/Site-test-A</a>) est un site personnel,
        gratuit et non commercial, édité par un particulier à titre non professionnel.
        Conformément à l'article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique,
        l'éditeur a choisi de ne pas rendre publique son identité ; les éléments permettant de l'identifier ont été communiqués à l'hébergeur.</p>
      <p>Directeur de la publication : l'éditeur du site.<br>
        Contact : <a href="#/contact">formulaire de contact</a>.</p>

      <h2>Hébergement</h2>
      <p>Site : GitHub Pages, service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis —
        <a href="https://github.com" target="_blank" rel="noopener">github.com</a>.<br>
        Comptes et avis des lecteurs : Firebase (Authentication et Cloud Firestore), service de Google.</p>

      <h2>Contenus et propriété intellectuelle</h2>
      <p>Les informations sur les livres (titres, auteurs, résumés, couvertures) proviennent de Google Books, d'Open Library
        et de la Bibliothèque nationale de France ; les couvertures et résumés restent la propriété de leurs éditeurs et ayants droit.
        Ils sont affichés à titre d'information, pour identifier les ouvrages.</p>
      <p>Les avis sont rédigés par les lecteurs, sous leur seule responsabilité. En publiant un avis, vous autorisez Biblio FR
        à l'afficher sur le site tant que vous ne le supprimez pas. Les avis contraires à la loi ou hors sujet peuvent être
        masqués ou supprimés par les modérateurs ; tout lecteur peut en signaler un avec le bouton « Signaler ».</p>
      <p>Les polices DM Sans et Libre Baskerville sont distribuées sous licence SIL Open Font License.</p>

      <h2>Liens d'achat et responsabilité</h2>
      <p>Les boutons « Acheter » mènent à une recherche chez des librairies en ligne indépendantes de Biblio FR, qui ne touche
        aucune commission. Les prix, la disponibilité et les conditions de vente relèvent de chaque revendeur.
        Les informations bibliographiques peuvent être incomplètes ou inexactes : en cas de doute, la fiche du revendeur ou de l'éditeur fait foi.
        Pour signaler une erreur, utilisez le <a href="#/contact">formulaire de contact</a>.</p>

      <h2>Données personnelles</h2>
      <p>Voir la <a href="#/confidentialite">politique de confidentialité</a>.</p>
    </article>`;
}

function viewPrivacy() {
  document.title = "Confidentialité — Biblio FR";
  setPageMeta("Politique de confidentialité de Biblio FR : données collectées, finalités, durées de conservation et droits des lecteurs.");
  app.innerHTML = `
    <article class="about">
      <h1 class="page-title">Politique de confidentialité</h1>
      <p class="muted small">Dernière mise à jour : ${LEGAL_UPDATED}</p>
      <p>Biblio FR collecte le moins de données possible : pas de publicité, pas de revente, pas de mesure d'audience,
        pas de cookies de suivi. Cette page explique ce qui est enregistré, pourquoi, pour combien de temps, et comment exercer vos droits
        (Règlement général sur la protection des données, RGPD).</p>

      <h2>Responsable du traitement</h2>
      <p>L'éditeur du site, particulier non professionnel (voir les <a href="#/mentions-legales">mentions légales</a>),
        joignable par le <a href="#/contact">formulaire de contact</a>.</p>

      <h2>Données enregistrées et finalités</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Données</th><th>Pourquoi</th><th>Base légale</th><th>Durée</th></tr></thead>
          <tbody>
            <tr><td>Adresse e-mail et mot de passe (ou compte Google)</td><td>Créer et sécuriser votre compte, confirmer votre adresse</td><td>Service demandé (contrat)</td><td>Jusqu'à la suppression du compte</td></tr>
            <tr><td>Pseudo, avatar, date d'inscription</td><td>Profil public de lecteur</td><td>Service demandé</td><td>Jusqu'à la suppression du compte</td></tr>
            <tr><td>Avis (note, commentaire)</td><td>Partager votre avis avec les autres lecteurs</td><td>Service demandé</td><td>Jusqu'à leur suppression par vous ou un modérateur, ou la suppression du compte</td></tr>
            <tr><td>Bibliothèque, listes, lecteurs suivis</td><td>Organiser vos lectures, suivre d'autres lecteurs</td><td>Service demandé</td><td>Jusqu'à leur suppression ou celle du compte</td></tr>
            <tr><td>Signalements d'avis</td><td>Modération</td><td>Intérêt légitime (sécurité du site)</td><td>Jusqu'au traitement du signalement</td></tr>
            <tr><td>Messages envoyés par le formulaire de contact</td><td>Vous répondre</td><td>Intérêt légitime</td><td>Supprimés une fois la demande traitée</td></tr>
            <tr><td>Sauvegarde des avis et profils publics</td><td>Pouvoir restaurer le site en cas d'incident</td><td>Intérêt légitime</td><td>Chiffrée, conservée 90 jours au plus</td></tr>
          </tbody>
        </table>
      </div>
      <p>Les avis, pseudos, avatars, listes publiques et abonnements sont visibles de tous. Votre adresse e-mail n'est jamais affichée.
        Votre bibliothèque reste privée sauf si vous choisissez de la montrer sur votre profil.</p>

      <h2>Données gardées dans votre navigateur</h2>
      <p>Vos préférences, l'historique des livres consultés, votre bibliothèque sans compte et un cache des recherches sont stockés
        uniquement dans votre navigateur (stockage local). Ils ne sont pas transmis au site et servent seulement à son fonctionnement :
        aucun consentement n'est donc demandé. Vous pouvez les effacer depuis les préférences ⚙️ (« Vider le cache ») ou les réglages de votre navigateur.</p>

      <h2>Services tiers contactés par votre navigateur</h2>
      <p>Pour afficher les livres, votre navigateur interroge directement Google Books, Open Library (Internet Archive) et la BnF,
        et charge les couvertures depuis Google, Open Library ou Amazon. Ces services reçoivent votre adresse IP, comme pour toute visite d'un site web,
        selon leurs propres politiques de confidentialité. GitHub, qui héberge le site, peut aussi conserver l'adresse IP des visiteurs
        pour la sécurité de son service. Les polices de caractères sont hébergées sur le site lui-même.</p>

      <h2>Destinataires et transferts</h2>
      <p>Seuls l'éditeur et les modérateurs du site accèdent aux signalements et aux messages. Les données des comptes sont confiées à Google
        (Firebase Authentication et Cloud Firestore) et la sauvegarde chiffrée à GitHub, qui agissent comme sous-traitants.
        Ces sociétés américaines peuvent traiter des données hors de l'Union européenne ; ces transferts sont encadrés par le
        cadre de protection des données UE–États-Unis et par les clauses contractuelles types de la Commission européenne.</p>

      <h2>Vos droits</h2>
      <p>Vous pouvez accéder à vos données, les corriger, les effacer, les récupérer, vous opposer à leur traitement ou en demander la limitation :</p>
      <ul>
        <li><strong>Corriger</strong> : modifiez votre pseudo, votre avatar ou vos avis depuis le site.</li>
        <li><strong>Récupérer</strong> : « Mon compte » → « Télécharger mes données » (fichier JSON).</li>
        <li><strong>Effacer</strong> : « Mon compte » → « Supprimer mon compte » efface votre compte, vos avis, votre profil, votre bibliothèque, vos listes et vos abonnements.</li>
        <li><strong>Toute autre demande</strong> : <a href="#/contact">formulaire de contact</a> (sujet « Mes données personnelles »). Une réponse est apportée dans un délai d'un mois.</li>
      </ul>
      <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL
        (<a href="https://www.cnil.fr" target="_blank" rel="noopener">cnil.fr</a>).</p>

      <h2>Mineurs</h2>
      <p>En France, un mineur de moins de 15 ans ne peut créer un compte qu'avec l'accord d'un titulaire de l'autorité parentale.</p>

      <h2>Sécurité</h2>
      <p>Les échanges sont chiffrés (HTTPS). Les mots de passe sont gérés par Google et ne sont jamais connus du site.
        Des règles d'accès empêchent quiconque de modifier les données d'un autre lecteur ; publier un avis exige une adresse e-mail confirmée.</p>
    </article>`;
}

/* ---------- Formulaire de contact ------------------------------------------ */

const CONTACT_SUBJECTS = [
  ["erreur", "Une erreur dans une fiche de livre"],
  ["avis", "Un avis ou un lecteur problématique"],
  ["donnees", "Mes données personnelles"],
  ["autre", "Autre question"],
];
const CONTACT_MAX = 3000;

async function sendContactMessage({ subject, body, replyTo }) {
  const user = currentUser();
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await firestore.commit([{
    update: {
      name: firestore.docName(`messages/${id}`),
      fields: toFirestore({ subject, body, replyTo, uid: user ? user.uid : "" }),
    },
    currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
  }]);
}

function viewContact() {
  document.title = "Contact — Biblio FR";
  setPageMeta("Contacter Biblio FR : signaler une erreur, un avis problématique ou faire une demande concernant vos données.");
  app.innerHTML = `
    <article class="about">
      <h1 class="page-title">Nous contacter</h1>
      <p>Une erreur dans une fiche, un avis problématique, une question sur vos données ? Écrivez-nous ici.
        Pour signaler un avis précis, le bouton « Signaler » sous l'avis est le plus rapide.</p>
      <form id="contact-form" class="account-card contact-form" novalidate>
        <label class="field">Sujet
          <select id="contact-subject" required>
            ${CONTACT_SUBJECTS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}
          </select>
        </label>
        <label class="field">Votre message
          <textarea id="contact-body" rows="7" maxlength="${CONTACT_MAX}" required
            placeholder="Décrivez votre demande (titre du livre, pseudo du lecteur…)"></textarea>
        </label>
        <p class="muted small"><span id="contact-count">0</span> / ${CONTACT_MAX} caractères (10 au minimum)</p>
        <label class="field">Pour vous répondre (facultatif)
          <input id="contact-reply" type="text" maxlength="200" autocomplete="email"
            placeholder="Adresse e-mail ou autre moyen de vous joindre">
        </label>
        <p class="muted small">Sans moyen de vous joindre, nous lirons votre message mais ne pourrons pas vous répondre.</p>
        <!-- Champ piège : invisible pour les lecteurs, rempli par les robots. -->
        <label class="hp-field" aria-hidden="true">Site web <input id="contact-website" type="text" tabindex="-1" autocomplete="off"></label>
        <p class="muted small">Ne transmettez pas d'informations sensibles. Ce message n'est lu que par l'éditeur et les modérateurs du site,
          puis supprimé une fois traité (<a href="#/confidentialite">confidentialité</a>).</p>
        <button type="submit" class="more-btn">Envoyer</button>
        <p class="contact-msg small" role="status" hidden></p>
      </form>
    </article>`;

  const form = document.getElementById("contact-form");
  const bodyEl = document.getElementById("contact-body");
  const count = document.getElementById("contact-count");
  const msg = form.querySelector(".contact-msg");
  const show = (text, ok) => { msg.textContent = text; msg.className = `contact-msg small ${ok ? "success" : "error"}`; msg.hidden = false; };
  bodyEl.addEventListener("input", () => { count.textContent = bodyEl.value.length; });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const body = bodyEl.value.trim();
    if (document.getElementById("contact-website").value) { show("Message envoyé. Merci !", true); form.reset(); return; }
    if (body.length < 10) { show("Votre message est trop court (10 caractères au minimum).", false); bodyEl.focus(); return; }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await sendContactMessage({
        subject: document.getElementById("contact-subject").value,
        body: body.slice(0, CONTACT_MAX),
        replyTo: document.getElementById("contact-reply").value.trim().slice(0, 200),
      });
      form.reset();
      count.textContent = "0";
      show("Message envoyé. Merci ! Nous vous répondrons dès que possible.", true);
    } catch (err) {
      show(err.message, false);
    } finally {
      button.disabled = false;
    }
  });
}
