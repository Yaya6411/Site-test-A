"use strict";

/* =========================================================================
 *  Vues du catalogue : accueil, genres, auteurs, résultats
 * ========================================================================= */

/* ---------- Vues --------------------------------------------------------- */

// Deux auteurs de chaque catégorie pour la page d'accueil.
function homeAuthors() {
  const tags = [...new Set(FEATURED_AUTHORS.map(a => a.tag))];
  return tags.flatMap(t => FEATURED_AUTHORS.filter(a => a.tag === t).slice(0, 2)).slice(0, 15);
}

const HOME_CATEGORY_CARDS = [
  { id: "litterature", name: "Littérature", description: "Romans, classiques, poésie…", count: "16 genres", image: "assets/categories/litterature.jpg" },
  { id: "imaginaire", name: "Imaginaire", description: "Fantasy, science-fiction, fantastique…", count: "11 genres", image: "assets/categories/imaginaire.jpg" },
  { id: "manga-bd", name: "Mangas & BD", description: "Mangas, comics, bandes dessinées…", count: "9 genres", image: "assets/categories/mangas-bd.jpg" },
  { id: "jeunesse", name: "Jeunesse", description: "Albums, romans, documentaires…", count: "5 genres", image: "assets/categories/jeunesse.jpg" },
  { id: "savoirs", name: "Savoirs & essais", description: "Histoire, société, sciences, art…", count: "21 genres", image: "assets/categories/savoirs-essais.jpg" },
  { id: "pratique", name: "Vie pratique", description: "Santé, cuisine, voyages, loisirs…", count: "12 genres", image: "assets/categories/vie-pratique.jpg" },
];

function homeCategoryHtml(card) {
  const target = card.id === "litterature" ? "romans" :
    card.id === "imaginaire" ? "science-fiction" :
    card.id === "manga-bd" ? "manga" :
    card.id === "jeunesse" ? "jeunesse" :
    card.id === "savoirs" ? "histoire" : "cuisine";
  return `<a class="home-category" href="#/genre/${target}">
    <img src="${esc(card.image)}" alt="" loading="lazy">
    <span class="home-category-shade"></span>
    <span class="home-category-copy">
      <strong>${esc(card.name)}</strong>
      <small>${esc(card.description)}</small>
      <em>${esc(card.count)} <b aria-hidden="true">→</b></em>
    </span>
  </a>`;
}

function viewHome() {
  document.title = "Biblio FR — le catalogue des livres en français";
  const mustShelf = MUST_READS.flatMap(c => c.books).filter((_, i) => i % 2 === 0).slice(0, 10);
  app.innerHTML = `
    <section class="home-hero">
      <div class="home-hero-copy">
        <p class="eyebrow">BIBLIO FR · CATALOGUE FRANCOPHONE</p>
        <h1>Trouvez votre<br><span>prochaine lecture</span></h1>
        <p class="hero-lead">Des milliers de livres en français : romans, mangas, BD, essais, jeunesse… Une communauté de lecteurs pour partager vos découvertes.</p>
        <div class="hero-actions">
          <a class="hero-cta primary" href="#/recherche/all/" data-home-search>⌕ <span>Rechercher un livre</span></a>
          <a class="hero-cta secondary" href="#/genres">⌁ <span>Explorer les genres</span></a>
        </div>
      </div>
      <div class="home-hero-art" aria-hidden="true">
        <img src="assets/hero-bibliotheque-maquette.jpg" alt="">
      </div>
    </section>

    <section class="home-categories" aria-label="Explorer les univers">
      <div class="home-category-grid">${HOME_CATEGORY_CARDS.map(homeCategoryHtml).join("")}</div>
    </section>

    <section class="home-shelf-section">
      <div class="section-head home-section-head"><div><span class="section-mark leaf">✦</span><div><h2>Sorties récentes</h2><p>Les dernières parutions en français</p></div></div><a href="#/nouveautes">Voir toutes les nouveautés →</a></div>
      <div class="shelf home-shelf" id="shelf-recent">${shelfSkeleton(8)}</div>
    </section>

    <section class="home-shelf-section">
      <div class="section-head home-section-head"><div><span class="section-mark star">★</span><div><h2>Incontournables</h2><p>Des livres de référence à découvrir ou redécouvrir</p></div></div><a href="#/incontournables">Voir tous les incontournables →</a></div>
      <div class="shelf home-shelf" id="shelf-must">${shelfSkeleton(8)}</div>
    </section>`;

  fillRecentShelf("shelf-recent");
  fillMustShelf("shelf-must", mustShelf);
}

async function fillMustShelf(elId, entries) {
  const el = document.getElementById(elId);
  try {
    const books = [];
    for (const [title, author] of entries) {
      const book = await findMustRead(title, author);
      if (book) books.push(book);
      if (books.length >= 10) break;
    }
    if (!document.body.contains(el)) return;
    el.innerHTML = books.map(bookCardHtml).join("") || `<p class="muted">La sélection se prépare…</p>`;
  } catch (err) {
    if (document.body.contains(el)) el.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
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

  attachAutocomplete(document.getElementById("author-input"), { types: ["Auteur"] });
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

// Catégories des sources (souvent en anglais) ramenées à des libellés français pour les filtres.
const CATEGORY_LABELS = {
  "fiction": "Fiction", "comics graphic novels": "BD & romans graphiques", "manga": "Mangas",
  "juvenile fiction": "Jeunesse", "juvenile nonfiction": "Documentaires jeunesse", "young adult fiction": "Young Adult",
  "science fiction": "Science-fiction", "fantasy": "Fantasy", "mystery detective": "Policier", "mystery": "Policier",
  "detective and mystery stories": "Policier", "thrillers": "Thriller", "romance": "Romance", "horror": "Horreur",
  "history": "Histoire", "biography autobiography": "Biographies", "biography": "Biographies", "philosophy": "Philosophie",
  "poetry": "Poésie", "drama": "Théâtre", "cooking": "Cuisine", "self help": "Développement personnel",
  "business economics": "Économie", "religion": "Religion", "psychology": "Psychologie", "science": "Sciences",
  "art": "Art", "travel": "Voyage", "humor": "Humour", "sports recreation": "Sport", "health fitness": "Santé",
  "political science": "Politique", "social science": "Société", "literary collections": "Recueils",
  "true crime": "True crime", "nature": "Nature", "music": "Musique", "computers": "Informatique",
};

function bookCategoryLabels(book) {
  const labels = new Set();
  for (const c of book.categories) {
    for (const part of String(c).split(/\s*\/\s*/)) {
      const label = CATEGORY_LABELS[norm(part)];
      if (label) labels.add(label);
    }
  }
  return [...labels];
}

const YEAR_BUCKETS = [
  { id: "2020", label: "2020 et après", test: y => y >= 2020 },
  { id: "2010", label: "2010 – 2019", test: y => y >= 2010 && y < 2020 },
  { id: "2000", label: "2000 – 2009", test: y => y >= 2000 && y < 2010 },
  { id: "1980", label: "1980 – 1999", test: y => y >= 1980 && y < 2000 },
  { id: "old", label: "Avant 1980", test: y => y > 0 && y < 1980 },
];

function topCounts(values, limit) {
  const counts = new Map();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).slice(0, limit);
}

// Message utile quand rien n'est trouvé : propositions proches et pistes.
function noResultsHtml(query) {
  const text = typeof query.value === "string" ? query.value : "";
  const ideas = text ? didYouMean(text) : [];
  return `
    <div class="empty no-results">
      <p><strong>Aucun livre en français trouvé.</strong></p>
      ${ideas.length ? `<p>Vouliez-vous dire : ${ideas.map(e => `<a href="${e.href}">${esc(e.label)}</a>`).join(", ")} ?</p>` : ""}
      <ul class="tips">
        <li>Vérifiez l'orthographe ou essayez moins de mots.</li>
        ${text ? `<li>Cherchez <a href="#/recherche/title/${enc(text)}">dans les titres</a> ou <a href="${authorLink(text)}">parmi les auteurs</a>.</li>` : ""}
        <li>Parcourez <a href="#/genres">les genres</a> ou <a href="#/incontournables">les incontournables</a>.</li>
        <li>Changez de source du catalogue dans les préférences ⚙️.</li>
      </ul>
    </div>`;
}

function viewResults({ title, subtitle = "", query }) {
  document.title = `${title} — Biblio FR`;
  let page = 0;
  let sort = "relevance";
  let token = 0;
  let books = [];               // tous les livres chargés, déjà dédoublonnés
  const seenWorks = new Set();  // œuvres déjà affichées (évite les doublons entre pages)
  const filters = { year: "", author: "", category: "" };

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
    <div class="filters" id="filters" hidden></div>
    <p id="results-count" class="muted" aria-live="polite"></p>
    <div class="book-grid" id="results"></div>
    <div id="results-status"></div>
    <div class="more-wrap"><button id="more-btn" class="more-btn" hidden>Charger plus de livres</button></div>`;

  const grid = document.getElementById("results");
  const status = document.getElementById("results-status");
  const moreBtn = document.getElementById("more-btn");
  const count = document.getElementById("results-count");
  const filtersBox = document.getElementById("filters");
  let summary = "";

  const matches = b => {
    if (filters.year) {
      const bucket = YEAR_BUCKETS.find(x => x.id === filters.year);
      if (!bucket.test(Number(b.year) || 0)) return false;
    }
    if (filters.author && !b.authors.includes(filters.author)) return false;
    if (filters.category && !bookCategoryLabels(b).includes(filters.category)) return false;
    return true;
  };

  function renderFilters() {
    if (books.length < 6) { filtersBox.hidden = true; return; }
    const years = YEAR_BUCKETS.filter(x => books.some(b => x.test(Number(b.year) || 0)));
    const authors = topCounts(books.flatMap(b => b.authors.slice(0, 1)), 15);
    const cats = topCounts(books.flatMap(bookCategoryLabels), 15);
    const select = (id, label, options) => `
      <label>${label}
        <select data-filter="${id}">
          <option value="">Tous</option>
          ${options.map(([v, l]) => `<option value="${esc(v)}"${filters[id] === v ? " selected" : ""}>${esc(l)}</option>`).join("")}
        </select>
      </label>`;
    filtersBox.innerHTML = `
      <span class="filters-title">Affiner :</span>
      ${select("year", "Année", years.map(x => [x.id, x.label]))}
      ${authors.length > 1 ? select("author", "Auteur", authors.map(([a, n]) => [a, `${a} (${n})`])) : ""}
      ${cats.length > 1 ? select("category", "Genre", cats.map(([c, n]) => [c, `${c} (${n})`])) : ""}
      ${Object.values(filters).some(Boolean) ? `<button type="button" class="link-btn" data-reset-filters>Effacer les filtres</button>` : ""}`;
    filtersBox.hidden = false;
  }

  function renderGrid() {
    const shown = books.filter(matches);
    grid.innerHTML = shown.map(bookCardHtml).join("");
    const filtered = Object.values(filters).some(Boolean);
    count.textContent = filtered
      ? `${shown.length} livre${shown.length > 1 ? "s" : ""} sur ${books.length} chargés correspondent aux filtres`
      : summary;
    if (!books.length) status.innerHTML = noResultsHtml(query);
    else if (!shown.length) status.innerHTML = `<p class="empty">Aucun livre chargé ne correspond à ces filtres. <button type="button" class="link-btn" data-reset-filters>Effacer les filtres</button></p>`;
    else status.innerHTML = "";
  }

  async function load() {
    const current = ++token;
    moreBtn.hidden = true;
    status.innerHTML = skeletonHtml(page ? 6 : 12);
    try {
      const result = await searchBooks(query, page, sort);
      if (current !== token) return;
      const fresh = result.books.filter(b => !seenWorks.has(workKey(b)));
      fresh.forEach(b => seenWorks.add(workKey(b)));
      books = books.concat(fresh);
      if (result.total) {
        summary = `Environ ${result.total.toLocaleString("fr-FR")} résultats · ${books.length} affichés · source : ${result.sourceLabel}`
          + (result.warnings && result.warnings.length ? " · " + result.warnings.join(" · ") : "");
      }
      renderFilters();
      renderGrid();
      moreBtn.textContent = "Charger plus de livres";
      moreBtn.hidden = !result.hasMore;
    } catch (err) {
      if (current !== token) return;
      status.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      moreBtn.textContent = "Réessayer";
      moreBtn.dataset.retry = "1";
      moreBtn.hidden = false;
    }
  }

  filtersBox.addEventListener("change", e => {
    const sel = e.target.closest("[data-filter]");
    if (!sel) return;
    filters[sel.dataset.filter] = sel.value;
    renderFilters();
    renderGrid();
  });
  // Écouteurs posés sur des éléments de la vue (et non sur #app, qui survit aux changements de page).
  const resetFilters = e => {
    if (!e.target.closest("[data-reset-filters]")) return;
    Object.keys(filters).forEach(k => { filters[k] = ""; });
    renderFilters();
    renderGrid();
  };
  filtersBox.addEventListener("click", resetFilters);
  status.addEventListener("click", resetFilters);
  moreBtn.addEventListener("click", () => {
    if (moreBtn.dataset.retry) delete moreBtn.dataset.retry;
    else page++;
    load();
  });
  document.getElementById("sort-select").addEventListener("change", e => {
    sort = e.target.value;
    page = 0;
    books = [];
    seenWorks.clear();
    grid.innerHTML = "";
    count.textContent = "";
    load();
  });
  load();
}

function viewNotFound() {
  app.innerHTML = `<p class="empty">Page introuvable. <a href="#/">Retour à l'accueil</a></p>`;
}
