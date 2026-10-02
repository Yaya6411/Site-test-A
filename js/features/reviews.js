"use strict";

/* =========================================================================
 *  Notes et commentaires des lecteurs
 *
 *  - Si FIREBASE_PROJECT_ID est renseigné dans data.js, les avis sont
 *    enregistrés dans Cloud Firestore (API REST) et visibles par tous.
 *    Il faut alors être connecté à un compte pour publier un avis
 *    (un avis par compte et par livre, supprimable par son auteur).
 *  - Sinon, ils sont enregistrés uniquement dans le navigateur du visiteur.
 * ========================================================================= */

const MAX_COMMENT = 2000;
const MAX_NAME = 50;

// Identifiant commun à toutes les éditions d'un même livre :
// titre principal + nom de famille du premier auteur, sans accents ni ponctuation.
function reviewKey(book) {
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const title = norm(book.title.split(" — ")[0]);
  const author = norm(book.authors[0]).split(" ").pop() || "";
  return `${title}|${author}`.slice(0, 200);
}

/* ---------- Stockage local ---------------------------------------------- */

const localReviews = {
  shared: false,
  read() {
    try { return JSON.parse(localStorage.getItem("bibliofr.reviews") || "{}"); } catch { return {}; }
  },
  async list(key) {
    return (this.read()[key] || []).map((r, i) => ({ ...r, id: String(i), mine: true }));
  },
  async add(key, review) {
    const all = this.read();
    (all[key] = all[key] || []).push(review);
    try { localStorage.setItem("bibliofr.reviews", JSON.stringify(all)); }
    catch { throw new Error("Impossible d'enregistrer l'avis dans ce navigateur."); }
  },
  async update(key, review, changes) {
    const all = this.read();
    const target = (all[key] || [])[Number(review.id)];
    if (target) Object.assign(target, changes);
    try { localStorage.setItem("bibliofr.reviews", JSON.stringify(all)); }
    catch { throw new Error("Impossible d'enregistrer la modification dans ce navigateur."); }
  },
  async remove(key, review) {
    const all = this.read();
    (all[key] || []).splice(Number(review.id), 1);
    try { localStorage.setItem("bibliofr.reviews", JSON.stringify(all)); } catch { /* stockage indisponible */ }
  },
};

/* ---------- Stockage partagé (Cloud Firestore) --------------------------- */

// Avis d'un livre (bookKey) ou d'un lecteur (uid).
firestore.query = async function query(field, value) {
    const rows = await this.request(`${this.base()}:runQuery`, {
      method: "POST",
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "reviews" }],
          where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } },
          limit: 300,
        },
      }),
    });
    const uid = currentUser() && currentUser().uid;
    return rows.filter(r => r.document).map(r => {
      const f = r.document.fields || {};
      return {
        path: r.document.name,
        uid: f.uid?.stringValue || "",
        bookKey: f.bookKey?.stringValue || "",
        title: f.title?.stringValue || "",
        rating: Number(f.rating?.integerValue || 0),
        name: f.name?.stringValue || "",
        comment: f.comment?.stringValue || "",
        createdAt: f.createdAt?.timestampValue || "",
        updatedAt: f.updatedAt?.timestampValue || "",
        hidden: Boolean(f.hidden?.booleanValue),
        mine: Boolean(uid && f.uid?.stringValue === uid),
      };
    });
};

const firestoreReviews = {
  shared: true,
  list(key) {
    return firestore.query("bookKey", key);
  },
  listByUser(uid) {
    return firestore.query("uid", uid);
  },
  async add(key, review, book) {
    const user = currentUser();
    if (!user) throw new Error("Connectez-vous pour publier un avis.");
    // L'identifiant du document (compte + livre) garantit un seul avis par compte et par livre.
    // La date de publication est fixée par le serveur (REQUEST_TIME), pas par le navigateur.
    try {
      await firestore.commit([{
        update: {
          name: firestore.docName(`reviews/${user.uid}__${key}`),
          fields: toFirestore({
            uid: user.uid, bookKey: key, title: book.title.slice(0, 300),
            rating: review.rating, name: review.name, comment: review.comment,
          }),
        },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
      }]);
    } catch (err) {
      if (err.status === 409 || err.status === 400) throw new Error("Vous avez déjà donné votre avis sur ce livre.");
      throw err;
    }
  },
  // review.path = "projects/…/documents/reviews/<id>"
  docUrl(review) {
    const id = review.path.split("/documents/")[1];
    return `${firestore.base()}/${id.split("/").map(p => encodeURIComponent(decodeURIComponent(p))).join("/")}`;
  },
  async update(key, review, changes) {
    await firestore.commit([{
      update: {
        name: review.path,
        fields: toFirestore({ rating: changes.rating, comment: changes.comment }),
      },
      updateMask: { fieldPaths: ["rating", "comment"] },
      currentDocument: { exists: true },
      updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
    }]);
  },
  async remove(key, review) {
    await firestore.request(this.docUrl(review), { method: "DELETE" });
  },
};

const reviewStore = FIREBASE_PROJECT_ID ? firestoreReviews : localReviews;

/* ---------- Affichage ----------------------------------------------------- */

function starsHtml(rating, label = true) {
  const full = Math.round(rating);
  return `<span class="stars" ${label ? `aria-label="${rating.toFixed(1).replace(".", ",")} sur 5"` : 'aria-hidden="true"'}>` +
    "★".repeat(full) + `<span class="stars-off">${"★".repeat(5 - full)}</span></span>`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Date de publication, et de dernière modification s'il y en a une.
function reviewDateHtml(r) {
  const edited = r.updatedAt && r.updatedAt !== r.createdAt
    ? ` · modifié le ${esc(formatDate(r.updatedAt))}` : "";
  return `<span class="muted small">${esc(formatDate(r.createdAt))}${edited}</span>`;
}

// Remplace un avis affiché par un formulaire de modification (note + commentaire).
// onSave(changes) doit renvoyer une promesse ; onCancel réaffiche la liste.
function openReviewEditor(li, review, onSave, onCancel) {
  li.innerHTML = `
    <form class="review-form review-edit" novalidate>
      <p class="star-label" aria-hidden="true">Votre note</p>
      <fieldset class="star-input">
        <legend class="sr-only">Votre note</legend>
        ${[5, 4, 3, 2, 1].map(n => `
          <input type="radio" name="edit-rating" id="edit-rate-${n}" value="${n}"${n === review.rating ? " checked" : ""}>
          <label for="edit-rate-${n}" title="${n} étoile${n > 1 ? "s" : ""}">★</label>`).join("")}
      </fieldset>
      <label class="field">Votre commentaire (facultatif)
        <textarea id="edit-comment" rows="4" maxlength="${MAX_COMMENT}">${esc(review.comment || "")}</textarea>
      </label>
      <p class="form-error error" hidden></p>
      <div class="edit-actions">
        <button type="submit" class="buy-btn">Enregistrer</button>
        <button type="button" class="link-btn" data-cancel-edit>Annuler</button>
      </div>
    </form>`;
  const form = li.querySelector("form");
  form.querySelector("textarea").focus();
  form.querySelector("[data-cancel-edit]").addEventListener("click", onCancel);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const errorEl = form.querySelector(".form-error");
    const rating = Number((form.querySelector("input[name=edit-rating]:checked") || {}).value || 0);
    if (!rating) {
      errorEl.textContent = "Choisissez une note de 1 à 5 étoiles.";
      errorEl.hidden = false;
      return;
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Enregistrement…";
    try {
      await onSave({
        rating,
        comment: form.querySelector("#edit-comment").value.trim().slice(0, MAX_COMMENT),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      button.disabled = false;
      button.textContent = "Enregistrer";
    }
  });
}

function reviewsSectionHtml() {
  return `<section class="reviews" id="reviews"><h3>Avis des lecteurs</h3><div class="reviews-body">${loadingHtml}</div></section>`;
}

function reviewFormHtml() {
  const user = currentUser();
  return `<form class="review-form" novalidate>
      <p class="star-label" aria-hidden="true">Votre note</p>
      <fieldset class="star-input">
        <legend class="sr-only">Votre note</legend>
        ${[5, 4, 3, 2, 1].map(n => `
          <input type="radio" name="rating" id="rate-${n}" value="${n}">
          <label for="rate-${n}" title="${n} étoile${n > 1 ? "s" : ""}">★</label>`).join("")}
      </fieldset>
      ${reviewStore.shared
        ? `<p class="muted small">Publié en tant que <strong>${esc(displayName(user))}</strong></p>`
        : `<label class="field">Votre nom (facultatif)
            <input id="review-name" maxlength="${MAX_NAME}" placeholder="Anonyme" autocomplete="nickname">
          </label>`}
      <label class="field">Votre commentaire (facultatif)
        <textarea id="review-comment" rows="4" maxlength="${MAX_COMMENT}"
                  placeholder="Qu'avez-vous pensé de ce livre ?"></textarea>
      </label>
      <p class="form-error error" hidden></p>
      <button type="submit" class="buy-btn">Publier mon avis</button>
      ${reviewStore.shared ? "" : `<p class="muted small">Les avis sont enregistrés uniquement dans votre navigateur.</p>`}
    </form>`;
}

// Livre dont les avis sont affichés, pour les recharger quand on se connecte ou se déconnecte.
let reviewsShown = null;

async function loadReviews(book, container) {
  reviewsShown = { book, container };
  const key = reviewKey(book);
  const body = container.querySelector(".reviews-body");
  let reviews = [];
  let error = "";
  try {
    reviews = await reviewStore.list(key);
  } catch (err) {
    error = err.message;
  }
  if (!document.body.contains(body)) return;
  reviews.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  // Avis masqués par la modération : visibles seulement par leur auteur et les modérateurs.
  reviews = reviews.filter(r => !r.hidden || r.mine || isAdminCached());
  const counted = reviews.filter(r => !r.hidden);

  const avg = counted.length ? counted.reduce((n, r) => n + r.rating, 0) / counted.length : 0;
  const mine = reviews.find(r => r.mine);

  let formArea;
  if (!reviewStore.shared) {
    formArea = reviewFormHtml();
  } else if (!currentUser()) {
    formArea = `<div class="review-login">
        <p>Connectez-vous pour noter ce livre et laisser un commentaire.</p>
        <button type="button" class="buy-btn" data-auth="login">Se connecter</button>
        <button type="button" class="link-btn" data-auth="signup">Créer un compte</button>
      </div>`;
  } else if (!currentUser().emailVerified) {
    formArea = `<div class="review-login">
        <p>Pour publier un avis, confirmez d'abord votre adresse e-mail grâce au lien reçu à l'inscription.</p>
        <button type="button" class="more-btn" data-verify="resend">Renvoyer l'e-mail de confirmation</button>
        <button type="button" class="link-btn" data-verify="check">J'ai confirmé mon adresse</button>
        <p class="form-msg small" hidden></p>
      </div>`;
  } else if (mine) {
    formArea = `<p class="muted small">Vous avez déjà donné votre avis sur ce livre. Vous pouvez le modifier ci-dessous.</p>`;
  } else {
    formArea = reviewFormHtml();
  }

  body.innerHTML = `
    ${error ? `<p class="error">${esc(error)}</p>` : ""}
    <div class="reviews-summary">
      ${counted.length
        ? `${starsHtml(avg)} <strong>${avg.toFixed(1).replace(".", ",")}</strong>
           <span class="muted">/ 5 · ${counted.length} avis</span>`
        : `<span class="muted">Aucun avis pour l'instant. Soyez le premier à donner le vôtre.</span>`}
    </div>
    ${formArea}
    <ul class="review-list">
      ${reviews.map((r, i) => `
        <li>
          <div class="review-head">
            ${starsHtml(r.rating)}
            ${profileLink(r.uid, r.name)}
            ${r.mine && reviewStore.shared ? `<span class="badge">Vous</span>` : ""}
            ${reviewDateHtml(r)}
            ${r.hidden ? `<span class="badge">${r.mine ? "Masqué par la modération" : "Masqué"}</span>` : ""}
            ${r.mine ? `<button type="button" class="link-btn" data-edit-review="${i}">Modifier</button>
                        <button type="button" class="link-btn danger" data-delete-review="${i}">Supprimer</button>` : ""}
            ${!r.mine && reviewStore.shared && currentUser() ? `<button type="button" class="link-btn subtle" data-report-review="${i}">Signaler</button>` : ""}
            ${!r.mine && isAdminCached() ? `<button type="button" class="link-btn" data-mod-hide="${i}">${r.hidden ? "Réafficher" : "Masquer"}</button>` : ""}
          </div>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ""}
        </li>`).join("")}
    </ul>`;

  body.querySelectorAll("[data-report-review]").forEach(btn => btn.addEventListener("click", () => {
    openReportForm(btn.closest("li"), { ...reviews[Number(btn.dataset.reportReview)], title: book.title });
  }));
  body.querySelectorAll("[data-mod-hide]").forEach(btn => btn.addEventListener("click", async () => {
    const r = reviews[Number(btn.dataset.modHide)];
    btn.disabled = true;
    try { await setReviewHidden(reviewDocId(r), !r.hidden); loadReviews(book, container); }
    catch (err) { btn.textContent = err.message; }
  }));
  body.querySelectorAll("[data-verify]").forEach(btn => btn.addEventListener("click", async () => {
    const msg = body.querySelector(".review-login .form-msg");
    const user = currentUser();
    try {
      if (btn.dataset.verify === "resend") {
        await user.sendEmailVerification();
        msg.textContent = "E-mail envoyé. Pensez à regarder dans vos courriers indésirables.";
      } else {
        await user.reload();
        await user.getIdToken(true);  // le jeton doit refléter la vérification pour la base de données
        if (currentUser().emailVerified) return loadReviews(book, container);
        msg.textContent = "Votre adresse n'est pas encore confirmée. Cliquez sur le lien reçu par e-mail, puis réessayez.";
      }
    } catch (err) {
      msg.textContent = authErrorMessage(err);
    }
    msg.hidden = false;
  }));
  body.querySelectorAll("[data-edit-review]").forEach(btn => btn.addEventListener("click", () => {
    const review = reviews[Number(btn.dataset.editReview)];
    openReviewEditor(btn.closest("li"), review,
      changes => reviewStore.update(key, review, changes).then(() => loadReviews(book, container)),
      () => loadReviews(book, container));
  }));

  body.querySelectorAll("[data-delete-review]").forEach(btn => btn.addEventListener("click", async () => {
    if (btn.dataset.confirm !== "1") {
      btn.dataset.confirm = "1";
      btn.textContent = "Confirmer la suppression";
      return;
    }
    btn.disabled = true;
    try {
      await reviewStore.remove(key, reviews[Number(btn.dataset.deleteReview)]);
      loadReviews(book, container);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = err.message;
    }
  }));

  const form = body.querySelector(".review-form");
  if (!form) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const errorEl = form.querySelector(".form-error");
    const rating = Number((form.querySelector("input[name=rating]:checked") || {}).value || 0);
    if (!rating) {
      errorEl.textContent = "Choisissez une note de 1 à 5 étoiles.";
      errorEl.hidden = false;
      return;
    }
    const nameInput = form.querySelector("#review-name");
    const review = {
      rating,
      name: (nameInput ? nameInput.value.trim() : displayName(currentUser())).slice(0, MAX_NAME),
      comment: form.querySelector("#review-comment").value.trim().slice(0, MAX_COMMENT),
      createdAt: new Date().toISOString(),
    };
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Publication…";
    try {
      await reviewStore.add(key, review, book);
      loadReviews(book, container);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      button.disabled = false;
      button.textContent = "Publier mon avis";
    }
  });
}

// Recharge les avis affichés quand l'état de connexion change.
onAuthChange(() => {
  if (reviewsShown && document.body.contains(reviewsShown.container)) {
    loadReviews(reviewsShown.book, reviewsShown.container);
  }
});
