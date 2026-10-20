// Pages légales, formulaire de contact, messages en modération, export des données, polices locales.
import { chromium } from 'playwright';
import { installCommon, installFirestore } from './fsmock.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const external = new Set(); p.on('request', r => { const h = new URL(r.url()).host; if (h) external.add(h); });
const docs = { 'admins/u123': { role: { stringValue: 'admin' } } }; const log = [];
await installCommon(p); await installFirestore(p, docs, log);
await p.route('https://www.googleapis.com/**', r => r.fulfill({ json: { totalItems: 0, items: [] } }));
await p.route('https://openlibrary.org/**', r => r.fulfill({ json: { numFound: 0, docs: [] } }));
await p.route('https://catalogue.bnf.fr/**', r => r.abort('failed'));
const go = h => p.goto('file:///home/user/Site-test-A/index.html' + h);
for (const h of ['#/mentions-legales', '#/confidentialite']) { await go(h); await p.waitForSelector('.about h1'); console.log(h, '→', await p.textContent('.about h1'), '|', (await p.locator('.about h2').allTextContents()).length, 'sections'); }
console.log('liens pied de page:', await p.locator('.site-footer a').allTextContents());
// Contact sans compte
await go('#/contact'); await p.waitForSelector('#contact-form');
await p.fill('#contact-body', 'court'); await p.click('#contact-form button[type=submit]');
console.log('trop court →', await p.textContent('.contact-msg'));
await p.selectOption('#contact-subject', 'donnees'); await p.fill('#contact-body', 'Je souhaite connaître les données conservées.'); await p.fill('#contact-reply', 'moi@exemple.fr');
await p.click('#contact-form button[type=submit]'); await p.waitForTimeout(400);
const msgs = Object.keys(docs).filter(k => k.startsWith('messages/'));
console.log('envoyé →', await p.textContent('.contact-msg'), '| documents:', msgs.length, msgs[0] && JSON.stringify(docs[msgs[0]]).slice(0, 160));
// Robot (champ piège)
await p.fill('#contact-body', 'Message de robot assez long'); await p.evaluate(() => { document.getElementById('contact-website').value = 'spam'; });
await p.click('#contact-form button[type=submit]'); await p.waitForTimeout(300);
console.log('robot → messages en base :', Object.keys(docs).filter(k => k.startsWith('messages/')).length);
// Modérateur
await p.click('#account-area [data-auth=login]'); await p.fill('#auth-email', 'y@x.fr'); await p.fill('#auth-password', 'goodpass1'); await p.click('#auth-form button[type=submit]'); await p.waitForTimeout(800);
await go('#/moderation'); await p.waitForSelector('.page-title');
console.log('modération :', (await p.locator('.account-card h2').allTextContents()).map(t => t.replace(/\s+/g, ' ')));
console.log('message affiché :', (await p.textContent('[data-message-id]')).replace(/\s+/g, ' ').trim().slice(0, 140));
await p.click('[data-msg=delete]'); await p.click('[data-msg=delete]'); await p.waitForTimeout(500);
console.log('après suppression :', Object.keys(docs).filter(k => k.startsWith('messages/')).length, 'message(s)');
// Export
await go('#/compte'); await p.waitForSelector('#export-data');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#export-data')]);
const data = JSON.parse(await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8'));
console.log('export :', dl.suggestedFilename(), Object.keys(data).join(','), '| uid', data.account.uid);
// Mobile
await p.setViewportSize({ width: 375, height: 800 });
for (const h of ['#/confidentialite', '#/contact']) { await go(h); await p.waitForTimeout(300); console.log(h, 'mobile hscroll:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)); }
await p.screenshot({ path: 'v27-contact-mobile.png', fullPage: true });
console.log('Google Fonts contacté :', [...external].some(h => h.includes('fonts.g')));
console.log('polices chargées :', await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight).join(', '); }));
console.log('errs', errs); await b.close();
