"use strict";

/* =========================================================================
 *  Biblio FR — utilitaires communs : état global, préférences, échappement
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

const loadingHtml = `<div class="loading"><span class="spinner"></span> Chargement…</div>`;

const DEFAULT_DESCRIPTION = "Parcourez les livres disponibles en français : romans, mangas, BD, essais… par genre ou par auteur, avec un lien d'achat pour chaque ouvrage.";

// Met à jour la description de la page (partage de liens, moteurs de recherche).
function setPageMeta(description) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) { tag = document.createElement("meta"); tag.name = "description"; document.head.appendChild(tag); }
  tag.content = description;
  const og = document.querySelector('meta[property="og:description"]');
  if (og) og.content = description;
}

/* ---------- Thème ------------------------------------------------------- */
(function initThemeToggle() {
  const btn = document.getElementById("theme-btn");
  if (!btn || !document.documentElement) return;
  const saved = prefs.get("theme", "");
  if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
  const update = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    btn.textContent = dark ? "☀" : "☾";
    btn.setAttribute("aria-label", dark ? "Passer au thème clair" : "Passer au thème sombre");
    btn.title = dark ? "Thème clair" : "Thème sombre";
  };
  update();
  // Sans choix enregistré, le site suit le réglage clair/sombre de l'appareil.
  if (window.matchMedia) {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
      if (prefs.get("theme", "")) return;
      document.documentElement.dataset.theme = e.matches ? "dark" : "light";
      update();
    });
  }
  btn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    prefs.set("theme", next);
    update();
  });
})();
