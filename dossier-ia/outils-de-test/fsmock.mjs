// Simulateur minimal de l'API REST Firestore pour les tests Playwright.
import fs from 'fs';
export const ROOT='projects/demo/databases/(default)/documents';
export function installCommon(p, opts={}) {
  return Promise.all([
    p.route('**/vendor/firebase-app-compat.js', r=>r.fulfill({contentType:'text/javascript',body: opts.fakeAuth===false?'':fs.readFileSync(new URL('./fakefb.js', import.meta.url),'utf8')})),
    p.route('**/vendor/firebase-auth-compat.js', r=>r.fulfill({contentType:'text/javascript',body:''})),
    p.route('**/*.jpg*', r=>r.fulfill({status:404})),
  ]);
}
const val=v=>{ if('stringValue' in v) return v.stringValue; if('booleanValue' in v) return v.booleanValue; if('integerValue' in v) return Number(v.integerValue); if('timestampValue' in v) return v.timestampValue; if('arrayValue' in v) return (v.arrayValue.values||[]).map(val); return null; };
export function installFirestore(p, docs, log=[]) {
  return p.route('https://firestore.googleapis.com/**', r=>{
    const req=r.request(); const u=new URL(req.url()); const m=req.method();
    let path=decodeURIComponent(u.pathname.split('/documents')[1]||''); // "/users/x/library" ou ":runQuery" ou "/users/x:runQuery"
    const isQuery=path.endsWith(':runQuery'); const isCommit=path.endsWith(':commit');
    if(isCommit){ const writes=JSON.parse(req.postData()).writes; for(const w of writes){ if(w.delete){ delete docs[w.delete.split('/documents/')[1]]; continue;} const k=w.update.name.split('/documents/')[1];
        if(w.currentDocument?.exists===false && docs[k]) return r.fulfill({status:409,json:{}});
        const f={...(w.updateMask?docs[k]||{}:{}),...w.update.fields}; for(const t of w.updateTransforms||[]) f[t.fieldPath]={timestampValue:new Date().toISOString()}; docs[k]=f; log.push('commit '+k);} return r.fulfill({json:{}}); }
    if(isQuery){ const parent=path.replace(/:runQuery$/,'').replace(/^\//,''); const q=JSON.parse(req.postData()).structuredQuery; const col=q.from[0].collectionId;
      const prefix=(parent?parent+'/':'')+col+'/';
      let rows=Object.entries(docs).filter(([k])=>k.startsWith(prefix)&&!k.slice(prefix.length).includes('/'));
      const w=q.where;
      if(w?.fieldFilter){ const ff=w.fieldFilter; const target=val(ff.value); rows=rows.filter(([,f])=>{ const x=f[ff.field.fieldPath]?val(f[ff.field.fieldPath]):undefined; return ff.op==='EQUAL'?x===target: ff.op==='GREATER_THAN_OR_EQUAL'? x>=target : true; }); }
      if(w?.compositeFilter){ const lo=val(w.compositeFilter.filters[0].fieldFilter.value); rows=rows.filter(([,f])=>(val(f.nameLower||{stringValue:''})).startsWith(lo)); }
      return r.fulfill({json:rows.length?rows.map(([k,f])=>({document:{name:ROOT+'/'+k,fields:f}})):[{readTime:'x'}]}); }
    path=path.replace(/^\//,'');
    if(m==='GET'){ if(docs[path]) return r.fulfill({json:{name:ROOT+'/'+path,fields:docs[path]}});
      const children=Object.entries(docs).filter(([k])=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/'));
      if(children.length || /\/(library|lists|reviews|users|reports)$/.test(path)) return r.fulfill({json:{documents:children.map(([k,f])=>({name:ROOT+'/'+k,fields:f}))}});
      return r.fulfill({status:404,json:{}}); }
    if(m==='PATCH'){ const f=JSON.parse(req.postData()).fields; docs[path]={...(docs[path]||{}),...f}; log.push('PATCH '+path+' '+Object.keys(f).join(',')); return r.fulfill({json:{name:ROOT+'/'+path,fields:docs[path]}}); }
    if(m==='POST'){ const id=u.searchParams.get('documentId'); const k=path+'/'+id; if(docs[k]) return r.fulfill({status:409,json:{}}); docs[k]=JSON.parse(req.postData()).fields; log.push('CREATE '+k); return r.fulfill({json:{name:ROOT+'/'+k,fields:docs[k]}}); }
    if(m==='DELETE'){ delete docs[path]; log.push('DELETE '+path); return r.fulfill({json:{}}); }
  });
}
export function installBooks(p, items) {
  return Promise.all([
    p.route('https://www.googleapis.com/**', r=>r.fulfill({json:{totalItems:items.length,items}})),
    p.route('https://openlibrary.org/**', r=>r.fulfill({json:{numFound:0,docs:[]}})),
  ]);
}
