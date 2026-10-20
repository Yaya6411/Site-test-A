// Robot quotidien du classement — Biblio FR
//
// Lancé chaque matin par GitHub Actions (.github/workflows/classement.yml).
// Lit une seule fois tous les avis publics de Firestore, calcule le classement
// de la semaine, du mois et depuis toujours (mêmes règles que la page
// « Classement » : nombre d'avis, puis note moyenne), retrouve la fiche des
// 10 premiers livres de chaque période, puis écrit data/classement.json.
// Les visiteurs lisent ce fichier au lieu de relire tous les avis : la page
// ne consomme presque plus le quota gratuit de Firebase.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT, robotFetch, createSiteContext, resetSourcePauses } from "./contexte-site.mjs";

const OUT = path.join(ROOT, "data", "classement.json");
const PERIODS = { semaine: 7, mois: 30, tout: 0 };   // mêmes périodes que RANKING_PERIODS (discover.js)
const TOP_WITH_BOOK = 10;
const BOOK_KEEP_DAYS = 30;

const context = createSiteContext();
const fn = name => vm.runInContext(name, context);
const P = fn("FIREBASE_PROJECT_ID"), K = fn("FIREBASE_API_KEY");
const BASE = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;

// Tous les avis (pagination), au format simple utilisé par la page.
async function allReviews() {
  const out = [];
  let token = "";
  do {
    const params = new URLSearchParams({ pageSize: "300", key: K });
    if (token) params.set("pageToken", token);
    const res = await robotFetch(`${BASE}/reviews?${params}`);
    if (!res.ok) throw new Error(`Firestore : erreur ${res.status}`);
    const data = await res.json();
    for (const doc of data.documents || []) {
      const f = doc.fields || {};
      out.push({
        bookKey: f.bookKey?.stringValue || "",
        title: f.title?.stringValue || "",
        rating: Number(f.rating?.integerValue || 0),
        hidden: Boolean(f.hidden?.booleanValue),
        createdAt: f.createdAt?.timestampValue || "",
      });
    }
    token = data.nextPageToken || "";
  } while (token);
  return out.filter(r => !r.hidden && r.bookKey);
}

// Même calcul que rankBooks (js/views/discover.js).
function rank(reviews) {
  const byBook = new Map();
  for (const r of reviews) {
    const e = byBook.get(r.bookKey) || { bookKey: r.bookKey, title: r.title, count: 0, sum: 0 };
    e.count++;
    e.sum += r.rating;
    byBook.set(r.bookKey, e);
  }
  return [...byBook.values()]
    .map(e => ({ bookKey: e.bookKey, title: e.title, count: e.count, avg: Math.round((e.sum / e.count) * 100) / 100 }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg || a.title.localeCompare(b.title, "fr"))
    .slice(0, 50);
}

// Fiche du livre (couverture, auteurs), gardée 30 jours d'un passage à l'autre.
const previous = (() => { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { return null; } })();
const knownBooks = new Map(Object.entries((previous && previous.books) || {}));
const today = new Date().toISOString().slice(0, 10);
async function bookFor(entry) {
  const old = knownBooks.get(entry.bookKey);
  if (old && Date.now() - Date.parse(old.at) < BOOK_KEEP_DAYS * 864e5) return old;
  resetSourcePauses(context);
  try {
    const { books } = await fn("searchBooks")({ type: "title", value: entry.title.split(" — ")[0] });
    const book = books.find(b => fn("reviewKey")(b) === entry.bookKey);
    if (!book) return old || null;
    const slim = {
      id: book.id, title: book.title, authors: book.authors, year: book.year, publisher: book.publisher,
      isbn: book.isbn, covers: (book.covers || []).slice(0, 4), link: book.link, categories: (book.categories || []).slice(0, 4),
      description: (book.description || "").slice(0, 600), at: today,
    };
    knownBooks.set(entry.bookKey, slim);
    return slim;
  } catch {
    return old || null;
  }
}

const reviews = await allReviews();
const result = { version: 1, generatedAt: new Date().toISOString(), reviews: reviews.length, periods: {}, books: {} };
for (const [id, days] of Object.entries(PERIODS)) {
  const since = days ? Date.now() - days * 864e5 : 0;
  result.periods[id] = rank(reviews.filter(r => !since || Date.parse(r.createdAt) >= since));
}
for (const list of Object.values(result.periods)) {
  for (const entry of list.slice(0, TOP_WITH_BOOK)) {
    if (result.books[entry.bookKey]) continue;
    const book = await bookFor(entry);
    if (book) result.books[entry.bookKey] = book;
  }
}

// Le fichier n'est réécrit que si le classement change, ou tous les 3 jours pour
// montrer que le robot fonctionne (le site ignore un fichier de plus de 8 jours).
const comparable = r => JSON.stringify({ ...r, generatedAt: "" });
const recent = previous && Date.now() - Date.parse(previous.generatedAt) < 3 * 864e5;
if (previous && recent && comparable(previous) === comparable(result)) {
  console.log(`Classement inchangé (${reviews.length} avis).`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result) + "\n");
  console.log(`data/classement.json écrit : ${reviews.length} avis, ` +
    Object.entries(result.periods).map(([k, l]) => `${k} ${l.length}`).join(", ") + `, ${Object.keys(result.books).length} fiches.`);
}
