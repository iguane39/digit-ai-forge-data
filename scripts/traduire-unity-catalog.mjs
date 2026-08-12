#!/usr/bin/env node
// traduire-unity-catalog — verbe (TF-0141) : traduit un EXPORT SYNTHÉTIQUE des system
// tables Unity Catalog Databricks (`system.access.column_lineage`) en
// `forge-data/lineage@1`, grain colonne (T6). Générateur, pas un oracle : la preuve de
// justesse est en boucle — la sortie DOIT PASSER oracle-tracer (round-trip, vérifié par
// oracles/self-test.mjs).
//
// *** VALIDÉ SUR FIXTURE SYNTHÉTIQUE UNIQUEMENT *** — aucun export `system.access.
// column_lineage` réel n'a été disponible pour ce lot (le lineage colonne natif d'Unity
// Catalog exige un workspace Premium/Enterprise payant, cf.
// references/profils-moteur/databricks.md §3-4). L'entrée attendue est un JSON déjà
// EXPORTÉ par l'humain (ou un outil tiers) depuis ces system tables — JAMAIS de connexion
// à un workspace Databricks (loi n° 4).
//
// Format d'entrée attendu (fidèle au schéma documenté de system.access.column_lineage) :
//   { "artefact": "<dataset servi que ce lineage documente>",
//     "lignes": [ { source_table_full_name, source_column_name,
//                   target_table_full_name, target_column_name,
//                   entity_type, entity_id, event_time }, ... ] }
// Chacune des 4 colonnes de nommage (source_table_full_name, source_column_name,
// target_table_full_name, target_column_name) est obligatoire et non vide sur CHAQUE
// ligne — une ligne où une colonne de sortie est déclarée sans son dataset (ou l'inverse)
// est un export incohérent : REFUS PROPRE (exit 2), jamais un lineage inventé.
//
// Correspondance vers lineage@1 :
//   entrees[]        = table sources distinctes, date = event_time le plus RÉCENT observé
//                       pour cette table (facet de fraîcheur, au mieux du signal disponible) ;
//   sorties[]         = tables cibles distinctes ;
//   transformations[] = une étape par (entity_type, entity_id) distinct rencontré, type
//                       TOUJOURS "runtime" — le lineage colonne d'Unity Catalog est par
//                       nature une capture d'exécution réelle (REX X5/X6 : l'opaque n'est
//                       accessible qu'en runtime ; niveau de maturité 3) ;
//   horodatage        = event_time le plus récent toutes lignes confondues (capture) ;
//   confiance.niveau  = 3 (colonne + runtime exhaustif, cf. REX X6) ;
//   colonnes[]        = une entrée par (target_table, target_column) distinct, `entrees`
//                       = liste de `source_table.source_column`, `transformation` posée
//                       seulement si TOUTES les lignes contribuant à cette sortie
//                       partagent le même (entity_type, entity_id) — sinon omise et
//                       signalée en avertissement (transformation ambiguë).
//
// Usage : node scripts/traduire-unity-catalog.mjs <export-uc.json> [--sortie <fichier>]
//         [--sortie-dir <dossier>] [--json-only]
// Codes : 0 lineage produit ; 1 échec d'écriture disque ; 2 entrée absente/vide/incohérente
// (aucune ligne exploitable, ou export incohérent) — jamais un lineage inventé.
import fs from "node:fs";
import path from "node:path";

const VERBE = "traduire-unity-catalog";
const DOM = "Traduction system.access.column_lineage (Unity Catalog) → forge-data/lineage@1, grain colonne (TF-0141)";
const CHAMPS_REQUIS = ["source_table_full_name", "source_column_name", "target_table_full_name", "target_column_name"];

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const sortieIdx = args.indexOf("--sortie");
const sortieArg = sortieIdx !== -1 ? args[sortieIdx + 1] : null;
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
if (!texteBrut.trim()) sortir("ECHEC", 2, { erreur: "fichier vide — rien à traduire" });
let doc = null;
try { doc = JSON.parse(texteBrut); } catch (e) { sortir("ECHEC", 2, { erreur: `JSON invalide : ${e.message}` }); }

if (!doc.artefact) sortir("ECHEC", 2, { erreur: "champ « artefact » absent — le lineage produit doit nommer le dataset servi qu'il documente" });
if (!Array.isArray(doc.lignes) || !doc.lignes.length) sortir("ECHEC", 2, { erreur: "champ « lignes » absent ou vide — aucun export column_lineage exploitable" });

// ---------- Validation de cohérence (jamais un lineage inventé sur export incomplet) ----------
const erreurs = [];
doc.lignes.forEach((l, i) => {
  for (const champ of CHAMPS_REQUIS) {
    if (!l || typeof l[champ] !== "string" || !l[champ].trim())
      erreurs.push(`ligne #${i + 1} : champ « ${champ} » manquant ou vide — colonne déclarée sans son dataset (ou l'inverse), export incohérent`);
  }
});
if (erreurs.length) sortir("ECHEC", 2, { erreur: "export column_lineage incohérent — aucune traduction produite", details: erreurs });

// ---------- Agrégation ----------
const entreesMap = new Map(); // table -> date la plus récente vue
const sortiesSet = new Set();
const transformationsMap = new Map(); // cle "type|id" -> etape
const colonnesMap = new Map(); // "target.col" -> { entrees:Set, transformations:Set }
let horodatage = null;

const majDate = (map, table, date) => {
  if (!date) return;
  const prev = map.get(table);
  if (!prev || date > prev) map.set(table, date);
};

for (const l of doc.lignes) {
  majDate(entreesMap, l.source_table_full_name, l.event_time);
  sortiesSet.add(l.target_table_full_name);
  if (!horodatage || (l.event_time && l.event_time > horodatage)) horodatage = l.event_time || horodatage;

  let etape = null;
  if (l.entity_type && l.entity_id) {
    const cle = `${l.entity_type}|${l.entity_id}`;
    etape = `${l.entity_type.toLowerCase()}_${l.entity_id}`.replace(/[^\w]+/g, "_");
    transformationsMap.set(cle, etape);
  }

  const sortieRef = `${l.target_table_full_name}.${l.target_column_name}`;
  const entreeRef = `${l.source_table_full_name}.${l.source_column_name}`;
  if (!colonnesMap.has(sortieRef)) colonnesMap.set(sortieRef, { entrees: new Set(), etapes: new Set() });
  const c = colonnesMap.get(sortieRef);
  c.entrees.add(entreeRef);
  if (etape) c.etapes.add(etape);
}

if (!entreesMap.size) sortir("ECHEC", 2, { erreur: "aucune table source distincte trouvée après agrégation — export incohérent" });
const tablesSansDate = [...entreesMap].filter(([, date]) => !date).map(([t]) => t);
if (tablesSansDate.length)
  sortir("ECHEC", 2, { erreur: "table(s) source sans aucun event_time exploitable — traduction refusée plutôt qu'un lineage@1 qui échouerait T2 (date de fraîcheur obligatoire)", tables_sans_date: tablesSansDate });

const entrees = [...entreesMap].map(([dataset, date]) => ({ dataset, date }));
const sorties = [...sortiesSet].map(dataset => ({ dataset }));
const transformations = [...transformationsMap.values()].map(etape => ({ etape, type: "runtime" }));
if (!transformations.length) sortir("ECHEC", 2, { erreur: "aucune transformation nommée (entity_type/entity_id absents de toutes les lignes) — traduction refusée plutôt qu'un lineage@1 qui échouerait T3 (transformation obligatoire)" });

const colonnes = [...colonnesMap].map(([sortie, v]) => {
  const entree = { sortie, entrees: [...v.entrees] };
  if (v.etapes.size === 1) entree.transformation = [...v.etapes][0];
  else if (v.etapes.size > 1) avert(`colonne de sortie « ${sortie} » : contributions issues de plusieurs transformations distinctes (${[...v.etapes].join(", ")}) — champ transformation omis (ambigu), à documenter manuellement`);
  return entree;
});

if (entrees.length !== entreesMap.size)
  sortir("ECHEC", 2, { erreur: "des tables sources n'ont aucune date de fraîcheur exploitable — traduction refusée plutôt qu'un lineage@1 qui échouerait T2", tables_sans_date: [...entreesMap].filter(([, d]) => !d).map(([t]) => t) });

const lineage = {
  format: "forge-data/lineage@1",
  artefact: doc.artefact,
  entrees,
  transformations,
  sorties,
  horodatage: horodatage || new Date().toISOString(),
  confiance: {
    niveau: 3,
    methode: "traduction automatique de system.access.column_lineage (Unity Catalog Databricks) — capture runtime native de l'exécution des requêtes, TF-0141 ; validé sur fixture synthétique uniquement (aucun export réel disponible sans workspace Premium/Enterprise payant)",
  },
  colonnes,
  origine: { verbe: VERBE, source: path.basename(file) },
};

// ---------- Écriture ----------
let outPath = sortieArg;
if (!outPath) {
  const base = path.basename(file).replace(/\.[^.]+$/, "");
  const outDir = sortieDirArg || path.dirname(path.resolve(file));
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) { sortir("ECHEC", 1, { erreur: `dossier de sortie impossible à créer : ${e.message}` }); }
  outPath = path.join(outDir, `${base}.lineage.json`);
}
try { fs.writeFileSync(outPath, JSON.stringify(lineage, null, 2) + "\n"); }
catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); }

sortir("OK", 0, {
  compte: { tables_entree: entrees.length, tables_sortie: sorties.length, transformations: transformations.length, colonnes: colonnes.length },
  fichier_produit: outPath,
});
