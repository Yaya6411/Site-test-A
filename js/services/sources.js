"use strict";

/* =========================================================================
 *  Sources de données : Google Books et Open Library, normalisation, couvertures
 * ========================================================================= */

/* ---------- Sources de données ------------------------------------------ */

// Champs demandés à Open Library ; "editions" renvoie l'édition qui correspond au
// filtre de langue (la version française).
const OL_FIELDS = "key,title,subtitle,author_name,first_publish_year,isbn,cover_i,subject,publisher,number_of_pages_median,language," +
  "editions,editions.key,editions.title,editions.subtitle,editions.isbn,editions.cover_i,editions.publisher,editions.publish_date";

// Variantes ciblées pour les genres dont les sujets sont mal indexés selon les catalogues.
// Elles ne sont essayées que si la requête principale ne produit aucun livre exploitable.
const GENRE_QUERY_FALLBACKS = {
  "litterature-francaise": ["roman français", "littérature française"],
  fantasy: ["fantasy fiction", "roman fantasy français"],
  "science-fiction": ["science fiction", "roman de science-fiction"],
  manga: ["manga français", "manga traduit"],
  shonen: ["shonen manga", "manga shonen"],
  shojo: ["shojo manga", "manga shojo"],
  seinen: ["seinen manga", "manga seinen"],
  "light-novel": ["light novel français", "light novels"],
  bd: ["bande dessinée", "BD franco-belge"],
  comics: ["comics super-héros", "comics français"],
  "roman-graphique": ["roman graphique", "graphic novel français"],
  manhwa: ["manhwa français", "webtoon imprimé"],
  albums: ["album jeunesse français", "livre illustré enfant"],
  jeunesse: ["roman jeunesse français", "fiction jeunesse"],
  "young-adult": ["roman young adult français", "littérature ado"],
  "documentaires-jeunesse": ["documentaire jeunesse", "documentaires pour enfants"],
};

function queryCandidates(query, primary, plain) {
  const candidates = [primary, plain];
  if (query.type === "genre" || query.type === "recent") {
    const id = query.value && query.value.id;
    for (const term of GENRE_QUERY_FALLBACKS[id] || []) candidates.push(term);
  }
  return [...new Set(candidates.filter(Boolean).map(s => s.trim()).filter(Boolean))];
}

const sources = {
  google: {
    label: "Google Books",
    buildQuery({ type, value }) {
      switch (type) {
        case "genre":  return `subject:"${value.google}"`;
        case "author": return `inauthor:"${value}"`;
        case "title":  return `intitle:${value}`;
        case "isbn":   return `isbn:${value.replace(/[^0-9Xx]/g, "")}`;
        case "recent": return value ? `subject:"${value.google}"` : "roman";
        default:       return value;
      }
    },
    // Recherche simple équivalente, utilisée quand la recherche avancée ne renvoie rien.
    plainQuery({ type, value }) {
      if (type === "genre") return value.name;
      if (type === "recent") return value ? value.name : "roman";
      return type === "isbn" ? value.replace(/[^0-9Xx]/g, "") : value;
    },
    async request(q, page, sort) {
      const params = new URLSearchParams({
        q,
        langRestrict: "fr",
        country: "FR",
        printType: "books",
        maxResults: PAGE_SIZE,
        startIndex: page * PAGE_SIZE,
        orderBy: sort === "new" ? "newest" : "relevance",
      });
      if (GOOGLE_API_KEY) params.set("key", GOOGLE_API_KEY);
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
      if (!res.ok) {
        throw new Error(res.status === 429 && !GOOGLE_API_KEY
          ? "Google Books : quota gratuit épuisé, une clé API est nécessaire"
          : `Google Books : erreur ${res.status}`);
      }
      return res.json();
    },
    async fetch(query, page, sort) {
      const candidates = queryCandidates(query, this.buildQuery(query), this.plainQuery(query));
      let data = { items: [], totalItems: 0 };
      let raw = [];
      let books = [];
      for (const q of candidates) {
        data = await this.request(q, page, sort);
        raw = data.items || [];
        books = raw
          .filter(it => !it.volumeInfo.language || it.volumeInfo.language === "fr")
          .filter(it => !isLowContent(it.volumeInfo.title, it.volumeInfo.subtitle, it.volumeInfo.categories))
          .map(normalizeGoogle);
        // Ne multiplier les appels que lorsque la requête ne fournit aucun livre exploitable.
        if (books.length || query.type === "all" || query.type === "isbn" || query.type === "title" || query.type === "author") break;
      }
      // Le total reflète la dernière requête tentée ; hasMore s'appuie sur les éléments réellement reçus.
      return { books, total: data.totalItems || 0, hasMore: raw.length > 0 && page * PAGE_SIZE + raw.length < (data.totalItems || 0) };
    },
  },

  openlibrary: {
    label: "Open Library",
    async fetch(query, page, sort) {
      const { type, value } = query;
      const params = new URLSearchParams({
        language: "fre",
        limit: PAGE_SIZE,
        page: page + 1,
        // Demande les données d'édition pour mieux identifier la version française.
        fields: OL_FIELDS,
      });
      const setQuery = (candidate, first = false) => {
        params.delete("subject"); params.delete("author"); params.delete("title"); params.delete("isbn"); params.delete("q");
        if (type === "author") params.set("author", value);
        else if (type === "title") params.set("title", value);
        else if (type === "isbn") params.set("isbn", value.replace(/[^0-9Xx]/g, ""));
        else if (type === "genre" || (type === "recent" && value)) params.set("subject", candidate);
        else params.set("q", candidate);
      };
      let candidates;
      if (type === "genre") candidates = queryCandidates(query, value.openlibrary, value.name);
      else if (type === "recent" && value) candidates = queryCandidates(query, value.openlibrary, value.name);
      else candidates = [type === "recent" ? "language:fre" : value];
      let data = { docs: [], numFound: 0 };
      let books = [];
      for (let i = 0; i < candidates.length; i++) {
        setQuery(candidates[i], i === 0 && (type === "genre" || (type === "recent" && value)));
        if (sort === "new") params.set("sort", "new");
        const res = await fetch(`https://openlibrary.org/search.json?${params}`);
        if (!res.ok) throw new Error(`Open Library : erreur ${res.status}`);
        data = await res.json();
        books = (data.docs || [])
          // On conserve uniquement les notices avec indice d'édition française ou langue française.
          .filter(doc => (doc.editions && doc.editions.docs && doc.editions.docs.length) || (doc.language || []).includes("fre"))
          .filter(doc => !isLowContent(doc.title, doc.subtitle, doc.subject))
          .map(normalizeOpenLibrary);
        if (books.length || !["genre", "recent"].includes(type)) break;
      }
      return { books, total: data.numFound || 0, hasMore: (page + 1) * PAGE_SIZE < (data.numFound || 0) };
    },
  },
};

/* ---------- Source expérimentale : catalogue de la BnF (SRU) ---------------
 * La BnF propose une API publique (SRU) mais ne garantit pas qu'un navigateur
 * puisse l'interroger depuis un autre site (CORS). Le site la teste donc une
 * fois par visite : si l'appel échoue, la source est ignorée sans bruit.
 * ------------------------------------------------------------------------- */

const BNF_SRU = "https://catalogue.bnf.fr/api/SRU";
let bnfState = (() => { try { return sessionStorage.getItem("bibliofr.bnf") || "unknown"; } catch { return "unknown"; } })();

function setBnfState(state) {
  bnfState = state;
  try { sessionStorage.setItem("bibliofr.bnf", state); } catch { /* ignoré */ }
}

const cqlQuote = v => `"${String(v).replace(/["\\]/g, " ").trim()}"`;

function bnfQuery({ type, value }) {
  const lang = 'bib.language any "fre" and bib.doctype any "a"';
  const year = new Date().getFullYear();
  switch (type) {
    case "title": return `bib.title all ${cqlQuote(value)} and ${lang}`;
    case "author": return `bib.author all ${cqlQuote(value)} and ${lang}`;
    case "isbn": return `bib.isbn any ${cqlQuote(value.replace(/[^0-9Xx]/g, ""))}`;
    case "genre": return `bib.subject all ${cqlQuote(value.name.split(/[&,]/)[0])} and ${lang}`;
    case "recent": return `bib.date any "${year} ${year - 1}" and ${value ? `bib.subject all ${cqlQuote(value.name.split(/[&,]/)[0])} and ` : ""}${lang}`;
    default: return `bib.anywhere all ${cqlQuote(value)} and ${lang}`;
  }
}

// « Saint-Exupéry, Antoine de (1900-1944). Auteur du texte » → « Antoine de Saint-Exupéry »
function bnfAuthor(raw) {
  const clean = raw.replace(/\(.*?\)/g, "").split(".")[0].trim();
  const [last, first] = clean.split(",").map(x => x && x.trim());
  return first ? `${first} ${last}` : last;
}

function normalizeBnf(rec) {
  const all = tag => [...rec.getElementsByTagName(tag)].map(n => n.textContent.trim()).filter(Boolean);
  const title = (all("dc:title")[0] || "").split(" / ")[0].replace(/\s*:\s*/, " — ").trim();
  const ids = all("dc:identifier");
  const isbnMatch = ids.join(" ").replace(/-/g, "").match(/\b(97[89]\d{10}|\d{9}[\dX])\b/);
  const isbn = isbnMatch ? isbnMatch[1] : "";
  const ark = ids.find(i => i.includes("ark:/")) || "";
  const year = (all("dc:date")[0] || "").match(/\d{4}/);
  const publisher = (all("dc:publisher")[0] || "").split(":").pop().replace(/\(.*?\)/g, "").split(",")[0].trim();
  return {
    id: "bnf-" + (ark.split("/").pop() || Math.random().toString(36).slice(2)),
    title,
    authors: [...new Set(all("dc:creator").map(bnfAuthor).filter(Boolean))].slice(0, 4),
    year: year ? year[0] : "",
    publisher,
    pages: "",
    categories: all("dc:subject").slice(0, 6),
    description: "",
    isbn,
    covers: coverCandidates(isbn),
    link: ark.startsWith("http") ? ark : (ark ? `https://catalogue.bnf.fr/${ark}` : ""),
  };
}

const bnfSource = {
  label: "BnF",
  async fetch(query, page) {
    const params = new URLSearchParams({
      version: "1.2", operation: "searchRetrieve", recordSchema: "dublincore",
      query: bnfQuery(query), maximumRecords: 30, startRecord: page * 30 + 1,
    });
    let res;
    try {
      res = await fetch(`${BNF_SRU}?${params}`);
    } catch (err) {
      setBnfState("off");  // refusée par le navigateur (CORS) : on n'insiste pas
      throw new Error("BnF : non accessible depuis ce navigateur");
    }
    if (!res.ok) throw new Error(`BnF : erreur ${res.status}`);
    setBnfState("on");
    const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
    const total = Number((xml.getElementsByTagName("srw:numberOfRecords")[0] || {}).textContent || 0);
    const books = [...xml.getElementsByTagName("srw:record")].map(normalizeBnf)
      .filter(b => b.title && !isLowContent(b.title, "", b.categories));
    return { books, total, hasMore: (page + 1) * 30 < total };
  },
};

/* ---------- Couvertures -------------------------------------------------
 * Chaque livre reçoit une liste d'images candidates, essayées dans l'ordre :
 * celle fournie par la source, puis Open Library et Amazon via l'ISBN.
 * Si aucune ne fonctionne, une couverture est dessinée avec le titre.
 * ------------------------------------------------------------------------- */

function isbn13to10(isbn) {
  if (!/^978\d{10}$/.test(isbn)) return "";
  const core = isbn.slice(3, 12);
  const sum = [...core].reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? "X" : String(check));
}

function coverCandidates(isbn, ...primary) {
  const list = primary.filter(Boolean);
  const clean = (isbn || "").replace(/[^0-9Xx]/g, "");
  if (clean) {
    list.push(`https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`);
    const isbn10 = clean.length === 10 ? clean : isbn13to10(clean);
    if (isbn10) list.push(`https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`);
  }
  return [...new Set(list)];
}

// Version haute définition des vignettes Google Books.
function googleCoverHd(url) {
  return url.replace(/^http:/, "https:").replace("&edge=curl", "") + "&fife=w480-h720";
}

/* ---------- Ouvrages exclus ----------------------------------------------
 * Agendas, calendriers, coloriages, carnets vierges et livres de grilles
 * ne sont pas des livres à lire : on les retire des résultats.
 * ------------------------------------------------------------------------- */

const LOW_CONTENT_PATTERNS = [
  "agenda", "agendas", "calendrier", "calendriers", "calendar", "planner", "planificateur", "organiseur", "organizer",
  "coloriage", "coloriages", "colorier", "a colorier", "coloring", "colouring", "mandala", "mandalas", "art-therapie",
  "carnet de notes", "carnet de bord", "carnet ligne", "carnet vierge", "carnet a dessin", "carnet de croquis",
  "cahier ligne", "cahier vierge", "pages lignees", "pages vierges", "bloc-notes", "bloc notes",
  "notebook", "journal vierge", "bullet journal", "sketchbook", "lined", "blank book", "dot grid", "papier millimetre",
  "sudoku", "mots fleches", "mots croises", "mots meles", "word search", "crossword",
  "activity book", "cahier d'activites", "livre d'activites", "autocollants", "stickers",
];
const LOW_CONTENT_RE = new RegExp(`(^|[^a-z])(${LOW_CONTENT_PATTERNS.map(p => p.replace(/[-'\s]/g, "[-' ]?")).join("|")})([^a-z]|$)`);

function isLowContent(title, subtitle, categories) {
  const text = [title, subtitle, ...(categories || [])].join(" | ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return LOW_CONTENT_RE.test(text);
}

function normalizeGoogle(item) {
  const v = item.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const isbn = (ids.find(i => i.type === "ISBN_13") || ids.find(i => i.type === "ISBN_10") || {}).identifier || "";
  const cover = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail);
  return {
    id: "g-" + item.id,
    title: v.title + (v.subtitle ? " — " + v.subtitle : ""),
    authors: v.authors || [],
    year: (v.publishedDate || "").slice(0, 4),
    publisher: v.publisher || "",
    pages: v.pageCount || "",
    categories: v.categories || [],
    description: (v.description || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
    isbn,
    covers: coverCandidates(isbn, cover && googleCoverHd(cover), cover && googleCoverHd(cover).replace(/&fife=[^&]*$/, "")),
    link: v.infoLink || "",
  };
}

function normalizeOpenLibrary(doc) {
  // Édition française si Open Library la fournit, sinon l'œuvre générale.
  const ed = (doc.editions && doc.editions.docs && doc.editions.docs[0]) || {};
  const isbns = [...(ed.isbn || []), ...(doc.isbn || [])];
  const isbn = isbns.find(i => /^97[89]2/.test(i)) || isbns.find(i => i.length === 13) || isbns[0] || "";
  const title = ed.title || doc.title;
  const subtitle = ed.title ? ed.subtitle : doc.subtitle;
  const year = ((ed.publish_date || [])[0] || "").match(/\d{4}/);
  const covers = [ed.cover_i, doc.cover_i].filter(Boolean).map(id => `https://covers.openlibrary.org/b/id/${id}-L.jpg`);
  return {
    id: "ol-" + doc.key.replace(/\//g, "_"),
    title: title + (subtitle ? " — " + subtitle : ""),
    authors: doc.author_name || [],
    year: year ? year[0] : (doc.first_publish_year ? String(doc.first_publish_year) : ""),
    publisher: (ed.publisher || doc.publisher || [])[0] || "",
    pages: doc.number_of_pages_median || "",
    categories: (doc.subject || []).slice(0, 6),
    description: "",
    isbn,
    covers: coverCandidates(isbn, covers[0], covers[1]),
    link: "https://openlibrary.org" + (ed.key || doc.key),
  };
}

// Retrouve un livre à partir de son identifiant (lien partagé).
async function fetchBookById(id) {
  if (bookCache.has(id)) return bookCache.get(id);
  let book = null;
  if (id.startsWith("g-")) {
    const params = new URLSearchParams({ country: "FR" });
    if (GOOGLE_API_KEY) params.set("key", GOOGLE_API_KEY);
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id.slice(2))}?${params}`);
    if (res.ok) book = normalizeGoogle(await res.json());
  } else if (id.startsWith("ol-")) {
    const key = id.slice(3).replace(/_/g, "/");
    const params = new URLSearchParams({ q: `key:${key}`, language: "fre", fields: OL_FIELDS, limit: 1 });
    const res = await fetch(`https://openlibrary.org/search.json?${params}`);
    if (res.ok) {
      const doc = ((await res.json()).docs || [])[0];
      if (doc) book = normalizeOpenLibrary(doc);
    }
  }
  if (book) bookCache.set(id, book);
  return book;
}

sources.bnf = bnfSource;
// Sources utilisables en ce moment (la BnF seulement si le navigateur peut la joindre).
const sourceUsable = name => name !== "bnf" || bnfState !== "off";
