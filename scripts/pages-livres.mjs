// Pages fixes par livre — Biblio FR
//
// Le site fonctionne avec des adresses en « #/… » que les moteurs de recherche
// voient comme une seule page. Le robot hebdomadaire appelle ce module pour
// écrire une vraie page HTML par livre (incontournables et nouveautés) dans
// livres/, un sommaire livres/index.html et le plan du site sitemap.xml.
// Chaque page renvoie vers la fiche interactive (avis, notes) et les librairies.

import fs from "node:fs";
import path from "node:path";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
const mainTitle = t => String(t || "").split(" — ")[0].trim();

const STYLE = `
:root{--bg:#f7f1e8;--card:#fffaf3;--ink:#2a211c;--muted:#6e6259;--line:#e4d8c8;--accent:#b5452b;--accent-ink:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#1b1715;--card:#26201d;--ink:#f1e9df;--muted:#b8aa9c;--line:#3a312c;--accent:#e0795c;--accent-ink:#1b1715}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}
.wrap{max-width:960px;margin:0 auto;padding:0 16px}
header{border-bottom:1px solid var(--line);background:var(--card)}
header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px}
.brand{font:700 1.3rem Georgia,"Times New Roman",serif;color:var(--ink);text-decoration:none}
.brand span{color:var(--accent)}
.crumbs{font-size:.9rem;color:var(--muted);margin:16px 0}
.crumbs a{color:var(--muted)}
.book{display:grid;grid-template-columns:220px 1fr;gap:28px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px}
.cover [hidden]{display:none!important}
.cover img,.cover .gen{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;display:block}
.cover .gen{background:linear-gradient(160deg,#7a3b2a,#3c2a4a);color:#fff;padding:16px;font:700 1.1rem Georgia,serif;display:flex;flex-direction:column;justify-content:space-between}
.cover .gen small{font:600 .75rem system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;opacity:.85}
h1{font:700 clamp(1.5rem,4vw,2.2rem)/1.2 Georgia,"Times New Roman",serif;margin:0 0 6px}
.by{margin:0 0 16px;color:var(--muted)}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0 0 16px;font-size:.95rem}
dt{color:var(--muted)}dd{margin:0}
.desc{white-space:pre-line}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);text-decoration:none;font-weight:600;padding:10px 18px;border-radius:999px;margin:4px 0}
.stores{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}
.stores a{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:6px 14px;text-decoration:none;background:var(--bg)}
h2{font:700 1.2rem Georgia,serif;margin:24px 0 10px}
.list{columns:2 260px;padding-left:18px}
.list li{break-inside:avoid;margin-bottom:4px}
footer.wrap{color:var(--muted);font-size:.9rem;padding:32px 16px;margin-top:24px}
@media (max-width:640px){.book{grid-template-columns:1fr;padding:16px}.cover{max-width:200px}}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:18px;list-style:none;padding:0;margin:0 0 8px}
.grid a{text-decoration:none;color:var(--ink);display:block}
.grid .cover{margin-bottom:6px}
.grid .gen{font-size:.95rem;padding:10px}
.grid strong{display:block;font-size:.95rem;line-height:1.3}
.grid small{color:var(--muted)}
.grid .gen small{color:#fff;opacity:.85;font-size:.7rem}
@media (max-width:640px){.btn{display:block;text-align:center}}
.intro{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px 24px;margin-bottom:8px}
.links{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}
.links a{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:4px 12px;text-decoration:none;background:var(--card)}
`;

function layout({ title, description, canonical, image, jsonLd, body, depth = 1 }) {
  const up = "../".repeat(depth);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="${up}icon.svg" type="image/svg+xml">
<meta property="og:type" content="${jsonLd && jsonLd["@type"] === "Book" ? "book" : "website"}">
<meta property="og:site_name" content="Biblio FR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
<style>${STYLE}</style>
</head>
<body>
<header><div class="wrap"><a class="brand" href="${up}">Biblio<span>FR</span></a><a href="${up}livres/">Tous les livres</a></div></header>
<main class="wrap">
${body}
</main>
<footer class="wrap">Biblio FR — catalogue des livres en français. Données : Google Books, Open Library, BnF. Les liens d'achat mènent vers des librairies en ligne.<br>
<a href="${up}#/mentions-legales">Mentions légales</a> · <a href="${up}#/confidentialite">Confidentialité</a> · <a href="${up}#/contact">Contact</a></footer>
</body>
</html>
`;
}

function bookPage(entry, ctx) {
  const { book, title, author, url, related, section } = entry;
  const { SITE, stores, storeUrl } = ctx;
  const cover = (book.covers || [])[0] || "";
  const authors = book.authors && book.authors.length ? book.authors : [author].filter(Boolean);
  const facts = [
    ["Auteur", authors.join(", ")],
    ["Éditeur", book.publisher],
    ["Parution", book.year],
    ["Pages", book.pages],
    ["ISBN", book.isbn],
  ].filter(([, v]) => v);
  const plainDesc = (book.description || "").replace(/\s+/g, " ").trim();
  const description = plainDesc
    ? `${title}, de ${authors[0] || "auteur inconnu"} : ${plainDesc}`.slice(0, 155).replace(/\s\S*$/, "") + "…"
    : `${title}${authors[0] ? `, de ${authors[0]}` : ""}${book.publisher ? ` (${book.publisher}${book.year ? `, ${book.year}` : ""})` : ""}. Avis des lecteurs et liens d'achat chez les libraires en ligne.`;
  const interactive = /^(g|ol)-/.test(book.id)
    ? `${SITE}#/livre/${encodeURIComponent(book.id)}`
    : `${SITE}#/recherche/all/${encodeURIComponent(`${title} ${authors[0] || ""}`.trim())}`;
  const target = { ...book, title, authors };
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Book", name: title, url, inLanguage: "fr",
    author: authors.map(name => ({ "@type": "Person", name })),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.year ? { datePublished: String(book.year) } : {}),
    ...(book.publisher ? { publisher: { "@type": "Organization", name: book.publisher } } : {}),
    ...(book.pages ? { numberOfPages: Number(book.pages) || undefined } : {}),
    ...(cover ? { image: cover } : {}),
    ...(plainDesc ? { description: plainDesc.slice(0, 500) } : {}),
  };
  const body = `
<nav class="crumbs"><a href="../">Accueil</a> › <a href="./">Livres</a> › <a href="./#${esc(section.id)}">${esc(section.name)}</a></nav>
<article class="book">
  <div class="cover">${cover
    ? `<img src="${esc(cover)}" alt="Couverture de ${esc(title)}" width="220" height="330" referrerpolicy="no-referrer"
         onerror="this.hidden=true;this.nextElementSibling.hidden=false">`
    : ""}<div class="gen" role="img" aria-label="Couverture de ${esc(title)}"${cover ? " hidden" : ""}><span>${esc(title)}</span><small>${esc(authors[0] || "")}</small></div></div>
  <div>
    <h1>${esc(title)}</h1>
    <p class="by">de ${authors.map(a => `<a href="../#/auteur/${encodeURIComponent(a)}">${esc(a)}</a>`).join(", ")}</p>
    <dl>${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    ${plainDesc ? `<p class="desc">${esc((book.description || "").trim())}</p>` : ""}
    <p><a class="btn" href="${esc(interactive)}">Voir la fiche, lire les avis et noter ce livre</a></p>
    <h2>Acheter ce livre</h2>
    <ul class="stores">${stores.map(st => `<li><a href="${esc(storeUrl(st, target))}" rel="nofollow noopener" target="_blank">${esc(st.name)} ↗</a></li>`).join("")}</ul>
  </div>
</article>
${related.length ? `<h2>Dans la même sélection : ${esc(section.name)}</h2>
<ul class="list">${related.map(r => `<li><a href="${esc(r.file)}">${esc(r.title)}</a> — ${esc(r.author)}</li>`).join("")}</ul>` : ""}`;
  return layout({
    title: `${title}${authors[0] ? ` — ${authors[0]}` : ""} | Biblio FR`,
    description, canonical: url, image: cover || `${SITE}og-image.png`, jsonLd, body,
  });
}

export function generatePages({ ROOT, SITE, mustReads, nouveautes, genres, genreGroups = [], authorsGenres = { authors: {}, genres: {} }, stores, storeUrl }) {
  const dir = path.join(ROOT, "livres");
  fs.mkdirSync(dir, { recursive: true });
  const used = new Map();   // nom de fichier → clé du livre
  const byKey = new Map();  // un livre n'a qu'une page, même s'il est dans plusieurs listes
  const sections = [];

  const fileFor = (key, title, author) => {
    if (byKey.has(key)) return byKey.get(key).file;
    const surname = String(author || "").split(" ").pop();
    let base = [slug(mainTitle(title)), slug(surname)].filter(Boolean).join("-") || "livre";
    let name = `${base}.html`;
    for (let i = 2; used.has(name) && used.get(name) !== key; i++) name = `${base}-${i}.html`;
    used.set(name, key);
    return name;
  };
  const addSection = (id, name, items) => {
    const entries = [];
    for (const { key, title, author, book } of items) {
      if (!book) continue;
      const file = fileFor(key, title, author);
      if (!byKey.has(key)) byKey.set(key, { key, title, author, book, file, url: `${SITE}livres/${file}`, section: { id, name } });
      entries.push(byKey.get(key));
    }
    if (entries.length) sections.push({ id, name, entries });
  };

  for (const cat of mustReads) addSection(`incontournables-${slug(cat.name)}`, `Incontournables — ${cat.name}`, cat.items);
  const genreName = id => (genres.find(g => g.id === id) || {}).name || id;
  for (const [id, list] of Object.entries(nouveautes.genres || {})) {
    addSection(`nouveautes-${id}`, `Nouveautés — ${genreName(id)}`, list.map(b => ({
      key: `n:${b.id}`, title: mainTitle(b.title), author: (b.authors || [])[0] || "", book: b,
    })));
  }

  // Pages des livres (réécrites seulement si leur contenu change).
  let written = 0;
  const keep = new Set(["index.html"]);
  for (const entry of byKey.values()) {
    const section = sections.find(s => s.id === entry.section.id);
    entry.related = section.entries.filter(e => e !== entry).slice(0, 12)
      .map(e => ({ file: e.file, title: e.title, author: (e.book.authors || [])[0] || e.author }));
    const html = bookPage(entry, { SITE, stores, storeUrl });
    const file = path.join(dir, entry.file);
    keep.add(entry.file);
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== html) { fs.writeFileSync(file, html); written++; }
  }
  // Pages auteurs et genres.
  const fileOfBook = new Map();
  for (const e of byKey.values()) [e.book.id, ...(e.book.altIds || [])].forEach(id => fileOfBook.set(id, e.file));
  const card = b => {
    const title = mainTitle(b.title);
    const href = fileOfBook.get(b.id) || (/^(g|ol)-/.test(b.id) ? `${SITE}#/livre/${encodeURIComponent(b.id)}` : `${SITE}#/recherche/all/${encodeURIComponent(title)}`);
    const cover = (b.covers || [])[0];
    return `<li><a href="${esc(href)}"><div class="cover">${cover
      ? `<img src="${esc(cover)}" alt="" loading="lazy" width="140" height="210" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : ""}<div class="gen"${cover ? " hidden" : ""}><span>${esc(title)}</span><small>${esc((b.authors || [])[0] || "")}</small></div></div>
      <strong>${esc(title)}</strong><small>${esc([(b.authors || [])[0], b.year].filter(Boolean).join(" · "))}</small></a></li>`;
  };
  const extraPages = []; // { file, url, title, kind, group }
  const writePage = (file, html) => {
    keep.add(file);
    const full = path.join(dir, file);
    if (!fs.existsSync(full) || fs.readFileSync(full, "utf8") !== html) { fs.writeFileSync(full, html); written++; }
  };

  const genreBooks = id => ((authorsGenres.genres || {})[id] || {}).books || [];
  const genreNews = id => (sections.find(s2 => s2.id === `nouveautes-${id}`) || { entries: [] }).entries;
  // Une page de genre n'existe que si elle a assez de contenu (4 livres ou des nouveautés).
  const genreOk = new Set(genres.filter(g => genreBooks(g.id).length >= 4 || genreNews(g.id).length).map(g => g.id));
  for (const g of genres) {
    if (!genreOk.has(g.id)) continue;
    const books = genreBooks(g.id);
    const news = genreNews(g.id);
    const file = `genre-${g.id}.html`;
    const url = `${SITE}livres/${file}`;
    const siblings = genres.filter(x => x.group === g.group && x.id !== g.id && genreOk.has(x.id));
    const body = `
<nav class="crumbs"><a href="../">Accueil</a> › <a href="./">Livres</a> › <a href="./#genres">Genres</a> › ${esc(g.name)}</nav>
<section class="intro">
  <h1>${esc(g.icon || "")} ${esc(g.name)}</h1>
  <p class="by">Livres en français du genre « ${esc(g.name)} » (${esc(g.group)}), avec les avis des lecteurs et des liens vers les librairies en ligne.</p>
  <p><a class="btn" href="${esc(`${SITE}#/genre/${g.id}`)}">Explorer tous les livres ${esc(g.name)}</a></p>
</section>
${books.length ? `<h2>Livres à découvrir</h2><ul class="grid">${books.map(card).join("")}</ul>` : ""}
${news.length ? `<h2>Nouveautés ${esc(g.name)}</h2><ul class="grid">${news.slice(0, 18).map(e => card(e.book)).join("")}</ul>
<p><a href="${esc(`${SITE}#/nouveautes/${g.id}`)}">Toutes les nouveautés ${esc(g.name)}</a></p>` : ""}
${siblings.length ? `<h2>Genres proches</h2><ul class="links">${siblings.map(x => `<li><a href="genre-${esc(x.id)}.html">${esc(x.name)}</a></li>`).join("")}</ul>` : ""}`;
    writePage(file, layout({
      title: `${g.name} : livres en français | Biblio FR`,
      description: `Livres du genre ${g.name} disponibles en français${books[0] ? ` : ${books.slice(0, 3).map(b => mainTitle(b.title)).join(", ")}…` : ""} Avis des lecteurs et liens d'achat.`.slice(0, 160),
      canonical: url, image: ((books[0] || {}).covers || [])[0] || `${SITE}og-image.png`,
      jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: `${g.name} — livres en français`, url, inLanguage: "fr" },
      body,
    }));
    extraPages.push({ file, url, title: g.name, kind: "genre", group: g.group });
  }
  const authorEntries = Object.entries(authorsGenres.authors || {});
  const authorFile = name => `auteur-${slug(name)}.html`;
  const authorPagesSet = new Set();
  for (const [name, info] of authorEntries) {
    const books = info.books || [];
    const words = String(name).toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    const mustOfAuthor = [...byKey.values()].filter(e => e.key.startsWith("m:")
      && (e.book.authors || [e.author]).some(n => words.some(w => String(n).toLowerCase().includes(w))));
    if (books.length < 2 && !mustOfAuthor.length) continue;
    authorPagesSet.add(name);
  }
  for (const name of authorPagesSet) {
    const info = authorsGenres.authors[name];
    const books = info.books || [];
    const words = String(name).toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    const mustOfAuthor = [...byKey.values()].filter(e => e.key.startsWith("m:")
      && (e.book.authors || [e.author]).some(n => words.some(w => String(n).toLowerCase().includes(w))));
    const file = authorFile(name);
    const url = `${SITE}livres/${file}`;
    const sameTag = [...authorPagesSet].filter(n => n !== name && authorsGenres.authors[n].tag === info.tag).slice(0, 24);
    const body = `
<nav class="crumbs"><a href="../">Accueil</a> › <a href="./">Livres</a> › <a href="./#auteurs">Auteurs</a> › ${esc(name)}</nav>
<section class="intro">
  <h1>${esc(name)}</h1>
  <p class="by">${esc(info.tag || "")} · livres de ${esc(name)} disponibles en français, avec les avis des lecteurs et des liens vers les librairies en ligne.</p>
  <p><a class="btn" href="${esc(`${SITE}#/auteur/${encodeURIComponent(name)}`)}">Tous les livres de ${esc(name)}</a></p>
</section>
${mustOfAuthor.length ? `<h2>Incontournables</h2><ul class="grid">${mustOfAuthor.map(e => card(e.book)).join("")}</ul>` : ""}
${books.length ? `<h2>Livres de ${esc(name)}</h2><ul class="grid">${books.map(card).join("")}</ul>` : ""}
${sameTag.length ? `<h2>Autres auteurs : ${esc(info.tag || "")}</h2><ul class="links">${sameTag.map(n => `<li><a href="${esc(authorFile(n))}">${esc(n)}</a></li>`).join("")}</ul>` : ""}`;
    writePage(file, layout({
      title: `${name} : livres en français | Biblio FR`,
      description: `Livres de ${name} en français${books[0] ? ` : ${books.slice(0, 3).map(b => mainTitle(b.title)).join(", ")}…` : ""} Avis des lecteurs et liens d'achat.`.slice(0, 160),
      canonical: url, image: ((books[0] || {}).covers || [])[0] || `${SITE}og-image.png`,
      jsonLd: { "@context": "https://schema.org", "@type": "ProfilePage", mainEntity: { "@type": "Person", name }, url, inLanguage: "fr" },
      body,
    }));
    extraPages.push({ file, url, title: name, kind: "auteur", group: info.tag || "" });
  }

  // Pages de livres qui ne sont plus dans aucune liste.
  let removed = 0;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".html") && !keep.has(f)) { fs.unlinkSync(path.join(dir, f)); removed++; }
  }

  // Sommaire.
  const total = byKey.size;
  const indexBody = `
<nav class="crumbs"><a href="../">Accueil</a> › Livres</nav>
<h1>Tous les livres de la sélection</h1>
<p class="by">${total} livres en français : les incontournables et les nouveautés de la semaine, avec leurs avis et leurs liens d'achat.</p>
${(() => {
  const gp = extraPages.filter(x => x.kind === "genre");
  const ap = extraPages.filter(x => x.kind === "auteur");
  const grouped = (list, order) => [...new Set([...order, ...list.map(x => x.group)])].filter(gr => list.some(x => x.group === gr))
    .map(gr => `<h3>${esc(gr)}</h3><ul class="links">${list.filter(x => x.group === gr).map(x => `<li><a href="${esc(x.file)}">${esc(x.title)}</a></li>`).join("")}</ul>`).join("");
  return (gp.length ? `<h2 id="genres">Genres</h2>${grouped(gp, genreGroups.map(g => g.name))}` : "")
    + (ap.length ? `<h2 id="auteurs">Auteurs</h2>${grouped(ap, [])}` : "");
})()}
${sections.map(s => `<h2 id="${esc(s.id)}">${esc(s.name)}</h2>
<ul class="list">${s.entries.map(e => `<li><a href="${esc(e.file)}">${esc(e.title)}</a> — ${esc((e.book.authors || [])[0] || e.author)}</li>`).join("")}</ul>`).join("\n")}`;
  fs.writeFileSync(path.join(dir, "index.html"), layout({
    title: "Tous les livres — Biblio FR",
    description: `Index des ${total} livres en français présentés par Biblio FR : incontournables par catégorie et nouveautés par genre.`,
    canonical: `${SITE}livres/`, image: `${SITE}og-image.png`, body: indexBody,
  }));

  // Plan du site.
  const urls = [`${SITE}`, `${SITE}livres/`, ...extraPages.map(x => x.url), ...[...byKey.values()].map(e => e.url)];
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join("\n") + `\n</urlset>\n`);

  return { total, written, removed, genresPages: extraPages.filter(x => x.kind === "genre").length, authorPages: extraPages.filter(x => x.kind === "auteur").length };
}
