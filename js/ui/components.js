"use strict";

/* =========================================================================
 *  Composants d'interface : couvertures, cartes livre, genres, auteurs
 * ========================================================================= */

/* ---------- Rendu des composants --------------------------------------- */

function generatedCoverHtml(book) {
  let hash = 0;
  for (const c of book.title) hash = (hash * 31 + c.charCodeAt(0)) % 360;
  return `<div class="cover-gen" style="--hue:${hash}">
            <span class="cover-gen-title">${esc(book.title.split(" — ")[0])}</span>
            <span class="cover-gen-author">${esc(book.authors[0] || "")}</span>
          </div>`;
}

// Adresses d'images déjà en échec pendant cette visite : inutile de les réessayer.
const badCovers = (() => {
  try { return new Set(JSON.parse(sessionStorage.getItem("bibliofr.badCovers") || "[]")); } catch { return new Set(); }
})();

function rememberBadCover(url) {
  badCovers.add(url);
  try { sessionStorage.setItem("bibliofr.badCovers", JSON.stringify([...badCovers].slice(-500))); } catch { /* stockage indisponible */ }
}

const usableCovers = book => book.covers.filter(u => !badCovers.has(u));

function coverHtml(book) {
  const covers = usableCovers(book);
  if (!covers.length) return generatedCoverHtml(book);
  return `<img src="${esc(covers[0])}" alt="Couverture de ${esc(book.title)}" loading="lazy" referrerpolicy="no-referrer"
               data-book-id="${esc(book.id)}" data-cover-index="0"
               onload="coverLoaded(this)" onerror="coverFailed(this)">`;
}

// Image vide (Amazon renvoie un pixel transparent quand il n'a pas la couverture).
function coverLoaded(img) {
  if (img.naturalWidth < 20 || img.naturalHeight < 20) coverFailed(img);
}

// Passe à l'image suivante, ou dessine une couverture si plus aucune n'est disponible.
function coverFailed(img) {
  rememberBadCover(img.currentSrc || img.src);
  const book = bookCache.get(img.dataset.bookId);
  const covers = book ? usableCovers(book) : [];
  const attempts = Number(img.dataset.coverIndex) + 1;
  if (book && covers.length && attempts <= book.covers.length) {
    img.dataset.coverIndex = attempts;
    img.src = covers[0];
  } else if (book) {
    img.outerHTML = generatedCoverHtml(book);
  } else {
    img.remove();
  }
}

function bookCardHtml(book) {
  const store = getStore();
  return `
    <article class="book-card" data-id="${esc(book.id)}" data-key="${esc(reviewKey(book))}">
      ${book.isNew ? `<span class="new-badge">Nouveau</span>` : ""}
      <span class="lib-badges">${typeof libraryBadgeHtml === "function" ? libraryBadgeHtml(book) : ""}</span>
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

// Cartes grisées affichées pendant le chargement (plus lisible qu'un simple indicateur).
function skeletonHtml(n = 8) {
  return `<div class="book-grid skeleton-grid" aria-hidden="true">${
    Array.from({ length: n }, () => `<div class="skeleton-card"><div class="sk-cover"></div><div class="sk-line"></div><div class="sk-line short"></div></div>`).join("")
  }</div><p class="sr-only" role="status">Chargement…</p>`;
}
