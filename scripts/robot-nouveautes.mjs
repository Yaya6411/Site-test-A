// Robot hebdomadaire des nouveautés et des incontournables — Biblio FR
//
// Lancé chaque semaine par GitHub Actions (.github/workflows/nouveautes.yml),
// ou à la main : `npm i --no-save @xmldom/xmldom && node scripts/robot-nouveautes.mjs`.
//
// Il réutilise exactement le code de recherche du site (sources, filtres,
// fusion des éditions), interroge Google Books, Open Library et la BnF pour
// chaque genre des « Nouveautés », puis écrit data/nouveautes.json.
// Il retrouve aussi la fiche de chaque « incontournable » (data/incontournables.json),
// ce qui évite aux visiteurs une recherche par livre.
// Les livres déjà connus et toujours récents sont conservés : une panne
// passagère d'une source ne vide donc jamais la liste.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT, SITE, DOMParser, robotFetch, createSiteContext } from "./contexte-site.mjs";

const OUT = path.join(ROOT, "data", "nouveautes.json");
const PAGES_PER_GENRE = 3;   // 3 × 40 résultats demandés par source et par genre
const MAX_PER_LIST = 60;     // livres gardés par liste
const RECENT_YEARS = 2;      // année en cours et année précédente
const MIN_BOOKS_TO_SAVE = 20; // en dessous, on garde l'ancien fichier (sources en panne)
const MUST_BUDGET_MS = 10 * 60 * 1000; // temps maximal consacré aux incontournables (la suite la semaine suivante)
const MUST_PARALLEL = 4;

const context = createSiteContext();

// Mêmes genres que la page « Nouveautés » (js/views/discover.js).
const discover = fs.readFileSync(path.join(ROOT, "js/views/discover.js"), "utf8");
const RECENT_GENRES = JSON.parse(discover.match(/const RECENT_GENRES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));

const year = new Date().getFullYear();
const isRecent = b => Number(b.year) <= year && Number(b.year) > year - RECENT_YEARS;
const workKey = b => vm.runInContext("workKey", context)(b);

// Fiche allégée : tout ce qu'il faut pour la carte et la fiche du livre.
const slim = b => ({
  id: b.id, title: b.title, authors: b.authors, year: b.year, publisher: b.publisher, pages: b.pages,
  categories: (b.categories || []).slice(0, 6), description: (b.description || "").slice(0, 900),
  isbn: b.isbn, covers: (b.covers || []).slice(0, 4), link: b.link,
  ...(b.altIds && b.altIds.length ? { altIds: b.altIds.slice(0, 6) } : {}),
});

/* ---------- Recherche par éditeur ------------------------------------------
 * Les sources classent mal les mangas, BD et livres jeunesse par sujet : pour
 * ces genres, on interroge aussi les catalogues des éditeurs spécialisés.
 * Un livre est gardé s'il est récent et si ses catégories (quand il y en a)
 * correspondent au genre.
 * ------------------------------------------------------------------------- */
// « exclusive » : l'éditeur ne publie que ce genre (un livre sans catégorie est accepté) ;
// « mixed » : il publie aussi autre chose (une catégorie doit confirmer le genre).
const PUBLISHER_QUERIES = {
  manga: { exclusive: ["Ki-oon", "Kana", "Pika", "Kurokawa", "Kazé", "Akata", "Mangetsu", "Meian", "Noeve Grafx", "Black Box"], mixed: ["Glénat"] },
  bd: { exclusive: ["Dargaud", "Dupuis", "Le Lombard", "Bamboo", "Soleil", "Futuropolis", "Rue de Sèvres"], mixed: ["Casterman", "Delcourt", "Glénat"] },
  "young-adult": { exclusive: ["Pocket Jeunesse", "Hachette Romans", "Lumen", "De Saxus"], mixed: ["Rageot", "Gallimard Jeunesse", "Casterman", "Michel Lafon"] },
  jeunesse: { exclusive: ["L'École des loisirs", "Gallimard Jeunesse", "Bayard Jeunesse", "Père Castor", "Auzou", "Milan"], mixed: ["Nathan", "Flammarion Jeunesse"] },
};
const GENRE_FIT = {
  manga: /\b(manga|mangas|seinen|shonen|shojo|josei|manhwa)\b/,
  bd: /\b(comic|comics|graphic|bande dessinee|bandes dessinees|bd)\b/,
  "young-adult": /\b(young adult|teen|adolescents|ado|ados)\b/,
  jeunesse: /\b(juvenile|jeunesse|enfant|enfants|children|album|albums)\b/,
};

function fitsGenre(book, genreId, exclusive) {
  const cats = vm.runInContext("norm", context)((book.categories || []).join(" | "));
  return cats ? GENRE_FIT[genreId].test(cats) || (exclusive && !/\b(cooking|business|economics|self help|health)\b/.test(cats)) : exclusive;
}

// Les catalogues élargissent la recherche (« Kana » trouve « Kanaé ») : l'éditeur doit correspondre.
function samePublisher(book, publisher) {
  const norm = vm.runInContext("norm", context);
  const got = norm(book.publisher || ""), want = norm(publisher);
  return got === want || got.startsWith(want + " ");
}

async function publisherSearch(publisher, genreId, exclusive) {
  const fn = name => vm.runInContext(name, context);
  const books = [];
  const keep = b => isRecent(b) && samePublisher(b, publisher) && fitsGenre(b, genreId, exclusive);
  // Google Books
  try {
    const data = await fn("sources").google.request(`inpublisher:"${publisher}"`, 0, "new");
    books.push(...(data.items || [])
      .filter(it => !it.volumeInfo.language || it.volumeInfo.language === "fr")
      .filter(it => !fn("isLowContent")(it.volumeInfo.title, it.volumeInfo.subtitle, it.volumeInfo.categories))
      .map(fn("normalizeGoogle")).filter(keep));
  } catch { /* source indisponible */ }
  // Open Library
  try {
    const params = new URLSearchParams({ publisher, language: "fre", sort: "new", limit: 40, fields: fn("OL_FIELDS") });
    const res = await robotFetch(`https://openlibrary.org/search.json?${params}`);
    if (res.ok) {
      books.push(...((await res.json()).docs || [])
        .filter(doc => !fn("isLowContent")(doc.title, doc.subtitle, doc.subject))
        .map(fn("normalizeOpenLibrary")).filter(keep));
    }
  } catch { /* source indisponible */ }
  // BnF
  if (DOMParser) {
    try {
      const cql = `bib.publisher all "${publisher.replace(/"/g, " ")}" and bib.date any "${year} ${year - 1}" and bib.language any "fre" and bib.doctype any "a"`;
      const params = new URLSearchParams({ version: "1.2", operation: "searchRetrieve", recordSchema: "dublincore", query: cql, maximumRecords: 30 });
      const res = await robotFetch(`${fn("BNF_SRU")}?${params}`);
      if (res.ok) {
        const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
        books.push(...[...xml.getElementsByTagName("srw:record")].map(fn("normalizeBnf"))
          .filter(b => b.title && !fn("isLowContent")(b.title, "", b.categories)).filter(keep));
      }
    } catch { /* source indisponible */ }
  }
  return books;
}

async function collect(genre) {
  const searchBooks = vm.runInContext("searchBooks", context);
  const found = [];
  const labels = new Set();
  for (let page = 0; page < PAGES_PER_GENRE; page++) {
    // Le site met une source en pause 5 minutes après une erreur ; le robot réessaie à chaque page.
    vm.runInContext("for (const k in sourceDownUntil) delete sourceDownUntil[k]", context);
    if (page) await new Promise(r => setTimeout(r, 800));
    try {
      const r = await searchBooks({ type: "recent", value: genre }, page, "new");
      r.sourceLabel.split(" + ").forEach(l => labels.add(l));
      found.push(...r.books.filter(isRecent));
      if (!r.hasMore) break;
    } catch (err) {
      console.warn(`  ${genre ? genre.id : "tout"} page ${page} : ${err.message}`);
      break;
    }
  }
  const groups = (genre && PUBLISHER_QUERIES[genre.id]) || { exclusive: [], mixed: [] };
  const publishers = [...groups.exclusive.map(p => [p, true]), ...groups.mixed.map(p => [p, false])];
  for (const [publisher, exclusive] of publishers) {
    found.push(...await publisherSearch(publisher, genre.id, exclusive));
    await new Promise(r => setTimeout(r, 300));
  }
  if (publishers.length) labels.add("éditeurs");
  // Les éditions d'une même œuvre trouvées par plusieurs chemins sont fusionnées.
  return { books: vm.runInContext("dedupeWorks", context)(found), labels: [...labels].filter(l => l !== "éditeurs") };
}

// Nouvelle liste : livres trouvés cette semaine d'abord, puis les anciens encore récents.
function mergeList(fresh, previous, today, genre) {
  // Les anciens livres repassent les filtres actuels du site (ils évoluent).
  const stillValid = b => isRecent(b) && !(genre && vm.runInContext("isGenreFalsePositive", context)(b, genre));
  const firstSeen = new Map((previous || []).map(b => [workKey(b), b.addedAt]));
  const out = new Map();
  for (const b of fresh) {
    const k = workKey(b);
    if (!out.has(k)) out.set(k, { ...slim(b), addedAt: firstSeen.get(k) || today });
  }
  for (const b of previous || []) {
    const k = workKey(b);
    if (!out.has(k) && stillValid(b)) out.set(k, b);
  }
  return [...out.values()];
}

// Ordre d'affichage : année, puis livres avec une vraie couverture, puis les plus récemment ajoutés.
const hasCover = b => (b.covers || []).length > 0;
const byDisplayOrder = (a, b) => Number(b.year) - Number(a.year) || hasCover(b) - hasCover(a)
  || String(b.addedAt).localeCompare(String(a.addedAt));

// Quand les règles de sélection changent, les listes concernées repartent de zéro
// (sinon les livres retenus par les anciennes règles resteraient d'une semaine à l'autre).
const FILTER_VERSION = 2;
const previous = (() => {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT, "utf8"));
    if (prev.filterVersion !== FILTER_VERSION) {
      prev.all = [];
      for (const id of Object.keys(PUBLISHER_QUERIES)) if (prev.genres) delete prev.genres[id];
    }
    return prev;
  } catch { return null; }
})();
const today = new Date().toISOString().slice(0, 10);
const GENRES = vm.runInContext("GENRES", context);
const result = { version: 1, filterVersion: FILTER_VERSION, generatedAt: new Date().toISOString(), years: [year - 1, year], sources: [], all: [], genres: {} };
const allSources = new Set();
let freshCount = 0;

const rawLists = {};
for (const id of [null, ...RECENT_GENRES]) {
  const genre = id ? GENRES.find(g => g.id === id) : null;
  if (id && !genre) continue;
  const { books, labels } = await collect(genre);
  labels.forEach(l => allSources.add(l));
  freshCount += books.length;
  rawLists[id || ""] = mergeList(books, id ? previous && previous.genres && previous.genres[id] : previous && previous.all, today, genre);
  console.log(`${(id || "tout").padEnd(16)} ${String(books.length).padStart(3)} trouvés (${labels.join(" + ") || "aucune source"})`);
}

/* ---------- Vérification des couvertures -----------------------------------
 * Chaque image candidate est téléchargée une fois : on garde la première qui
 * fonctionne, ou aucune (le site dessine alors une couverture avec le titre).
 * Open Library limite les recherches d'image par ISBN : 80 au plus par passage.
 * ------------------------------------------------------------------------- */
const checkedBefore = new Map();
for (const list of [previous && previous.all, ...Object.values((previous && previous.genres) || {})]) {
  for (const b of list || []) if (b.coversChecked) checkedBefore.set(b.id, b.covers);
}
let olIsbnBudget = 80;
async function coverWorks(url) {
  if (url.includes("covers.openlibrary.org/b/isbn/")) {
    if (olIsbnBudget <= 0) return null;
    olIsbnBudget--;
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "BiblioFR-robot-nouveautes (" + SITE + ")" } });
    if (!res.ok) return res.status === 404 ? false : null;
    if (!(res.headers.get("content-type") || "").startsWith("image/")) return false;
    // Amazon renvoie un pixel transparent quand il n'a pas l'image.
    return (await res.arrayBuffer()).byteLength > 1000;
  } catch {
    return null; // erreur réseau : on ne conclut pas
  }
}
async function checkCovers(book) {
  if (checkedBefore.has(book.id)) return { ...book, covers: checkedBefore.get(book.id), coversChecked: true };
  let unsure = false;
  for (const url of book.covers || []) {
    const ok = await coverWorks(url);
    if (ok) return { ...book, covers: [url], coversChecked: true };
    if (ok === null) unsure = true;
  }
  return unsure ? book : { ...book, covers: [], coversChecked: true };
}
const uniqueBooks = new Map();
for (const list of Object.values(rawLists)) for (const b of list) uniqueBooks.set(b.id, b);
const pendingBooks = [...uniqueBooks.values()];
let coversFound = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (pendingBooks.length) {
    const b = pendingBooks.shift();
    const checked = await checkCovers(b);
    if (hasCover(checked) && checked.coversChecked) coversFound++;
    uniqueBooks.set(b.id, checked);
  }
}));
for (const key of Object.keys(rawLists)) rawLists[key] = rawLists[key].map(b => uniqueBooks.get(b.id));
console.log(`Couvertures vérifiées : ${coversFound} trouvées sur ${uniqueBooks.size} livres.`);

for (const id of RECENT_GENRES) {
  if (rawLists[id]) result.genres[id] = [...rawLists[id]].sort(byDisplayOrder).slice(0, MAX_PER_LIST);
}

// « Tout » : un mélange des genres (romans, polars, mangas…) avant les résultats généraux,
// pour éviter une liste dominée par les essais et les guides pratiques (biographies et
// développement personnel restent dans leurs propres listes).
const TOUT_ORDER = ["romans", "policier", "thriller", "fantasy", "science-fiction", "manga", "bd", "romance",
  "jeunesse", "young-adult"];
const mixed = [];
const lists = TOUT_ORDER.map(id => result.genres[id] || []);
for (let i = 0; i < MAX_PER_LIST; i++) for (const list of lists) if (list[i]) mixed.push(list[i]);
mixed.push(...[...(rawLists[""] || [])].sort(byDisplayOrder));
const seenTout = new Set();
result.all = mixed
  .filter(b => { const k = workKey(b); if (seenTout.has(k)) return false; seenTout.add(k); return true; })
  .map((b, rank) => ({ b, rank }))
  .sort((x, y) => Number(y.b.year) - Number(x.b.year) || hasCover(y.b) - hasCover(x.b) || x.rank - y.rank)
  .map(x => x.b)
  .slice(0, MAX_PER_LIST);
for (const [id, list] of [["tout", result.all], ...Object.entries(result.genres)]) {
  console.log(`  ${id.padEnd(16)} ${String(list.length).padStart(3)} gardés, ${list.filter(hasCover).length} avec couverture`);
}
result.sources = [...allSources];

const total = result.all.length + Object.values(result.genres).reduce((n, l) => n + l.length, 0);
if (freshCount < MIN_BOOKS_TO_SAVE && previous) {
  console.log(`Seulement ${freshCount} livres trouvés cette semaine : sources probablement en panne, ancien fichier des nouveautés conservé.`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result) + "\n");
  console.log(`data/nouveautes.json écrit : ${total} livres au total, sources : ${result.sources.join(", ")}.`);
}

/* ---------- Incontournables ------------------------------------------------
 * Même correspondance que findMustRead (js/views/discover.js) : titre + auteur,
 * puis comparaison de la clé d'avis (titre principal + nom de l'auteur).
 * Une fiche trouvée est gardée 90 jours ; les livres non trouvés sont retentés
 * chaque semaine (le site les cherche alors lui-même, comme avant).
 * ------------------------------------------------------------------------- */
const MUST_OUT = path.join(ROOT, "data", "incontournables.json");
const MUST_KEEP_DAYS = 90;
const reviewKey = vm.runInContext("reviewKey", context);
const searchBooks = vm.runInContext("searchBooks", context);
const MUST_READS = vm.runInContext("MUST_READS", context);
const prevMust = (() => { try { return JSON.parse(fs.readFileSync(MUST_OUT, "utf8")).books || {}; } catch { return {}; } })();
const must = {};
let mustFound = 0, mustSearched = 0;
const queue = [];
for (const cat of MUST_READS) {
  for (const [title, author] of cat.books) {
    const key = reviewKey({ title, authors: [author] });
    const old = prevMust[key];
    if (old) must[key] = old;
    if (!old || !(Date.now() - Date.parse(old.at) < MUST_KEEP_DAYS * 864e5)) queue.push({ title, author, key });
  }
}
// Les livres jamais trouvés passent d'abord, puis les fiches les plus anciennes.
queue.sort((a, b) => (must[a.key] ? 1 : 0) - (must[b.key] ? 1 : 0));
const mustDeadline = Date.now() + MUST_BUDGET_MS;

// Correspondance souple : même titre (ou titre suivi d'un numéro de tome, d'un sous-titre…)
// et au moins un mot du nom de l'auteur en commun, quel que soit l'ordre nom/prénom.
const mainTitle = t => reviewKey({ title: t, authors: [""] }).split("|")[0];
const nameWords = s => vm.runInContext("norm", context)(s).split(" ").filter(w => w.length >= 3);
const FIRST_VOLUME = /\b(?:t|tome|vol|volume)\s*0*1\b|\b0*1$/;
function bestMustMatch(books, title, author, key) {
  const exact = books.find(b => reviewKey(b) === key);
  if (exact) return exact;
  const want = mainTitle(title);
  const words = nameWords(author);
  const candidates = books.filter(b => {
    const got = mainTitle(b.title);
    // « Millénium 1 — Les hommes qui n'aimaient pas les femmes » : titre long contenu dans celui de l'édition.
    const full = vm.runInContext("norm", context)(b.title);
    const inside = want.split(" ").length >= 3 && ` ${full} `.includes(` ${want} `);
    if (!(got === want || got.startsWith(want + " ") || inside)) return false;
    const authorWords = new Set((b.authors || []).flatMap(nameWords));
    return words.some(w => authorWords.has(w));
  });
  // Préférence : titre exact, puis premier tome, puis l'ordre de pertinence.
  return candidates.find(b => mainTitle(b.title) === want)
    || candidates.find(b => FIRST_VOLUME.test(mainTitle(b.title)))
    || candidates[0] || null;
}
async function mustWorker() {
  while (queue.length && Date.now() < mustDeadline) {
    const { title, author, key } = queue.shift();
    vm.runInContext("for (const k in sourceDownUntil) delete sourceDownUntil[k]", context);
    mustSearched++;
    try {
      let book = null;
      // 1. titre + auteur ; 2. titre seul (les catalogues inversent souvent nom et prénom japonais).
      for (const query of [{ type: "all", value: `${title} ${author}` }, { type: "title", value: title }]) {
        const { books } = await searchBooks(query);
        book = bestMustMatch(books, title, author, key);
        if (book) break;
      }
      if (book) { must[key] = { ...slim(book), at: today }; mustFound++; }
    } catch { /* fiche précédente conservée */ }
  }
}
await Promise.all(Array.from({ length: MUST_PARALLEL }, mustWorker));
if (queue.length) console.log(`Temps écoulé : ${queue.length} incontournables seront cherchés au prochain passage.`);
const mustTotal = MUST_READS.reduce((n, c) => n + c.books.length, 0);
fs.mkdirSync(path.dirname(MUST_OUT), { recursive: true });
fs.writeFileSync(MUST_OUT, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), books: must }) + "\n");
console.log(`data/incontournables.json écrit : ${Object.keys(must).length}/${mustTotal} fiches (${mustSearched} recherchées cette semaine, ${mustFound} trouvées).`);

/* ---------- Livres des pages auteurs et genres ------------------------------
 * Open Library seulement (pas de quota Google). Chaque semaine : tous les genres
 * et les 80 auteurs mis en avant dont la liste est la plus ancienne ; chaque liste
 * est gardée 60 jours, la suite est reprise la semaine suivante.
 * ------------------------------------------------------------------------- */
const AG_OUT = path.join(ROOT, "data", "auteurs-genres.json");
const AUTHORS_PER_RUN = 80;
const AG_KEEP_DAYS = 60;
// Version 2 : seules les éditions françaises sont gardées (les listes de la version 1 sont refaites).
const AG_VERSION = 2;
const agPrev = (() => {
  try {
    const prev = JSON.parse(fs.readFileSync(AG_OUT, "utf8"));
    return prev.version === AG_VERSION ? prev : { authors: {}, genres: {} };
  } catch { return { authors: {}, genres: {} }; }
})();
const ag = { version: AG_VERSION, generatedAt: new Date().toISOString(), authors: { ...agPrev.authors }, genres: { ...agPrev.genres } };
const FEATURED_AUTHORS = vm.runInContext("FEATURED_AUTHORS", context);
const ol = vm.runInContext("sources.openlibrary", context);
const norm = vm.runInContext("norm", context);
const lightBook = b => ({ id: b.id, title: b.title, authors: (b.authors || []).slice(0, 3), year: b.year, covers: (b.covers || []).slice(0, 2) });

async function olBooks(query, keep, max) {
  try {
    const { books } = await ol.fetch(query, 0, "relevance");
    // Une édition française précise (lien /books/…) : sinon Open Library donne le titre original (« The Stranger »).
    const french = b => String(b.link || "").includes("/books/");
    let list = vm.runInContext("dedupeWorks", context)(books.filter(b => french(b) && keep(b)));
    list = vm.runInContext("rankByRelevance", context)(list, query);
    return list.slice(0, max).map(lightBook);
  } catch {
    return null; // source indisponible : l'ancienne liste est gardée
  }
}
const stale = entry => !entry || !(Date.now() - Date.parse(entry.at) < AG_KEEP_DAYS * 864e5);
const agTasks = [];
for (const genre of GENRES) {
  agTasks.push(async () => {
    const books = await olBooks({ type: "genre", value: genre }, b => !vm.runInContext("isGenreFalsePositive", context)(b, genre), 24);
    if (books) ag.genres[genre.id] = { at: today, books };
  });
}
const authorsByAge = [...FEATURED_AUTHORS].sort((x, y) =>
  String((ag.authors[x.name] || {}).at || "").localeCompare(String((ag.authors[y.name] || {}).at || "")));
for (const a of authorsByAge.filter(a => stale(ag.authors[a.name])).slice(0, AUTHORS_PER_RUN)) {
  const words = norm(a.name).split(" ").filter(w => w.length >= 3);
  agTasks.push(async () => {
    const books = await olBooks({ type: "author", value: a.name },
      b => (b.authors || []).some(n => words.some(w => norm(n).split(" ").includes(w))), 12);
    if (books) ag.authors[a.name] = { at: today, tag: a.tag, books };
  });
}
await Promise.all(Array.from({ length: 3 }, async () => {
  while (agTasks.length) { await agTasks.shift()(); await new Promise(r => setTimeout(r, 300)); }
}));
// Auteurs retirés de la liste des auteurs mis en avant : leur page disparaît.
for (const name of Object.keys(ag.authors)) if (!FEATURED_AUTHORS.some(a => a.name === name)) delete ag.authors[name];
fs.writeFileSync(AG_OUT, JSON.stringify(ag) + "\n");
console.log(`data/auteurs-genres.json écrit : ${Object.keys(ag.genres).length} genres, ${Object.keys(ag.authors).length}/${FEATURED_AUTHORS.length} auteurs.`);

/* ---------- Pages fixes pour les moteurs de recherche ---------------------- */
const { generatePages } = await import("./pages-livres.mjs");
const savedNews = (() => { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { return { genres: {} }; } })();
const pages = generatePages({
  ROOT, SITE,
  mustReads: MUST_READS.map(cat => ({
    name: cat.name,
    items: cat.books.map(([title, author]) => {
      const key = reviewKey({ title, authors: [author] });
      return { key: `m:${key}`, title, author, book: must[key] || null };
    }),
  })),
  nouveautes: savedNews,
  genres: GENRES,
  genreGroups: vm.runInContext("GENRE_GROUPS", context),
  authorsGenres: ag,
  stores: vm.runInContext("STORES", context),
  storeUrl: vm.runInContext("storeUrl", context),
});
console.log(`Pages livres : ${pages.total} livres, ${pages.genresPages} genres, ${pages.authorPages} auteurs (${pages.written} pages écrites ou modifiées, ${pages.removed} retirées), sitemap.xml à jour.`);
