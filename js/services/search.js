"use strict";

/* =========================================================================
 *  Service de recherche : combinaison des sources, bascule, déduplication
 * ========================================================================= */

// Quand une source échoue (quota Google dépassé, panne…), on bascule sur l'autre
// et on laisse la source en échec de côté pendant quelques minutes.
const SOURCE_COOLDOWN_MS = 5 * 60 * 1000;
const sourceDownUntil = {};
const resultCache = new Map();

async function fetchFrom(name, query, page, sort) {
  const queryKey = query.type === "genre" ? query.value.id : query.value;
  const cacheKey = JSON.stringify([name, query.type, queryKey, page, sort]);
  if (resultCache.has(cacheKey)) return resultCache.get(cacheKey);
  try {
    const result = await sources[name].fetch(query, page, sort);
    result.books.forEach(b => bookCache.set(b.id, b));
    resultCache.set(cacheKey, result);
    return result;
  } catch (err) {
    sourceDownUntil[name] = Date.now() + SOURCE_COOLDOWN_MS;
    throw err;
  }
}

const isUp = name => !(sourceDownUntil[name] > Date.now());

// Interroge les sources (toutes en parallèle, ou la préférée avec bascule) sans post-traitement.
async function fetchSources(query, page, sort) {
  const mode = getSource();
  const all = Object.keys(sources);

  if (mode === "all") {
    const names = all.filter(isUp).length ? all.filter(isUp) : all;
    const settled = await Promise.allSettled(names.map(n => fetchFrom(n, query, page, sort)));
    const ok = settled.map((r, i) => r.status === "fulfilled" && { ...r.value, name: names[i] }).filter(Boolean);
    if (!ok.length) {
      throw new Error(`Le catalogue est momentanément indisponible (${settled[0].reason.message}). Réessayez dans un instant.`);
    }
    // Résultats entremêlés : chaque source garde sa place dans le classement initial.
    const books = [];
    const longest = Math.max(...ok.map(r => r.books.length));
    for (let i = 0; i < longest; i++) for (const r of ok) if (r.books[i]) books.push(r.books[i]);
    return {
      books,
      total: ok.reduce((n, r) => n + r.total, 0),
      hasMore: ok.some(r => r.hasMore),
      sourceLabel: ok.map(r => sources[r.name].label).join(" + "),
      warnings: settled.filter(r => r.status === "rejected").map(r => r.reason.message),
    };
  }

  const order = [mode, ...all.filter(n => n !== mode)];
  let lastError;
  for (const name of order.filter(isUp).length ? order.filter(isUp) : order) {
    try {
      const result = await fetchFrom(name, query, page, sort);
      return { ...result, sourceLabel: sources[name].label, warnings: lastError ? [lastError.message] : [] };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Le catalogue est momentanément indisponible (${lastError.message}). Réessayez dans un instant.`);
}

// Recherche complète : sources → regroupement des éditions → filtrage → classement par pertinence.
async function searchBooks(query, page = 0, sort = "relevance") {
  const result = await fetchSources(query, page, sort);
  let books = result.books;

  // Peu de résultats pour un auteur : nouvelle tentative avec son seul nom de famille.
  if (query.type === "author" && page === 0 && books.length < 5) {
    const surname = authorVariant(query.value);
    if (surname && surname !== norm(query.value)) {
      try {
        const extra = await fetchSources({ type: "author", value: surname }, 0, sort);
        books = books.concat(extra.books.filter(b => tokens(b.authors.join(" ")).includes(surname)));
      } catch { /* la recherche principale suffit */ }
    }
  }

  if (query.type === "genre" || query.type === "recent") {
    books = books.filter(b => !isGenreFalsePositive(b, query.value));
  }
  books = dedupeWorks(books);
  // Les identifiants des éditions fusionnées ouvrent la même fiche.
  books.forEach(b => { bookCache.set(b.id, b); (b.altIds || []).forEach(id => bookCache.set(id, b)); });
  if (sort === "relevance") books = rankByRelevance(books, query);
  return { ...result, books };
}
