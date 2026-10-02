"use strict";

/* =========================================================================
 *  Bibliothèque personnelle : statuts (À lire, En cours, Lu), favoris,
 *  listes personnalisées, historique des livres consultés et statistiques.
 *
 *  - Connecté : enregistrée dans Firestore (users/{uid}/library et
 *    users/{uid}/lists), donc retrouvée sur tous les appareils.
 *  - Non connecté : enregistrée dans le navigateur, puis versée dans le
 *    compte à la première connexion.
 *  L'historique reste toujours privé, dans le navigateur.
 * ========================================================================= */

const LIB_STATUSES = [
  { id: "to-read", label: "À lire", icon: "🔖" },
  { id: "reading", label: "En cours", icon: "📖" },
  { id: "read", label: "Lu", icon: "✓" },
];
const statusLabel = id => (LIB_STATUSES.find(s => s.id === id) || {}).label || "";

const MAX_LIST_ITEMS = 200;
const MAX_HISTORY = 60;

const localStore = {
  read(name, fallback) {
    try { return JSON.parse(localStorage.getItem(`bibliofr.${name}`)) || fallback; } catch { return fallback; }
  },
  write(name, value) {
    try { localStorage.setItem(`bibliofr.${name}`, JSON.stringify(value)); } catch { /* stockage indisponible */ }
  },
};

// Résumé d'un livre conservé dans la bibliothèque (suffisant pour réafficher sa carte).
function bookSnapshot(book) {
  return {
    title: String(book.title || "").slice(0, 300),
    authors: (book.authors || []).slice(0, 10).map(a => String(a).slice(0, 120)),
    cover: (typeof usableCovers === "function" ? usableCovers(book)[0] : (book.covers || [])[0]) || "",
    isbn: String(book.isbn || "").slice(0, 20),
    year: String(book.year || "").slice(0, 10),
    pages: Number(book.pages) || 0,
  };
}

// Reconstruit une fiche affichable à partir d'un résumé enregistré.
function bookFromSnapshot(key, snap) {
  const id = `lib-${key}`;
  const book = bookCache.get(id) || {
    id, title: snap.title, authors: snap.authors || [], year: snap.year || "", publisher: "", pages: snap.pages || "",
    categories: [], description: "", isbn: snap.isbn || "", covers: snap.cover ? [snap.cover] : [], link: "",
  };
  bookCache.set(id, book);
  return book;
}

const library = {
  entries: new Map(),   // clé du livre → { title, authors, cover, isbn, year, pages, status, favorite, addedAt, updatedAt, readAt }
  lists: new Map(),     // id → { name, public, items: [{ key, ...résumé }], createdAt, updatedAt }
  uid: null,
  ready: Promise.resolve(),
  listeners: [],

  remote() { return Boolean(this.uid && FIREBASE_PROJECT_ID); },
  onChange(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(fn => fn()); },

  // Charge la bibliothèque du compte connecté (ou celle du navigateur).
  async load(user) {
    this.uid = user ? user.uid : null;
    this.entries = new Map();
    this.lists = new Map();
    if (!this.remote()) {
      Object.entries(localStore.read("library", {})).forEach(([k, v]) => this.entries.set(k, v));
      Object.entries(localStore.read("lists", {})).forEach(([k, v]) => this.lists.set(k, v));
      this.emit();
      return;
    }
    try {
      const [entries, lists] = await Promise.all([
        firestore.list(`users/${this.uid}/library`),
        firestore.list(`users/${this.uid}/lists`),
      ]);
      entries.forEach(({ id, ...e }) => this.entries.set(id, e));
      lists.forEach(({ id, ...l }) => this.lists.set(id, l));
      await this.importLocal();
    } catch (err) {
      console.warn("Bibliothèque indisponible :", err.message);
    }
    this.emit();
  },

  // Verse dans le compte ce qui avait été enregistré avant la connexion.
  async importLocal() {
    const localEntries = localStore.read("library", {});
    const localLists = localStore.read("lists", {});
    const writes = [];
    for (const [key, e] of Object.entries(localEntries)) {
      if (!this.entries.has(key)) { this.entries.set(key, e); writes.push(this.saveEntry(key, e)); }
    }
    for (const [id, l] of Object.entries(localLists)) {
      if (!this.lists.has(id)) { this.lists.set(id, l); writes.push(this.saveList(id, l)); }
    }
    await Promise.allSettled(writes);
    localStore.write("library", {});
    localStore.write("lists", {});
  },

  persistLocal() {
    if (this.remote()) return;
    localStore.write("library", Object.fromEntries(this.entries));
    localStore.write("lists", Object.fromEntries(this.lists));
  },

  saveEntry(key, e) {
    if (!this.remote()) return this.persistLocal();
    const data = { ...e, addedAt: ts(e.addedAt), updatedAt: ts(e.updatedAt) };
    if (e.readAt) data.readAt = ts(e.readAt); else delete data.readAt;
    return firestore.patch(`users/${this.uid}/library/${key}`, data);
  },

  saveList(id, l) {
    if (!this.remote()) return this.persistLocal();
    return firestore.patch(`users/${this.uid}/lists/${id}`, { ...l, createdAt: ts(l.createdAt), updatedAt: ts(l.updatedAt) });
  },

  entry(book) { return this.entries.get(reviewKey(book)) || null; },

  // Change le statut et/ou le favori d'un livre. Une fiche vide est retirée.
  async update(book, changes) {
    const key = reviewKey(book);
    const now = new Date().toISOString();
    const prev = this.entries.get(key);
    const e = { ...bookSnapshot(book), status: "", favorite: false, addedAt: now, ...(prev || {}), ...changes, updatedAt: now };
    if (changes.status === "read" && (!prev || prev.status !== "read")) e.readAt = now;
    if (changes.status !== undefined && changes.status !== "read") delete e.readAt;

    if (!e.status && !e.favorite) {
      this.entries.delete(key);
      this.emit();
      if (this.remote()) await firestore.remove(`users/${this.uid}/library/${key}`);
      else this.persistLocal();
      return;
    }
    this.entries.set(key, e);
    this.emit();
    await this.saveEntry(key, e);
  },

  async createList(name, isPublic = false) {
    const id = `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const l = { name: name.trim().slice(0, 60), public: Boolean(isPublic), items: [], createdAt: now, updatedAt: now };
    this.lists.set(id, l);
    this.emit();
    await this.saveList(id, l);
    return id;
  },

  async editList(id, changes) {
    const l = this.lists.get(id);
    if (!l) return;
    Object.assign(l, changes, { updatedAt: new Date().toISOString() });
    this.emit();
    await this.saveList(id, l);
  },

  async deleteList(id) {
    this.lists.delete(id);
    this.emit();
    if (this.remote()) await firestore.remove(`users/${this.uid}/lists/${id}`);
    else this.persistLocal();
  },

  inList(id, book) {
    const l = this.lists.get(id);
    return Boolean(l && l.items.some(i => i.key === reviewKey(book)));
  },

  async toggleInList(id, book) {
    const l = this.lists.get(id);
    if (!l) return;
    const key = reviewKey(book);
    const items = l.items.some(i => i.key === key)
      ? l.items.filter(i => i.key !== key)
      : [...l.items, { key, ...bookSnapshot(book) }].slice(-MAX_LIST_ITEMS);
    await this.editList(id, { items });
  },
};

/* ---------- Historique des livres consultés (toujours local) ------------- */

const readingHistory = {
  all() { return localStore.read("history", []); },
  add(book) {
    const key = reviewKey(book);
    const list = this.all().filter(h => h.key !== key);
    list.unshift({ key, ...bookSnapshot(book), viewedAt: new Date().toISOString() });
    localStore.write("history", list.slice(0, MAX_HISTORY));
  },
  clear() { localStore.write("history", []); },
};

/* ---------- Statistiques personnelles ------------------------------------ */

function libraryStats() {
  const all = [...library.entries.values()];
  const year = new Date().getFullYear();
  const read = all.filter(e => e.status === "read");
  return {
    read: read.length,
    readThisYear: read.filter(e => e.readAt && new Date(e.readAt).getFullYear() === year).length,
    reading: all.filter(e => e.status === "reading").length,
    toRead: all.filter(e => e.status === "to-read").length,
    favorites: all.filter(e => e.favorite).length,
    pages: read.reduce((n, e) => n + (Number(e.pages) || 0), 0),
    lists: library.lists.size,
  };
}

/* ---------- Interface : fiche livre --------------------------------------- */

function libraryControlsHtml() {
  return `<div class="lib-controls" id="lib-controls"></div>`;
}

function renderLibraryControls(book) {
  const box = document.getElementById("lib-controls");
  if (!box) return;
  const e = library.entry(book) || {};
  const lists = [...library.lists.entries()];
  box.innerHTML = `
    <div class="lib-status" role="group" aria-label="Statut de lecture">
      ${LIB_STATUSES.map(s => `
        <button type="button" class="lib-btn${e.status === s.id ? " on" : ""}" aria-pressed="${e.status === s.id}" data-lib-status="${s.id}">
          ${s.icon} ${s.label}
        </button>`).join("")}
      <button type="button" class="lib-btn fav${e.favorite ? " on" : ""}" aria-pressed="${Boolean(e.favorite)}" data-lib-fav
              title="${e.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}">${e.favorite ? "♥" : "♡"} Favori</button>
    </div>
    <details class="lib-lists">
      <summary>Ajouter à une liste${lists.length ? ` (${lists.filter(([id]) => library.inList(id, book)).length}/${lists.length})` : ""}</summary>
      <div class="lib-lists-body">
        ${lists.map(([id, l]) => `
          <label class="lib-list-row"><input type="checkbox" data-lib-list="${esc(id)}"${library.inList(id, book) ? " checked" : ""}>
            ${esc(l.name)} ${l.public ? `<span class="badge">Publique</span>` : ""}</label>`).join("")
          || `<p class="muted small">Aucune liste pour l'instant.</p>`}
        <form class="lib-new-list" novalidate>
          <input id="lib-new-list-name" maxlength="60" placeholder="Nouvelle liste (ex. : Vacances)" aria-label="Nom de la nouvelle liste">
          <button type="submit" class="more-btn">Créer et ajouter</button>
        </form>
      </div>
    </details>
    ${library.remote() ? "" : `<p class="muted small">Votre bibliothèque est enregistrée dans ce navigateur. <button type="button" class="link-btn" data-auth="login">Connectez-vous</button> pour la retrouver partout.</p>`}`;

  const fail = err => { box.insertAdjacentHTML("beforeend", `<p class="error small">${esc(err.message)}</p>`); };
  box.querySelectorAll("[data-lib-status]").forEach(btn => btn.addEventListener("click", () => {
    const status = btn.dataset.libStatus === e.status ? "" : btn.dataset.libStatus;
    library.update(book, { status }).catch(fail);
  }));
  box.querySelector("[data-lib-fav]").addEventListener("click", () => library.update(book, { favorite: !e.favorite }).catch(fail));
  box.querySelectorAll("[data-lib-list]").forEach(cb => cb.addEventListener("change", () => {
    library.toggleInList(cb.dataset.libList, book).catch(fail);
  }));
  box.querySelector(".lib-new-list").addEventListener("submit", async ev => {
    ev.preventDefault();
    const name = box.querySelector("#lib-new-list-name").value.trim();
    if (!name) return;
    try {
      const id = await library.createList(name);
      await library.toggleInList(id, book);
      box.querySelector(".lib-lists").open = true;
    } catch (err) { fail(err); }
  });
}

// Pastille de statut sur les cartes (« Lu », « En cours », ♥…).
function libraryBadgeHtml(book) {
  const e = library.entry(book);
  if (!e) return "";
  const parts = [];
  if (e.status) parts.push(`<span class="lib-badge s-${e.status}">${esc(statusLabel(e.status))}</span>`);
  if (e.favorite) parts.push(`<span class="lib-badge fav" aria-label="Favori">♥</span>`);
  return parts.join("");
}

function refreshLibraryBadges() {
  document.querySelectorAll(".book-card[data-key]").forEach(card => {
    const holder = card.querySelector(".lib-badges");
    const book = bookCache.get(card.dataset.id);
    if (holder && book) holder.innerHTML = libraryBadgeHtml(book);
  });
}

/* ---------- Page « Ma bibliothèque » --------------------------------------- */

const LIB_TABS = [
  { id: "en-cours", label: "En cours", filter: e => e.status === "reading" },
  { id: "a-lire", label: "À lire", filter: e => e.status === "to-read" },
  { id: "lus", label: "Lus", filter: e => e.status === "read" },
  { id: "favoris", label: "Favoris", filter: e => e.favorite },
  { id: "listes", label: "Mes listes" },
  { id: "historique", label: "Historique" },
];

function entryCardsHtml(pairs) {
  return `<div class="book-grid">${pairs.map(([key, snap]) => bookCardHtml(bookFromSnapshot(key, snap))).join("")}</div>`;
}

function viewLibrary(tabId) {
  const tab = LIB_TABS.find(t => t.id === tabId) || LIB_TABS[0];
  document.title = "Ma bibliothèque — Biblio FR";
  const st = libraryStats();
  const counts = {
    "en-cours": st.reading, "a-lire": st.toRead, lus: st.read, favoris: st.favorites,
    listes: st.lists, historique: readingHistory.all().length,
  };

  app.innerHTML = `
    <h1 class="page-title">Ma bibliothèque</h1>
    ${library.remote() ? "" : `<p class="notice">Votre bibliothèque est enregistrée dans ce navigateur uniquement. <button type="button" class="link-btn" data-auth="login">Connectez-vous</button> pour la sauvegarder dans votre compte et la retrouver sur tous vos appareils.</p>`}
    <dl class="lib-stats">
      <div><dt>Livres lus</dt><dd>${st.read}</dd></div>
      <div><dt>Lus en ${new Date().getFullYear()}</dt><dd>${st.readThisYear}</dd></div>
      <div><dt>En cours</dt><dd>${st.reading}</dd></div>
      <div><dt>À lire</dt><dd>${st.toRead}</dd></div>
      <div><dt>Favoris</dt><dd>${st.favorites}</dd></div>
      ${st.pages ? `<div><dt>Pages lues</dt><dd>${st.pages.toLocaleString("fr-FR")}</dd></div>` : ""}
      <div id="lib-review-stats" hidden></div>
    </dl>
    <nav class="tag-filter" aria-label="Sections de la bibliothèque">
      ${LIB_TABS.map(t => `<a class="tag${t === tab ? " active" : ""}" href="#/bibliotheque/${t.id}"${t === tab ? ' aria-current="page"' : ""}>${esc(t.label)} <span class="count">${counts[t.id]}</span></a>`).join("")}
    </nav>
    <div id="lib-content"></div>`;

  const content = document.getElementById("lib-content");

  if (tab.filter) {
    const pairs = [...library.entries.entries()].filter(([, e]) => tab.filter(e))
      .sort((a, b) => (b[1].updatedAt || "").localeCompare(a[1].updatedAt || ""));
    content.innerHTML = pairs.length
      ? entryCardsHtml(pairs)
      : `<p class="empty">Rien ici pour l'instant. Ouvrez la fiche d'un livre et choisissez « ${tab.id === "favoris" ? "Favori" : esc(tab.label.replace(/s$/, ""))} ».</p>`;
  } else if (tab.id === "historique") {
    const items = readingHistory.all();
    content.innerHTML = items.length
      ? `<p class="muted small">Les ${items.length} derniers livres consultés, visibles par vous seul. <button type="button" class="link-btn" id="clear-history">Effacer l'historique</button></p>
         ${entryCardsHtml(items.map(h => [h.key, h]))}`
      : `<p class="empty">Les livres que vous consultez apparaîtront ici.</p>`;
    const clear = document.getElementById("clear-history");
    if (clear) clear.addEventListener("click", () => { readingHistory.clear(); viewLibrary("historique"); });
  } else {
    renderListsTab(content);
  }

  // Avis publiés et note moyenne (compte connecté).
  if (library.remote()) {
    firestoreReviews.listByUser(library.uid).then(reviews => {
      const box = document.getElementById("lib-review-stats");
      if (!box || !reviews.length) return;
      const avg = reviews.reduce((n, r) => n + r.rating, 0) / reviews.length;
      box.outerHTML = `<div><dt>Avis publiés</dt><dd>${reviews.length}</dd></div><div><dt>Note moyenne</dt><dd>${avg.toFixed(1).replace(".", ",")}</dd></div>`;
    }).catch(() => {});
  }
}

function renderListsTab(content) {
  const lists = [...library.lists.entries()].sort((a, b) => (b[1].updatedAt || "").localeCompare(a[1].updatedAt || ""));
  content.innerHTML = `
    <form class="inline-search" id="new-list-form" novalidate>
      <input id="new-list-name" maxlength="60" placeholder="Nom de la nouvelle liste" aria-label="Nom de la nouvelle liste">
      <button type="submit">Créer la liste</button>
    </form>
    ${lists.length ? lists.map(([id, l]) => `
      <section class="account-card list-card" data-list="${esc(id)}">
        <div class="list-head">
          <h2>${esc(l.name)} <span class="muted small">· ${l.items.length} livre${l.items.length > 1 ? "s" : ""}</span></h2>
          <div class="list-actions">
            ${library.remote() ? `<label class="small"><input type="checkbox" data-list-public${l.public ? " checked" : ""}> Publique</label>` : ""}
            ${library.remote() && l.public ? `<button type="button" class="link-btn" data-list-share>Copier le lien</button>` : ""}
            <button type="button" class="link-btn" data-list-rename>Renommer</button>
            <button type="button" class="link-btn danger" data-list-delete>Supprimer</button>
          </div>
        </div>
        ${l.items.length ? entryCardsHtml(l.items.map(i => [i.key, i])) : `<p class="muted small">Ajoutez des livres depuis leur fiche (« Ajouter à une liste »).</p>`}
      </section>`).join("") : `<p class="empty">Créez une liste pour regrouper des livres : « Vacances », « Cadeaux », « Classiques à relire »…</p>`}`;

  document.getElementById("new-list-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = document.getElementById("new-list-name").value.trim();
    if (!name) return;
    await library.createList(name).catch(() => {});
    viewLibrary("listes");
  });
  content.querySelectorAll("[data-list]").forEach(card => {
    const id = card.dataset.list;
    const l = library.lists.get(id);
    const pub = card.querySelector("[data-list-public]");
    if (pub) pub.addEventListener("change", async () => { await library.editList(id, { public: pub.checked }).catch(() => {}); viewLibrary("listes"); });
    const share = card.querySelector("[data-list-share]");
    if (share) share.addEventListener("click", () => copyLink(listUrl(library.uid, id), share));
    card.querySelector("[data-list-rename]").addEventListener("click", () => {
      const h2 = card.querySelector("h2");
      h2.innerHTML = `<form class="rename-form"><input value="${esc(l.name)}" maxlength="60" aria-label="Nouveau nom"><button class="more-btn">OK</button></form>`;
      const form = h2.querySelector("form");
      form.querySelector("input").focus();
      form.addEventListener("submit", async ev => {
        ev.preventDefault();
        const name = form.querySelector("input").value.trim();
        if (name) await library.editList(id, { name }).catch(() => {});
        viewLibrary("listes");
      });
    });
    const del = card.querySelector("[data-list-delete]");
    del.addEventListener("click", async () => {
      if (del.dataset.confirm !== "1") { del.dataset.confirm = "1"; del.textContent = "Confirmer la suppression"; return; }
      await library.deleteList(id).catch(() => {});
      viewLibrary("listes");
    });
  });
}

/* ---------- Listes publiques (partage) ------------------------------------- */

const listUrl = (uid, id) => `${location.origin}${location.pathname}#/liste/${enc(uid)}/${enc(id)}`;

async function copyLink(url, btn) {
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = "Lien copié ✓";
  } catch {
    prompt("Copiez ce lien :", url);
  }
}

async function viewPublicList(arg) {
  const [uid, id] = arg.split("/");
  if (!uid || !id || !FIREBASE_PROJECT_ID) return viewNotFound();
  app.innerHTML = loadingHtml;
  let list = null;
  try { list = await firestore.get(`users/${uid}/lists/${id}`); } catch { /* liste privée ou supprimée */ }
  if (!list) {
    app.innerHTML = `<p class="empty">Cette liste n'existe pas ou n'est pas publique.</p>`;
    return;
  }
  const owner = await getProfile(uid);
  document.title = `${list.name} — Biblio FR`;
  setPageMeta(`${list.name}, une liste de ${owner ? owner.name : "lecteur"} sur Biblio FR (${list.items.length} livres).`);
  app.innerHTML = `
    <h1 class="page-title">${esc(list.name)}</h1>
    <p class="muted">Liste de ${owner ? profileLink(uid, owner.name) : "un lecteur"} · ${list.items.length} livre${list.items.length > 1 ? "s" : ""}
      · <button type="button" class="link-btn" id="share-list">Copier le lien</button></p>
    ${list.items.length ? entryCardsHtml(list.items.map(i => [i.key, i])) : `<p class="empty">Cette liste est vide.</p>`}`;
  document.getElementById("share-list").addEventListener("click", e => copyLink(location.href, e.target));
}

/* ---------- Branchements ------------------------------------------------------ */

library.onChange(() => {
  refreshLibraryBadges();
  if (bookDialog.open && currentBook) renderLibraryControls(currentBook);
  if (location.hash.startsWith("#/bibliotheque") && !document.querySelector("#lib-content .rename-form, #lib-content input:focus")) {
    viewLibrary(location.hash.split("/")[2]);
  }
});

onAuthChange(user => { library.ready = library.load(user); });
if (!FIREBASE_PROJECT_ID) library.ready = library.load(null);
