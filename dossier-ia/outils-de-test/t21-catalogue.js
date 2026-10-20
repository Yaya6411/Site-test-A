/* Tests ciblés du repli de recherche catalogue, sans réseau réel. Exécution : node t21-catalogue.js */
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = process.env.SITE_DIR || path.resolve(__dirname, "../..");
const calls = [];
const fakeItem = {
  id: "manga-fr-1",
  volumeInfo: {
    title: "Un manga en français", authors: ["Auteur Test"], language: "fr",
    publishedDate: "2024", industryIdentifiers: [{ type: "ISBN_13", identifier: "9782010000000" }],
    categories: ["Comics & Graphic Novels / Manga"], imageLinks: {}
  }
};
const ctx = {
  URLSearchParams,
  sessionStorage: { getItem: () => "off", setItem() {} },
  fetch: async url => {
    const u = new URL(url);
    calls.push(u.searchParams.get("q"));
    if (u.searchParams.get("q") === "manga français") {
      return { ok: true, json: async () => ({ items: [fakeItem], totalItems: 1 }) };
    }
    return { ok: true, json: async () => ({ items: [], totalItems: 0 }) };
  },
  console,
};
vm.createContext(ctx);
vm.runInContext('const PAGE_SIZE=40; const GOOGLE_API_KEY="";', ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/services/sources.js"), "utf8"), ctx, { filename: "sources.js" });
(async () => {
  const result = await vm.runInContext('sources.google.fetch({type:"genre",value:{id:"manga",name:"Mangas",google:"manga",openlibrary:"manga"}},0,"relevance")', ctx);
  if (result.books.length !== 1 || result.books[0].title !== "Un manga en français") throw new Error("Le repli de recherche n'a pas retrouvé le livre simulé.");
  if (calls.length !== 3 || calls[2] !== "manga français") throw new Error(`Séquence de repli inattendue : ${JSON.stringify(calls)}`);
  console.log("OK — une requête de genre vide est suivie de variantes ciblées ; le livre français est récupéré.");
})().catch(err => { console.error(err); process.exitCode = 1; });
