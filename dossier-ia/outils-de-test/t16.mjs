import { chromium } from 'playwright';
import { installCommon, installFirestore, installBooks } from './fsmock.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({viewport:{width:1100,height:1300}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const enc=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k, typeof v==='number'?{integerValue:String(v)}:typeof v==='boolean'?{booleanValue:v}:{stringValue:v}]));
const docs={
 'usernames/yaya': enc({uid:'someone-else'}),
 'users/u999': {...enc({name:'Marie Lit',nameLower:'marie lit',photoURL:''}),createdAt:{timestampValue:'2026-03-01T00:00:00Z'}},
 'usernames/marie lit': enc({uid:'u999'}),
 'reviews/u999__dune|herbert': {...enc({uid:'u999',bookKey:'dune|herbert',title:'Dune',rating:1,name:'Marie Lit',comment:'SPAM achetez ici'}),createdAt:{timestampValue:'2026-09-30T10:00:00Z'}},
};
const log=[];
await installCommon(p); await installFirestore(p, docs, log);
await installBooks(p, [{id:'d1',volumeInfo:{title:'Dune',authors:['Frank Herbert'],language:'fr'}}]);
const go=h=>p.goto('file:///home/user/Site-test-A/index.html'+h);
await go('#/recherche/all/dune'); await p.waitForSelector('#account-area [data-auth=login]');
// inscription avec pseudo pris
await p.click('#account-area [data-auth=login]'); await p.click('#auth-content [data-auth=signup]');
await p.fill('#auth-name','Yaya'); await p.fill('#auth-email','n@x.fr'); await p.fill('#auth-password','motdepasse'); await p.fill('#auth-password2','motdepasse');
await p.click('#auth-form button[type=submit]'); await p.waitForTimeout(300); console.log('pseudo pris:', await p.textContent('#auth-form .form-error'));
await p.fill('#auth-name','a/b'); await p.click('#auth-form button[type=submit]'); await p.waitForTimeout(100); console.log('pseudo invalide:', await p.textContent('#auth-form .form-error'));
await p.fill('#auth-name','Yaya Lectrice'); await p.click('#auth-form button[type=submit]'); await p.waitForTimeout(800);
console.log('réservation:', log.filter(l=>l.startsWith('commit')), '| username doc:', JSON.stringify(docs['usernames/yaya lectrice']));
// e-mail non vérifié
await p.click('.book-open'); await p.waitForSelector('[data-verify]'); console.log('blocage e-mail:', (await p.textContent('.review-login p')).trim());
await p.click('[data-verify=check]'); await p.waitForTimeout(200); console.log('pas encore:', await p.textContent('.review-login .form-msg'));
await p.evaluate(()=>{window.__verifyOnReload=true;}); await p.click('[data-verify=check]'); await p.waitForSelector('.review-form'); console.log('vérifié → formulaire affiché');
await p.click('label[for=rate-4]'); await p.fill('#review-comment','Très bien'); await p.click('.review-form button[type=submit]'); await p.waitForTimeout(300);
const mine=Object.keys(docs).find(k=>k.startsWith('reviews/u123')); console.log('avis créé:', mine, '| createdAt serveur:', !!docs[mine]?.createdAt?.timestampValue);
// signaler l'avis de Marie
await p.click('[data-report-review]'); await p.selectOption('.report-form select','spam'); await p.click('.report-form button[type=submit]'); await p.waitForTimeout(300);
console.log('signalement:', (await p.textContent('.report-form')).trim(), '|', Object.keys(docs).filter(k=>k.startsWith('reports/')));
await p.keyboard.press('Escape');
// changement de pseudo
await go('#/compte'); await p.waitForSelector('#profile-name'); await p.fill('#profile-name','Marie Lit'); await p.click('#profile-form button[type=submit]'); await p.waitForTimeout(300);
console.log('renommer en pseudo pris:', await p.textContent('#profile-form .form-msg'));
await p.fill('#profile-name','Yaya Nouvelle'); await p.click('#profile-form button[type=submit]'); await p.waitForTimeout(600);
console.log('renommer OK:', await p.textContent('#profile-form .form-msg'), '| ancien libéré:', !docs['usernames/yaya lectrice'], '| nouveau:', !!docs['usernames/yaya nouvelle'], '| avis renommé:', docs[mine].name.stringValue);
// avatar
await p.click('[data-avatar="🦊"]'); await p.waitForTimeout(300); console.log('avatar:', docs['users/u123'].avatar?.stringValue, '| en-tête:', (await p.textContent('#account-area')).trim());
// administrateur
docs['admins/u123']={};
await p.evaluate(()=>{ adminState={uid:null,value:false}; checkAdmin(currentUser()); }); await p.waitForSelector('#admin-link');
await go('#/moderation'); await p.waitForSelector('.mod-row'); console.log('modération:', (await p.textContent('.mod-row')).replace(/\s+/g,' ').trim());
await p.click('.mod-row [data-mod=hide]'); await p.waitForTimeout(500); console.log('masqué:', docs['reviews/u999__dune|herbert'].hidden);
await p.screenshot({path:'v13-mod.png', fullPage:true});
await p.click('.mod-row [data-mod=dismiss]').catch(()=>{}); await p.waitForTimeout(400); console.log('signalements restants:', Object.keys(docs).filter(k=>k.startsWith('reports/')).length);
// visiteur normal ne voit plus l'avis masqué
delete docs['admins/u123']; await p.evaluate(()=>{ adminState={uid:null,value:false}; });
await go('#/recherche/all/dune'); await p.click('.book-open'); await p.waitForSelector('.reviews-summary'); await p.waitForTimeout(300);
console.log('avis visibles (non admin):', (await p.locator('.review-list li').allInnerTexts()).map(t=>t.replace(/\s+/g,' ').slice(0,40)));
console.log('errs', errs); await b.close();
