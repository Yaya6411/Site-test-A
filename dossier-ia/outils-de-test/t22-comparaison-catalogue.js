/* Matrice hors réseau pour le repli de recherche catalogue.
 * Exécution depuis n'importe quel dossier : node dossier-ia/outils-de-test/t22-comparaison-catalogue.js
 * Les livres utilisés sont fictifs et ne sont jamais écrits en base.
 */
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "js/services/sources.js"), "utf8");
const cases = [
  { id: "litterature-francaise", name: "Littérature française", google: "french literature", openlibrary: "french literature", expected: "roman français", title: "Roman français de test" },
  { id: "fantasy", name: "Fantasy", google: "fantasy", openlibrary: "fantasy", expected: "fantasy fiction", title: "Fantasy de test" },
  { id: "manga", name: "Mangas", google: "manga", openlibrary: "manga", expected: "manga français", title: "Manga français de test" },
  { id: "bd", name: "BD", google: "comics", openlibrary: "comics", expected: "bande dessinée", title: "BD de test" },
  { id: "jeunesse", name: "Jeunesse", google: "children books", openlibrary: "children", expected: "roman jeunesse français", title: "Roman jeunesse de test" },
  { id: "documentaires-jeunesse", name: "Documentaires jeunesse", google: "children nonfiction", openlibrary: "children", expected: "documentaire jeunesse", title: "Documentaire jeunesse de test" },
];
async function run(query, responseForQuery) {
  const calls = [];
  const ctx = {
    URLSearchParams,
    sessionStorage: { getItem: () => "off", setItem() {} },
    fetch: async url => {
      const q = new URL(url).searchParams.get("q");
      calls.push(q);
      const body = responseForQuery(q);
      return { ok: true, json: async () => body };
    },
    console,
  };
  vm.createContext(ctx);
  vm.runInContext('const PAGE_SIZE=40; const GOOGLE_API_KEY="";', ctx);
  vm.runInContext(source, ctx, { filename: "sources.js" });
  const result = await vm.runInContext(`sources.google.fetch(${JSON.stringify(query)},0,"relevance")`, ctx);
  return { result, calls };
}
const item = title => ({ id: "test-only", volumeInfo: { title, authors: ["Auteur test"], language: "fr", publishedDate: "2024", industryIdentifiers: [{ type: "ISBN_13", identifier: "9782010000000" }], categories: ["Books"], imageLinks: {} } });
(async () => {
  let passed = 0;
  for (const c of cases) {
    const { result, calls } = await run({ type: "genre", value: c }, q => q === c.expected ? { items: [item(c.title)], totalItems: 1 } : { items: [], totalItems: 0 });
    const ok = result.books.length === 1 && result.books[0].title === c.title && calls.includes(c.expected);
    console.log(`${ok ? "PASS" : "FAIL"} | repli ${c.id} | appels=${calls.length} | livre trouvé=${result.books.length}`);
    if (ok) passed++;
  }
  const normal = { id: "fantasy", name: "Fantasy", google: "fantasy", openlibrary: "fantasy" };
  const primary = await run({ type: "genre", value: normal }, q => q === 'subject:"fantasy"' ? { items: [item("Fantasy déjà trouvée")], totalItems: 1 } : { items: [], totalItems: 0 });
  const primaryOk = primary.result.books.length === 1 && primary.calls.length === 1;
  console.log(`${primaryOk ? "PASS" : "FAIL"} | arrêt si la requête principale renvoie un livre | appels=${primary.calls.length}`);
  if (primaryOk) passed++;
  const exact = await run({ type: "title", value: "Titre exact" }, () => ({ items: [], totalItems: 0 }));
  const exactOk = exact.calls.length === 1 && exact.calls[0] === "intitle:Titre exact";
  console.log(`${exactOk ? "PASS" : "FAIL"} | recherche exacte non élargie | appels=${exact.calls.length}`);
  if (exactOk) passed++;
  console.log(`TOTAL ${passed}/${cases.length + 2}`);
  if (passed !== cases.length + 2) process.exitCode = 1;
})().catch(err => { console.error(err); process.exitCode = 1; });
