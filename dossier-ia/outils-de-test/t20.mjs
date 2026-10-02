import { chromium } from 'playwright';
import { installCommon, installFirestore } from './fsmock.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({viewport:{width:1280,height:900}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const enc=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k, typeof v==='number'?{integerValue:String(v)}:{stringValue:v}]));
const docs={ 'users/u999': {...enc({name:'Marie Lit',nameLower:'marie lit',photoURL:''}),createdAt:{timestampValue:'2026-03-01T00:00:00Z'}}, 'usernames/marie lit': enc({uid:'u999'}),
  'reviews/u999__dune|herbert': {...enc({uid:'u999',bookKey:'dune|herbert',title:'Dune',rating:5,name:'Marie Lit',comment:'Chef-d’œuvre'}),createdAt:{timestampValue:new Date().toISOString()}} };
const log=[]; await installCommon(p); await installFirestore(p, docs, log);
await p.route('https://www.googleapis.com/**', r=>{ const u=r.request().url(); if(u.includes('/volumes/abc123')) return r.fulfill({json:{id:'abc123',volumeInfo:{title:'Le Petit Prince',authors:['Antoine de Saint-Exupéry'],language:'fr',description:'Un aviateur…'}}});
  r.fulfill({json:{totalItems:1,items:[{id:'d1',volumeInfo:{title:'Dune',authors:['Frank Herbert'],language:'fr'}}]}}); });
await p.route('https://openlibrary.org/**', r=>r.fulfill({json:{numFound:0,docs:[]}}));
await p.route('https://catalogue.bnf.fr/**', r=>r.abort('failed'));
const go=h=>p.goto('file:///home/user/Site-test-A/index.html'+h);
await go('#/genres'); await p.waitForSelector('.genre-card');
console.log('menu courant:', await p.textContent('.main-nav a[aria-current=page]'));
await p.keyboard.press('Tab'); console.log('1er Tab →', await p.evaluate(()=>document.activeElement.textContent.trim()));
await p.keyboard.press('Enter'); console.log('focus après lien d\'évitement:', await p.evaluate(()=>document.activeElement.id), '| page inchangée:', await p.evaluate(()=>location.hash));
await p.screenshot({path:'v20-header-desktop.png', clip:{x:0,y:0,width:1280,height:160}});
await go('#/a-propos'); await p.waitForSelector('.about'); console.log('à propos:', await p.locator('.about h2').allTextContents());
// lien partagé
await go('#/livre/g-abc123'); await p.waitForSelector('#book-dialog[open]'); console.log('lien partagé → fiche:', await p.textContent('#book-detail h2'), '| meta:', await p.getAttribute('meta[name=description]','content'));
await p.keyboard.press('Escape'); await p.waitForTimeout(200); console.log('après fermeture:', await p.evaluate(()=>location.hash));
// suivre + fil
await p.click('#account-area [data-auth=login]'); await p.fill('#auth-email','y@x.fr'); await p.fill('#auth-password','goodpass1'); await p.click('#auth-form button[type=submit]'); await p.waitForTimeout(800);
console.log('lien Fil visible:', await p.isVisible('#feed-link'));
await go('#/lecteur/u999'); await p.waitForSelector('#follow-btn'); console.log('profil:', (await p.textContent('#follow-box')).replace(/\s+/g,' ').trim());
await p.click('#follow-btn'); await p.waitForSelector('#follow-btn[aria-pressed=true]'); console.log('après suivre:', (await p.textContent('#follow-box')).replace(/\s+/g,' ').trim(), '| docs:', !!docs['users/u123/following/u999'], !!docs['users/u999/followers/u123']);
await p.evaluate(()=>updateFeedBadge()); await p.waitForTimeout(500); console.log('pastille:', await p.textContent('#feed-link .nav-badge'), 'visible', await p.isVisible('#feed-link .nav-badge'));
await go('#/fil'); await p.waitForSelector('.feed-item'); console.log('fil:', (await p.textContent('.feed-item')).replace(/\s+/g,' ').trim());
await p.waitForTimeout(300); console.log('pastille après visite visible:', await p.isVisible('#feed-link .nav-badge'), await p.evaluate(async()=>({seen:getFeedSeen(currentUser().uid), items:(await feedItems(currentUser())).map(r=>[r.createdAt,r.updatedAt])})));
await go('#/lecteur/u999'); await p.waitForSelector('#follow-btn'); await p.click('#follow-btn'); await p.waitForSelector('#follow-btn[aria-pressed=false]'); console.log('ne plus suivre:', !docs['users/u123/following/u999'], !docs['users/u999/followers/u123']);
await p.setViewportSize({width:375,height:800}); await go('#/'); await p.waitForTimeout(500);
console.log('mobile hscroll:', await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)); await p.screenshot({path:'v20-mobile.png'});
console.log('errs', errs); await b.close();
