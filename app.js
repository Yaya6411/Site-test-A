"use strict";

/* =========================================================================
 *  Biblio FR — catalogue des livres en français
 *  Application monopage sans dépendance : routage par hash, données
 *  récupérées en direct depuis Google Books ou Open Library.
 * ========================================================================= */

const PAGE_SIZE = 40;
const app = document.getElementById("app");
const bookCache = new Map();

/* ---------- Préférences ------------------------------------------------- */

const prefs = {
  get(key, fallback) {
    try { return localStorage.getItem("bibliofr." + key) || fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("bibliofr." + key, value); } catch { /* stockage indisponible */ }
  },
};

const getSource = () => {
  const source = prefs.get("source", "all");
  return source === "all" || sources[source] ? source : "all";
};
const getStore = () => STORES.find(s => s.id === prefs.get("store", "leslibraires")) || STORES[0];

/* ---------- Utilitaires ------------------------------------------------- */

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

const enc = encodeURIComponent;
const authorLink = name => `#/auteur/${enc(name)}`;

// Les librairies cherchent par titre + auteur : la recherche par ISBN renvoie
// souvent une page vide quand le revendeur ne connaît pas cette édition précise.
function storeUrl(store, book) {
  const title = book.title.split(" — ")[0].replace(/[«»"]/g, "").trim();
  const author = (book.authors[0] || "").replace(/\(.*?\)/g, "").trim();
  return store.url(enc([title, author].filter(Boolean).join(" ")));
}

/* ---------- Sources de données ------------------------------------------ */

const sources = {
  google: {
    label: "Google Books",
    buildQuery({ type, value }) {
      switch (type) {
        case "genre":  return `subject:"${value.google}"`;
        case "author": return `inauthor:"${value}"`;
        case "title":  return `intitle:${value}`;
        case "isbn":   return `isbn:${value.replace(/[^0-9Xx]/g, "")}`;
        case "recent": return value ? `subject:"${value.google}"` : "roman";
        default:       return value;
      }
    },
    // Recherche simple équivalente, utilisée quand la recherche avancée ne renvoie rien.
    plainQuery({ type, value }) {
      if (type === "genre") return value.name;
      if (type === "recent") return value ? value.name : "roman";
      return type === "isbn" ? value.replace(/[^0-9Xx]/g, "") : value;
    },
    async request(q, page, sort) {
      const params = new URLSearchParams({
        q,
        langRestrict: "fr",
        country: "FR",
        printType: "books",
        maxResults: PAGE_SIZE,
        startIndex: page * PAGE_SIZE,
        orderBy: sort === "new" ? "newest" : "relevance",
      });
      if (GOOGLE_API_KEY) params.set("key", GOOGLE_API_KEY);
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
      if (!res.ok) {
        throw new Error(res.status === 429 && !GOOGLE_API_KEY
          ? "Google Books : quota gratuit épuisé, une clé API est nécessaire"
          : `Google Books : erreur ${res.status}`);
      }
      return res.json();
    },
    async fetch(query, page, sort) {
      let data = await this.request(this.buildQuery(query), page, sort);
      if (!(data.items || []).length && query.type !== "all") {
        data = await this.request(this.plainQuery(query), page, sort);
      }
      const raw = data.items || [];
      const books = raw
        .filter(it => !it.volumeInfo.language || it.volumeInfo.language === "fr")
        .map(normalizeGoogle);
      // Google renvoie parfois moins de résultats que demandé : on continue tant qu'il en reste.
      return { books, total: data.totalItems || 0, hasMore: raw.length > 0 && page * PAGE_SIZE + raw.length < (data.totalItems || 0) };
    },
  },

  openlibrary: {
    label: "Open Library",
    async fetch(query, page, sort) {
      const params = new URLSearchParams({
        language: "fre",
        limit: PAGE_SIZE,
        page: page + 1,
        // "editions" renvoie l'édition qui correspond au filtre de langue (la version française).
        fields: "key,title,subtitle,author_name,first_publish_year,isbn,cover_i,subject,publisher,number_of_pages_median," +
                "editions,editions.key,editions.title,editions.subtitle,editions.isbn,editions.cover_i,editions.publisher,editions.publish_date",
      });
      const { type, value } = query;
      if (type === "genre") params.set("subject", value.openlibrary);
      else if (type === "author") params.set("author", value);
      else if (type === "title") params.set("title", value);
      else if (type === "isbn") params.set("isbn", value.replace(/[^0-9Xx]/g, ""));
      else if (type === "recent") value ? params.set("subject", value.openlibrary) : params.set("q", "language:fre");
      else params.set("q", value);
      if (sort === "new") params.set("sort", "new");

      const res = await fetch(`https://openlibrary.org/search.json?${params}`);
      if (!res.ok) throw new Error(`Open Library : erreur ${res.status}`);
      const data = await res.json();
      const books = (data.docs || []).map(normalizeOpenLibrary);
      return { books, total: data.numFound || 0, hasMore: (page + 1) * PAGE_SIZE < (data.numFound || 0) };
    },
  },
};

/* ---------- Couvertures -------------------------------------------------
 * Chaque livre reçoit une liste d'images candidates, essayées dans l'ordre :
 * celle fournie par la source, puis Open Library et Amazon via l'ISBN.
 * Si aucune ne fonctionne, une couverture est dessinée avec le titre.
 * ------------------------------------------------------------------------- */

function isbn13to10(isbn) {
  if (!/^978\d{10}$/.test(isbn)) return "";
  const core = isbn.slice(3, 12);
  const sum = [...core].reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? "X" : String(check));
}

function coverCandidates(isbn, ...primary) {
  const list = primary.filter(Boolean);
  const clean = (isbn || "").replace(/[^0-9Xx]/g, "");
  if (clean) {
    list.push(`https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`);
    const isbn10 = clean.length === 10 ? clean : isbn13to10(clean);
    if (isbn10) list.push(`https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`);
  }
  return [...new Set(list)];
}

// Version haute définition des vignettes Google Books.
function googleCoverHd(url) {
  return url.replace(/^http:/, "https:").replace("&edge=curl", "") + "&fife=w480-h720";
}

function normalizeGoogle(item) {
  const v = item.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const isbn = (ids.find(i => i.type === "ISBN_13") || ids.find(i => i.type === "ISBN_10") || {}).identifier || "";
  const cover = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail);
  return {
    id: "g-" + item.id,
    title: v.title + (v.subtitle ? " — " + v.subtitle : ""),
    authors: v.authors || [],
    year: (v.publishedDate || "").slice(0, 4),
    publisher: v.publisher || "",
    pages: v.pageCount || "",
    categories: v.categories || [],
    description: (v.description || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
    isbn,
    covers: coverCandidates(isbn, cover && googleCoverHd(cover), cover && googleCoverHd(cover).replace(/&fife=[^&]*$/, "")),
    link: v.infoLink || "",
  };
}

function normalizeOpenLibrary(doc) {
  // Édition française si Open Library la fournit, sinon l'œuvre générale.
  const ed = (doc.editions && doc.editions.docs && doc.editions.docs[0]) || {};
  const isbns = [...(ed.isbn || []), ...(doc.isbn || [])];
  const isbn = isbns.find(i => /^97[89]2/.test(i)) || isbns.find(i => i.length === 13) || isbns[0] || "";
  const title = ed.title || doc.title;
  const subtitle = ed.title ? ed.subtitle : doc.subtitle;
  const year = ((ed.publish_date || [])[0] || "").match(/\d{4}/);
  const covers = [ed.cover_i, doc.cover_i].filter(Boolean).map(id => `https://covers.openlibrary.org/b/id/${id}-L.jpg`);
  return {
    id: "ol-" + doc.key.replace(/\//g, "_"),
    title: title + (subtitle ? " — " + subtitle : ""),
    authors: doc.author_name || [],
    year: year ? year[0] : (doc.first_publish_year ? String(doc.first_publish_year) : ""),
    publisher: (ed.publisher || doc.publisher || [])[0] || "",
    pages: doc.number_of_pages_median || "",
    categories: (doc.subject || []).slice(0, 6),
    description: "",
    isbn,
    covers: coverCandidates(isbn, covers[0], covers[1]),
    link: "https://openlibrary.org" + (ed.key || doc.key),
  };
}

// Quand une source échoue (quota Google dépassé, panne…), on bascule sur l'autre
// et on laisse la source en échec de côté pendant quelques minutes.
const SOURCE_COOLDOWN_MS = 5 * 60 * 1000;
const sourceDownUntil = {};
const resultCache = new Map();

async function fetchFrom(name, query, page, sort) {
  const queryKey = query.type === "genre" ? query.value.id : query.value;
  const cacheKey = JSON.stringify([name, query.type, queryKey, page, sort]);
  if (resultCache.has(cacheKey)) return resultCache.get(cacheKey);
  try {
    const result = await sources[name].fetch(query, page, sort);
    result.books.forEach(b => bookCache.set(b.id, b));
    resultCache.set(cacheKey, result);
    return result;
  } catch (err) {
    sourceDownUntil[name] = Date.now() + SOURCE_COOLDOWN_MS;
    throw err;
  }
}

const isUp = name => !(sourceDownUntil[name] > Date.now());
const bookKey = b => b.isbn || (b.title + "|" + (b.authors[0] || "")).toLowerCase();

async function searchBooks(query, page = 0, sort = "relevance") {
  const mode = getSource();
  const all = Object.keys(sources);

  if (mode === "all") {
    // Toutes les sources en parallèle, résultats entremêlés et dédoublonnés.
    const names = all.filter(isUp).length ? all.filter(isUp) : all;
    const settled = await Promise.allSettled(names.map(n => fetchFrom(n, query, page, sort)));
    const ok = settled.map((r, i) => r.status === "fulfilled" && { ...r.value, name: names[i] }).filter(Boolean);
    if (!ok.length) {
      throw new Error(`Le catalogue est momentanément indisponible (${settled[0].reason.message}). Réessayez dans un instant.`);
    }
    const seen = new Set();
    const books = [];
    const longest = Math.max(...ok.map(r => r.books.length));
    for (let i = 0; i < longest; i++) {
      for (const r of ok) {
        const b = r.books[i];
        if (b && !seen.has(bookKey(b))) { seen.add(bookKey(b)); books.push(b); }
      }
    }
    return {
      books,
      total: ok.reduce((n, r) => n + r.total, 0),
      hasMore: ok.some(r => r.hasMore),
      sourceLabel: ok.map(r => sources[r.name].label).join(" + "),
      warnings: settled.filter(r => r.status === "rejected").map(r => r.reason.message),
    };
  }

  const order = [mode, ...all.filter(n => n !== mode)];
  let lastError;
  for (const name of order.filter(isUp).length ? order.filter(isUp) : order) {
    try {
      const result = await fetchFrom(name, query, page, sort);
      return { ...result, sourceLabel: sources[name].label, warnings: lastError ? [lastError.message] : [] };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Le catalogue est momentanément indisponible (${lastError.message}). Réessayez dans un instant.`);
}

/* ---------- Rendu des composants --------------------------------------- */

function generatedCoverHtml(book) {
  let hash = 0;
  for (const c of book.title) hash = (hash * 31 + c.charCodeAt(0)) % 360;
  return `<div class="cover-gen" style="--hue:${hash}">
            <span class="cover-gen-title">${esc(book.title.split(" — ")[0])}</span>
            <span class="cover-gen-author">${esc(book.authors[0] || "")}</span>
          </div>`;
}

function coverHtml(book) {
  if (!book.covers.length) return generatedCoverHtml(book);
  return `<img src="${esc(book.covers[0])}" alt="" loading="lazy" referrerpolicy="no-referrer"
               data-book-id="${esc(book.id)}" data-cover-index="0"
               onload="coverLoaded(this)" onerror="coverFailed(this)">`;
}

// Image vide (Amazon renvoie un pixel transparent quand il n'a pas la couverture).
function coverLoaded(img) {
  if (img.naturalWidth < 20 || img.naturalHeight < 20) coverFailed(img);
}

// Passe à l'image suivante, ou dessine une couverture si plus aucune n'est disponible.
function coverFailed(img) {
  const book = bookCache.get(img.dataset.bookId);
  const next = Number(img.dataset.coverIndex) + 1;
  if (book && next < book.covers.length) {
    img.dataset.coverIndex = next;
    img.src = book.covers[next];
  } else if (book) {
    img.outerHTML = generatedCoverHtml(book);
  } else {
    img.remove();
  }
}

function bookCardHtml(book) {
  const store = getStore();
  return `
    <article class="book-card">
      ${book.isNew ? `<span class="new-badge">Nouveau</span>` : ""}
      <button class="book-open" data-book="${esc(book.id)}" aria-label="Voir les détails de ${esc(book.title)}">
        <div class="cover">${coverHtml(book)}</div>
        <h3 class="book-title">${esc(book.title)}</h3>
      </button>
      <p class="book-authors">${book.authors.slice(0, 2).map(a => `<a href="${authorLink(a)}">${esc(a)}</a>`).join(", ") || "<span class='muted'>Auteur inconnu</span>"}</p>
      <p class="book-meta">${esc(book.year)}</p>
      <a class="buy-btn" href="${esc(storeUrl(store, book))}" target="_blank" rel="noopener">Acheter sur ${esc(store.name)} ↗</a>
    </article>`;
}

function genreCardHtml(g) {
  return `<a class="genre-card" href="#/genre/${g.id}"><span class="genre-icon">${g.icon}</span><span>${esc(g.name)}</span></a>`;
}

function authorChipHtml(a) {
  return `<a class="author-chip" href="${authorLink(a.name)}"><strong>${esc(a.name)}</strong><small>${esc(a.tag)}</small></a>`;
}

const loadingHtml = `<div class="loading"><span class="spinner"></span> Chargement…</div>`;

/* ---------- Vues --------------------------------------------------------- */

// Deux auteurs de chaque catégorie pour la page d'accueil.
function homeAuthors() {
  const tags = [...new Set(FEATURED_AUTHORS.map(a => a.tag))];
  return tags.flatMap(t => FEATURED_AUTHORS.filter(a => a.tag === t).slice(0, 2)).slice(0, 15);
}

function viewHome() {
  document.title = "Biblio FR — le catalogue des livres en français";
  app.innerHTML = `
    <section class="hero">
      <h1>Tous les livres en français, au même endroit</h1>
      <p>Romans, mangas, BD, essais, jeunesse… Parcourez le catalogue par genre ou par auteur, puis achetez en un clic chez votre libraire en ligne préféré.</p>
    </section>

    <section>
      <div class="section-head"><h2>Genres</h2><a href="#/genres">Tous les genres →</a></div>
      <div class="genre-grid">${HOME_GENRES.map(id => GENRES.find(g => g.id === id)).filter(Boolean).map(genreCardHtml).join("")}</div>
    </section>

    <section>
      <div class="section-head"><h2>Auteurs populaires</h2><a href="#/auteurs">Tous les auteurs →</a></div>
      <div class="author-grid">${homeAuthors().map(authorChipHtml).join("")}</div>
    </section>

    <section>
      <div class="section-head"><h2>🆕 Sorties récentes</h2><a href="#/nouveautes">Toutes les nouveautés →</a></div>
      <div class="shelf" id="shelf-recent">${loadingHtml}</div>
    </section>

    <section>
      <div class="section-head"><h2>🎌 Mangas</h2><a href="#/genre/manga">Voir plus →</a></div>
      <div class="shelf" id="shelf-manga">${loadingHtml}</div>
    </section>

    <section>
      <div class="section-head"><h2>📖 Romans</h2><a href="#/genre/romans">Voir plus →</a></div>
      <div class="shelf" id="shelf-romans">${loadingHtml}</div>
    </section>`;

  fillRecentShelf("shelf-recent");
  fillShelf("shelf-manga", { type: "genre", value: GENRES.find(g => g.id === "manga") });
  fillShelf("shelf-romans", { type: "genre", value: GENRES.find(g => g.id === "romans") });
}

async function fillShelf(elId, query) {
  const el = document.getElementById(elId);
  try {
    const { books } = await searchBooks(query);
    if (!document.body.contains(el)) return;
    el.innerHTML = books.slice(0, 12).map(bookCardHtml).join("") || `<p class="muted">Aucun résultat.</p>`;
  } catch (err) {
    if (document.body.contains(el)) el.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

function viewGenres() {
  document.title = "Genres — Biblio FR";
  app.innerHTML = `
    <h1 class="page-title">Tous les genres</h1>
    <p class="muted">${GENRES.length} genres, des romans aux mangas en passant par la cuisine.</p>
    ${GENRE_GROUPS.map(group => `
      <section class="genre-group">
        <h2>${esc(group.name)}</h2>
        <div class="genre-grid">${group.genres.map(genreCardHtml).join("")}</div>
      </section>`).join("")}`;
}

function viewAuthors() {
  document.title = "Auteurs — Biblio FR";
  const tags = [...new Set(FEATURED_AUTHORS.map(a => a.tag))];
  app.innerHTML = `
    <h1 class="page-title">Auteurs</h1>
    <p class="muted">${FEATURED_AUTHORS.length} auteurs mis en avant. Cherchez n'importe quel autre auteur ci-dessous.</p>
    <form id="author-form" class="inline-search">
      <input id="author-input" type="search" placeholder="Nom d'un auteur, d'un mangaka, d'un scénariste…" required>
      <button type="submit">Voir ses livres</button>
    </form>
    <div class="tag-filter">
      <button class="tag active" data-tag="">Tous</button>
      ${tags.map(t => `<button class="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}
    </div>
    <div class="author-grid" id="author-list">${FEATURED_AUTHORS.map(authorChipHtml).join("")}</div>`;

  document.getElementById("author-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("author-input").value.trim();
    if (name) location.hash = authorLink(name);
  });
  app.querySelector(".tag-filter").addEventListener("click", e => {
    const btn = e.target.closest(".tag");
    if (!btn) return;
    app.querySelectorAll(".tag").forEach(t => t.classList.toggle("active", t === btn));
    const list = btn.dataset.tag ? FEATURED_AUTHORS.filter(a => a.tag === btn.dataset.tag) : FEATURED_AUTHORS;
    document.getElementById("author-list").innerHTML = list.map(authorChipHtml).join("");
  });
}

function viewResults({ title, subtitle = "", query }) {
  document.title = `${title} — Biblio FR`;
  let page = 0;
  let sort = "relevance";
  let token = 0;
  const seen = new Set();

  app.innerHTML = `
    <div class="results-head">
      <div>
        <h1 class="page-title">${esc(title)}</h1>
        ${subtitle ? `<p class="muted">${subtitle}</p>` : ""}
      </div>
      <label class="sort">Trier par
        <select id="sort-select">
          <option value="relevance">Pertinence</option>
          <option value="new">Plus récents</option>
        </select>
      </label>
    </div>
    <p id="results-count" class="muted"></p>
    <div class="book-grid" id="results"></div>
    <div id="results-status"></div>
    <div class="more-wrap"><button id="more-btn" class="more-btn" hidden>Charger plus de livres</button></div>`;

  const grid = document.getElementById("results");
  const status = document.getElementById("results-status");
  const moreBtn = document.getElementById("more-btn");
  const count = document.getElementById("results-count");

  async function load() {
    const current = ++token;
    moreBtn.hidden = true;
    status.innerHTML = loadingHtml;
    try {
      const { books, total, hasMore, sourceLabel, warnings = [] } = await searchBooks(query, page, sort);
      if (current !== token) return;
      const fresh = books.filter(b => !seen.has(b.id));
      fresh.forEach(b => seen.add(b.id));
      grid.insertAdjacentHTML("beforeend", fresh.map(bookCardHtml).join(""));
      status.innerHTML = seen.size === 0
        ? `<p class="empty">Aucun livre en français trouvé. Essayez une autre orthographe ou changez de source dans les préférences ⚙️.</p>`
        : "";
      if (total) count.textContent = `Environ ${total.toLocaleString("fr-FR")} résultats · source : ${sourceLabel}${warnings.length ? " · " + warnings.join(" · ") : ""}`;
      moreBtn.textContent = "Charger plus de livres";
      moreBtn.hidden = !hasMore;
    } catch (err) {
      if (current !== token) return;
      status.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      moreBtn.textContent = "Réessayer";
      moreBtn.dataset.retry = "1";
      moreBtn.hidden = false;
    }
  }

  moreBtn.addEventListener("click", () => {
    if (moreBtn.dataset.retry) delete moreBtn.dataset.retry;
    else page++;
    load();
  });
  document.getElementById("sort-select").addEventListener("change", e => {
    sort = e.target.value;
    page = 0;
    seen.clear();
    grid.innerHTML = "";
    count.textContent = "";
    load();
  });
  load();
}

function viewNotFound() {
  app.innerHTML = `<p class="empty">Page introuvable. <a href="#/">Retour à l'accueil</a></p>`;
}

/* ---------- Fiche livre (modale) ---------------------------------------- */

const bookDialog = document.getElementById("book-dialog");

function openBook(id) {
  const book = bookCache.get(id);
  if (!book) return;
  const preferred = getStore();
  const others = STORES.filter(s => s.id !== preferred.id);
  const meta = [
    book.year && ["Parution", esc(book.year)],
    book.publisher && ["Éditeur", esc(book.publisher)],
    book.pages && ["Pages", esc(book.pages)],
    book.isbn && ["ISBN", esc(book.isbn)],
  ].filter(Boolean);

  document.getElementById("book-detail").innerHTML = `
    <div class="detail">
      <div class="detail-cover cover">${coverHtml(book)}</div>
      <div class="detail-body">
        <h2>${esc(book.title)}</h2>
        <p class="book-authors">${book.authors.map(a => `<a href="${authorLink(a)}" data-close>${esc(a)}</a>`).join(", ") || "Auteur inconnu"}</p>
        <dl class="meta">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
        ${book.categories.length ? `<p class="cats">${book.categories.map(c => `<span>${esc(c)}</span>`).join("")}</p>` : ""}
        ${book.description ? `<div class="desc">${esc(book.description)}</div>` : ""}
        <a class="buy-btn big" href="${esc(storeUrl(preferred, book))}" target="_blank" rel="noopener">Acheter sur ${esc(preferred.name)} ↗</a>
        <p class="muted small">Également disponible chez :</p>
        <div class="store-list">
          ${others.map(s => `<a href="${esc(storeUrl(s, book))}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join("")}
        </div>
        ${book.link ? `<p class="small"><a href="${esc(book.link)}" target="_blank" rel="noopener">Fiche complète sur ${esc(sources[book.id.startsWith("g-") ? "google" : "openlibrary"].label)} ↗</a></p>` : ""}
      </div>
    </div>
    ${reviewsSectionHtml()}`;
  bookDialog.showModal();
  loadReviews(book, document.getElementById("reviews"));
}

/* ---------- Routeur ------------------------------------------------------ */

function route() {
  const [, section = "", ...rest] = location.hash.replace(/^#/, "").split("/");
  const arg = rest.map(decodeURIComponent).join("/");
  window.scrollTo(0, 0);

  if (bookDialog.open) bookDialog.close();

  switch (section) {
    case "":
      return viewHome();
    case "genres":
      return viewGenres();
    case "auteurs":
      return viewAuthors();
    case "compte":
      return viewAccount();
    case "classement":
      return viewRanking();
    case "nouveautes":
      return viewRecent(arg);
    case "genre": {
      const genre = GENRES.find(g => g.id === arg);
      if (!genre) return viewNotFound();
      return viewResults({
        title: `${genre.icon} ${genre.name}`,
        subtitle: `${esc(genre.group)} · livres en français classés dans le genre « ${esc(genre.name)} ».`,
        query: { type: "genre", value: genre },
      });
    }
    case "auteur":
      if (!arg) return viewNotFound();
      return viewResults({
        title: arg,
        subtitle: `Livres de ${esc(arg)} disponibles en français.`,
        query: { type: "author", value: arg },
      });
    case "recherche": {
      const [mode, ...q] = rest.map(decodeURIComponent);
      const text = q.join("/");
      if (!text) return viewNotFound();
      const labels = { all: "", title: "titre : ", author: "auteur : ", isbn: "ISBN : " };
      return viewResults({
        title: `Recherche : ${labels[mode] || ""}« ${text} »`,
        query: { type: mode || "all", value: text },
      });
    }
    default:
      return viewNotFound();
  }
}

/* ---------- Événements globaux ------------------------------------------ */

document.getElementById("search-form").addEventListener("submit", e => {
  e.preventDefault();
  const q = document.getElementById("search-input").value.trim();
  const mode = document.getElementById("search-mode").value;
  if (!q) return;
  if (mode === "author") location.hash = authorLink(q);
  else location.hash = `#/recherche/${mode}/${enc(q)}`;
});

document.addEventListener("click", e => {
  const opener = e.target.closest("[data-book]");
  if (opener) { openBook(opener.dataset.book); return; }
  const closer = e.target.closest("[data-close]");
  if (closer) closer.closest("dialog")?.close();
});

// Fermer une modale en cliquant sur le fond
document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", e => {
  if (e.target === d) d.close();
}));

// Préférences
const settingsDialog = document.getElementById("settings-dialog");
const prefSource = document.getElementById("pref-source");
const prefStore = document.getElementById("pref-store");
prefStore.innerHTML = STORES.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");

document.getElementById("settings-btn").addEventListener("click", () => {
  prefSource.value = getSource();
  prefStore.value = getStore().id;
  settingsDialog.showModal();
});
prefSource.addEventListener("change", () => { prefs.set("source", prefSource.value); route(); });
prefStore.addEventListener("change", () => { prefs.set("store", prefStore.value); route(); });

window.addEventListener("hashchange", route);
// Premier affichage une fois tous les scripts chargés (auth.js fournit la page « Mon compte »).
document.addEventListener("DOMContentLoaded", route);
