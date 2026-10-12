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
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "nouveautes.json");
const SITE = "https://yaya6411.github.io/Site-test-A/";
const PAGES_PER_GENRE = 3;   // 3 × 40 résultats demandés par source et par genre
const MAX_PER_LIST = 60;     // livres gardés par liste
const RECENT_YEARS = 2;      // année en cours et année précédente
const MIN_BOOKS_TO_SAVE = 20; // en dessous, on garde l'ancien fichier (sources en panne)
const REQUEST_TIMEOUT_MS = 20000;  // une source qui ne répond pas est abandonnée
const MUST_BUDGET_MS = 6 * 60 * 1000; // temps maximal consacré aux incontournables (la suite la semaine suivante)
const MUST_PARALLEL = 4;

// La BnF répond en XML : le navigateur a DOMParser, Node non.
let DOMParser = null;
try {
  ({ DOMParser } = await import("@xmldom/xmldom"));
  // Le code du site parcourt les listes de nœuds avec [...liste] : on les rend itérables.
  const sample = new DOMParser().parseFromString("<a><b/></a>", "application/xml").getElementsByTagName("b");
  const proto = Object.getPrototypeOf(sample);
  if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
} catch { /* BnF ignorée */ }

// Clé Google : secret GitHub GOOGLE_BOOKS_KEY si présent, sinon la clé du site
// (limitée au site : on présente donc l'adresse du site comme origine).
const secretKey = process.env.GOOGLE_BOOKS_KEY || "";
async function robotFetch(url, opts = {}) {
  let u = String(url);
  const headers = { "User-Agent": "BiblioFR-robot-nouveautes (" + SITE + ")", ...(opts.headers || {}) };
  if (u.startsWith("https://www.googleapis.com/")) {
    if (secretKey) u = u.replace(/([?&]key=)[^&]*/, "$1" + encodeURIComponent(secretKey));
    else headers.Referer = SITE;
  }
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(u, { ...opts, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    // Google répond parfois 503 / 429 : on réessaie calmement.
    if ((res.status === 503 || res.status === 429 || res.status === 500) && attempt < 3) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    return res;
  }
}

// Contexte qui imite le minimum d'un navigateur pour charger les scripts du site.
const stubEl = null;
const context = vm.createContext({
  console, setTimeout, clearTimeout, URLSearchParams, URL, Promise, Map, Set, JSON, Math, Date,
  fetch: robotFetch,
  DOMParser: DOMParser || undefined,
  document: { getElementById: () => stubEl, querySelector: () => stubEl, documentElement: null },
  window: {},
});
context.window = context;
const SCRIPTS = ["data.js", "js/core/util.js", "js/services/cache.js", "js/services/sources.js",
  "js/services/quality.js", "js/services/search.js"];
for (const file of SCRIPTS) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
}
if (!DOMParser) vm.runInContext(`delete sources.bnf;`, context);

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
  return { books: found, labels: [...labels] };
}

// Nouvelle liste : livres trouvés cette semaine d'abord, puis les anciens encore récents.
function mergeList(fresh, previous, today) {
  const firstSeen = new Map((previous || []).map(b => [workKey(b), b.addedAt]));
  const out = new Map();
  for (const b of fresh) {
    const k = workKey(b);
    if (!out.has(k)) out.set(k, { ...slim(b), addedAt: firstSeen.get(k) || today });
  }
  for (const b of previous || []) {
    const k = workKey(b);
    if (!out.has(k) && isRecent(b)) out.set(k, b);
  }
  return [...out.values()]
    .sort((a, b) => Number(b.year) - Number(a.year) || String(b.addedAt).localeCompare(String(a.addedAt)))
    .slice(0, MAX_PER_LIST);
}

const previous = (() => { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { return null; } })();
const today = new Date().toISOString().slice(0, 10);
const GENRES = vm.runInContext("GENRES", context);
const result = { version: 1, generatedAt: new Date().toISOString(), years: [year - 1, year], sources: [], all: [], genres: {} };
const allSources = new Set();
let freshCount = 0;

for (const id of [null, ...RECENT_GENRES]) {
  const genre = id ? GENRES.find(g => g.id === id) : null;
  if (id && !genre) continue;
  const { books, labels } = await collect(genre);
  labels.forEach(l => allSources.add(l));
  freshCount += books.length;
  const list = mergeList(books, id ? previous && previous.genres && previous.genres[id] : previous && previous.all, today);
  if (id) result.genres[id] = list; else result.all = list;
  console.log(`${(id || "tout").padEnd(16)} ${String(books.length).padStart(3)} trouvés, ${list.length} gardés (${labels.join(" + ") || "aucune source"})`);
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
const reviewsSrc = fs.readFileSync(path.join(ROOT, "js/features/reviews.js"), "utf8");
vm.runInContext(reviewsSrc.match(/function reviewKey\(book\) \{[\s\S]*?\n\}\n/)[0], context);
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
async function mustWorker() {
  while (queue.length && Date.now() < mustDeadline) {
    const { title, author, key } = queue.shift();
    vm.runInContext("for (const k in sourceDownUntil) delete sourceDownUntil[k]", context);
    mustSearched++;
    try {
      const { books } = await searchBooks({ type: "all", value: `${title} ${author}` });
      const surname = key.split("|")[1];
      const book = books.find(b => reviewKey(b) === key)
        || books.find(b => reviewKey(b).split("|")[1] === surname && reviewKey(b).startsWith(key.split("|")[0]));
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
