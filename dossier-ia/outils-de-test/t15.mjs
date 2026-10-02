import { chromium } from 'playwright';
import { installCommon, installFirestore, installBooks } from './fsmock.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({viewport:{width:1100,height:1300}}); const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const docs={}; const log=[];
await installCommon(p); await installFirestore(p, docs, log);
await installBooks(p, [
 {id:'d1',volumeInfo:{title:'Dune',authors:['Frank Herbert'],language:'fr',pageCount:800,publishedDate:'2021'}},
 {id:'d2',volumeInfo:{title:'Fondation',authors:['Isaac Asimov'],language:'fr',pageCount:300,publishedDate:'2009'}},
 {id:'d3',volumeInfo:{title:'Hypérion',authors:['Dan Simmons'],language:'fr',publishedDate:'1991'}}]);
const go=h=>p.goto('file:///home/user/Site-test-A/index.html'+h);
// --- Non connecté : bibliothèque locale
await go('#/recherche/all/sf'); await p.waitForSelector('#results .book-card');
await p.click('.book-card[data-id="g-d1"] .book-open'); await p.waitForSelector('[data-lib-status=read]');
await p.click('[data-lib-status=read]'); await p.waitForTimeout(100); await p.click('[data-lib-fav]'); await p.waitForTimeout(100);
console.log('modal statut:', await p.getAttribute('[data-lib-status=read]','aria-pressed'), '| favori:', await p.getAttribute('[data-lib-fav]','aria-pressed'));
await p.click('.lib-lists summary'); await p.fill('#lib-new-list-name','Vacances'); await p.click('.lib-new-list button'); await p.waitForTimeout(150);
console.log('liste cochée:', await p.locator('[data-lib-list]').first().isChecked());
await p.keyboard.press('Escape');
console.log('badge carte Dune:', (await p.textContent('.book-card[data-id="g-d1"] .lib-badges')).trim());
await p.click('.book-card[data-id="g-d2"] .book-open'); await p.click('[data-lib-status=to-read]'); await p.keyboard.press('Escape');
await go('#/bibliotheque/lus'); await p.waitForSelector('.lib-stats');
console.log('stats:', (await p.textContent('.lib-stats')).replace(/\s+/g,' ').trim());
console.log('onglet Lus:', await p.locator('#lib-content .book-title').allTextContents(), '| onglets:', (await p.locator('nav.tag-filter .tag').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')));
await go('#/bibliotheque/listes'); await p.waitForSelector('.list-card'); console.log('liste:', (await p.textContent('.list-card h2')).replace(/\s+/g,' '), await p.locator('.list-card .book-title').allTextContents());
await go('#/bibliotheque/historique'); await p.waitForSelector('#lib-content .book-card'); console.log('historique:', await p.locator('#lib-content .book-title').allTextContents());
await p.screenshot({path:'v12-lib.png', fullPage:true});
// ouvrir un livre depuis la bibliothèque
await p.click('#lib-content .book-open'); await p.waitForSelector('#book-dialog[open]'); console.log('fiche depuis bibliothèque:', await p.textContent('#book-detail h2')); await p.keyboard.press('Escape');
// --- Connexion : import dans le compte
await p.click('#account-area [data-auth=login]'); await p.fill('#auth-email','y@x.fr'); await p.fill('#auth-password','goodpass1'); await p.click('#auth-form button[type=submit]'); await p.waitForTimeout(800);
console.log('écrit dans Firestore:', log.filter(l=>l.includes('library')||l.includes('lists')));
console.log('local vidé:', await p.evaluate(()=>localStorage.getItem('bibliofr.library')));
await go('#/bibliotheque/a-lire'); await p.waitForTimeout(500); console.log('à lire (compte):', await p.locator('#lib-content .book-title').allTextContents());
// liste publique + partage
await go('#/bibliotheque/listes'); await p.waitForSelector('[data-list-public]'); await p.check('[data-list-public]'); await p.waitForTimeout(300);
const listKey=Object.keys(docs).find(k=>k.includes('/lists/')); console.log('liste publique:', docs[listKey].public);
await go('#/liste/u123/'+listKey.split('/').pop()); await p.waitForSelector('.page-title'); console.log('page liste publique:', await p.textContent('.page-title'), await p.locator('.book-title').allTextContents());
// réglage profil public + affichage
await go('#/compte'); await p.waitForSelector('#show-library'); await p.check('#show-library'); await p.waitForTimeout(300); console.log('showLibrary:', docs['users/u123']?.showLibrary);
await go('#/lecteur/u123'); await p.waitForSelector('#public-library section'); console.log('profil public:', (await p.locator('#public-library h2').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')));
// retirer le statut supprime la fiche
await go('#/bibliotheque/a-lire'); await p.waitForSelector('#lib-content .book-open'); await p.click('#lib-content .book-open'); await p.click('[data-lib-status=to-read]'); await p.waitForTimeout(300);
console.log('suppression fiche vide:', log.filter(l=>l.startsWith('DELETE')));
await p.setViewportSize({width:375,height:800}); await go('#/bibliotheque/lus'); await p.waitForTimeout(300); console.log('mobile hscroll:', await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
console.log('errs', errs); await b.close();
