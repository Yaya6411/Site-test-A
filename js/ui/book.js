"use strict";

/* =========================================================================
 *  Fiche livre (fenêtre modale)
 * ========================================================================= */

const bookDialog = document.getElementById("book-dialog");
let currentBook = null;   // livre affiché dans la fiche

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
        ${libraryControlsHtml()}
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
  currentBook = book;
  bookDialog.showModal();
  renderLibraryControls(book);
  readingHistory.add(book);
  loadReviews(book, document.getElementById("reviews"));
}
