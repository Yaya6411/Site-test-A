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

const firestore = {
  base() {
    return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  },
  apiKey() {
    return FIREBASE_API_KEY || GOOGLE_API_KEY;
  },
  async request(url, options = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = await getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}key=${this.apiKey()}`, { ...options, headers });
    if (!res.ok) {
      const status = res.status;
      throw new Error(status === 403
        ? "Action refusée. Vérifiez que vous êtes connecté, puis réessayez."
        : status === 409
          ? "Vous avez déjà donné votre avis sur ce livre."
          : `Le service des avis ne répond pas (erreur ${status}). Réessayez plus tard.`);
    }
    return res.status === 204 ? null : res.json();
  },
  async query(field, value) {
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
        mine: Boolean(uid && f.uid?.stringValue === uid),
      };
    });
  },
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
    const docId = encodeURIComponent(`${user.uid}__${key}`);
    await firestore.request(`${firestore.base()}/reviews?documentId=${docId}`, {
      method: "POST",
      body: JSON.stringify({
        fields: {
          uid: { stringValue: user.uid },
          bookKey: { stringValue: key },
          title: { stringValue: book.title.slice(0, 300) },
          rating: { integerValue: String(review.rating) },
          name: { stringValue: review.name },
          comment: { stringValue: review.comment },
          createdAt: { timestampValue: review.createdAt },
        },
      }),
    });
  },
  // review.path = "projects/…/documents/reviews/<id>"
  docUrl(review) {
    const id = review.path.split("/documents/")[1];
    return `${firestore.base()}/${id.split("/").map(p => encodeURIComponent(decodeURIComponent(p))).join("/")}`;
  },
  async update(key, review, changes) {
    const mask = ["rating", "comment", "updatedAt"].map(f => `updateMask.fieldPaths=${f}`).join("&");
    await firestore.request(`${this.docUrl(review)}?${mask}`, {
      method: "PATCH",
      body: JSON.stringify({
        fields: {
          rating: { integerValue: String(changes.rating) },
          comment: { stringValue: changes.comment },
          updatedAt: { timestampValue: changes.updatedAt },
        },
      }),
    });
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

  const avg = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0;
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
  } else if (mine) {
    formArea = `<p class="muted small">Vous avez déjà donné votre avis sur ce livre. Vous pouvez le modifier ci-dessous.</p>`;
  } else {
    formArea = reviewFormHtml();
  }

  body.innerHTML = `
    ${error ? `<p class="error">${esc(error)}</p>` : ""}
    <div class="reviews-summary">
      ${reviews.length
        ? `${starsHtml(avg)} <strong>${avg.toFixed(1).replace(".", ",")}</strong>
           <span class="muted">/ 5 · ${reviews.length} avis</span>`
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
            ${r.mine ? `<button type="button" class="link-btn" data-edit-review="${i}">Modifier</button>
                        <button type="button" class="link-btn danger" data-delete-review="${i}">Supprimer</button>` : ""}
          </div>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ""}
        </li>`).join("")}
    </ul>`;

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
