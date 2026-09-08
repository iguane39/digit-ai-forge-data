#!/usr/bin/env node
// projeter-evolutions — verbe (TF-0937, 08/09/2026, retour Produit de reporting du 08/09) :
// PROJETTE, colonne par colonne, ce qui change dans une couche et d'où ça vient. Générateur,
// pas un oracle.
//
// POURQUOI CE VERBE. `forge-data/lineage@1` porte les sorties proposées et les transformations ;
// il ne porte PAS la vue colonne par colonne de ce qui change dans chaque couche. Or c'est la
// PREMIÈRE question d'une équipe data devant une reprise (« qu'est-ce qui bouge en Silver, en
// Gold, et d'où ça vient ? »), et elle se reconstituait à la main depuis les DDL, le mapping et
// le catalogue. Coût constaté chez le produit demandeur : 397 lignes de provenance reconstruites
// à la main (119 en Silver, 278 en Gold).
//
// CE QUE LE VERBE LIT, ET RIEN D'AUTRE :
//   `--cible <ddl.sql>`     l'état VISÉ de la couche (sortie de SHOW CREATE TABLE, dialecte
//                           Databricks — le même artefact que `scripts/importer.mjs` consomme) ;
//   `--existant <ddl.sql>`  l'état ACTUEL, facultatif : c'est lui, et lui seul, qui permet de
//                           distinguer une table CRÉÉE d'une table COMPLÉTÉE ou DÉPLACÉE ;
//   `--lineage <l.json>`    une déclaration `forge-data/lineage@1`, facultative : elle fournit
//                           la provenance des tables qu'elle déclare en sortie.
//
// CE QU'IL NE DEVINE PAS. Sans `--existant`, l'état antérieur n'existe pas : toute table est lue
// comme CRÉÉE — ce qui est vrai d'une couche neuve et faux d'une reprise, donc le verbe l'AVERTIT
// au lieu de le taire. Une colonne sans commentaire DDL, absente de l'existant et sans lineage
// déclaré reçoit la provenance `indeterminee` AVEC son motif : une provenance vraisemblable
// posée au jugé ferait passer la projection pour complète alors qu'elle ne l'est pas — c'est
// exactement le défaut que TF-0911 a coûté.
//
// Sortie : `forge-data/evolutions@1` (JSON, jugé par `oracles/oracle-evoluer.mjs`), ou la même
// projection rendue en Markdown / CSV pour le chapitre de restitution — mêmes lignes, même
// ordre, jamais un rendu qui recompte.
//
// TROIS NIVEAUX, PAS UNE LISTE PLATE (TF-0942, 08/09). La projection porte aussi un `arbre` :
// un nœud par SCHÉMA, par TABLE et par COLONNE — { niveau, parent, objet, statut, statut_agrege } —
// où chaque niveau a son propre statut et chaque parent le RECOMPTE des statuts de ses enfants.
// Sans lui, le statut n'existait qu'à la ligne la plus fine et un schéma n'apparaissait nulle part
// comme objet : 119 lignes Silver et 278 lignes Gold répétant le nom de leur table, et aucun
// agrégat « 3 tables dont 2 créées ». Le rendu Markdown en fait un tableau à trois niveaux dont
// la colonne « Niveau » est la clé de filtrage.
//
// Usage : node scripts/projeter-evolutions.mjs --couche silver --cible <ddl.sql>
//         [--existant <ddl.sql>] [--lineage <lineage.json>] [--format json|md|csv]
//         [--sortie <fichier>] [--sortie-dir <dossier>] [--date AAAA-MM-JJ] [--json-only]
// Codes : 0 projection produite ; 1 échec d'écriture ; 2 entrée absente/illisible (aucune table
// lue) — jamais une projection inventée.
import fs from "node:fs";
import path from "node:path";

const VERBE = "projeter-evolutions";
const DOM = "Projection des évolutions d'une couche, colonne par colonne, avec provenance (TF-0937)";
const FORMATS = ["json", "md", "csv"];

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const jsonOnly = args.includes("--json-only");
const coucheArg = opt("--couche");
const cibleArg = opt("--cible") || args.find(a => !a.startsWith("--"));
const existantArg = opt("--existant");
const lineageArg = opt("--lineage");
const formatArg = (opt("--format") || "json").toLowerCase();
const sortieArg = opt("--sortie");
const sortieDirArg = opt("--sortie-dir");

const AVERT = [];
const avert = m => AVERT.push(m);
const sortir = (sortie, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ verbe: VERBE, domaine: DOM, cible: cibleArg || null, sortie,
    avertissements: AVERT, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};

if (!FORMATS.includes(formatArg)) sortir("ECHEC", 2, { erreur: `format « ${formatArg} » inconnu (attendu ${FORMATS.join(", ")})` });
if (!coucheArg) sortir("ECHEC", 2, { erreur: "--couche absent — une projection d'évolutions se rattache à UNE couche nommée (silver, gold, …) ; sans elle, deux projections se confondent" });
if (!cibleArg || !fs.existsSync(cibleArg)) sortir("ECHEC", 2, { erreur: `DDL cible introuvable : ${cibleArg} — attendu une sortie SHOW CREATE TABLE en texte (jamais de connexion, loi n° 4)` });
if (existantArg && !fs.existsSync(existantArg)) sortir("ECHEC", 2, { erreur: `DDL de l'état existant introuvable : ${existantArg}` });
if (lineageArg && !fs.existsSync(lineageArg)) sortir("ECHEC", 2, { erreur: `déclaration de lineage introuvable : ${lineageArg}` });

// ---------- Lecture DDL (dialecte Databricks : sortie de SHOW CREATE TABLE) -------------------
// Volontairement minimal : ce verbe a besoin du NOM QUALIFIÉ, des colonnes, de leur TYPE et de
// leur COMMENT. Les contraintes, clauses de queue et propriétés sont l'affaire de
// `scripts/importer.mjs`, qui les traduit en assertions — elles ne disent rien d'une évolution.
const lireDdl = fichier => {
  const texte = fs.readFileSync(fichier, "utf8").replace(/^\s*--.*$/gm, "");
  const tables = new Map();
  const CREATE = /CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.`]+)\s*\(([\s\S]*?)\)\s*(?:USING|COMMENT|PARTITIONED|TBLPROPERTIES|;|$)/gi;
  for (const m of texte.matchAll(CREATE)) {
    const nomComplet = m[1].replace(/`/g, "");
    const colonnes = [];
    for (const brut of m[2].split(/\r?\n/)) {
      const l = brut.trim().replace(/,\s*$/, "");
      if (!l || /^CONSTRAINT\b/i.test(l) || /^(?:PRIMARY|FOREIGN|UNIQUE|CHECK)\b/i.test(l)) continue;
      const c = l.match(/^([\w`]+)\s+([A-Za-z_]+(?:\s*\([^)]*\))?(?:\s*<[^>]*>)?)(.*)$/);
      if (!c) continue;
      const suite = c[3] || "";
      const com = suite.match(/COMMENT\s+'((?:[^']|'')*)'/i);
      colonnes.push({ nom: c[1].replace(/`/g, ""), type: c[2].replace(/\s+/g, "").toUpperCase(),
                      commentaire: com ? com[1].replace(/''/g, "'") : null });
    }
    const seg = nomComplet.split(".");
    tables.set(nomComplet, { nomComplet, nomCourt: seg[seg.length - 1], prefixe: seg.slice(0, -1).join("."), colonnes });
  }
  return tables;
};

const cible = lireDdl(cibleArg);
if (!cible.size) sortir("ECHEC", 2, { erreur: `aucune table lue dans ${cibleArg} — un DDL vide ne projette rien, et une projection vide se lirait « aucune évolution »` });
const existant = existantArg ? lireDdl(existantArg) : new Map();
if (!existantArg)
  avert("aucun état existant fourni (--existant) : toute table est lue comme CRÉÉE. C'est vrai d'une couche neuve et faux d'une reprise — fournir le DDL de l'existant pour distinguer complétée, déplacée et corrigée");
else if (!existant.size)
  avert(`aucune table lue dans l'état existant ${existantArg} — la comparaison porte sur un existant vide, donc tout est lu comme créé`);

// ---------- Provenance déclarée par un lineage@1 ----------------------------------------------
const sortiesLineage = new Map();  // nom de dataset -> entrées déclarées
if (lineageArg) {
  let l = null;
  try { l = JSON.parse(fs.readFileSync(lineageArg, "utf8")); }
  catch (e) { sortir("ECHEC", 2, { erreur: `lineage illisible (JSON attendu) : ${e.message}` }); }
  if (l.format !== "forge-data/lineage@1")
    sortir("ECHEC", 2, { erreur: `lineage au format « ${l.format} » (attendu forge-data/lineage@1)` });
  const entrees = (l.entrees || []).map(e => e.dataset).filter(Boolean);
  for (const s of l.sorties || []) if (s && s.dataset) sortiesLineage.set(String(s.dataset).toLowerCase(), entrees);
}

// ---------- Appariement des tables : créée, complétée, déplacée --------------------------------
// Le DÉPLACEMENT est le cas que la lecture naïve rate : la table existe déjà, sous le même nom
// court, mais dans un autre catalogue ou schéma. Lue comme « créée », elle ferait croire à une
// construction là où il y a un transfert — et sa provenance réelle serait perdue.
const parNomCourt = new Map();
for (const t of existant.values()) {
  if (!parNomCourt.has(t.nomCourt)) parNomCourt.set(t.nomCourt, []);
  parNomCourt.get(t.nomCourt).push(t);
}
const EVOLUTIONS_TABLE = { creee: "table_creee", completee: "table_completee", deplacee: "table_deplacee", inchangee: "inchangee" };
const lignes = [];
const tablesProjetees = [];

for (const t of cible.values()) {
  const memeChemin = existant.get(t.nomComplet) || null;
  const homonymes = (parNomCourt.get(t.nomCourt) || []).filter(x => x.nomComplet !== t.nomComplet);
  const source = memeChemin || (homonymes.length === 1 ? homonymes[0] : null);
  if (!memeChemin && homonymes.length > 1)
    avert(`table « ${t.nomComplet} » : ${homonymes.length} homonymes dans l'état existant (${homonymes.map(h => h.nomComplet).join(", ")}) — le déplacement ne se tranche pas tout seul, la table est lue comme CRÉÉE`);
  const deplacee = !memeChemin && !!source;
  const colonnesSource = new Map((source ? source.colonnes : []).map(c => [c.nom.toLowerCase(), c]));

  let ajoutees = 0, corrigees = 0, inchangees = 0;
  for (const c of t.colonnes) {
    const avant = colonnesSource.get(c.nom.toLowerCase()) || null;
    let evolution;
    if (!avant) { evolution = "colonne_ajoutee"; ajoutees++; }
    else if (avant.type !== c.type) { evolution = "colonne_corrigee"; corrigees++; }
    else { evolution = "inchangee"; inchangees++; }

    // Provenance : lue dans les artefacts, dans cet ordre — le commentaire DDL est la source la
    // plus proche du producteur, l'état existant vient ensuite, le lineage déclaré en dernier.
    let provenance;
    if (c.commentaire) provenance = { type: "commentaire_ddl", detail: c.commentaire };
    else if (avant) provenance = { type: "couche_existante", detail: `${source.nomComplet}.${avant.nom}` };
    else if (sortiesLineage.has(t.nomComplet.toLowerCase()))
      provenance = { type: "mapping", detail: `lineage@1 : ${(sortiesLineage.get(t.nomComplet.toLowerCase()) || []).join(", ") || "entrées non déclarées"}` };
    else provenance = { type: "indeterminee",
      motif: "aucun commentaire DDL sur cette colonne, absente de l'état existant, et aucune sortie de lineage déclarée pour cette table" };

    lignes.push({ table: t.nomComplet, colonne: c.nom, type: c.type, evolution, provenance });
  }

  let evolutionTable;
  if (deplacee) evolutionTable = EVOLUTIONS_TABLE.deplacee;
  else if (!source) evolutionTable = EVOLUTIONS_TABLE.creee;
  else if (ajoutees || corrigees) evolutionTable = EVOLUTIONS_TABLE.completee;
  else evolutionTable = EVOLUTIONS_TABLE.inchangee;
  tablesProjetees.push({ table: t.nomComplet, evolution: evolutionTable,
    origine: source ? source.nomComplet : null,
    colonnes: { total: t.colonnes.length, ajoutees, corrigees, inchangees } });
}

// ---------- Arbre schéma › table › colonne (TF-0942, retour du 08/09) --------------------------
// Une projection PLATE — une ligne par colonne, répétant le nom de sa table — perd la hiérarchie
// que le lecteur cherche : le schéma n'y apparaît nulle part comme OBJET, et le statut n'existe
// qu'au niveau le plus fin. Mesuré sur la version livrée : 119 lignes Silver et 278 lignes Gold,
// aucun agrégat « 3 tables dont 2 créées ». L'arbre rend les trois niveaux, chacun avec SON
// statut, et chaque parent avec le recompte des statuts de ses enfants — recompté ici, jamais
// recopié : c'est l'agrégat qui se périme en premier quand une ligne bouge.
const SCHEMA_SANS = "(hors schéma)";
const compter = xs => xs.reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {});
// Statut d'un schéma : dérivé de ses tables, par une règle DÉCLARÉE et non par un vote. Un schéma
// dont toutes les tables sont créées est un schéma neuf ; dès qu'une seule table bouge sans que
// tout soit neuf, le schéma est complété ; sinon il est inchangé.
const statutSchema = statutsTables =>
  statutsTables.every(s => s === EVOLUTIONS_TABLE.creee) ? "schema_cree"
  : statutsTables.some(s => s !== EVOLUTIONS_TABLE.inchangee) ? "schema_complete"
  : EVOLUTIONS_TABLE.inchangee;

const parSchema = new Map();
for (const t of tablesProjetees) {
  const seg = t.table.split(".");
  const sch = seg.length > 1 ? seg.slice(0, -1).join(".") : SCHEMA_SANS;
  if (!parSchema.has(sch)) parSchema.set(sch, []);
  parSchema.get(sch).push(t);
}
const arbre = [];
for (const [sch, tablesDuSchema] of parSchema) {
  arbre.push({ niveau: "schema", objet: sch, parent: null,
    statut: statutSchema(tablesDuSchema.map(t => t.evolution)),
    statut_agrege: compter(tablesDuSchema.map(t => t.evolution)) });
  for (const t of tablesDuSchema) {
    const colonnesDeLaTable = lignes.filter(l => l.table === t.table);
    arbre.push({ niveau: "table", objet: t.table, parent: sch, statut: t.evolution,
      statut_agrege: compter(colonnesDeLaTable.map(c => c.evolution)) });
    for (const c of colonnesDeLaTable)
      arbre.push({ niveau: "colonne", objet: `${t.table}.${c.colonne}`, parent: t.table,
        statut: c.evolution, statut_agrege: null });
  }
}

// ---------- Comptes : recalculés ici, jamais recopiés d'une synthèse ---------------------------
const compteParEvolution = obj => obj.reduce((acc, x) => { acc[x.evolution] = (acc[x.evolution] || 0) + 1; return acc; }, {});
const indeterminees = lignes.filter(l => l.provenance.type === "indeterminee").length;
if (indeterminees)
  avert(`${indeterminees} ligne(s) de provenance INDÉTERMINÉE — chacune porte son motif ; poser une provenance vraisemblable ferait passer la projection pour complète alors qu'elle ne l'est pas`);

const dateProjection = opt("--date") || new Date().toISOString().slice(0, 10);
const projection = {
  format: "forge-data/evolutions@1",
  id: `evolutions_${String(coucheArg).toLowerCase()}_${dateProjection}`,
  couche: coucheArg,
  date: dateProjection,
  origine: { verbe: VERBE,
    cible: path.relative(process.cwd(), cibleArg).replace(/\\/g, "/") || cibleArg,
    existant: existantArg ? (path.relative(process.cwd(), existantArg).replace(/\\/g, "/") || existantArg) : null,
    lineage: lineageArg ? (path.relative(process.cwd(), lineageArg).replace(/\\/g, "/") || lineageArg) : null },
  comptes: { tables: tablesProjetees.length, colonnes: lignes.length,
             par_evolution: compteParEvolution(lignes),
             tables_par_evolution: compteParEvolution(tablesProjetees),
             provenance_indeterminee: indeterminees,
             arbre_par_niveau: compter(arbre.map(n => n.niveau)) },
  tables: tablesProjetees,
  arbre,
  lignes,
};

// ---------- Rendus : les MÊMES lignes, dans le MÊME ordre --------------------------------------
// Un rendu qui recompterait serait une seconde source de vérité, donc une divergence en attente.
const echapCsv = v => { const s = String(v ?? ""); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const provenanceTexte = p => p.type === "indeterminee" ? `indeterminee (${p.motif})` : `${p.type} : ${p.detail}`;
const rendreCsv = () => ["table;colonne;type;evolution;provenance",
  ...lignes.map(l => [l.table, l.colonne, l.type, l.evolution, provenanceTexte(l.provenance)].map(echapCsv).join(";"))].join("\n") + "\n";
const agregeTexte = a => a && Object.keys(a).length ? Object.entries(a).map(([k, v]) => `${v} ${k}`).join(", ") : "—";
const rendreMd = () => {
  const ent = Object.entries(projection.comptes.tables_par_evolution).map(([k, v]) => `${v} ${k}`).join(", ");
  const n = projection.comptes.arbre_par_niveau;
  return [`## Évolutions ${coucheArg} (${dateProjection})`, "",
    `${projection.comptes.colonnes} colonne(s) sur ${projection.comptes.tables} table(s) — ${ent || "aucune évolution"}.`,
    `Provenance indéterminée : ${indeterminees}.`, "",
    // TF-0942 : les trois niveaux d'abord, chacun avec son statut. La colonne « Niveau » est la
    // clé de filtrage du tableau ; sans elle, le lecteur ne voit que la ligne la plus fine et le
    // schéma n'existe nulle part comme objet.
    `### Arborescence (schéma › table › colonne) — ${n.schema || 0} schéma(s), ${n.table || 0} table(s), ${n.colonne || 0} colonne(s)`, "",
    "Filtrer sur la colonne « Niveau » pour ne lire qu'un étage.", "",
    "| Niveau | Objet | Parent | Statut | Statuts des enfants |", "|---|---|---|---|---|",
    ...arbre.map(x => `| ${x.niveau} | ${x.objet} | ${x.parent || "—"} | ${x.statut} | ${agregeTexte(x.statut_agrege)} |`), "",
    "### Détail colonne par colonne", "",
    "| Table | Colonne | Type | Évolution | Provenance |", "|---|---|---|---|---|",
    ...lignes.map(l => `| ${l.table} | ${l.colonne} | ${l.type} | ${l.evolution} | ${provenanceTexte(l.provenance).replace(/\|/g, "\\|")} |`)].join("\n") + "\n";
};

const EXT = { json: "json", md: "md", csv: "csv" };
let cheminSortie = sortieArg;
if (!cheminSortie) {
  const outDir = sortieDirArg || path.dirname(path.resolve(cibleArg));
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) { sortir("ECHEC", 1, { erreur: `dossier de sortie impossible à créer : ${e.message}` }); }
  cheminSortie = path.join(outDir, `${projection.id}.${EXT[formatArg]}`);
}
const contenu = formatArg === "json" ? JSON.stringify(projection, null, 2) + "\n" : formatArg === "csv" ? rendreCsv() : rendreMd();
try { fs.writeFileSync(cheminSortie, contenu); }
catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); }

sortir("OK", 0, { couche: coucheArg, format: formatArg, comptes: projection.comptes, fichier_produit: cheminSortie });
