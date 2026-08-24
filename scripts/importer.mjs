#!/usr/bin/env node
// importer — verbe « importer » (TF-0139) : parseur d'un schéma EXPORTÉ en texte → BROUILLON
// de forge-data/assertions@1 ET forge-data/contrat@1. Ce verbe PRODUIT, il ne juge pas :
// c'est un GÉNÉRATEUR, pas un oracle. La preuve de justesse est en boucle : le brouillon
// produit doit ensuite PASSER oracle-profiler / oracle-contractualiser sans retouche
// (round-trip vérifié par oracles/self-test.mjs).
//
// Dialecte couvert v0 : Postgres — DDL SQL (format `pg_dump --schema-only` en premier, cf.
// references/profils-moteur/postgres.md). JAMAIS de connexion : l'entrée est toujours un
// fichier .sql déjà exporté par un humain ou un outil tiers (loi n°4 : l'exécutable ne se
// connecte pas à une base).
//
// Correspondances dialecte Postgres :
//   NOT NULL (colonne) / PRIMARY KEY               → assertion non_nul
//   CHECK (col >= a AND col <= b) / BETWEEN a AND b → assertion bornes {min, max}
//   CHECK (col IN (...)) / col = ANY (ARRAY[...])   → assertion ensemble {valeurs}
//     (la forme `= ANY (ARRAY[...])` est la façon dont pg_dump réécrit un CHECK IN — les
//     deux formes sont reconnues)
//   UNIQUE / PRIMARY KEY (colonne seule)            → assertion unique
//   colonnes + types                                → contrat@1 schema[].proprietes[]
//   COMMENT ON TABLE/COLUMN … IS '…'                → contrat@1 `description` (TF-0585)
//
// Limites assumées, jamais silencieuses (remontées en `avertissements` de la sortie) :
//   - clés composites (PRIMARY KEY / UNIQUE sur plusieurs colonnes) : NOT NULL par colonne
//     est dérivé, mais aucune assertion "unique" n'est produite (le format assertions@1 ne
//     porte qu'un seul objet par assertion — pas de clé composite) ;
//   - CHECK portant sur plusieurs colonnes, ou motif non reconnu : ignoré et signalé, jamais
//     converti à l'aveugle ;
//   - FOREIGN KEY : sa CONVERSION reste hors périmètre assertions@1/contrat@1 v0, signalée ; sa
//     CIBLE est en revanche vérifiée — une clé qui référence une table absente du schéma est
//     dénoncée comme ORPHELINE (TF-0584), parce qu'un objet encore référencé n'est pas un objet
//     hors périmètre : c'est un constat à livrer ;
//   - type de colonne hors mapping connu : repli "string" avec avertissement explicite ;
//   - sla / propriétaire / version / statut du contrat@1 ne se déduisent PAS d'un DDL : le
//     brouillon pose des valeurs placeholder explicites et un statut "brouillon" — jamais un
//     contrat qui s'auto-déclare engagé. Complétion humaine obligatoire avant usage réel.
//   - littéral de chaîne (DEFAULT '...') contenant par coïncidence un mot-clé de contrainte
//     (« UNIQUE », « NOT NULL ») : risque de faux positif non filtré en v0 (repérage par
//     regex sur la clause entière, pas par analyseur lexical complet).
//
//
// LE COMMENTAIRE D'UNE COLONNE EST UNE SOURCE DE VÉRITÉ DE PREMIER ORDRE (TF-0585, retour
// SCC_ALX du 24/08), et ce fichier portait la preuve du contraire : sa boucle de lecture rangeait
// `COMMENT ON` avec `GRANT` et `SET` sous « hors périmètre schéma, ignorés ». Ce qui a tranché un
// sujet resté ouvert TROIS TOURS d'analyse n'est ni une jointure ni un décompte : c'est le
// commentaire porté par une colonne de code, qui déclarait en toutes lettres de quel système ce
// code était repris. Un commentaire peut nommer l'AMONT d'une colonne, la COMPOSITION d'une clé,
// la CIBLE d'une clé étrangère, la RÈGLE de dérivation d'une valeur — et l'ignorer, c'est jeter la
// seule phrase du schéma écrite par quelqu'un qui savait.
//
// AVEC SON CONTRÔLE, qui coûte trois lignes et paie tout de suite : tout objet NOMMÉ dans un
// commentaire existe-t-il ? Sur le cas fondateur, un commentaire de clé étrangère désignait une
// table sous un nom que le catalogue ne portait pas — et il avait traversé trois revues sans que
// personne le relève. Un commentaire faux est pire qu'un commentaire absent : il se lit avec
// l'autorité du schéma.
//
// Usage : node scripts/importer.mjs <schema.sql> [--sortie-dir <dossier>] [--json-only]
// Sortie : écrit <base>.assertions.json (si au moins une assertion dérivée) et
// <base>.contrat.json (si au moins une table à colonnes), + un manifeste JSON sur stdout
// {verbe, domaine, sortie, ...}. Codes : 0 brouillon produit ; 1 échec d'écriture disque ;
// 2 entrée absente/vide/illisible (aucune table trouvée) — jamais un brouillon inventé.
import fs from "node:fs";
import path from "node:path";

const VERBE = "importer";
const DOM = "Import de schéma exporté (DDL) → brouillon assertions@1 + contrat@1 (dialecte Postgres v0)";
const MOTS_CONTRAINTE = ["NOT", "NULL", "DEFAULT", "UNIQUE", "PRIMARY", "CHECK", "REFERENCES", "COLLATE", "GENERATED", "CONSTRAINT"];
const MAP_TYPE = {
  smallint: "entier", integer: "entier", int: "entier", int4: "entier", bigint: "entier", int8: "entier",
  serial: "entier", bigserial: "entier", smallserial: "entier",
  numeric: "decimal", decimal: "decimal", real: "decimal", "double precision": "decimal", money: "decimal", float4: "decimal", float8: "decimal",
  boolean: "booleen", bool: "booleen",
  date: "date",
  timestamp: "timestamp", "timestamp without time zone": "timestamp", "timestamp with time zone": "timestamp", timestamptz: "timestamp",
  text: "string", "character varying": "string", varchar: "string", character: "string", char: "string", bpchar: "string",
  uuid: "string", json: "string", jsonb: "string", citext: "string", bytea: "string", inet: "string", cidr: "string",
};
const RE_CREATE_TABLE = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."$]+)\s*\(/i;
const RE_ALTER_ADD = /^ALTER\s+TABLE\s+(?:ONLY\s+)?([\w."$]+)\s+ADD\s+CONSTRAINT\s+[\w"$]+\s+([\s\S]+)$/i;
const RE_TABLE_CONSTRAINT = /^(?:CONSTRAINT\s+[\w"$]+\s+)?(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE)\b/i;
const RE_COL = /^"?([A-Za-z_][\w$]*)"?\s+([\s\S]+)$/;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const sortieDirIdx = args.indexOf("--sortie-dir");
const sortieDirArg = sortieDirIdx !== -1 ? args[sortieDirIdx + 1] : null;

const AVERT = [];
const avert = msg => AVERT.push(msg);
const sortir = (sortie, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ verbe: VERBE, domaine: DOM, source: file || null, sortie,
    avertissements: AVERT, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};

if (!file || !fs.existsSync(file)) sortir("ECHEC", 2, { erreur: `fichier introuvable : ${file}` });
const texteBrut = fs.readFileSync(file, "utf8");
if (!texteBrut.trim()) sortir("ECHEC", 2, { erreur: "fichier vide — rien à importer" });

// ---------- Tokenisation minimale, consciente des chaînes '...' et des parenthèses ----------
function retirerCommentaires(sql) {
  let out = "", i = 0, enChaine = false;
  while (i < sql.length) {
    const c = sql[i];
    if (enChaine) {
      out += c;
      if (c === "'") { if (sql[i + 1] === "'") { out += sql[i + 1]; i += 2; continue; } enChaine = false; }
      i++; continue;
    }
    if (c === "'") { enChaine = true; out += c; i++; continue; }
    if (c === "-" && sql[i + 1] === "-") { while (i < sql.length && sql[i] !== "\n") i++; continue; }
    if (c === "/" && sql[i + 1] === "*") { i += 2; while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}
function decouperStatements(sql) {
  const stmts = []; let cur = "", depth = 0, i = 0, enChaine = false;
  while (i < sql.length) {
    const c = sql[i];
    if (enChaine) {
      cur += c;
      if (c === "'") { if (sql[i + 1] === "'") { cur += sql[i + 1]; i += 2; continue; } enChaine = false; }
      i++; continue;
    }
    if (c === "'") { enChaine = true; cur += c; i++; continue; }
    if (c === "(") { depth++; cur += c; i++; continue; }
    if (c === ")") { depth--; cur += c; i++; continue; }
    if (c === ";" && depth === 0) { stmts.push(cur); cur = ""; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) stmts.push(cur);
  return stmts.map(s => s.trim()).filter(Boolean);
}
function splitTopLevel(str, sepChar) {
  const parts = []; let cur = "", depth = 0, enChaine = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (enChaine) {
      cur += c;
      if (c === "'") { if (str[i + 1] === "'") { cur += str[++i]; continue; } enChaine = false; }
      continue;
    }
    if (c === "'") { enChaine = true; cur += c; continue; }
    if (c === "(") { depth++; cur += c; continue; }
    if (c === ")") { depth--; cur += c; continue; }
    if (c === sepChar && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map(s => s.trim()).filter(Boolean);
}
function extraireParenthese(str, debut) {
  let depth = 0, enChaine = false;
  for (let i = debut; i < str.length; i++) {
    const c = str[i];
    if (enChaine) { if (c === "'") { if (str[i + 1] === "'") { i++; continue; } enChaine = false; } continue; }
    if (c === "'") { enChaine = true; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return str.slice(debut + 1, i); }
  }
  return null;
}
function nomTable(brut) {
  return brut.trim().replace(/"/g, "").split(".").pop();
}
function separerTypeEtContraintes(rest) {
  let depth = 0, enChaine = false, i = 0;
  while (i < rest.length) {
    const c = rest[i];
    if (enChaine) { if (c === "'") { if (rest[i + 1] === "'") { i += 2; continue; } enChaine = false; } i++; continue; }
    if (c === "'") { enChaine = true; i++; continue; }
    if (c === "(") { depth++; i++; continue; }
    if (c === ")") { depth--; i++; continue; }
    if (depth === 0) {
      const m = rest.slice(i).match(/^([A-Za-z]+)\b/);
      if (m && MOTS_CONTRAINTE.includes(m[1].toUpperCase())) return { type: rest.slice(0, i).trim(), reste: rest.slice(i).trim() };
    }
    i++;
  }
  return { type: rest.trim(), reste: "" };
}
function normaliserType(t) {
  return t.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function typeContrat(ddlType, table, col) {
  const norm = normaliserType(ddlType);
  if (MAP_TYPE[norm]) return MAP_TYPE[norm];
  avert(`type « ${ddlType.trim()} » (${table}.${col}) non reconnu — repli sur "string", à vérifier`);
  return "string";
}
function analyserContraintesColonne(reste) {
  const r = { notNull: false, unique: false, pk: false, check: null };
  if (/\bPRIMARY\s+KEY\b/i.test(reste)) r.pk = true;
  if (/\bNOT\s+NULL\b/i.test(reste)) r.notNull = true;
  if (/\bUNIQUE\b/i.test(reste)) r.unique = true;
  const mCheck = reste.match(/CHECK\s*\(/i);
  if (mCheck) {
    const idx = reste.search(/CHECK\s*\(/i) + mCheck[0].length - 1;
    const expr = extraireParenthese(reste, idx);
    if (expr !== null) r.check = expr;
  }
  return r;
}
function nettoyerExpr(e) {
  let s = e.replace(/::\s*"?[\w. ]+"?/g, "");
  let prev;
  do { prev = s; s = s.replace(/\(\s*(-?\d+(?:\.\d+)?)\s*\)/g, "$1"); } while (s !== prev);
  s = s.trim();
  while (s.startsWith("(") && s.endsWith(")")) {
    let depth = 0, ok = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")") { depth--; if (depth === 0 && i !== s.length - 1) { ok = false; break; } }
    }
    if (!ok) break;
    s = s.slice(1, -1).trim();
  }
  return s;
}
function extraireValeurs(listeBrut) {
  return splitTopLevel(listeBrut, ",").map(v => {
    let s = v.trim().replace(/::\s*"?[\w. ]+"?/g, "").trim();
    while (s.startsWith("(") && s.endsWith(")")) s = s.slice(1, -1).trim();
    if (/^'.*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  });
}
function analyserCheck(expr) {
  const e = nettoyerExpr(expr);
  let m = e.match(/^\(?\s*"?([A-Za-z_]\w*)"?\s*\)?\s*BETWEEN\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\)?\s*AND\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\)?\s*$/i);
  if (m) return { type: "bornes", colonne: m[1], min: Number(m[2]), max: Number(m[3]) };
  m = e.match(/^\(?\s*"?([A-Za-z_]\w*)"?\s*\)?\s*>=\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\)?\s*\)?\s*AND\s*\(?\s*"?\1"?\s*\)?\s*<=\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\)?\s*\)?\s*$/i);
  if (m) return { type: "bornes", colonne: m[1], min: Number(m[2]), max: Number(m[3]) };
  m = e.match(/^\(?\s*"?([A-Za-z_]\w*)"?\s*\)?\s*<=\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\)?\s*\)?\s*AND\s*\(?\s*"?\1"?\s*\)?\s*>=\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\)?\s*\)?\s*$/i);
  if (m) return { type: "bornes", colonne: m[1], min: Number(m[3]), max: Number(m[2]) };
  m = e.match(/^\(?\s*"?([A-Za-z_]\w*)"?\s*\)?\s*IN\s*\(([\s\S]*)\)\s*\)?$/i);
  if (m) return { type: "ensemble", colonne: m[1], valeurs: extraireValeurs(m[2]) };
  m = e.match(/^\(?\s*\(?\s*"?([A-Za-z_]\w*)"?\s*\)?\s*=\s*ANY\s*\(\s*ARRAY\s*\[([\s\S]*)\]\s*\)\s*\)?$/i);
  if (m) return { type: "ensemble", colonne: m[1], valeurs: extraireValeurs(m[2]) };
  return null;
}

// ---------- Modèle de tables accumulées ----------
const tables = new Map();
function table(nom) {
  if (!tables.has(nom)) tables.set(nom, { colonnes: [], assertionsClefs: new Set(), assertions: [] });
  return tables.get(nom);
}
function ajouterAssertion(t, objet, type, params = {}) {
  const cle = `${objet}|${type}|${JSON.stringify(params)}`;
  if (t.assertionsClefs.has(cle)) return;
  t.assertionsClefs.add(cle);
  t.assertions.push({ objet, type, ...params });
}

function traiterContrainteTable(def, t, nomT) {
  const s = def.trim();
  let m;
  if ((m = s.match(/^(?:CONSTRAINT\s+[\w"$]+\s+)?PRIMARY\s+KEY\s*\(([\s\S]*)\)/i))) {
    const cols = splitTopLevel(m[1], ",").map(c => c.replace(/"/g, "").trim());
    if (cols.length === 1) { ajouterAssertion(t, `${nomT}.${cols[0]}`, "non_nul"); ajouterAssertion(t, `${nomT}.${cols[0]}`, "unique"); }
    else {
      cols.forEach(c => ajouterAssertion(t, `${nomT}.${c}`, "non_nul"));
      avert(`table ${nomT} : clé primaire composite (${cols.join(", ")}) — assertion "unique" non générée (assertions@1 ne porte pas de clé multi-colonnes), à compléter manuellement`);
    }
    return;
  }
  if ((m = s.match(/^(?:CONSTRAINT\s+[\w"$]+\s+)?UNIQUE\s*\(([\s\S]*)\)/i))) {
    const cols = splitTopLevel(m[1], ",").map(c => c.replace(/"/g, "").trim());
    if (cols.length === 1) ajouterAssertion(t, `${nomT}.${cols[0]}`, "unique");
    else avert(`table ${nomT} : contrainte UNIQUE composite (${cols.join(", ")}) — non convertie (assertions@1 ne porte pas de clé multi-colonnes), à compléter manuellement`);
    return;
  }
  if (/^(?:CONSTRAINT\s+[\w"$]+\s+)?CHECK\s*\(/i.test(s)) {
    const mk = s.match(/CHECK\s*\(/i);
    const idx = s.search(/CHECK\s*\(/i) + mk[0].length - 1;
    const expr = extraireParenthese(s, idx);
    if (expr === null) { avert(`table ${nomT} : CHECK table-level non refermé — ignoré`); return; }
    const r = analyserCheck(expr);
    if (r && t.colonnes.some(c => c.nom.toLowerCase() === r.colonne.toLowerCase())) {
      if (r.type === "bornes") ajouterAssertion(t, `${nomT}.${r.colonne}`, "bornes", { min: r.min, max: r.max });
      else ajouterAssertion(t, `${nomT}.${r.colonne}`, "ensemble", { valeurs: r.valeurs });
      return;
    }
    avert(`table ${nomT} : CHECK table-level non converti automatiquement (« ${expr.slice(0, 80)} ») — multi-colonnes ou motif non reconnu, à créer manuellement`);
    return;
  }
  if (/^(?:CONSTRAINT\s+[\w"$]+\s+)?FOREIGN\s+KEY\b/i.test(s)) {
    // TF-0584 — la CIBLE de la clé étrangère est mémorisée, pas seulement signalée. Sa conversion
    // reste hors périmètre du format v0 ; son EXISTENCE, elle, se vérifie et vaut le détour (voir
    // le contrôle des clés orphelines plus bas).
    const mRef = s.match(/REFERENCES\s+([\w".$]+)/i);
    if (mRef) clesEtrangeres.push({ depuis: nomT, vers: nomTable(mRef[1]), brut: mRef[1].replace(/"/g, "") });
    avert(`table ${nomT} : FOREIGN KEY non convertie (hors périmètre assertions@1/contrat@1 v0) — à documenter manuellement`);
    return;
  }
  avert(`table ${nomT} : contrainte non reconnue — ignorée : « ${s.slice(0, 80)} »`);
}
function traiterDefinition(def, t, nomT) {
  if (RE_TABLE_CONSTRAINT.test(def)) { traiterContrainteTable(def, t, nomT); return; }
  const mCol = def.match(RE_COL);
  if (!mCol) { avert(`table ${nomT} : définition non reconnue — ignorée : « ${def.slice(0, 60)}${def.length > 60 ? "…" : ""} »`); return; }
  const nomCol = mCol[1];
  const { type: typeDdl, reste } = separerTypeEtContraintes(mCol[2]);
  if (!typeDdl) { avert(`table ${nomT}.${nomCol} : type non détecté — colonne ignorée`); return; }
  t.colonnes.push({ nom: nomCol, typeDdl });
  const c = analyserContraintesColonne(reste);
  if (c.notNull || c.pk) ajouterAssertion(t, `${nomT}.${nomCol}`, "non_nul");
  if (c.unique || c.pk) ajouterAssertion(t, `${nomT}.${nomCol}`, "unique");
  if (c.check) {
    const r = analyserCheck(c.check);
    if (r && r.colonne.toLowerCase() === nomCol.toLowerCase()) {
      if (r.type === "bornes") ajouterAssertion(t, `${nomT}.${nomCol}`, "bornes", { min: r.min, max: r.max });
      else ajouterAssertion(t, `${nomT}.${nomCol}`, "ensemble", { valeurs: r.valeurs });
    } else {
      avert(`table ${nomT}.${nomCol} : CHECK non converti automatiquement (« ${c.check.slice(0, 80)} ») — à créer manuellement`);
    }
  }
}

// ---------- Boucle principale ----------
// TF-0585 — `COMMENT ON` est une INSTRUCTION du dialecte, pas un commentaire SQL : `retirerCommentaires`
// (qui enlève les `--` et les `/* */`) ne la touche pas, elle arrive donc entière dans la boucle.
const RE_COMMENT_ON = /^\s*COMMENT\s+ON\s+(TABLE|COLUMN)\s+([\w".]+)\s+IS\s+'((?:[^']|'')*)'/i;
//: Un nom d'objet QUALIFIÉ cité dans un commentaire : `schema.table` ou `schema.table.colonne`.
//: Volontairement étroit — un mot seul n'est pas une citation d'objet, et le confondre avec un mot
//: de prose ferait crier le contrôle sur chaque phrase française qui porte un point.
const RE_OBJET_CITE = /\b([a-z_][\w]*(?:\.[a-z_][\w]*){1,2})\b/gi;
//: Ce qui ressemble à un nom qualifié sans en être un — extensions, décimales, abréviations.
const CITATIONS_INNOCENTES = /^(?:\d|v\d|etc\.|cf\.|ex\.)/i;
const commentaires = [];
//: TF-0584 — les clés étrangères relevées, pour pouvoir dire lesquelles pointent vers du vide.
const clesEtrangeres = [];

const stmts = decouperStatements(retirerCommentaires(texteBrut));
let nbTablesTrouvees = 0;
for (const stmt of stmts) {
  const mCreate = stmt.match(RE_CREATE_TABLE);
  if (mCreate) {
    nbTablesTrouvees++;
    const nomT = nomTable(mCreate[1]);
    const t = table(nomT);
    const parenIdx = mCreate[0].length - 1;
    const corps = extraireParenthese(stmt, parenIdx);
    if (corps === null) { avert(`table ${nomT} : parenthèse de définition non refermée — ignorée`); continue; }
    for (const def of splitTopLevel(corps, ",")) traiterDefinition(def, t, nomT);
    continue;
  }
  const mAlter = stmt.match(RE_ALTER_ADD);
  if (mAlter) {
    const nomT = nomTable(mAlter[1]);
    if (!tables.has(nomT)) { avert(`ALTER TABLE ${nomT} ADD CONSTRAINT : table non vue en CREATE TABLE — contrainte ignorée`); continue; }
    traiterContrainteTable(mAlter[2], table(nomT), nomT);
    continue;
  }
  // COMMENT ON TABLE|COLUMN <nom> IS '<texte>' (TF-0585). Le guillemet simple doublé est
  // l'échappement SQL : `l''activité` se relit `l'activité`.
  const mCom = stmt.match(RE_COMMENT_ON);
  if (mCom) {
    const cible = mCom[2].replace(/"/g, "");
    const texte = mCom[3].replace(/''/g, "'").trim();
    if (texte) commentaires.push({ genre: mCom[1].toUpperCase(), cible, texte });
    continue;
  }
  // CREATE INDEX, ALTER ... OWNER TO, SET, GRANT… : hors périmètre schéma, ignorés
}
if (nbTablesTrouvees === 0) sortir("ECHEC", 2, { erreur: "aucune instruction CREATE TABLE reconnue — fichier illisible ou hors dialecte couvert (Postgres v0)" });

const nomsTables = [...tables.keys()];
const toutesAssertions = [];
for (const nom of nomsTables) toutesAssertions.push(...tables.get(nom).assertions);
if (!toutesAssertions.length) avert("aucune contrainte NOT NULL / CHECK / UNIQUE / PRIMARY KEY détectée — brouillon assertions@1 non produit (rien à y mettre)");

// ---- Les commentaires : rattachés, puis CONTRÔLÉS (TF-0585) ----------------------------------
// Rattachement : `COMMENT ON TABLE a.b` vise la table `b` du schéma `a` ; `COMMENT ON COLUMN
// a.b.c` vise la colonne `c` de cette table. `nomTable` normalise déjà la qualification, on
// applique la même normalisation aux deux bouts pour ne pas comparer des formes différentes.
const descTable = new Map();
const descColonne = new Map();
const objetsConnus = new Set();
for (const nom of nomsTables) {
  objetsConnus.add(nom.toLowerCase());
  for (const c of tables.get(nom).colonnes) objetsConnus.add(`${nom}.${c.nom}`.toLowerCase());
}
for (const com of commentaires) {
  if (com.genre === "TABLE") {
    const nomT = nomTable(com.cible);
    if (!tables.has(nomT)) { avert(`COMMENT ON TABLE ${com.cible} : table non vue en CREATE TABLE — commentaire non rattaché`); continue; }
    descTable.set(nomT, com.texte);
  } else {
    const morceaux = com.cible.split(".");
    const colonne = morceaux.pop();
    const nomT = nomTable(morceaux.join("."));
    const t = tables.has(nomT) ? tables.get(nomT) : null;
    if (!t || !t.colonnes.some(c => c.nom === colonne)) {
      avert(`COMMENT ON COLUMN ${com.cible} : colonne non vue dans le schéma — commentaire non rattaché`);
      continue;
    }
    descColonne.set(`${nomT}.${colonne}`, com.texte);
  }
}
// LA CLÉ ÉTRANGÈRE ORPHELINE (TF-0584, retour SCC_ALX du 24/08). LE FAIT : une cible du périmètre
// a été RETIRÉE parce que sa table était absente du déploiement visé — recherche par motif fournie,
// complète et honnête, et la décision était quand même la mauvaise. La table existe dans le modèle
// du groupe, sur un autre déploiement : 12 colonnes, 236 lignes. Son absence ici n'était pas un
// trou de CONCEPTION mais un trou de DÉPLOIEMENT, et la méthode n'avait pas d'état pour le dire.
//
// L'AGGRAVANT, et c'est lui qui se mécanise : la colonne qui référence cette table existe bel et
// bien dans le catalogue visé, et pointe donc vers un objet INEXISTANT. Le retrait de la cible a
// MASQUÉ ce défaut au lieu de le révéler — une clé étrangère renseignée sur 1 407 lignes sur
// 24 136, vers une table que rien ne porte. La règle qui en sort tient en une phrase : *avant de
// conclure qu'un objet absent est hors périmètre, regarder si quelque chose le référence encore* —
// si oui, l'absence est un CONSTAT à livrer, pas un objet à retirer.
//
// Borne déclarée : un schéma exporté table par table verra ses références externes signalées comme
// orphelines, ce qui est le comportement voulu — le doute se lit plutôt qu'il ne se devine — mais
// il faut savoir que sur un export PARTIEL le signal est attendu et bénin.
for (const fk of clesEtrangeres) {
  if (tables.has(fk.vers)) continue;
  avert(`table ${fk.depuis} : CLÉ ÉTRANGÈRE ORPHELINE — elle référence « ${fk.brut} », que ce schéma ne porte pas. ` +
    "Deux lectures, et le choix n'est pas neutre : soit la table manque à CE déploiement seulement (un autre la porte, " +
    "et la cible reste au périmètre), soit elle manque au modèle. Dans les deux cas, la référence qui pointe vers du " +
    "vide est un CONSTAT À LIVRER, jamais un objet à retirer du périmètre. Sur un export partiel, ce signal est attendu");
}

// LE CONTRÔLE. Un commentaire qui NOMME un objet absent du schéma est un commentaire FAUX, et il
// se lit avec l'autorité du schéma. Sur le cas fondateur, un commentaire de clé étrangère désignait
// une table sous un nom que le catalogue ne portait pas, après trois revues. Ce qui n'est pas jugé
// est déclaré : la JUSTESSE de ce qu'un commentaire affirme reste hors de portée — seule
// l'existence de ce qu'il nomme se vérifie.
//
// PREMIER PASSAGE DE CE CONTRÔLE, ET IL S'EST ACCUSÉ LUI-MÊME — la leçon N-23 du pilot appliquée
// telle quelle : jouer la liste sur un cas réel, et lire d'abord ce qu'elle attrape À TORT. Sur un
// schéma à trois commentaires, il en a dénoncé DEUX, dont un JUSTE (`ref.activites` au pluriel,
// table inexistante) et un FAUX : `ref.activite.cod_activite`, qui existe. Cause — `nomTable`
// normalise en ne gardant que le DERNIER segment, donc le registre des objets connus porte
// `activite.cod_activite` et pas sa forme qualifiée. Un contrôle qui crie un coup sur deux ne se
// corrige pas, il se fait désactiver (R-33 bis) : la citation est donc normalisée par LE MÊME
// chemin que les noms du schéma, et ses deux lectures possibles sont essayées avant de conclure.
//
//   `a.b.c`  → schéma.table.colonne          → clé `b.c`
//   `a.b`    → soit schéma.table (clé `b`), soit table.colonne (clé `a.b`) — l'une suffit
const citationConnue = (cite) => {
  const seg = cite.toLowerCase().split(".");
  if (seg.length >= 3) return objetsConnus.has(`${seg[seg.length - 2]}.${seg[seg.length - 1]}`);
  return objetsConnus.has(seg[seg.length - 1]) || objetsConnus.has(seg.join("."));
};
for (const com of commentaires) {
  const cites = [...new Set((com.texte.match(RE_OBJET_CITE) || []))]
    .filter(x => !CITATIONS_INNOCENTES.test(x))
    .filter(x => !citationConnue(x));
  if (cites.length)
    avert(`COMMENT ON ${com.genre} ${com.cible} NOMME ${cites.length} objet(s) que le schéma ne porte pas : ` +
      `${cites.join(", ")} — un commentaire faux se lit avec l'autorité du schéma. Vérifier le nom, ou le retirer`);
}

const schema = nomsTables.map(nom => {
  const o = {
    objet: nom,
    proprietes: tables.get(nom).colonnes.map(c => {
      const prop = { nom: c.nom, type: typeContrat(c.typeDdl, nom, c.nom) };
      const d = descColonne.get(`${nom}.${c.nom}`);
      if (d) prop.description = d;
      return prop;
    }),
  };
  const dt = descTable.get(nom);
  if (dt) o.description = dt;
  return o;
}).filter(s => s.proprietes.length);
if (!schema.length) avert("aucune colonne exploitable — brouillon contrat@1 non produit");
else avert("contrat@1 brouillon : sla / proprietaire / version réels ne se déduisent pas d'un schéma DDL — valeurs placeholder posées (statut \"brouillon\"), complétion humaine obligatoire avant usage réel");

const outDir = sortieDirArg || path.dirname(path.resolve(file));
try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) { sortir("ECHEC", 1, { erreur: `dossier de sortie impossible à créer : ${e.message}` }); }
const base = path.basename(file).replace(/\.[^.]+$/, "");
const chemins = {};

if (toutesAssertions.length) {
  const docAssertions = { format: "forge-data/assertions@1", dataset: nomsTables.join(","), assertions: toutesAssertions };
  const p = path.join(outDir, `${base}.assertions.json`);
  try { fs.writeFileSync(p, JSON.stringify(docAssertions, null, 2) + "\n"); chemins.assertions = p; }
  catch (e) { sortir("ECHEC", 1, { erreur: `écriture assertions impossible : ${e.message}` }); }
}
if (schema.length) {
  const contrat = {
    format: "forge-data/contrat@1",
    id: `contrat_${nomsTables.join("_")}_brouillon`,
    brouillon: true,
    origine: { verbe: VERBE, source: path.basename(file) },
    schema,
    sla: [{ propriete: "fraicheur", valeur: "a_completer", unite: "a_completer" }],
    proprietaire: { equipe: "a_completer", contact: "a-completer@example.com" },
    version: "0.1.0",
    statut: "brouillon",
  };
  const p = path.join(outDir, `${base}.contrat.json`);
  try { fs.writeFileSync(p, JSON.stringify(contrat, null, 2) + "\n"); chemins.contrat = p; }
  catch (e) { sortir("ECHEC", 1, { erreur: `écriture contrat impossible : ${e.message}` }); }
}

sortir(Object.keys(chemins).length ? "OK" : "ECHEC", Object.keys(chemins).length ? 0 : 2, {
  tables: nomsTables,
  compte: {
    tables: nomsTables.length,
    colonnes: nomsTables.reduce((s, n) => s + tables.get(n).colonnes.length, 0),
    assertions: toutesAssertions.length,
  },
  fichiers_produits: chemins,
});
