import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
for (const [label, opts, theme] of [['système sombre',{colorScheme:'dark'},null],['bouton sombre',{colorScheme:'light'},'dark'],['clair',{colorScheme:'light'},null]]) {
  const p = await b.newPage({viewport:{width:1440,height:900}, ...opts});
  await p.route('**/vendor/*.js', r=>r.fulfill({contentType:'text/javascript',body:''}));
  await p.route(/googleapis|openlibrary|bnf|fonts\.g/, r=>r.fulfill({json:{}}));
  await p.goto('file:///home/user/Site-test-A/index.html#/');
  if (theme) await p.evaluate(t=>document.documentElement.dataset.theme=t, theme);
  await p.waitForTimeout(300);
  const info = await p.evaluate(()=>{ const cs=(s,prop='color')=>{const e=document.querySelector(s); return e?getComputedStyle(e)[prop]:'-'};
    return { body:cs('body','backgroundColor'), header:cs('.site-header','backgroundColor'), nav:cs('.main-nav a'), navSpan:cs('.main-nav a span:last-child'), themeBtn:cs('#theme-btn'), logo:cs('.logo-text strong'), hero:cs('.home-hero','backgroundColor'), heroH1:cs('.home-hero h1'), heroLead:cs('.hero-lead'), catText:cs('.home-category-copy strong'), main:cs('#app','backgroundColor') }; });
  console.log(label, JSON.stringify(info));
  await p.close();
}
await b.close();
