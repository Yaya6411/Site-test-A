"use strict";

/* =========================================================================
 *  Classement (livres les plus commentés par les visiteurs du site)
 *  et Nouveautés (sorties récentes en français).
 * ========================================================================= */

/* ---------- Classement ---------------------------------------------------- */

const RANKING_PERIODS = [
  { id: "semaine", label: "Cette semaine", days: 7 },
  { id: "mois", label: "Ce mois-ci", days: 30 },
  { id: "tout", label: "Depuis toujours", days: 0 },
];

// Avis publiés depuis `days` jours (tous les avis si days = 0).
async function reviewsSince(days) {
  const query = { from: [{ collectionId: "reviews" }], limit: 2000 };
  if (days) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    query.where = {
      fieldFilter: { field: { fieldPath: "createdAt" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: since } },
    };
  }
  const rows = await firestore.request(`${firestore.base()}:runQuery`, {
    method: "POST",
    body: JSON.stringify({ structuredQuery: query }),
  });
  return rows.filter(r => r.document).map(r => {
    const f = r.document.fields || {};
    return {
      bookKey: f.bookKey?.stringValue || "",
      title: f.title?.stringValue || "",
      rating: Number(f.rating?.integerValue || 0),
    };
  });
}

// Regroupe les avis par livre : nombre d'avis puis note moyenne.
function rankBooks(reviews) {
  const byBook = new Map();
  for (const r of reviews) {
    if (!r.bookKey) continue;
    const entry = byBook.get(r.bookKey) || { bookKey: r.bookKey, title: r.title, count: 0, sum: 0 };
    entry.count++;
    entry.sum += r.rating;
    byBook.set(r.bookKey, entry);
  }
  return [...byBook.values()]
    .map(e => ({ ...e, avg: e.sum / e.count }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg || a.title.localeCompare(b.title, "fr"))
    .slice(0, 50);
}

// Retrouve la fiche du livre (couverture, auteur) à partir de son titre.
async function findBookForRanking(entry) {
  try {
    const { books } = await searchBooks({ type: "title", value: entry.title.split(" — ")[0] });
    return books.find(b => reviewKey(b) === entry.bookKey) || null;
  } catch {
    return null;
  }
}

function rankingRowHtml(entry, rank, book) {
  const authorPart = entry.bookKey.split("|")[1] || "";
  const fakeBook = { id: "", title: entry.title, authors: book ? book.authors : [authorPart], covers: [] };
  const cover = book ? coverHtml(book) : generatedCoverHtml(fakeBook);
  const open = book
    ? `<button class="rank-open" data-book="${esc(book.id)}">${esc(entry.title)}</button>`
    : `<a class="rank-open" href="#/recherche/title/${enc(entry.title.split(" — ")[0])}">${esc(entry.title)}</a>`;
  return `
    <li class="rank-row${rank <= 3 ? " podium" : ""}" data-rank-key="${esc(entry.bookKey)}">
      <span class="rank-num">${rank}</span>
      <div class="rank-cover cover">${cover}</div>
      <div class="rank-info">
        ${open}
        <p class="book-authors">${book ? book.authors.slice(0, 2).map(a => `<a href="${authorLink(a)}">${esc(a)}</a>`).join(", ") : ""}</p>
        <p class="rank-score">${starsHtml(entry.avg)} <strong>${entry.avg.toFixed(1).replace(".", ",")}</strong></p>
      </div>
      <span class="rank-count"><strong>${entry.count}</strong> avis</span>
    </li>`;
}

function viewRanking() {
  document.title = "Classement — Biblio FR";
  let periodId = "semaine";
  try { periodId = sessionStorage.getItem("bibliofr.rankingPeriod") || periodId; } catch { /* stockage indisponible */ }

  app.innerHTML = `
    <h1 class="page-title">Classement des lecteurs</h1>
    <p class="muted">Les livres qui ont reçu le plus d'avis sur Biblio FR. À égalité, la meilleure note moyenne passe devant.</p>
    <div class="tag-filter" id="period-filter">
      ${RANKING_PERIODS.map(p => `<button class="tag${p.id === periodId ? " active" : ""}" data-period="${p.id}">${esc(p.label)}</button>`).join("")}
    </div>
    <div id="ranking"></div>`;

  if (!FIREBASE_PROJECT_ID) {
    document.getElementById("ranking").innerHTML =
      `<p class="empty">Le classement nécessite les avis partagés (Firebase), qui ne sont pas activés sur ce site.</p>`;
    return;
  }

  document.getElementById("period-filter").addEventListener("click", e => {
    const btn = e.target.closest("[data-period]");
    if (!btn) return;
    periodId = btn.dataset.period;
    try { sessionStorage.setItem("bibliofr.rankingPeriod", periodId); } catch { /* stockage indisponible */ }
    document.querySelectorAll("#period-filter .tag").forEach(t => t.classList.toggle("active", t === btn));
    load();
  });

  let token = 0;
  async function load() {
    const current = ++token;
    const box = document.getElementById("ranking");
    box.innerHTML = loadingHtml;
    const period = RANKING_PERIODS.find(p => p.id === periodId) || RANKING_PERIODS[0];
    let ranked;
    try {
      ranked = rankBooks(await reviewsSince(period.days));
    } catch (err) {
      if (current === token) box.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      return;
    }
    if (current !== token) return;
    if (!ranked.length) {
      box.innerHTML = `
        <div class="empty">
          <p>Aucun avis ${period.days ? `sur les ${period.days} derniers jours` : "pour l'instant"}.</p>
          <p>Ouvrez la fiche d'un livre pour donner le premier avis : il apparaîtra ici.</p>
        </div>`;
      return;
    }
    box.innerHTML = `<ol class="ranking">${ranked.map((e, i) => rankingRowHtml(e, i + 1, null)).join("")}</ol>`;

    // Couvertures et auteurs des 10 premiers, complétés ensuite.
    ranked.slice(0, 10).forEach(async (entry, i) => {
      const book = await findBookForRanking(entry);
      if (!book || current !== token) return;
      const row = box.querySelector(`[data-rank-key="${CSS.escape(entry.bookKey)}"]`);
      if (row) row.outerHTML = rankingRowHtml(entry, i + 1, book);
    });
  }
  load();
}

/* ---------- Nouveautés --------------------------------------------------- */

const RECENT_GENRES = ["romans", "policier", "thriller", "science-fiction", "fantasy", "manga", "bd", "jeunesse", "young-adult", "romance", "biographies", "dev-perso"];
const RECENT_YEARS = 2; // année en cours et année précédente

// Garde les parutions récentes (pas d'année future aberrante), de la plus récente à la plus ancienne.
function recentOnly(books) {
  const year = new Date().getFullYear();
  return books
    .filter(b => Number(b.year) <= year && Number(b.year) > year - RECENT_YEARS)
    .map(b => ({ ...b, isNew: Number(b.year) === year }))
    .sort((a, b) => Number(b.year) - Number(a.year));
}

async function fillRecentShelf(elId) {
  const el = document.getElementById(elId);
  try {
    const { books } = await searchBooks({ type: "recent", value: null }, 0, "new");
    if (!document.body.contains(el)) return;
    const recent = recentOnly(books);
    el.innerHTML = recent.slice(0, 12).map(bookCardHtml).join("") || `<p class="muted">Aucune sortie récente trouvée.</p>`;
  } catch (err) {
    if (document.body.contains(el)) el.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

function viewRecent(genreId) {
  const genre = GENRES.find(g => g.id === genreId) || null;
  document.title = "Nouveautés — Biblio FR";
  const year = new Date().getFullYear();

  app.innerHTML = `
    <h1 class="page-title">Sorties récentes</h1>
    <p class="muted">Livres en français parus en ${year - 1} et ${year}, du plus récent au plus ancien.</p>
    <div class="tag-filter">
      <a class="tag${genre ? "" : " active"}" href="#/nouveautes">Tout</a>
      ${RECENT_GENRES.map(id => GENRES.find(g => g.id === id)).filter(Boolean)
        .map(g => `<a class="tag${genre && genre.id === g.id ? " active" : ""}" href="#/nouveautes/${g.id}">${g.icon} ${esc(g.name)}</a>`).join("")}
    </div>
    <p id="results-count" class="muted"></p>
    <div class="book-grid" id="results"></div>
    <div id="results-status"></div>
    <div class="more-wrap"><button id="more-btn" class="more-btn" hidden>Charger plus de nouveautés</button></div>`;

  const grid = document.getElementById("results");
  const status = document.getElementById("results-status");
  const moreBtn = document.getElementById("more-btn");
  const seen = new Set();
  let page = 0;

  // Les sources mélangent anciennes et nouvelles éditions : on parcourt
  // quelques pages de suite jusqu'à trouver assez de parutions récentes.
  async function load() {
    moreBtn.hidden = true;
    status.innerHTML = loadingHtml;
    let added = 0;
    let hasMore = true;
    try {
      for (let tries = 0; tries < 3 && added < 12 && hasMore; tries++) {
        const result = await searchBooks({ type: "recent", value: genre }, page, "new");
        if (!document.body.contains(grid)) return;
        hasMore = result.hasMore;
        page++;
        const fresh = recentOnly(result.books).filter(b => !seen.has(b.id));
        fresh.forEach(b => seen.add(b.id));
        grid.insertAdjacentHTML("beforeend", fresh.map(bookCardHtml).join(""));
        added += fresh.length;
        document.getElementById("results-count").textContent = `source : ${result.sourceLabel}`;
      }
      status.innerHTML = seen.size ? "" : `<p class="empty">Aucune sortie récente trouvée pour ce genre.</p>`;
      moreBtn.hidden = !hasMore;
    } catch (err) {
      status.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      moreBtn.hidden = false;
    }
  }

  moreBtn.addEventListener("click", load);
  load();
}

/* ---------- Incontournables ----------------------------------------------- */

const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Retrouve la fiche d'un incontournable (titre + auteur) dans le catalogue.
// Les correspondances trouvées sont gardées 7 jours dans le navigateur pour économiser les requêtes.
const MUST_CACHE_DAYS = 7;

function mustCache() {
  try { return JSON.parse(localStorage.getItem("bibliofr.mustReads") || "{}"); } catch { return {}; }
}

async function findMustRead(title, author) {
  const key = reviewKey({ title, authors: [author] });
  const cached = mustCache()[key];
  if (cached && Date.now() - cached.at < MUST_CACHE_DAYS * 864e5) {
    if (cached.book) bookCache.set(cached.book.id, cached.book);
    return cached.book;
  }
  const surname = key.split("|")[1];
  let book = null;
  try {
    const { books } = await searchBooks({ type: "all", value: `${title} ${author}` });
    book = books.find(b => reviewKey(b) === key)
      || books.find(b => reviewKey(b).split("|")[1] === surname && reviewKey(b).startsWith(key.split("|")[0]))
      || null;
  } catch {
    return null; // pas de mise en cache d'un échec réseau
  }
  try {
    const all = mustCache();
    all[key] = { at: Date.now(), book };
    localStorage.setItem("bibliofr.mustReads", JSON.stringify(all));
  } catch { /* stockage indisponible */ }
  return book;
}

function mustReadCardHtml(title, author, book) {
  const store = getStore();
  const target = book || { title, authors: [author], covers: [] };
  return `
    <article class="book-card" data-must="${esc(title)}">
      ${book
        ? `<button class="book-open" data-book="${esc(book.id)}" aria-label="Voir les détails de ${esc(title)}">
             <div class="cover">${coverHtml(book)}</div>
             <h3 class="book-title">${esc(title)}</h3>
           </button>`
        : `<a class="book-open" href="#/recherche/all/${enc(title + " " + author)}">
             <div class="cover">${generatedCoverHtml(target)}</div>
             <h3 class="book-title">${esc(title)}</h3>
           </a>`}
      <p class="book-authors"><a href="${authorLink(author)}">${esc(author)}</a></p>
      <p class="book-meta"></p>
      <a class="buy-btn" href="${esc(storeUrl(store, target))}" target="_blank" rel="noopener">Acheter sur ${esc(store.name)} ↗</a>
    </article>`;
}

function viewMustReads(catSlug) {
  const cat = MUST_READS.find(c => slug(c.name) === catSlug) || MUST_READS[0];
  document.title = "Incontournables — Biblio FR";
  const total = MUST_READS.reduce((n, c) => n + c.books.length, 0);

  app.innerHTML = `
    <h1 class="page-title">Les incontournables</h1>
    <p class="muted">${total} livres de référence à avoir lus, des classiques aux mangas.</p>
    <div class="tag-filter">
      ${MUST_READS.map(c => `<a class="tag${c === cat ? " active" : ""}" href="#/incontournables/${slug(c.name)}">${esc(c.name)}</a>`).join("")}
    </div>
    <div class="book-grid" id="must-grid">
      ${cat.books.map(([t, a]) => mustReadCardHtml(t, a, null)).join("")}
    </div>`;

  // Couvertures et fiches complétées au fur et à mesure.
  const grid = document.getElementById("must-grid");
  cat.books.forEach(async ([title, author]) => {
    const book = await findMustRead(title, author);
    if (!book || !document.body.contains(grid)) return;
    const card = grid.querySelector(`[data-must="${CSS.escape(title)}"]`);
    if (card) card.outerHTML = mustReadCardHtml(title, author, book);
  });
}
