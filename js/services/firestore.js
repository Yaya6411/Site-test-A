"use strict";

/* =========================================================================
 *  Accès à Cloud Firestore par son API REST (sans bibliothèque).
 *  Conversion automatique entre objets JavaScript et format Firestore.
 * ========================================================================= */

const firestore = {
  base() {
    return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  },
  apiKey() {
    return FIREBASE_API_KEY || GOOGLE_API_KEY;
  },
  // Chemin "users/abc/lists/x" → URL avec chaque segment encodé.
  url(path) {
    return `${this.base()}/${path.split("/").map(p => encodeURIComponent(p)).join("/")}`;
  },
  async request(url, options = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = typeof getIdToken === "function" ? await getIdToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}key=${this.apiKey()}`, { ...options, headers });
    if (!res.ok) {
      const status = res.status;
      const err = new Error(status === 403
        ? "Action refusée. Vérifiez que vous êtes connecté, puis réessayez."
        : status === 404
          ? "Élément introuvable."
          : status === 409
            ? "Cet élément existe déjà."
            : `Le service ne répond pas (erreur ${status}). Réessayez plus tard.`);
      err.status = status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  },

  /* ---------- Opérations génériques (objets JavaScript simples) ---------- */

  async get(path) {
    try {
      const doc = await this.request(this.url(path));
      return { id: doc.name.split("/").pop(), ...fromFirestore(doc.fields) };
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },
  // Tous les documents d'une collection (pagination incluse).
  async list(path, max = 1000) {
    const out = [];
    let pageToken = "";
    do {
      const data = await this.request(`${this.url(path)}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
      for (const doc of data.documents || []) out.push({ id: doc.name.split("/").pop(), ...fromFirestore(doc.fields) });
      pageToken = data.nextPageToken || "";
    } while (pageToken && out.length < max);
    return out;
  },
  // Crée ou remplace les champs donnés (les autres champs du document sont conservés).
  async patch(path, data) {
    const mask = Object.keys(data).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
    return this.request(`${this.url(path)}?${mask}`, { method: "PATCH", body: JSON.stringify({ fields: toFirestore(data) }) });
  },
  async remove(path) {
    return this.request(this.url(path), { method: "DELETE" }).catch(err => { if (err.status !== 404) throw err; });
  },
  // Requête structurée ; `parent` vide = racine de la base.
  async runQuery(structuredQuery, parent = "") {
    const url = parent ? `${this.url(parent)}:runQuery` : `${this.base()}:runQuery`;
    const rows = await this.request(url, { method: "POST", body: JSON.stringify({ structuredQuery }) });
    return rows.filter(r => r.document).map(r => ({ id: r.document.name.split("/").pop(), path: r.document.name, ...fromFirestore(r.document.fields) }));
  },
  // Écritures groupées, appliquées toutes ensemble ou pas du tout.
  async commit(writes) {
    return this.request(`${this.base()}:commit`, {
      method: "POST",
      body: JSON.stringify({ writes }),
    });
  },
  docName(path) {
    return `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  },
};

// Date au format Firestore : { ts: "2026-10-01T…Z" } est converti en timestamp.
const ts = date => ({ ts: new Date(date).toISOString() });

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (v.ts) return { timestampValue: v.ts };
  return { mapValue: { fields: toFirestore(v) } };
}

function toFirestore(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) fields[k] = toValue(v);
  return fields;
}

function fromValue(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFirestore(v.mapValue.fields);
  return null;
}

function fromFirestore(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromValue(v);
  return out;
}
