"use strict";

/* =========================================================================
 *  Routeur (navigation par hash) et événements globaux
 * ========================================================================= */

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
    case "incontournables":
      return viewMustReads(arg);
    case "lecteurs":
      return viewReaders(arg);
    case "lecteur":
      return viewReader(arg);
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

attachAutocomplete(document.getElementById("search-input"));

window.addEventListener("hashchange", route);
// Premier affichage une fois tous les scripts chargés (auth.js fournit la page « Mon compte »).
document.addEventListener("DOMContentLoaded", route);
