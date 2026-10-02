"use strict";

/* =========================================================================
 *  Modération des avis
 *  - Tout lecteur connecté peut signaler un avis (reports/…).
 *  - Les administrateurs (documents admins/{uid}, créés à la main dans la
 *    console Firebase) voient les signalements, peuvent masquer, réafficher
 *    ou supprimer un avis, et classer un signalement sans suite.
 * ========================================================================= */

const REPORT_REASONS = [
  { id: "spam", label: "Spam ou publicité" },
  { id: "abuse", label: "Propos injurieux ou haineux" },
  { id: "spoiler", label: "Divulgâcheur (révèle l'intrigue)" },
  { id: "offtopic", label: "Hors sujet" },
  { id: "other", label: "Autre" },
];
const reasonLabel = id => (REPORT_REASONS.find(r => r.id === id) || {}).label || id;

// Rôle administrateur du compte connecté (vérifié une fois par session).
let adminState = { uid: null, value: false };

async function checkAdmin(user) {
  if (!user || !FIREBASE_PROJECT_ID) { adminState = { uid: null, value: false }; return false; }
  if (adminState.uid === user.uid) return adminState.value;
  let value = false;
  try { value = Boolean(await firestore.get(`admins/${user.uid}`)); } catch { value = false; }
  adminState = { uid: user.uid, value };
  renderAdminLink();
  return value;
}

const isAdminCached = () => Boolean(currentUser() && adminState.uid === currentUser().uid && adminState.value);

function renderAdminLink() {
  const nav = document.querySelector(".main-nav");
  let link = document.getElementById("admin-link");
  if (isAdminCached()) {
    if (!link) {
      link = document.createElement("a");
      link.id = "admin-link";
      link.href = "#/moderation";
      link.textContent = "Modération";
      nav.insertBefore(link, document.getElementById("settings-btn"));
    }
  } else if (link) {
    link.remove();
  }
}

const reviewDocId = review => decodeURIComponent(review.path.split("/reviews/")[1] || "");

// Signale un avis ; un même lecteur ne peut signaler un avis qu'une fois.
async function reportReview(review, reason) {
  const user = currentUser();
  if (!user) throw new Error("Connectez-vous pour signaler un avis.");
  const reviewId = reviewDocId(review);
  const id = `${user.uid}__${reviewId}`;
  try {
    await firestore.commit([{
      update: {
        name: firestore.docName(`reports/${id}`),
        fields: toFirestore({
          reviewId, reviewUid: review.uid, bookKey: review.bookKey || "", title: (review.title || "").slice(0, 300),
          reason, reporterUid: user.uid,
        }),
      },
      currentDocument: { exists: false },
      updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
    }]);
  } catch (err) {
    if (err.status === 409 || err.status === 400) return; // déjà signalé par ce lecteur
    throw err;
  }
}

async function setReviewHidden(reviewId, hidden) {
  await firestore.patch(`reviews/${reviewId}`, { hidden });
}

async function deleteReviewAsAdmin(reviewId) {
  await firestore.remove(`reviews/${reviewId}`);
}

async function dismissReports(reports) {
  await Promise.all(reports.map(r => firestore.remove(`reports/${r.id}`)));
}

// Formulaire de signalement affiché sous l'avis concerné.
function openReportForm(li, review) {
  if (li.querySelector(".report-form")) return;
  li.insertAdjacentHTML("beforeend", `
    <form class="report-form" novalidate>
      <label>Pourquoi signaler cet avis ?
        <select name="reason">${REPORT_REASONS.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join("")}</select>
      </label>
      <button type="submit" class="more-btn">Envoyer le signalement</button>
      <button type="button" class="link-btn" data-cancel-report>Annuler</button>
      <p class="form-msg small" hidden></p>
    </form>`);
  const form = li.querySelector(".report-form");
  form.querySelector("[data-cancel-report]").addEventListener("click", () => form.remove());
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const msg = form.querySelector(".form-msg");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await reportReview(review, form.querySelector("select").value);
      form.innerHTML = `<p class="small success">Merci, l'avis a été signalé. Un modérateur va l'examiner.</p>`;
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "form-msg small error";
      msg.hidden = false;
      button.disabled = false;
    }
  });
}

/* ---------- Page de modération (administrateurs) --------------------------- */

async function viewModeration() {
  document.title = "Modération — Biblio FR";
  app.innerHTML = loadingHtml;
  const user = currentUser();
  if (!user || !(await checkAdmin(user))) {
    app.innerHTML = `<p class="empty">Cette page est réservée aux modérateurs du site.</p>`;
    return;
  }

  let reports = [];
  let hidden = [];
  try {
    [reports, hidden] = await Promise.all([
      firestore.runQuery({ from: [{ collectionId: "reports" }], limit: 500 }),
      firestore.runQuery({
        from: [{ collectionId: "reviews" }],
        where: { fieldFilter: { field: { fieldPath: "hidden" }, op: "EQUAL", value: { booleanValue: true } } },
        limit: 200,
      }),
    ]);
  } catch (err) {
    app.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    return;
  }

  // Regroupe les signalements par avis.
  const byReview = new Map();
  for (const r of reports) {
    if (!byReview.has(r.reviewId)) byReview.set(r.reviewId, []);
    byReview.get(r.reviewId).push(r);
  }
  const reviewsById = new Map();
  await Promise.all([...byReview.keys()].map(async id => {
    reviewsById.set(id, await firestore.get(`reviews/${id}`).catch(() => null));
  }));

  const row = (id, review, reps) => `
    <li class="mod-row" data-review-id="${esc(id)}">
      ${review ? `
        <div class="review-head">
          ${starsHtml(review.rating)}
          ${profileLink(review.uid, review.name)}
          <span class="muted small">sur <strong>${esc(review.title)}</strong></span>
          ${review.hidden ? `<span class="badge">Masqué</span>` : ""}
        </div>
        ${review.comment ? `<p class="mod-comment">${esc(review.comment)}</p>` : `<p class="muted small">(note sans commentaire)</p>`}`
        : `<p class="muted">Avis déjà supprimé.</p>`}
      ${reps && reps.length ? `<p class="small"><strong>${reps.length} signalement${reps.length > 1 ? "s" : ""} :</strong>
        ${[...new Set(reps.map(r => reasonLabel(r.reason)))].map(esc).join(", ")}</p>` : ""}
      <div class="mod-actions">
        ${review ? (review.hidden
          ? `<button type="button" class="more-btn" data-mod="show">Réafficher</button>`
          : `<button type="button" class="more-btn" data-mod="hide">Masquer</button>`) : ""}
        ${review ? `<button type="button" class="link-btn danger" data-mod="delete">Supprimer l'avis</button>` : ""}
        ${reps && reps.length ? `<button type="button" class="link-btn" data-mod="dismiss">Classer sans suite</button>` : ""}
      </div>
    </li>`;

  const hiddenOnly = hidden.filter(h => !byReview.has(h.id));
  app.innerHTML = `
    <h1 class="page-title">Modération</h1>
    <p class="muted">Avis signalés par les lecteurs. Un avis masqué n'est plus visible que par son auteur et les modérateurs.</p>
    <section class="account-card">
      <h2>Signalements en attente <span class="muted small">· ${byReview.size}</span></h2>
      ${byReview.size ? `<ul class="mod-list">${[...byReview.entries()].map(([id, reps]) => row(id, reviewsById.get(id), reps)).join("")}</ul>`
        : `<p class="muted">Aucun signalement en attente. 🎉</p>`}
    </section>
    <section class="account-card">
      <h2>Avis masqués <span class="muted small">· ${hiddenOnly.length}</span></h2>
      ${hiddenOnly.length ? `<ul class="mod-list">${hiddenOnly.map(h => row(h.id, h, [])).join("")}</ul>` : `<p class="muted">Aucun avis masqué.</p>`}
    </section>`;

  app.querySelectorAll(".mod-row").forEach(li => {
    const id = li.dataset.reviewId;
    li.querySelectorAll("[data-mod]").forEach(btn => btn.addEventListener("click", async () => {
      const action = btn.dataset.mod;
      if (action === "delete" && btn.dataset.confirm !== "1") {
        btn.dataset.confirm = "1";
        btn.textContent = "Confirmer la suppression";
        return;
      }
      btn.disabled = true;
      try {
        if (action === "hide") await setReviewHidden(id, true);
        if (action === "show") await setReviewHidden(id, false);
        if (action === "delete") { await deleteReviewAsAdmin(id); await dismissReports(byReview.get(id) || []); }
        if (action === "dismiss") await dismissReports(byReview.get(id) || []);
        viewModeration();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = err.message;
      }
    }));
  });
}

onAuthChange(user => { adminState = { uid: null, value: false }; renderAdminLink(); if (user) checkAdmin(user); });
