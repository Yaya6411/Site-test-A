"use strict";

/* =========================================================================
 *  Cache et maîtrise des appels aux API de livres
 *  - cache persistant (localStorage) avec une durée de vie par type de donnée ;
 *  - une seule requête réseau pour plusieurs demandes identiques simultanées ;
 *  - nombre limité de requêtes en parallèle (file d'attente).
 * ========================================================================= */

// Durée de conservation selon le type de recherche.
const CACHE_TTL = {
  genre: 24 * 3600e3,     // listes par genre : évoluent lentement
  author: 24 * 3600e3,
  isbn: 7 * 24 * 3600e3,  // une fiche ISBN ne change pas
  title: 12 * 3600e3,
  all: 12 * 3600e3,
  recent: 6 * 3600e3,     // nouveautés : rafraîchies plus souvent
};
const CACHE_MAX_ENTRIES = 60;
const CACHE_PREFIX = "bibliofr.cache.v1.";

const persistentCache = {
  indexKey: `${CACHE_PREFIX}index`,
  index() {
    try { return JSON.parse(localStorage.getItem(this.indexKey)) || {}; } catch { return {}; }
  },
  saveIndex(idx) {
    try { localStorage.setItem(this.indexKey, JSON.stringify(idx)); } catch { /* stockage indisponible */ }
  },
  get(key) {
    const idx = this.index();
    const meta = idx[key];
    if (!meta) return null;
    if (meta.expires < Date.now()) { this.delete(key); return null; }
    try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + meta.id)); } catch { return null; }
  },
  set(key, value, ttl) {
    const idx = this.index();
    const id = (idx[key] && idx[key].id) || Math.random().toString(36).slice(2, 10);
    idx[key] = { id, expires: Date.now() + ttl, at: Date.now() };
    this.evict(idx, CACHE_MAX_ENTRIES);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        localStorage.setItem(CACHE_PREFIX + id, JSON.stringify(value));
        this.saveIndex(idx);
        return;
      } catch {
        // Stockage plein : on libère la moitié la plus ancienne et on réessaie.
        this.evict(idx, Math.floor(Object.keys(idx).length / 2));
      }
    }
  },
  delete(key) {
    const idx = this.index();
    if (idx[key]) {
      try { localStorage.removeItem(CACHE_PREFIX + idx[key].id); } catch { /* ignoré */ }
      delete idx[key];
      this.saveIndex(idx);
    }
  },
  // Garde au plus `max` entrées : les expirées puis les plus anciennes partent d'abord.
  evict(idx, max) {
    const now = Date.now();
    const keys = Object.keys(idx).sort((a, b) => (idx[a].expires < now) - (idx[b].expires < now) || idx[b].at - idx[a].at);
    for (const k of keys.slice(max)) {
      try { localStorage.removeItem(CACHE_PREFIX + idx[k].id); } catch { /* ignoré */ }
      delete idx[k];
    }
  },
  clear() {
    const idx = this.index();
    Object.values(idx).forEach(m => { try { localStorage.removeItem(CACHE_PREFIX + m.id); } catch { /* ignoré */ } });
    this.saveIndex({});
  },
};

// File d'attente : au plus MAX_PARALLEL requêtes vers les API de livres en même temps.
const MAX_PARALLEL = 4;
let running = 0;
const waiting = [];

function limited(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      running++;
      task().then(resolve, reject).finally(() => {
        running--;
        if (waiting.length) waiting.shift()();
      });
    };
    if (running < MAX_PARALLEL) run(); else waiting.push(run);
  });
}

// Demandes identiques en cours : elles partagent la même requête réseau.
const inflight = new Map();

function dedupedFetch(key, task) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = limited(task).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// Résumé allégé pour le cache (descriptions tronquées).
function slimResult(result) {
  return { ...result, books: result.books.map(b => ({ ...b, description: (b.description || "").slice(0, 1500) })) };
}
