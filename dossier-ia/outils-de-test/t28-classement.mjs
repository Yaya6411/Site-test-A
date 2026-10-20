// Page Classement : fichier préparé par le robot (data/classement.json) et repli en direct.
// Le site doit être servi en HTTP : BASE=http://localhost:8766/ node t28-classement.mjs
import { chromium } from 'playwright';
import { installCommon, installFirestore } from './fsmock.mjs';
const BASE = process.env.BASE || 'http://localhost:8766/';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const enc = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v }]));
const now = new Date().toISOString();
const file = { version: 1, generatedAt: now, reviews: 3, books: { 'dune|herbert': { id: 'g-dune', title: 'Dune', authors: ['Frank Herbert'], covers: [], year: '2021' } },
  periods: { semaine: [{ bookKey: 'dune|herbert', title: 'Dune', count: 2, avg: 4.5 }, { bookKey: 'nana|yazawa', title: 'Nana', count: 1, avg: 5 }], mois: [], tout: [] } };
async function run(label, { serveFile, stale = false }) {
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const docs = { 'reviews/u1__dune|herbert': { ...enc({ uid: 'u1', bookKey: 'dune|herbert', title: 'Dune', rating: 4, name: 'A', comment: '' }), createdAt: { timestampValue: now } } };
  const log = []; await installCommon(p); await installFirestore(p, docs, log);
  let queries = 0; p.on('request', r => { if (r.url().includes(':runQuery')) queries++; });
  await p.route('https://www.googleapis.com/**', r => r.fulfill({ json: { totalItems: 0, items: [] } }));
  await p.route('https://openlibrary.org/**', r => r.fulfill({ json: { numFound: 0, docs: [] } }));
  await p.route('https://catalogue.bnf.fr/**', r => r.abort('failed'));
  await p.route('**/data/classement.json', r => serveFile ? r.fulfill({ json: stale ? { ...file, generatedAt: '2020-01-01T00:00:00Z' } : file }) : r.fulfill({ status: 404, body: '' }));
  await p.goto(BASE + '#/classement'); await p.waitForSelector('.rank-row', { timeout: 8000 });
  await p.waitForTimeout(500);
  const rows = await p.locator('.rank-row').allTextContents();
  const note = await p.locator('#ranking p.muted.small').count();
  console.log(`[${label}] lignes: ${rows.length} | 1re: ${rows[0].replace(/\s+/g, ' ').trim().slice(0, 50)} | mention « chaque matin »: ${note === 1} | requêtes d'avis: ${queries} | erreurs: ${JSON.stringify(errs)}`);
  await p.close();
}
await run('fichier présent', { serveFile: true });
await run('fichier absent → direct', { serveFile: false });
await run('fichier trop ancien → direct', { serveFile: true, stale: true });
await b.close();
