#!/usr/bin/env node
// lire-classeur-xlsx — verbe (TF-1226, 02/10/2026, option décidée D-51 (a)) : LIT un classeur
// Excel BINAIRE authentique (.xlsx, archive ZIP Office Open XML — ECMA-376) et en extrait
// feuilles + cellules. Générateur, pas un oracle.
//
// POURQUOI CE VERBE. Les lecteurs livrés le 14/09 lisent des formats déjà TEXTE (TMDL, PBIR,
// CSV) ; aucun n'ouvrait les fichiers BINAIRES que les clients remettent RÉELLEMENT (vu dans
// traduire-modele-semantique.mjs : « pas un classeur .pbix binaire » était un refus EXPLICITE,
// jamais un lecteur). Un .xlsx EST une archive ZIP contenant du XML documenté : zéro dépendance
// nécessaire — lecteur ZIP maison `lib-zip-minimal.mjs`, DEFLATE porté nativement par
// `zlib.inflateRawSync`.
//
// CE QUI EST LU, dans cet ordre : xl/workbook.xml (nom et ordre des feuilles, `r:id`) ;
// xl/_rels/workbook.xml.rels (relie chaque feuille à son fichier xl/worksheets/sheetN.xml) ;
// xl/sharedStrings.xml (chaînes partagées — OOXML ne répète JAMAIS un texte inline par défaut,
// une cellule `t="s"` porte un INDEX dans cette table) ; puis chaque feuille, cellule par
// cellule (`<c r="A1" t="...">`). Types lus : `s` (chaîne partagée, par index), `b` (booléen),
// `str` (résultat de formule mis en cache, en texte), et NU (nombre — type `n` par défaut, ou
// date Excel en epoch-jours, non convertie ici : lue telle quelle, sans heuristique).
//
// CE QUE CE LECTEUR NE FAIT PAS, ASSUMÉ ET DIT : styles, formats d'affichage, graphiques,
// tableaux croisés, macros (hors du mandat — extraire feuilles + cellules) ; `inlineStr`
// (texte inline rare, vit dans `<is><t>`, jamais dans `<v>` — cellule alors ABSENTE du résultat,
// jamais mal lue) ; une formule n'est JAMAIS rejouée, seule sa valeur mise en cache (`<v>`) est
// rendue. Une archive ZIP64, chiffrée, ou sans `xl/workbook.xml` est REFUSÉE (exit 2).
//
// Usage : node lire-classeur-xlsx.mjs <classeur.xlsx> [--sortie <fichier.json>] [--json-only]
// Codes : 0 lecture faite ; 1 échec d'écriture disque ; 2 fichier absent / pas une archive ZIP /
// pas un classeur .xlsx reconnaissable (xl/workbook.xml absent).
import fs from "node:fs";
import path from "node:path";
import { lireArchiveZip } from "./lib-zip-minimal.mjs";

const VERBE = "lire-classeur-xlsx";
const DOM = "Lecture d'un classeur Excel binaire (.xlsx, archive ZIP OOXML) — feuilles et cellules (TF-1226)";

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const jsonOnly = args.includes("--json-only");
const source = args.find(a => !a.startsWith("--"));
const sortieArg = opt("--sortie");

const sortir = (sortie, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ verbe: VERBE, domaine: DOM, source: source || null, sortie, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};

if (!source || !fs.existsSync(source) || !fs.statSync(source).isFile())
  sortir("ECHEC", 2, { erreur: `fichier introuvable : ${source}` });

let zip;
try {
  zip = lireArchiveZip(fs.readFileSync(source));
} catch (e) {
  sortir("ECHEC", 2, { erreur: `archive ZIP illisible : ${e.message}` });
}

if (!zip.existe("xl/workbook.xml"))
  sortir("ECHEC", 2, { erreur: "xl/workbook.xml absent de l'archive — pas un classeur .xlsx reconnaissable (OOXML)" });

// ---------- XML minimal, par expressions régulières — pas de dépendance tierce (R-29) --------
// Suffisant : les parts lues ici n'imbriquent jamais d'attribut contenant un « > » non échappé,
// et aucune des trois ne porte de CDATA (hors périmètre, non observé dans un export réel).
const attr = (attrsOuTag, nom) => { const m = attrsOuTag.match(new RegExp(`${nom}="([^"]*)"`)); return m ? m[1] : null; };
const decoderEntites = s => String(s ?? "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// xl/workbook.xml : ordre et nom des feuilles, identifiant de relation
const workbookXml = zip.lire("xl/workbook.xml").toString("utf8");
const feuillesDeclarees = [...workbookXml.matchAll(/<sheet\b([^>]*?)\/>/g)].map(m => ({
  nom: decoderEntites(attr(m[1], "name")),
  rId: attr(m[1], "r:id"),
}));
if (!feuillesDeclarees.length)
  sortir("ECHEC", 2, { erreur: "xl/workbook.xml ne déclare aucune feuille — classeur vide ou illisible" });

// xl/_rels/workbook.xml.rels : rId -> chemin (relatif à xl/) du fichier worksheets/sheetN.xml
const relations = new Map();
if (zip.existe("xl/_rels/workbook.xml.rels")) {
  const relsXml = zip.lire("xl/_rels/workbook.xml.rels").toString("utf8");
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*?)\/>/g)) {
    const id = attr(m[1], "Id");
    const cible = attr(m[1], "Target");
    if (id && cible) relations.set(id, cible.replace(/^\//, ""));
  }
}

// xl/sharedStrings.xml : chaînes partagées référencées par INDEX depuis les cellules t="s"
const sharedStrings = [];
if (zip.existe("xl/sharedStrings.xml")) {
  const sstXml = zip.lire("xl/sharedStrings.xml").toString("utf8");
  for (const m of sstXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    // un <si> porte un <t> simple OU plusieurs <r><t> (texte enrichi, plusieurs « runs ») — la
    // valeur affichée CONCATÈNE tous les <t> trouvés, jamais le seul premier.
    const textes = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => decoderEntites(t[1]));
    sharedStrings.push(textes.join(""));
  }
}

const feuilles = [];
let totalCellules = 0;
for (const f of feuillesDeclarees) {
  const cible = f.rId ? relations.get(f.rId) : null;
  const chemin = cible ? `xl/${cible}` : null;
  if (!chemin || !zip.existe(chemin)) {
    feuilles.push({ nom: f.nom, cellules: {}, avertissement: "fichier de feuille introuvable dans l'archive (relation absente ou rompue)" });
    continue;
  }
  const sheetXml = zip.lire(chemin).toString("utf8");
  const cellules = {};
  // Une cellule est soit auto-fermante (`<c .../>`, toujours vide — aucune valeur à lire), soit
  // porteuse d'un corps (`<c ...>…</c>`) dans lequel une balise <v> optionnelle porte la valeur.
  // Pas de <v> = cellule stylée mais vide : jamais une valeur inventée.
  for (const m of sheetXml.matchAll(/<c\b([^>]*?)\/>|<c\b([^>]*?)>([\s\S]*?)<\/c>/g)) {
    const attrsStr = m[1] !== undefined ? m[1] : m[2];
    const corps = m[3] || "";
    const ref = attr(attrsStr, "r");
    if (!ref) continue;
    const type = attr(attrsStr, "t");
    const vMatch = corps.match(/<v>([\s\S]*?)<\/v>/);
    if (!vMatch) continue; // auto-fermante, ou inlineStr (texte dans <is><t>, pas dans <v>) : non lue, dit plus haut
    const brut = decoderEntites(vMatch[1]);
    let valeur;
    if (type === "s") valeur = sharedStrings[Number(brut)] ?? null;
    else if (type === "b") valeur = brut === "1";
    else if (type === "str") valeur = brut; // résultat de formule mis en cache, en texte
    else valeur = Number(brut); // type « n » par défaut (ou absent) : nombre, ou date epoch-jours non convertie
    cellules[ref] = valeur;
    totalCellules++;
  }
  feuilles.push({ nom: f.nom, cellules });
}

const doc = {
  format: "forge-data/classeur-lu@1",
  source: path.relative(process.cwd(), source).replace(/\\/g, "/") || source,
  feuilles,
};

let fichierProduit = null;
if (sortieArg) {
  try { fs.writeFileSync(sortieArg, JSON.stringify(doc, null, 2) + "\n"); }
  catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); }
  fichierProduit = sortieArg;
}

sortir("OK", 0, {
  compte: { feuilles: feuilles.length, cellules: totalCellules, chaines_partagees: sharedStrings.length },
  fichier_produit: fichierProduit,
  document: fichierProduit ? undefined : doc,
});
