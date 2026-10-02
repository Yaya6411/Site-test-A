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
      <div class="section-head"><h2>Les incontournables</h2><a href="#/incontournables">Voir la sélection →</a></div>
      <div class="tag-filter">${MUST_READS.map(c => `<a class="tag" href="#/incontournables/${slug(c.name)}">${esc(c.name)}</a>`).join("")}</div>
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
