"use strict";

/* =========================================================================
 *  Notes et commentaires des lecteurs
 *
 *  - Si FIREBASE_PROJECT_ID est renseigné dans data.js, les avis sont
 *    enregistrés dans Cloud Firestore et visibles par tous les visiteurs
 *    (API REST, sans bibliothèque à charger).
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
    return this.read()[key] || [];
  },
  async add(key, review) {
    const all = this.read();
    (all[key] = all[key] || []).push(review);
    try { localStorage.setItem("bibliofr.reviews", JSON.stringify(all)); }
    catch { throw new Error("Impossible d'enregistrer l'avis dans ce navigateur."); }
  },
};

/* ---------- Stockage partagé (Cloud Firestore) --------------------------- */

const firestoreReviews = {
  shared: true,
  base() {
    return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  },
  key() {
    return FIREBASE_API_KEY || GOOGLE_API_KEY;
  },
  async list(key) {
    const res = await fetch(`${this.base()}:runQuery?key=${this.key()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "reviews" }],
          where: { fieldFilter: { field: { fieldPath: "bookKey" }, op: "EQUAL", value: { stringValue: key } } },
          limit: 200,
        },
      }),
    });
    if (!res.ok) throw new Error(`Avis indisponibles (erreur ${res.status}).`);
    const rows = await res.json();
    return rows.filter(r => r.document).map(r => {
      const f = r.document.fields || {};
      return {
        rating: Number(f.rating?.integerValue || 0),
        name: f.name?.stringValue || "",
        comment: f.comment?.stringValue || "",
        createdAt: f.createdAt?.timestampValue || "",
      };
    });
  },
  async add(key, review, book) {
    const res = await fetch(`${this.base()}/reviews?key=${this.key()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          bookKey: { stringValue: key },
          title: { stringValue: book.title.slice(0, 300) },
          rating: { integerValue: String(review.rating) },
          name: { stringValue: review.name },
          comment: { stringValue: review.comment },
          createdAt: { timestampValue: review.createdAt },
        },
      }),
    });
    if (!res.ok) throw new Error(`L'avis n'a pas pu être publié (erreur ${res.status}). Réessayez plus tard.`);
  },
};

const reviewStore = FIREBASE_PROJECT_ID ? firestoreReviews : localReviews;

/* ---------- Affichage ----------------------------------------------------- */

// Mémorise dans le navigateur les livres déjà notés, pour éviter les doublons.
const myReviews = {
  has(key) {
    try { return JSON.parse(localStorage.getItem("bibliofr.myReviews") || "[]").includes(key); } catch { return false; }
  },
  add(key) {
    try {
      const list = JSON.parse(localStorage.getItem("bibliofr.myReviews") || "[]");
      list.push(key);
      localStorage.setItem("bibliofr.myReviews", JSON.stringify(list));
    } catch { /* stockage indisponible */ }
  },
};

function starsHtml(rating, label = true) {
  const full = Math.round(rating);
  return `<span class="stars" ${label ? `aria-label="${rating.toFixed(1).replace(".", ",")} sur 5"` : 'aria-hidden="true"'}>` +
    "★".repeat(full) + `<span class="stars-off">${"★".repeat(5 - full)}</span></span>`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function reviewsSectionHtml() {
  return `<section class="reviews" id="reviews"><h3>Avis des lecteurs</h3><div class="reviews-body">${loadingHtml}</div></section>`;
}

async function loadReviews(book, container) {
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
  const alreadyReviewed = myReviews.has(key);

  body.innerHTML = `
    ${error ? `<p class="error">${esc(error)}</p>` : ""}
    <div class="reviews-summary">
      ${reviews.length
        ? `${starsHtml(avg)} <strong>${avg.toFixed(1).replace(".", ",")}</strong>
           <span class="muted">/ 5 · ${reviews.length} avis</span>`
        : `<span class="muted">Aucun avis pour l'instant. Soyez le premier à donner le vôtre.</span>`}
    </div>

    ${alreadyReviewed
      ? `<p class="muted small">Vous avez déjà donné votre avis sur ce livre.</p>`
      : `<form class="review-form" novalidate>
          <p class="star-label" aria-hidden="true">Votre note</p>
          <fieldset class="star-input">
            <legend class="sr-only">Votre note</legend>
            ${[5, 4, 3, 2, 1].map(n => `
              <input type="radio" name="rating" id="rate-${n}" value="${n}">
              <label for="rate-${n}" title="${n} étoile${n > 1 ? "s" : ""}">★</label>`).join("")}
          </fieldset>
          <label class="field">Votre nom (facultatif)
            <input id="review-name" name="name" maxlength="${MAX_NAME}" placeholder="Anonyme" autocomplete="nickname">
          </label>
          <label class="field">Votre commentaire (facultatif)
            <textarea id="review-comment" name="comment" rows="4" maxlength="${MAX_COMMENT}"
                      placeholder="Qu'avez-vous pensé de ce livre ?"></textarea>
          </label>
          <p class="form-error error" hidden></p>
          <button type="submit" class="buy-btn">Publier mon avis</button>
          ${reviewStore.shared ? "" : `<p class="muted small">Les avis sont pour l'instant enregistrés uniquement dans votre navigateur.</p>`}
        </form>`}

    <ul class="review-list">
      ${reviews.map(r => `
        <li>
          <div class="review-head">
            ${starsHtml(r.rating)}
            <strong>${esc(r.name || "Anonyme")}</strong>
            <span class="muted small">${esc(formatDate(r.createdAt))}</span>
          </div>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ""}
        </li>`).join("")}
    </ul>`;

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
    const review = {
      rating,
      name: form.querySelector("#review-name").value.trim().slice(0, MAX_NAME),
      comment: form.querySelector("#review-comment").value.trim().slice(0, MAX_COMMENT),
      createdAt: new Date().toISOString(),
    };
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Publication…";
    try {
      await reviewStore.add(key, review, book);
      myReviews.add(key);
      loadReviews(book, container);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      button.disabled = false;
      button.textContent = "Publier mon avis";
    }
  });
}
