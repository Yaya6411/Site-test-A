import { chromium } from 'playwright';
import fs from 'fs';
const R='/home/user/Site-test-A/'; const svg=fs.readFileSync(R+'icon.svg','utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const n of [180,192,512]) { const p=await b.newPage({viewport:{width:n,height:n}}); await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${n}px;height:${n}px}</style>${svg}`); await p.screenshot({path: R+(n===180?'apple-touch-icon.png':`icon-${n}.png`)}); await p.close(); }
const p=await b.newPage({viewport:{width:1200,height:630}});
await p.setContent(`<style>html,body{margin:0;width:1200px;height:630px;font-family:system-ui,sans-serif}
.c{width:100%;height:100%;box-sizing:border-box;padding:80px 90px;background:linear-gradient(135deg,#faf7f2 0%,#f6e4dd 100%);display:flex;flex-direction:column;justify-content:center;gap:28px;position:relative;overflow:hidden}
.t{display:flex;align-items:center;gap:26px;font-size:92px;font-weight:800;color:#1f1d1a}.t span{color:#b5452b}.t svg{width:110px;height:110px}
.s{font-size:40px;color:#4a453e;max-width:900px;line-height:1.3}
.tags{display:flex;gap:14px;flex-wrap:wrap}.tags b{font-size:26px;font-weight:600;background:#fff;border:2px solid #e6e0d6;border-radius:999px;padding:8px 20px;color:#1f1d1a}
.deco{position:absolute;right:-60px;bottom:-60px;width:420px;height:420px;border-radius:50%;background:#b5452b;opacity:.08}</style>
<div class="c"><div class="deco"></div><div class="t">${svg}<div>Biblio<span>FR</span></div></div>
<div class="s">Le catalogue des livres en français : trouvez, notez, partagez.</div>
<div class="tags"><b>Romans</b><b>Mangas</b><b>BD</b><b>Essais</b><b>Jeunesse</b></div></div>`);
await p.screenshot({path:R+'og-image.png'}); await b.close();
