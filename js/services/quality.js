"use strict";

/* =========================================================================
 *  Qualité du catalogue : normalisation du texte, tolérance aux fautes,
 *  regroupement des éditions d'une même œuvre, score de pertinence et
 *  filtrage des faux positifs de genre.
 * ========================================================================= */

// Texte comparable : sans accents, en minuscules, ponctuation remplacée par des espaces.
function norm(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

const tokens = s => norm(s).split(" ").filter(Boolean);

// Distance d'édition (nombre de lettres à changer), arrêtée au-delà de `max`.
function levenshtein(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Fautes de frappe tolérées selon la longueur du mot.
const typoBudget = word => (word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0);

// 2 = mot identique, 1 = début de mot ou faute de frappe tolérée, 0 = absent.
function tokenMatch(word, candidates) {
  let best = 0;
  for (const c of candidates) {
    if (c === word) return 2;
    if (word.length >= 3 && c.startsWith(word)) best = 1;
    else if (typoBudget(word) && levenshtein(word, c, typoBudget(word)) <= typoBudget(word)) best = Math.max(best, 1);
  }
  return best;
}

/* ---------- Œuvre ou édition ------------------------------------------------
 * Plusieurs éditions d'un même livre (poche, collector, autre éditeur…) sont
 * regroupées sous une seule carte. Les tomes d'une série restent distincts.
 * ------------------------------------------------------------------------- */

const EDITION_NOISE = [
  "edition collector", "collector", "nouvelle edition", "edition revue et augmentee", "edition illustree",
  "edition definitive", "edition speciale", "edition anniversaire", "edition limitee", "texte integral",
  "version integrale", "poche", "grand format", "format poche", "large print", "gros caracteres",
  "version francaise", "french edition", "edition francaise", "roman", "litterature",
];
const EDITION_NOISE_RE = new RegExp(`\\b(${EDITION_NOISE.join("|")})\\b`, "g");

function volumeNumber(text) {
  const t = norm(text);
  const m = t.match(/\b(?:tome|t|vol|volume|livre|partie|n|no|numero|episode)\s*(\d{1,4})\b/) || t.match(/\b(\d{1,3})\s*$/);
  return m ? String(Number(m[1])) : "";
}

function authorSurname(book) {
  return tokens((book.authors || [])[0] || "").pop() || "";
}

// Clé d'œuvre : titre principal sans mentions d'édition + numéro de tome + nom de l'auteur.
function workKey(book) {
  const full = book.title || "";
  const main = full.split(" — ")[0].replace(/\(.*?\)|\[.*?\]/g, " ");
  const base = norm(main).replace(EDITION_NOISE_RE, " ")
    .replace(/\b(?:tome|t|vol|volume|livre|partie|n|no|numero|episode)\s*\d{1,4}\b/g, " ")
    .replace(/\s+/g, " ").trim();
  return `${base}#${volumeNumber(full)}|${authorSurname(book)}`;
}

const FRENCH_ISBN = /^(9782|97910|97912|2)/;

// Richesse d'une fiche : sert à choisir quelle édition représenter.
function quality(book) {
  return (book.covers.length ? 2 : 0) + (book.isbn ? 1 : 0) + (FRENCH_ISBN.test(book.isbn || "") ? 2 : 0)
    + (book.description ? 1 : 0) + (book.year ? 0.5 : 0) + (book.authors.length ? 1 : 0) + (book.publisher ? 0.5 : 0);
}

// Fusionne deux éditions : on garde la plus complète et on complète ses trous.
function mergeBooks(a, b) {
  const [main, other] = quality(b) > quality(a) ? [b, a] : [a, b];
  const merged = {
    ...main,
    covers: [...new Set([...main.covers, ...other.covers])],
    categories: [...new Set([...main.categories, ...other.categories])].slice(0, 8),
    description: main.description || other.description,
    isbn: main.isbn || other.isbn,
    pages: main.pages || other.pages,
    publisher: main.publisher || other.publisher,
    year: main.year || other.year,
    editions: (main.editions || 1) + (other.editions || 1),
    altIds: [...new Set([...(main.altIds || []), ...(other.altIds || []), other.id])],
  };
  return merged;
}

function dedupeWorks(books) {
  const byKey = new Map();
  for (const b of books) {
    const k = workKey(b);
    byKey.set(k, byKey.has(k) ? mergeBooks(byKey.get(k), b) : b);
  }
  return [...byKey.values()];
}

/* ---------- Faux positifs de genre ---------------------------------------- */

// Guides scolaires et critiques : des livres *sur* un genre, pas *du* genre.
const STUDY_RE = /\b(fiche de lecture|fiches de lecture|resume et analyse|analyse de l oeuvre|etude de l oeuvre|profil d une oeuvre|commentaire compose|reussir le bac|bac de francais|bac francais|guide de lecture|lire et comprendre|questionnaire de lecture|dossier pedagogique|histoire du roman|le roman policier|la science fiction|la bande dessinee)\b/;
const STUDY_CATEGORIES = /\b(literary criticism|study aids|reference|language arts|education|criticism|critique|history and criticism|dictionaries)\b/;
const FICTION_CATEGORIES = /\b(fiction|comics|manga|graphic|poetry|drama|roman|romans|bande dessinee|young adult|juvenile|fantasy|science fiction|romance|thriller|policier|mystery|horror|humor|nouvelles|contes|legends)\b/;
const NONFICTION_GENRES = new Set(["temoignages", "true-crime", "documentaires-jeunesse"]);

function isFictionGenre(genre) {
  return Boolean(genre) && ["Littérature", "Imaginaire", "Mangas & BD", "Jeunesse"].includes(genre.group)
    && !NONFICTION_GENRES.has(genre.id);
}

// Vrai si le livre est manifestement un ouvrage d'étude ou de critique sur le genre.
function isGenreFalsePositive(book, genre) {
  if (!isFictionGenre(genre)) return false;
  const title = norm(book.title);
  const cats = norm(book.categories.join(" | "));
  return STUDY_RE.test(title) || (STUDY_CATEGORIES.test(cats) && !FICTION_CATEGORIES.test(cats));
}

/* ---------- Pertinence ----------------------------------------------------- */

function relevance(book, query) {
  const { type, value } = query;
  let score = quality(book) * 0.4;
  const titleNorm = norm(book.title);
  const titleTokens = titleNorm.split(" ");
  const authorTokens = tokens(book.authors.join(" "));

  if (type === "isbn") {
    return score + ((book.isbn || "").replace(/[^0-9Xx]/g, "") === value.replace(/[^0-9Xx]/g, "") ? 20 : 0);
  }
  if (type === "genre" || type === "recent") {
    const genre = value;
    if (genre) {
      const cats = norm(book.categories.join(" "));
      const keywords = tokens(`${genre.google} ${genre.name} ${genre.openlibrary}`).filter(w => w.length > 3);
      if (keywords.some(k => cats.includes(k) || titleNorm.includes(k))) score += 2;
      if (isFictionGenre(genre) && book.categories.length && !FICTION_CATEGORIES.test(cats)) score -= 4;
    }
    return score;
  }

  const q = norm(value);
  const words = q.split(" ").filter(Boolean);
  if (type === "author") {
    const hits = words.map(w => tokenMatch(w, authorTokens));
    score += hits.reduce((n, h) => n + h * 3, 0);
    if (hits.every(h => h === 0)) score -= 15;
    return score;
  }
  // Recherche globale ou par titre.
  for (const w of words) {
    const inTitle = tokenMatch(w, titleTokens);
    const inAuthor = type === "all" ? tokenMatch(w, authorTokens) : 0;
    const best = Math.max(inTitle, inAuthor);
    score += best ? best * 3 : -2;
  }
  const mainTitle = norm(book.title.split(" — ")[0]);
  if (mainTitle === q) score += 8;
  else if (mainTitle.startsWith(q)) score += 5;
  else if (titleNorm.includes(q)) score += 3;
  if (STUDY_RE.test(titleNorm)) score -= 3;
  return score;
}

// Trie par pertinence décroissante (tri stable : l'ordre des sources départage).
function rankByRelevance(books, query) {
  return books
    .map((b, i) => ({ b, i, s: relevance(b, query) }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .map(x => x.b);
}

/* ---------- Suggestions locales (autocomplétion, « Vouliez-vous dire ») ---- */

let suggestionIndex = null;

function getSuggestionIndex() {
  if (suggestionIndex) return suggestionIndex;
  const entries = [];
  for (const a of FEATURED_AUTHORS) entries.push({ type: "Auteur", label: a.name, sub: a.tag, href: authorLink(a.name) });
  for (const cat of MUST_READS) {
    for (const [title, author] of cat.books) {
      entries.push({ type: "Livre", label: title, sub: author, href: `#/recherche/all/${enc(`${title} ${author}`)}` });
    }
  }
  for (const g of GENRES) entries.push({ type: "Genre", label: g.name, sub: g.group, href: `#/genre/${g.id}` });
  for (const e of entries) { e.n = norm(e.label); e.t = e.n.split(" "); }
  return (suggestionIndex = entries);
}

// Entrées dont les mots commencent par ceux saisis (avec tolérance aux fautes).
function suggest(text, limit = 8, types = null) {
  const q = norm(text);
  if (q.length < 2) return [];
  const words = q.split(" ");
  const scored = [];
  for (const e of getSuggestionIndex()) {
    if (types && !types.includes(e.type)) continue;
    let s = 0;
    if (e.n.startsWith(q)) s = 10;
    else if (e.n.includes(q)) s = 7;
    else {
      // Le dernier mot est peut-être en cours de frappe : un simple début de mot suffit.
      const hits = words.map((w, i) => (i === words.length - 1 && e.t.some(t => t.startsWith(w)) ? 1 : tokenMatch(w, e.t)));
      if (hits.every(h => h > 0)) s = 3 + hits.reduce((n, h) => n + h, 0);
    }
    if (s) scored.push({ e, s: s - e.n.length / 100 });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.e);
}

// Propositions proches pour une recherche sans résultat : chaque mot saisi peut
// comporter jusqu'à deux fautes (« harri poterr » → Harry Potter).
function didYouMean(text, limit = 4) {
  const q = norm(text);
  if (q.length < 3) return [];
  const found = suggest(text, limit);
  if (found.length) return found;
  const words = q.split(" ").filter(w => w.length >= 2);
  return getSuggestionIndex()
    .map(e => {
      let total = 0;
      for (const w of words) {
        const d = Math.min(...e.t.map(t => (t.startsWith(w) ? 0 : levenshtein(w, t, 2))));
        if (d > (w.length >= 4 ? 2 : 1)) return null;
        total += d;
      }
      return { e, d: total };
    })
    .filter(Boolean)
    .sort((a, b) => a.d - b.d || a.e.n.length - b.e.n.length)
    .slice(0, limit)
    .map(x => x.e);
}

// Variante d'un nom d'auteur : nom de famille seul (utile pour « J.K. Rowling », « Saint-Exupéry »…).
function authorVariant(name) {
  const parts = tokens(name);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}
