import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({viewport:{width:1100,height:1200}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.route('**/vendor/*.js', r=>r.fulfill({contentType:'text/javascript',body:''}));
await p.route('**/*.jpg*', r=>r.fulfill({status:404}));
await p.route('https://www.googleapis.com/**', r=>{ const q=new URL(r.request().url()).searchParams.get('q');
  if(q.includes('zzzz')||q.includes('harri')) return r.fulfill({json:{totalItems:0}});
  r.fulfill({json:{totalItems:50,items:[
   {id:'g1',volumeInfo:{title:'Le roman policier',authors:['Yves Reuter'],language:'fr',categories:['Literary Criticism'],publishedDate:'2017'}},
   {id:'g2',volumeInfo:{title:'Nymphéas noirs',authors:['Michel Bussi'],language:'fr',categories:['Fiction / Mystery & Detective'],publishedDate:'2011',industryIdentifiers:[{type:'ISBN_13',identifier:'9782266211192'}]}},
   {id:'g3',volumeInfo:{title:'Glacé',authors:['Bernard Minier'],language:'fr',categories:['Fiction / Thrillers'],publishedDate:'2011'}},
   {id:'g4',volumeInfo:{title:'Fiche de lecture : Glacé',authors:['X'],language:'fr',publishedDate:'2020'}},
   {id:'g5',volumeInfo:{title:'Pars vite et reviens tard',authors:['Fred Vargas'],language:'fr',categories:['Fiction'],publishedDate:'2001'}},
   {id:'g6',volumeInfo:{title:'Le Syndrome E',authors:['Franck Thilliez'],language:'fr',categories:['Fiction'],publishedDate:'2010'}},
   {id:'g7',volumeInfo:{title:'Sharko',authors:['Franck Thilliez'],language:'fr',categories:['Fiction'],publishedDate:'2017'}},
   {id:'g8',volumeInfo:{title:'Le Manuscrit inachevé',authors:['Franck Thilliez'],language:'fr',categories:['Fiction'],publishedDate:'2018'}},
  ]}}); });
await p.route('https://openlibrary.org/**', r=>r.fulfill({json:{numFound:2,docs:[
  {key:'/works/OL1W',title:'Nymphéas noirs (Pocket)',author_name:['Michel Bussi'],subject:['Fiction'],editions:{docs:[{key:'/books/OL1M',title:'Nymphéas noirs (Pocket)',isbn:['9782266211192'],cover_i:5}]}},
  {key:'/works/OL2W',title:'Some English book',author_name:['Anon'],language:['eng']}]}}));
await p.goto('file:///home/user/Site-test-A/index.html#/genre/policier'); await p.waitForSelector('#results .book-card');
const titles=await p.locator('#results .book-title').allTextContents(); console.log('genre policier:', titles);
console.log('count:', await p.textContent('#results-count'));
console.log('filters visible:', await p.isVisible('#filters'), '| selects:', await p.locator('#filters select').count());
await p.selectOption('[data-filter=author]', 'Franck Thilliez'); console.log('after author filter:', await p.locator('#results .book-title').allTextContents(), '|', await p.textContent('#results-count'));
await p.selectOption('[data-filter=year]', '2010'); console.log('+ year 2010-2019:', await p.locator('#results .book-title').allTextContents());
await p.click('#filters [data-reset-filters]'); console.log('reset:', await p.locator('#results .book-card').count());
await p.screenshot({path:'v11-filters.png'});
// autocomplete
await p.click('#search-input'); await p.keyboard.type('vict hu'); await p.waitForSelector('.ac-list li');
console.log('autocomplete:', (await p.locator('.ac-list li').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')));
await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(200); console.log('picked ->', await p.evaluate(()=>location.hash));
// no results
await p.goto('file:///home/user/Site-test-A/index.html#/recherche/all/zzzz%20harri%20poter'); 
await p.route('https://openlibrary.org/**', r=>r.fulfill({json:{numFound:0,docs:[]}}));
await p.goto('file:///home/user/Site-test-A/index.html#/recherche/all/harri%20poterr'); await p.waitForSelector('.no-results');
console.log('no results:', (await p.textContent('.no-results')).replace(/\s+/g,' ').trim().slice(0,200));
await p.setViewportSize({width:375,height:800}); await p.goto('file:///home/user/Site-test-A/index.html#/genre/thriller'); await p.waitForSelector('#results .book-card');
console.log('mobile hscroll:', await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)); await p.screenshot({path:'v11-mobile.png'});
console.log('errs', errs); await b.close();
