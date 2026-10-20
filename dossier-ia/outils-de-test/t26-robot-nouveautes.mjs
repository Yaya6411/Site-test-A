// Vérifie l'usage des fichiers du robot (data/nouveautes.json, data/incontournables.json)
// et le repli sur la recherche en direct. Le site doit être servi en HTTP (fetch interdit en file://) :
//   node scripts/robot-nouveautes.mjs (avec API simulées) puis python3 -m http.server 8765 dans une copie du site.
import { chromium } from 'playwright';
import { installCommon } from './fsmock.mjs';
const BASE = process.env.BASE || 'http://localhost:8765/';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
async function run(label, { block = false, stale = false, width = 1280 } = {}) {
  const p = await b.newPage({ viewport: { width, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const calls = { google: 0 };
  await installCommon(p);
  await p.route('https://www.googleapis.com/**', r => { calls.google++; r.fulfill({ json: { totalItems: 1, items: [{ id: 'live1', volumeInfo: { title: 'Livre en direct', authors: ['Direct'], publishedDate: String(new Date().getFullYear()), language: 'fr' } }] } }); });
  await p.route('https://openlibrary.org/**', r => r.fulfill({ json: { numFound: 0, docs: [] } }));
  await p.route('https://catalogue.bnf.fr/**', r => r.abort('failed'));
  if (block) await p.route('**/data/*.json', r => r.fulfill({ status: 404, body: '' }));
  if (stale) await p.route('**/data/nouveautes.json', async r => { const res = await r.fetch(); const j = await res.json(); j.generatedAt = '2020-01-01T00:00:00Z'; r.fulfill({ json: j }); });
  await p.goto(BASE + '#/'); await p.waitForSelector('#shelf-recent .book-card', { timeout: 8000 });
  const shelf = await p.locator('#shelf-recent .book-title').allTextContents();
  await p.goto(BASE + '#/nouveautes/manga'); await p.waitForSelector('#results .book-card');
  const count = await p.textContent('#results-count'); const n1 = await p.locator('#results .book-card').count();
  const moreVisible = await p.isVisible('#more-btn');
  if (moreVisible) { await p.click('#more-btn'); await p.waitForTimeout(800); }
  const n2 = await p.locator('#results .book-card').count();
  await p.locator('#results .book-open').first().click(); await p.waitForSelector('#book-dialog[open]');
  const dlg = await p.textContent('#book-detail h2'); await p.keyboard.press('Escape');
  const before = calls.google;
  await p.goto(BASE + '#/incontournables'); await p.waitForSelector('#must-grid .book-card'); await p.waitForTimeout(800);
  const misCard = await p.locator('#must-grid [data-must="Les Misérables"] button.book-open').count();
  const hscroll = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(`[${label}] étagère: ${shelf.length} (${shelf[0]}) | nouveautés manga: "${count}" ${n1} → ${n2} après « plus » | fiche: ${dlg} | Misérables préparé: ${misCard === 1} | appels Google page incontournables: ${calls.google - before} | défilement horizontal: ${hscroll} | erreurs: ${JSON.stringify(errs)}`);
  if (width === 375) await p.screenshot({ path: 'v26-nouveautes-mobile.png' });
  await p.close();
}
await run('fichier présent');
await run('fichier présent, mobile', { width: 375 });
await run('fichier absent → direct', { block: true });
await run('fichier trop ancien → direct', { stale: true });
await b.close();
