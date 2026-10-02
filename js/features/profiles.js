"use strict";

/* =========================================================================
 *  Profils publics des lecteurs
 *  Chaque compte a un document users/{uid} (pseudo + date d'inscription,
 *  jamais l'e-mail) qui permet de chercher un lecteur et d'afficher ses avis.
 * ========================================================================= */

const normName = s => (s || "").trim().toLowerCase();

/* ---------- Pseudos uniques -------------------------------------------------
 * Chaque pseudo est réservé par un document usernames/{pseudo en minuscules}
 * qui contient l'uid de son propriétaire. Réservation, mise à jour du profil
 * et libération de l'ancien pseudo se font en une seule écriture atomique.
 * ------------------------------------------------------------------------- */

const PSEUDO_RE = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.'-]{2,30}$/u;

function pseudoError(name) {
  const n = (name || "").trim();
  if (n.length < 2 || n.length > 30) return "Le pseudo doit contenir entre 2 et 30 caractères.";
  if (!PSEUDO_RE.test(n)) return "Le pseudo ne peut contenir que des lettres, des chiffres, des espaces et les signes _ . ' -";
  return "";
}

async function pseudoOwner(name) {
  const doc = await firestore.get(`usernames/${name.trim().toLowerCase()}`).catch(() => null);
  return doc ? doc.uid : null;
}

async function isPseudoFree(name, uid = null) {
  const owner = await pseudoOwner(name);
  return !owner || owner === uid;
}

// Premier pseudo libre parmi « Nom », « Nom 2 », « Nom 3 »…
async function freePseudo(base, uid) {
  let clean = String(base || "").replace(/[^\p{L}\p{N} _.'-]/gu, "").trim().slice(0, 26);
  if (pseudoError(clean)) clean = "Lecteur";
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? clean : `${clean} ${i}`;
    if (await isPseudoFree(candidate, uid)) return candidate;
  }
  return `${clean} ${Date.now().toString(36).slice(-4)}`;
}

function parseProfile(doc) {
  const f = doc.fields || {};
  return {
    uid: doc.name.split("/").pop(),
    name: f.name?.stringValue || "Lecteur",
    nameLower: f.nameLower?.stringValue || "",
    createdAt: f.createdAt?.timestampValue || "",
    photoURL: f.photoURL?.stringValue || "",
    avatar: f.avatar?.stringValue || "",
    showLibrary: Boolean(f.showLibrary?.booleanValue),
  };
}

async function getProfile(uid) {
  try {
    return parseProfile(await firestore.request(`${firestore.base()}/users/${encodeURIComponent(uid)}`));
  } catch {
    return null;
  }
}

let myProfileCache = null;   // profil public du compte connecté (avatar, pseudo…)

// Réserve le pseudo du compte et met à jour son profil public, atomiquement.
async function claimPseudo(user, name, existing) {
  const lower = name.toLowerCase();
  const writes = [];
  if ((await pseudoOwner(name)) !== user.uid) {
    writes.push({
      update: { name: firestore.docName(`usernames/${lower}`), fields: toFirestore({ uid: user.uid }) },
      currentDocument: { exists: false },
    });
  }
  const createdAt = existing && existing.createdAt ? existing.createdAt : new Date(user.metadata?.creationTime || Date.now()).toISOString();
  writes.push({
    update: {
      name: firestore.docName(`users/${user.uid}`),
      fields: toFirestore({ name, nameLower: lower, createdAt: ts(createdAt), photoURL: (user.photoURL || "").slice(0, 500) }),
    },
    updateMask: { fieldPaths: ["name", "nameLower", "createdAt", "photoURL"] },
  });
  // Libère l'ancien pseudo s'il appartenait bien à ce compte.
  if (existing && existing.nameLower && existing.nameLower !== lower && (await pseudoOwner(existing.nameLower)) === user.uid) {
    writes.push({ delete: firestore.docName(`usernames/${existing.nameLower}`) });
  }
  await firestore.commit(writes);
}

// Crée ou met à jour le profil public du compte connecté, avec un pseudo unique.
async function syncProfile(user) {
  if (!user || !FIREBASE_PROJECT_ID || !user.displayName) return;  // inscription en cours : le pseudo arrive juste après
  try {
    const existing = await getProfile(user.uid);
    let name = user.displayName.trim().slice(0, 30);
    const owned = existing && existing.nameLower && (await pseudoOwner(existing.nameLower)) === user.uid;
    if (existing && owned && existing.name === name && existing.photoURL === (user.photoURL || "")) {
      myProfileCache = existing;
      renderAccountButton();
      return;
    }
    if (pseudoError(name) || !(await isPseudoFree(name, user.uid))) {
      name = await freePseudo(name, user.uid);
      await user.updateProfile({ displayName: name });
    }
    await claimPseudo(user, name, existing);
    myProfileCache = await getProfile(user.uid);
    renderAccountButton();
  } catch (err) {
    console.warn("Profil public non enregistré :", err.message);
  }
}

// Changement de pseudo depuis « Mon compte ». Renvoie un message d'erreur, ou "" si tout s'est bien passé.
async function renamePseudo(user, name) {
  const error = pseudoError(name);
  if (error) return error;
  if (!(await isPseudoFree(name, user.uid))) return "Ce pseudo est déjà pris. Choisissez-en un autre.";
  const existing = await getProfile(user.uid);
  await claimPseudo(user, name.trim(), existing);
  await user.updateProfile({ displayName: name.trim() });
  myProfileCache = await getProfile(user.uid);
  await renameReviews(user);
  return "";
}

// Met à jour le nom affiché sur tous les avis du compte.
async function renameReviews(user) {
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
  const existing = await getProfile(uid);
  if (existing && existing.nameLower) await firestore.remove(`usernames/${existing.nameLower}`).catch(() => {});
  await firestore.request(`${firestore.base()}/users/${encodeURIComponent(uid)}`, { method: "DELETE" }).catch(() => {});
}

/* ---------- Avatar ------------------------------------------------------------ */

const AVATARS = ["📚", "🦊", "🐱", "🐼", "🦉", "🐉", "🌸", "🚀", "🎨", "☕", "🌙", "⚡", "🍀", "🎧", "🧙", "🐢"];

async function setAvatar(user, avatar) {
  await firestore.patch(`users/${user.uid}`, { avatar });
  myProfileCache = await getProfile(user.uid);
  renderAccountButton();
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
  if (profile.avatar) return `<span class="avatar emoji ${size}" aria-hidden="true">${esc(profile.avatar)}</span>`;
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

  // Avis masqués par la modération : visibles par leur auteur et les modérateurs seulement.
  const canSeeHidden = (currentUser() && currentUser().uid === uid) || isAdminCached();
  for (let i = reviews.length - 1; i >= 0; i--) if (reviews[i].hidden && !canSeeHidden) reviews.splice(i, 1);

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

    <div id="public-library"></div>

    <section class="account-card">
      <h2>Notes et commentaires</h2>
      ${reviews.length
        ? `<ul class="review-list">${reviews.map(r => `
            <li>
              <div class="review-head">
                ${starsHtml(r.rating)}
                <a href="#/recherche/title/${enc(r.title.split(" — ")[0])}"><strong>${esc(r.title)}</strong></a>
                ${reviewDateHtml(r)}
              </div>
              ${r.comment ? `<p>${esc(r.comment)}</p>` : ""}
            </li>`).join("")}</ul>`
        : `<p class="muted">${isMe ? "Vous n'avez pas encore donné d'avis." : "Ce lecteur n'a pas encore donné d'avis."}</p>`}
    </section>`;
  renderPublicLibrary(uid, profile);
}

// Bibliothèque et listes publiques d'un lecteur (si il a choisi de les montrer).
async function renderPublicLibrary(uid, profile) {
  const box = document.getElementById("public-library");
  if (!box) return;
  const [entries, lists] = await Promise.all([
    profile && profile.showLibrary ? firestore.list(`users/${uid}/library`).catch(() => []) : [],
    firestore.runQuery({
      from: [{ collectionId: "lists" }],
      where: { fieldFilter: { field: { fieldPath: "public" }, op: "EQUAL", value: { booleanValue: true } } },
      limit: 50,
    }, `users/${uid}`).catch(() => []),
  ]);
  if (!document.body.contains(box)) return;
  const shelf = (label, status) => {
    const items = entries.filter(e => e.status === status);
    if (!items.length) return "";
    return `<section class="account-card"><h2>${label} <span class="muted small">· ${items.length}</span></h2>
      <div class="shelf">${items.slice(0, 20).map(e => bookCardHtml(bookFromSnapshot(e.id, e))).join("")}</div></section>`;
  };
  box.innerHTML = shelf("En cours de lecture", "reading") + shelf("Livres lus", "read") + shelf("À lire", "to-read")
    + (lists.length ? `<section class="account-card"><h2>Listes publiques</h2><ul class="public-lists">${lists.map(l =>
      `<li><a href="#/liste/${enc(uid)}/${enc(l.id)}">${esc(l.name)}</a> <span class="muted small">· ${(l.items || []).length} livres</span></li>`).join("")}</ul></section>` : "");
}

// Le profil public est créé ou mis à jour à chaque connexion.
onAuthChange(user => { myProfileCache = null; if (user) syncProfile(user); });
