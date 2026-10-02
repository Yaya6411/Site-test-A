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
const bookKey = b => b.isbn || (b.title + "|" + (b.authors[0] || "")).toLowerCase();

async function searchBooks(query, page = 0, sort = "relevance") {
  const mode = getSource();
  const all = Object.keys(sources);

  if (mode === "all") {
    // Toutes les sources en parallèle, résultats entremêlés et dédoublonnés.
    const names = all.filter(isUp).length ? all.filter(isUp) : all;
    const settled = await Promise.allSettled(names.map(n => fetchFrom(n, query, page, sort)));
    const ok = settled.map((r, i) => r.status === "fulfilled" && { ...r.value, name: names[i] }).filter(Boolean);
    if (!ok.length) {
      throw new Error(`Le catalogue est momentanément indisponible (${settled[0].reason.message}). Réessayez dans un instant.`);
    }
    const seen = new Set();
    const books = [];
    const longest = Math.max(...ok.map(r => r.books.length));
    for (let i = 0; i < longest; i++) {
      for (const r of ok) {
        const b = r.books[i];
        if (b && !seen.has(bookKey(b))) { seen.add(bookKey(b)); books.push(b); }
      }
    }
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
