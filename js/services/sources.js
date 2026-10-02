"use strict";

/* =========================================================================
 *  Sources de données : Google Books et Open Library, normalisation, couvertures
 * ========================================================================= */

/* ---------- Sources de données ------------------------------------------ */

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
      let data = await this.request(this.buildQuery(query), page, sort);
      if (!(data.items || []).length && query.type !== "all") {
        data = await this.request(this.plainQuery(query), page, sort);
      }
      const raw = data.items || [];
      const books = raw
        .filter(it => !it.volumeInfo.language || it.volumeInfo.language === "fr")
        .filter(it => !isLowContent(it.volumeInfo.title, it.volumeInfo.subtitle, it.volumeInfo.categories))
        .map(normalizeGoogle);
      // Google renvoie parfois moins de résultats que demandé : on continue tant qu'il en reste.
      return { books, total: data.totalItems || 0, hasMore: raw.length > 0 && page * PAGE_SIZE + raw.length < (data.totalItems || 0) };
    },
  },

  openlibrary: {
    label: "Open Library",
    async fetch(query, page, sort) {
      const params = new URLSearchParams({
        language: "fre",
        limit: PAGE_SIZE,
        page: page + 1,
        // "editions" renvoie l'édition qui correspond au filtre de langue (la version française).
        fields: "key,title,subtitle,author_name,first_publish_year,isbn,cover_i,subject,publisher,number_of_pages_median,language," +
                "editions,editions.key,editions.title,editions.subtitle,editions.isbn,editions.cover_i,editions.publisher,editions.publish_date",
      });
      const { type, value } = query;
      if (type === "genre") params.set("subject", value.openlibrary);
      else if (type === "author") params.set("author", value);
      else if (type === "title") params.set("title", value);
      else if (type === "isbn") params.set("isbn", value.replace(/[^0-9Xx]/g, ""));
      else if (type === "recent") value ? params.set("subject", value.openlibrary) : params.set("q", "language:fre");
      else params.set("q", value);
      if (sort === "new") params.set("sort", "new");

      const res = await fetch(`https://openlibrary.org/search.json?${params}`);
      if (!res.ok) throw new Error(`Open Library : erreur ${res.status}`);
      const data = await res.json();
      const books = (data.docs || [])
        // Langue française confirmée : édition française trouvée ou œuvre marquée « fre ».
        .filter(doc => (doc.editions && doc.editions.docs && doc.editions.docs.length) || (doc.language || []).includes("fre"))
        .filter(doc => !isLowContent(doc.title, doc.subtitle, doc.subject))
        .map(normalizeOpenLibrary);
      return { books, total: data.numFound || 0, hasMore: (page + 1) * PAGE_SIZE < (data.numFound || 0) };
    },
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
