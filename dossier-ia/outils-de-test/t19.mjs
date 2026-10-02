import { chromium } from 'playwright';
import { installCommon, installFirestore } from './fsmock.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const SRU=`<?xml version="1.0" encoding="UTF-8"?><srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/"><srw:numberOfRecords>2</srw:numberOfRecords><srw:records>
<srw:record><srw:recordData><oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>Le petit prince / Antoine de Saint-Exupéry ; avec des aquarelles de l'auteur</dc:title><dc:creator>Saint-Exupéry, Antoine de (1900-1944). Auteur du texte</dc:creator>
<dc:publisher>Paris : Gallimard</dc:publisher><dc:date>2026</dc:date><dc:identifier>ISBN 978-2-07-061275-8</dc:identifier><dc:identifier>https://catalogue.bnf.fr/ark:/12148/cb47000001x</dc:identifier><dc:type>texte imprimé</dc:type></oai_dc:dc></srw:recordData></srw:record>
<srw:record><srw:recordData><oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>Agenda scolaire 2026</dc:title><dc:creator>X</dc:creator></oai_dc:dc></srw:recordData></srw:record>
</srw:records></srw:searchRetrieveResponse>`;
for (const mode of ['ok','cors']) {
  const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await installCommon(p,{fakeAuth:false});
  let bnfCalls=0;
  await p.route('https://www.googleapis.com/**', r=>r.fulfill({json:{totalItems:1,items:[{id:'g1',volumeInfo:{title:'Le Petit Prince',authors:['Antoine de Saint-Exupéry'],language:'fr',publishedDate:'1999'}}]}}));
  await p.route('https://openlibrary.org/**', r=>r.fulfill({json:{numFound:0,docs:[]}}));
  await p.route('https://catalogue.bnf.fr/**', r=>{ bnfCalls++; return mode==='ok' ? r.fulfill({contentType:'application/xml', body:SRU}) : r.abort('failed'); });
  await p.goto('file:///home/user/Site-test-A/index.html#/recherche/all/petit%20prince'); await p.waitForSelector('#results .book-card');
  console.log(`[${mode}] résultats:`, await p.locator('#results .book-title').allTextContents(), '|', await p.textContent('#results-count'));
  if (mode==='ok') { await p.click('.book-open'); console.log('  fiche:', (await p.textContent('#book-detail .meta')).replace(/\s+/g,' '), '|', await p.textContent('#book-detail .small a')); }
  await p.goto('file:///home/user/Site-test-A/index.html#/recherche/all/dune'); await p.waitForSelector('#results .book-card');
  console.log(`  appels BnF sur 2 recherches: ${bnfCalls}`, 'errs', errs); await p.close();
}
await b.close();
