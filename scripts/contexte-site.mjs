// Outils communs aux robots de Biblio FR (nouveautés, classement).
//
// Charge le vrai code de recherche du site (data.js, sources, filtres…) dans
// Node, avec le minimum d'un navigateur, pour que les robots trient et filtrent
// les livres exactement comme le site.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SITE = "https://yaya6411.github.io/Site-test-A/";
const REQUEST_TIMEOUT_MS = 20000; // une source qui ne répond pas est abandonnée

// La BnF répond en XML : le navigateur a DOMParser, Node non.
export let DOMParser = null;
try {
  ({ DOMParser } = await import("@xmldom/xmldom"));
  // Le code du site parcourt les listes de nœuds avec [...liste] : on les rend itérables.
  const sample = new DOMParser().parseFromString("<a><b/></a>", "application/xml").getElementsByTagName("b");
  const proto = Object.getPrototypeOf(sample);
  if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
} catch { /* BnF ignorée */ }

// Clé Google : secret GitHub GOOGLE_BOOKS_KEY si présent, sinon la clé du site
// (limitée au site : on présente donc l'adresse du site comme origine, comme pour Firebase).
const secretKey = process.env.GOOGLE_BOOKS_KEY || "";
export async function robotFetch(url, opts = {}) {
  let u = String(url);
  const headers = { "User-Agent": "BiblioFR-robot (" + SITE + ")", ...(opts.headers || {}) };
  if (u.startsWith("https://www.googleapis.com/") && secretKey) u = u.replace(/([?&]key=)[^&]*/, "$1" + encodeURIComponent(secretKey));
  else if (u.startsWith("https://www.googleapis.com/") || u.startsWith("https://firestore.googleapis.com/")) headers.Referer = SITE;
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

const SCRIPTS = ["data.js", "js/core/util.js", "js/services/cache.js", "js/services/sources.js",
  "js/services/quality.js", "js/services/search.js"];

// Contexte qui imite le minimum d'un navigateur pour charger les scripts du site.
export function createSiteContext() {
  const context = vm.createContext({
    console, setTimeout, clearTimeout, URLSearchParams, URL, Promise, Map, Set, JSON, Math, Date,
    fetch: robotFetch,
    DOMParser: DOMParser || undefined,
    document: { getElementById: () => null, querySelector: () => null, documentElement: null },
    window: {},
  });
  context.window = context;
  for (const file of SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }
  if (!DOMParser) vm.runInContext(`delete sources.bnf;`, context);
  // Clé d'avis du site (js/features/reviews.js), utile pour relier avis et fiches.
  const reviewsSrc = fs.readFileSync(path.join(ROOT, "js/features/reviews.js"), "utf8");
  vm.runInContext(reviewsSrc.match(/function reviewKey\(book\) \{[\s\S]*?\n\}\n/)[0], context);
  return context;
}

// Le site met une source en pause 5 minutes après une erreur ; un robot préfère réessayer.
export function resetSourcePauses(context) {
  vm.runInContext("for (const k in sourceDownUntil) delete sourceDownUntil[k]", context);
}
