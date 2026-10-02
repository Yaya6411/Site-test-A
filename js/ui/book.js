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
        <div class="detail-actions">
          <a class="buy-btn big" href="${esc(storeUrl(preferred, book))}" target="_blank" rel="noopener">Acheter sur ${esc(preferred.name)} ↗</a>
          <button type="button" class="more-btn" id="share-book">Partager</button>
        </div>
        <p class="muted small">Également disponible chez :</p>
        <div class="store-list">
          ${others.map(s => `<a href="${esc(storeUrl(s, book))}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join("")}
        </div>
        ${book.link ? `<p class="small"><a href="${esc(book.link)}" target="_blank" rel="noopener">Fiche complète sur ${esc(sources[book.id.startsWith("g-") ? "google" : book.id.startsWith("bnf-") ? "bnf" : "openlibrary"].label)} ↗</a></p>` : ""}
      </div>
    </div>
    ${reviewsSectionHtml()}`;
  currentBook = book;
  document.getElementById("share-book").addEventListener("click", e => shareBook(book, e.target));
  setPageMeta(`${book.title}${book.authors.length ? `, de ${book.authors.slice(0, 2).join(", ")}` : ""} : avis des lecteurs et où l'acheter, sur Biblio FR.`);
  bookDialog.showModal();
  renderLibraryControls(book);
  readingHistory.add(book);
  loadReviews(book, document.getElementById("reviews"));
}

// Lien vers la fiche : direct pour les livres des sources, sinon une recherche titre + auteur.
function bookShareUrl(book) {
  const base = `${location.origin}${location.pathname}`;
  if (/^(g|ol)-/.test(book.id)) return `${base}#/livre/${enc(book.id)}`;
  return `${base}#/recherche/all/${enc(`${book.title.split(" — ")[0]} ${book.authors[0] || ""}`.trim())}`;
}

async function shareBook(book, btn) {
  const url = bookShareUrl(book);
  const data = { title: book.title, text: `${book.title}${book.authors[0] ? ` — ${book.authors[0]}` : ""} sur Biblio FR`, url };
  try {
    if (navigator.share) { await navigator.share(data); return; }
    await navigator.clipboard.writeText(url);
    btn.textContent = "Lien copié ✓";
  } catch (err) {
    if (err && err.name === "AbortError") return;  // partage annulé
    prompt("Copiez ce lien :", url);
  }
}

// Page d'un lien partagé (#/livre/<id>) : la fiche s'ouvre par-dessus l'accueil.
async function viewSharedBook(id) {
  viewHome();
  let book = null;
  try { book = await fetchBookById(id); } catch { /* source indisponible */ }
  if (!location.hash.startsWith("#/livre/")) return;
  if (book) openBook(book.id);
  else app.insertAdjacentHTML("afterbegin", `<p class="error">Ce livre est introuvable pour le moment. Essayez de le rechercher par son titre.</p>`);
}

// En fermant la fiche d'un lien partagé, on revient à l'accueil.
bookDialog.addEventListener("close", () => {
  if (location.hash.startsWith("#/livre/")) history.replaceState(null, "", "#/");
  setPageMeta(DEFAULT_DESCRIPTION);
});
