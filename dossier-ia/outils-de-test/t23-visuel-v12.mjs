import { chromium } from 'playwright';
import { installCommon } from './fsmock.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const items=Array.from({length:12},(_,i)=>({id:'b'+i,volumeInfo:{title:['Dune','Fondation','Le Petit Prince','One Piece','Les Misérables','L\'Étranger'][i%6]+(i>5?' tome '+i:''),authors:[['Frank Herbert','Isaac Asimov','Antoine de Saint-Exupéry','Eiichiro Oda','Victor Hugo','Albert Camus'][i%6]],language:'fr',publishedDate:'2026'}}));
async function shot(name, w, h, scheme, hash='#/') {
  const p = await b.newPage({viewport:{width:w,height:h}, colorScheme:scheme}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const failed=[]; p.on('requestfailed', r=>{ const u=r.url(); if(u.startsWith('file:')) failed.push(u.split('Site-test-A/')[1]); });
  await p.route('**/vendor/*.js', r=>r.fulfill({contentType:'text/javascript',body:''})); await p.route(/^https:\/\/(books\.google|covers\.openlibrary|images-na)/, r=>r.fulfill({status:404,body:''}));
  await p.route('https://www.googleapis.com/**', r=>r.fulfill({json:{totalItems:12,items}}));
  await p.route(/openlibrary|bnf|fonts\.g/, r=>r.fulfill({status:404,body:''}));
  await p.goto('file:///home/user/Site-test-A/index.html'+hash); await p.waitForTimeout(4000);
  const hs=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  await p.screenshot({path:name, fullPage: hash==='#/' });
  console.log(name, '| hscroll', hs, '| fichiers locaux manquants', failed, '| errs', errs);
  return p;
}
await shot('v12-home-desktop.png',1440,900,'light');
await shot('v12-home-mobile.png',375,800,'light');
await shot('v12-home-dark.png',1440,900,'dark');
const p = await shot('v12-genres.png',1440,900,'light','#/genres');
// bascule de thème
await p.click('#theme-btn'); console.log('thème après clic:', await p.evaluate(()=>document.documentElement.dataset.theme), await p.getAttribute('#theme-btn','aria-label'));
await p.screenshot({path:'v12-toggle.png'});
await shot('v12-results-mobile.png',375,800,'light','#/recherche/all/dune');
await b.close();
