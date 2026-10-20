// Sauvegarde hebdomadaire des données publiques de Firestore — Biblio FR
//
// Lancée par .github/workflows/nouveautes.yml (tâche « sauvegarde »). Lit, comme
// un visiteur, tout ce que les règles Firestore rendent public :
//   avis (reviews), pseudos (usernames), profils (users) avec abonnements
//   (following / followers) et listes publiques (lists où public == true).
// Les bibliothèques personnelles et les signalements ne sont pas lisibles sans
// compte : ils ne sont pas sauvegardés.
//
// Le fichier produit (JSON) est ensuite chiffré par le workflow avec le secret
// BACKUP_PASSWORD et conservé 90 jours comme « artifact » GitHub. Il n'est jamais
// ajouté au dépôt, qui est public.
//
// Usage : node scripts/sauvegarde-avis.mjs <fichier-de-sortie.json>

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://yaya6411.github.io/Site-test-A/";
const out = process.argv[2] || "sauvegarde.json";

// Projet et clé Firebase lus dans data.js (clé limitée au site : on présente son adresse).
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(ROOT, "data.js"), "utf8") + ";this.P=FIREBASE_PROJECT_ID;this.K=FIREBASE_API_KEY;", ctx);
const BASE = `https://firestore.googleapis.com/v1/projects/${ctx.P}/databases/(default)/documents`;
const headers = { Referer: SITE, "Content-Type": "application/json" };

async function call(url, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method: body ? "POST" : "GET", headers, body: body && JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) { await new Promise(r => setTimeout(r, 3000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`.slice(0, 300));
    return res.json();
  }
}

// Tous les documents d'une collection (pagination).
async function listAll(collectionPath) {
  const docs = [];
  let token = "";
  do {
    const params = new URLSearchParams({ pageSize: "300", key: ctx.K });
    if (token) params.set("pageToken", token);
    const data = await call(`${BASE}/${collectionPath}?${params}`);
    docs.push(...(data.documents || []));
    token = data.nextPageToken || "";
  } while (token);
  return docs;
}

async function publicLists(uid) {
  const rows = await call(`${BASE}/users/${encodeURIComponent(uid)}:runQuery?key=${ctx.K}`, {
    structuredQuery: {
      from: [{ collectionId: "lists" }],
      where: { fieldFilter: { field: { fieldPath: "public" }, op: "EQUAL", value: { booleanValue: true } } },
    },
  });
  return rows.map(r => r.document).filter(Boolean);
}

const idOf = doc => doc.name.split("/").pop();
const backup = { version: 1, project: ctx.P, createdAt: new Date().toISOString(), collections: {} };

backup.collections.reviews = await listAll("reviews");
backup.collections.usernames = await listAll("usernames");
const users = await listAll("users");
backup.collections.users = [];
for (const user of users) {
  const uid = idOf(user);
  backup.collections.users.push({
    ...user,
    following: await listAll(`users/${encodeURIComponent(uid)}/following`),
    followers: await listAll(`users/${encodeURIComponent(uid)}/followers`),
    lists: await publicLists(uid),
  });
}

fs.writeFileSync(out, JSON.stringify(backup));
const c = backup.collections;
console.log(`Sauvegarde : ${c.reviews.length} avis, ${c.users.length} profils, ${c.usernames.length} pseudos, `
  + `${c.users.reduce((n, u) => n + u.lists.length, 0)} listes publiques, `
  + `${c.users.reduce((n, u) => n + u.following.length, 0)} abonnements.`);
