"use strict";

/* =========================================================================
 *  Profils publics des lecteurs
 *  Chaque compte a un document users/{uid} (pseudo + date d'inscription,
 *  jamais l'e-mail) qui permet de chercher un lecteur et d'afficher ses avis.
 * ========================================================================= */

const normName = s => (s || "").trim().toLowerCase();

function profileFields(user, createdAt) {
  const name = displayName(user).slice(0, 30);
  return {
    name: { stringValue: name },
    nameLower: { stringValue: name.toLowerCase() },
    createdAt: { timestampValue: createdAt },
    photoURL: { stringValue: (user.photoURL || "").slice(0, 500) },
  };
}

function parseProfile(doc) {
  const f = doc.fields || {};
  return {
    uid: doc.name.split("/").pop(),
    name: f.name?.stringValue || "Lecteur",
    createdAt: f.createdAt?.timestampValue || "",
    photoURL: f.photoURL?.stringValue || "",
  };
}

async function getProfile(uid) {
  try {
    return parseProfile(await firestore.request(`${firestore.base()}/users/${encodeURIComponent(uid)}`));
  } catch {
    return null;
  }
}

// Crée ou met à jour le profil public du compte connecté.
async function syncProfile(user) {
  if (!user || !FIREBASE_PROJECT_ID) return;
  const createdAt = new Date(user.metadata?.creationTime || Date.now()).toISOString();
  const existing = await getProfile(user.uid);
  if (existing && existing.name === displayName(user).slice(0, 30) && existing.photoURL === (user.photoURL || "")) return;
  const mask = ["name", "nameLower", "photoURL", "createdAt"].map(f => `updateMask.fieldPaths=${f}`).join("&");
  try {
    await firestore.request(`${firestore.base()}/users/${encodeURIComponent(user.uid)}?${mask}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: profileFields(user, existing && existing.createdAt ? existing.createdAt : createdAt) }),
    });
  } catch (err) {
    console.warn("Profil public non enregistré :", err.message);
  }
}

// Après un changement de pseudo : met à jour le profil et le nom affiché sur ses avis.
async function onProfileRenamed(user) {
  await syncProfile(user);
  const name = displayName(user).slice(0, 50);
  const mine = await firestoreReviews.listByUser(user.uid);
  await Promise.all(mine.filter(r => r.name !== name).map(r => {
    const id = r.path.split("/documents/")[1].split("/").map(p => encodeURIComponent(decodeURIComponent(p))).join("/");
    return firestore.request(`${firestore.base()}/${id}?updateMask.fieldPaths=name`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { name: { stringValue: name } } }),
    }).catch(() => {});
  }));
}

async function deleteProfile(uid) {
  await firestore.request(`${firestore.base()}/users/${encodeURIComponent(uid)}`, { method: "DELETE" }).catch(() => {});
}

// Pseudos commençant par `prefix` (sans tenir compte des majuscules), ou derniers inscrits si vide.
async function searchProfiles(prefix) {
  const q = normName(prefix);
  const query = { from: [{ collectionId: "users" }], limit: 30 };
  if (q) {
    query.where = {
      compositeFilter: {
        op: "AND",
        filters: [
          { fieldFilter: { field: { fieldPath: "nameLower" }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: q } } },
          { fieldFilter: { field: { fieldPath: "nameLower" }, op: "LESS_THAN", value: { stringValue: q + "" } } },
        ],
      },
    };
    query.orderBy = [{ field: { fieldPath: "nameLower" }, direction: "ASCENDING" }];
  } else {
    query.orderBy = [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }];
  }
  const rows = await firestore.request(`${firestore.base()}:runQuery`, {
    method: "POST",
    body: JSON.stringify({ structuredQuery: query }),
  });
  return rows.filter(r => r.document).map(r => parseProfile(r.document));
}

/* ---------- Affichage ----------------------------------------------------- */

function avatarHtml(profile, size = "") {
  return `<span class="avatar ${size}">${profile.photoURL
    ? `<img src="${esc(profile.photoURL)}" alt="" referrerpolicy="no-referrer">`
    : esc(initials(profile.name))}</span>`;
}

function memberSince(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : `Membre depuis ${d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
}

function profileLink(uid, name) {
  return uid
    ? `<a class="reviewer" href="#/lecteur/${enc(uid)}">${esc(name || "Lecteur")}</a>`
    : `<strong>${esc(name || "Anonyme")}</strong>`;
}

function profileCardHtml(p) {
  return `
    <a class="reader-card" href="#/lecteur/${enc(p.uid)}">
      ${avatarHtml(p)}
      <span class="reader-text">
        <strong>${esc(p.name)}</strong>
        <small class="muted">${esc(memberSince(p.createdAt))}</small>
      </span>
    </a>`;
}

function viewReaders(initialQuery = "") {
  document.title = "Lecteurs — Biblio FR";
  if (!FIREBASE_PROJECT_ID) {
    app.innerHTML = `<p class="empty">Les profils de lecteurs nécessitent les comptes, qui ne sont pas activés sur ce site.</p>`;
    return;
  }
  app.innerHTML = `
    <h1 class="page-title">Lecteurs</h1>
    <p class="muted">Retrouvez un lecteur par son pseudo pour voir ses notes et ses commentaires.</p>
    <form id="reader-form" class="inline-search" role="search">
      <input id="reader-input" type="search" placeholder="Pseudo d'un lecteur" autocomplete="off" value="${esc(initialQuery)}">
      <button type="submit">Chercher</button>
    </form>
    <h2 class="readers-title" id="readers-title"></h2>
    <div class="reader-grid" id="readers"></div>`;

  const input = document.getElementById("reader-input");
  let token = 0;
  async function run(q) {
    const current = ++token;
    const box = document.getElementById("readers");
    document.getElementById("readers-title").textContent = q ? `Pseudos commençant par « ${q} »` : "Derniers inscrits";
    box.innerHTML = loadingHtml;
    let list;
    try {
      list = await searchProfiles(q);
    } catch (err) {
      if (current === token) box.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      return;
    }
    if (current !== token) return;
    box.innerHTML = list.length
      ? list.map(profileCardHtml).join("")
      : `<p class="muted">${q ? "Aucun lecteur ne porte ce pseudo." : "Aucun lecteur inscrit pour l'instant."}</p>`;
  }

  // Recherche au fil de la frappe, avec un léger délai.
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => run(input.value), 300);
  });
  document.getElementById("reader-form").addEventListener("submit", e => {
    e.preventDefault();
    clearTimeout(timer);
    run(input.value);
  });
  run(initialQuery);
}

async function viewReader(uid) {
  document.title = "Profil — Biblio FR";
  if (!uid || !FIREBASE_PROJECT_ID) return viewNotFound();
  app.innerHTML = loadingHtml;

  const [profile, reviews] = await Promise.all([
    getProfile(uid),
    firestoreReviews.listByUser(uid).catch(() => []),
  ]);
  if (!location.hash.startsWith(`#/lecteur/${enc(uid)}`)) return;
  if (!profile && !reviews.length) {
    app.innerHTML = `<p class="empty">Ce lecteur n'existe pas ou a supprimé son compte. <a href="#/lecteurs">Chercher un autre lecteur</a></p>`;
    return;
  }

  const p = profile || { uid, name: (reviews[0] && reviews[0].name) || "Lecteur", createdAt: "", photoURL: "" };
  document.title = `${p.name} — Biblio FR`;
  reviews.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const avg = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0;
  const withComment = reviews.filter(r => r.comment).length;
  const isMe = currentUser() && currentUser().uid === uid;

  // Répartition des notes (5 → 1 étoile).
  const dist = [5, 4, 3, 2, 1].map(n => ({ n, count: reviews.filter(r => r.rating === n).length }));
  const max = Math.max(1, ...dist.map(d => d.count));

  app.innerHTML = `
    <section class="profile-head">
      ${avatarHtml(p, "large")}
      <div class="profile-id">
        <h1 class="page-title">${esc(p.name)}</h1>
        <p class="muted">${esc(memberSince(p.createdAt))}</p>
        ${isMe ? `<a href="#/compte" class="small">Modifier mon profil</a>` : ""}
      </div>
      <dl class="profile-stats">
        <div><dt>Livres notés</dt><dd>${reviews.length}</dd></div>
        <div><dt>Commentaires</dt><dd>${withComment}</dd></div>
        <div><dt>Note moyenne</dt><dd>${reviews.length ? avg.toFixed(1).replace(".", ",") : "–"}</dd></div>
      </dl>
    </section>

    ${reviews.length ? `
    <section class="account-card">
      <h2>Répartition des notes</h2>
      <ul class="rating-bars">
        ${dist.map(d => `
          <li>
            <span class="bar-label">${d.n} ★</span>
            <span class="bar-track"><span class="bar-fill" style="width:${(d.count / max) * 100}%"></span></span>
            <span class="bar-count">${d.count}</span>
          </li>`).join("")}
      </ul>
    </section>` : ""}

    <section class="account-card">
      <h2>Notes et commentaires</h2>
      ${reviews.length
        ? `<ul class="review-list">${reviews.map(r => `
            <li>
              <div class="review-head">
                ${starsHtml(r.rating)}
                <a href="#/recherche/title/${enc(r.title.split(" — ")[0])}"><strong>${esc(r.title)}</strong></a>
                <span class="muted small">${esc(formatDate(r.createdAt))}</span>
              </div>
              ${r.comment ? `<p>${esc(r.comment)}</p>` : ""}
            </li>`).join("")}</ul>`
        : `<p class="muted">${isMe ? "Vous n'avez pas encore donné d'avis." : "Ce lecteur n'a pas encore donné d'avis."}</p>`}
    </section>`;
}

// Le profil public est créé ou mis à jour à chaque connexion.
onAuthChange(user => { if (user) syncProfile(user); });
