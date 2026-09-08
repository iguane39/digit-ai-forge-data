#!/usr/bin/env node
// traduire-unity-catalog — verbe (TF-0141) : traduit un export du lineage Unity Catalog
// Databricks en `forge-data/lineage@1`. Générateur, pas un oracle : la preuve de justesse
// est en boucle — la sortie DOIT PASSER oracle-tracer (round-trip, vérifié par
// oracles/self-test.mjs).
//
// DEUX VOIES D'ENTRÉE (la seconde ouverte par TF-0893, retour Produit-10 du 07/09/2026) :
//   `system-tables`        — export de `system.access.column_lineage`, champ `lignes` ;
//                            grain COLONNE (T6), confiance niveau 3.
//   `api-lineage-tracking` — export des réponses de l'API REST
//                            `GET /api/2.0/lineage-tracking/table-lineage`, champ `reponses` ;
//                            grain TABLE, confiance niveau 0.
// POURQUOI LA SECONDE. Sur un workspace réel, la voie system tables est REFUSÉE avant même
// d'exister : `SELECT … FROM system.access.table_lineage` rend `[INSUFFICIENT_PERMISSIONS]
// User does not have USE SCHEMA on Schema 'system.access'` (SQLSTATE 42501) — un droit de
// gouvernance que le compte d'une mission n'a pas et n'obtient pas dans la journée. La même
// information de lineage, au grain table, sort de l'API REST avec les droits ordinaires du
// jeton. Le verbe n'avait donc qu'une entrée, et c'était celle qui ne répond pas : le lineage
// de 30 objets a été relevé par l'API puis TRANSCRIT À LA MAIN dans un lineage@1 (PASS T1-T7).
//
// *** VALIDÉ SUR FIXTURE SYNTHÉTIQUE UNIQUEMENT *** — aucun export `system.access.
// column_lineage` réel n'a été disponible pour ce lot (le lineage colonne natif d'Unity
// Catalog exige un workspace Premium/Enterprise payant, cf.
// references/profils-moteur/databricks.md §3-4). L'entrée attendue est un JSON déjà
// EXPORTÉ par l'humain (ou un outil tiers) depuis ces system tables — JAMAIS de connexion
// à un workspace Databricks (loi n° 4).
//
// Format d'entrée de la voie `system-tables` (fidèle au schéma documenté de
// system.access.column_lineage) :
//   { "artefact": "<dataset servi que ce lineage documente>",
//     "namespace": "<instance interrogée — databricks://adb-<id>.<n>.azuredatabricks.net>",
//     "lignes": [ { source_table_full_name, source_column_name,
//                   target_table_full_name, target_column_name,
//                   entity_type, entity_id, event_time }, ... ] }
// Chacune des 4 colonnes de nommage (source_table_full_name, source_column_name,
// target_table_full_name, target_column_name) est obligatoire et non vide sur CHAQUE
// ligne — une ligne où une colonne de sortie est déclarée sans son dataset (ou l'inverse)
// est un export incohérent : REFUS PROPRE (exit 2), jamais un lineage inventé.
//
// Format d'entrée de la voie `api-lineage-tracking` (fidèle au schéma de réponse de l'API,
// une réponse par table interrogée — c'est une API par table, un relevé de 30 objets est
// donc 30 réponses ; le champ `reponses` les porte toutes) :
//   { "artefact": …, "namespace": …,
//     "reponses": [ { "table_name": "<catalogue.schema.table interrogée>",
//                     "reponse": { "upstreams":   [ { tableInfo: { catalog_name, schema_name,
//                                                                  name, lineage_timestamp },
//                                                     notebookInfos: [ { notebook_id } ],
//                                                     jobInfos: [ { job_id } ] }, … ],
//                                  "downstreams": [ … même forme … ] } }, … ] }
// Une entrée d'upstream/downstream sans `tableInfo` (les `fileInfo` d'un emplacement externe)
// est SIGNALÉE et écartée : ce format est au grain table qualifiée, pas au grain fichier.
//
// Correspondance vers lineage@1 (voie `system-tables`) :
//   entrees[]        = table sources distinctes, date = event_time le plus RÉCENT observé
//                       pour cette table (facet de fraîcheur, au mieux du signal disponible),
//                       `namespace` = celui déclaré par l'appelant (T7) ;
//   sorties[]         = tables cibles distinctes, même `namespace` ;
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
// Correspondance vers lineage@1 (voie `api-lineage-tracking`) :
//   chaque `upstream` d'une table T est une arête (upstream → T) ; chaque `downstream` est
//   une arête (T → downstream). Les datasets côté SOURCE d'au moins une arête peuplent
//   `entrees` (datés du `lineage_timestamp` le plus RÉCENT observé pour ce dataset) ; ceux
//   côté CIBLE peuplent `sorties`. Une table intermédiaire figure des deux côtés, et c'est
//   la vérité du graphe relevé. `transformations[]` = une étape par entité d'exécution
//   distincte (notebook, job, pipeline, requête), type TOUJOURS "runtime" : l'API rend une
//   capture d'exécution. Pas de champ `colonnes` — cette voie est au grain TABLE.
//   `confiance.niveau` = 0, et c'est un arbitrage DÉLIBÉRÉ contre la proposition du retour
//   (qui demandait 2) : sur l'échelle de maturité du REX X6, les niveaux 1, 2 et 3 sont
//   TOUS des grains colonne (1 déclaratif, 2 statique étendu, 3 runtime exhaustif) et le
//   niveau 0 est « topologie + grain table ». Un lineage grain table qui se déclarerait 2
//   mentirait sur sa maturité — et T5 ne juge que la présence du niveau, jamais sa justesse :
//   personne ne rattraperait le mensonge en aval. Le caractère runtime de la capture est dit
//   là où il est vérifiable, dans `confiance.methode` et le type des transformations.
//
// Usage : node scripts/traduire-unity-catalog.mjs <export-uc.json> [--voie <system-tables|
//         api-lineage-tracking>] [--sortie <fichier>] [--sortie-dir <dossier>] [--json-only]
// Codes : 0 lineage produit ; 1 échec d'écriture disque ; 2 entrée absente/vide/incohérente
// (aucune ligne exploitable, voie indécidable, ou export incohérent) — jamais un lineage inventé.
import fs from "node:fs";
import path from "node:path";

const VERBE = "traduire-unity-catalog";
const DOM = "Traduction du lineage Unity Catalog (system.access.column_lineage grain colonne, API lineage-tracking grain table) → forge-data/lineage@1 (TF-0141, TF-0893)";
const CHAMPS_REQUIS = ["source_table_full_name", "source_column_name", "target_table_full_name", "target_column_name"];
const VOIES = ["system-tables", "api-lineage-tracking"];

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const sortieIdx = args.indexOf("--sortie");
const sortieArg = sortieIdx !== -1 ? args[sortieIdx + 1] : null;
const sortieDirIdx = args.indexOf("--sortie-dir");
const sortieDirArg = sortieDirIdx !== -1 ? args[sortieDirIdx + 1] : null;
const voieIdx = args.indexOf("--voie");
const voieArg = voieIdx !== -1 ? args[voieIdx + 1] : null;

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
// T7 (TF-0595, 24/08) — l'INSTANCE interrogée, et pourquoi elle ne peut pas être devinée ici.
// Un export `system.access.column_lineage` nomme ses tables `catalogue.schema.table` : trois
// niveaux qui ne disent RIEN du workspace d'où l'export a été tiré. Deux workspaces d'un même
// groupe exposent les mêmes noms de catalogues par construction — c'est la règle, pas
// l'exception. Le « où » ne vit pas dans les lignes, il vit dans la CONNEXION : soit l'appelant
// le déclare, soit il est perdu et aucune analyse a posteriori ne le retrouvera. Refus propre,
// donc, plutôt qu'un lineage@1 qui échouerait T7 — même arbitrage que pour la date de fraîcheur.
const NS = typeof doc.namespace === "string" ? doc.namespace.trim() : "";
if (!NS)
  sortir("ECHEC", 2, { erreur: "champ « namespace » absent — l'instance d'où cet export a été tiré ne se lit dans AUCUNE de ses lignes (`catalogue.schema.table` ne dit pas le workspace) et ne peut donc pas être devinée. Traduction refusée plutôt qu'un lineage@1 qui échouerait T7 : `databricks://adb-<id>.<n>.azuredatabricks.net`" });
// ---------- Voie d'entrée : détectée ou DÉCLARÉE, jamais devinée en silence (TF-0893) ----------
// Même construction que le `--dialecte` d'importer.mjs : la voie figure au manifeste, une voie
// déclarée inconnue est refusée sans interprétation, et une entrée qui porte les DEUX champs
// est ambiguë — traduire l'un en taisant l'autre perdrait la moitié du relevé en silence.
if (voieArg !== null && !VOIES.includes(voieArg))
  sortir("ECHEC", 2, { erreur: `voie déclarée « ${voieArg} » inconnue — attendu ${VOIES.join(" | ")} ; jamais interprétée au jugé` });
const aLignes = Array.isArray(doc.lignes) && doc.lignes.length > 0;
const aReponses = Array.isArray(doc.reponses) && doc.reponses.length > 0;
if (aLignes && aReponses)
  sortir("ECHEC", 2, { erreur: "export ambigu : « lignes » (system tables) ET « reponses » (API lineage-tracking) sont tous deux renseignés — les deux voies ne se mélangent pas dans un même fichier (grains et niveaux de confiance différents). Scinder l'export" });
const VOIE = voieArg || (aReponses ? "api-lineage-tracking" : "system-tables");
if (VOIE === "api-lineage-tracking" && !aReponses)
  sortir("ECHEC", 2, { erreur: "voie « api-lineage-tracking » : champ « reponses » absent ou vide — aucune réponse de GET /api/2.0/lineage-tracking/table-lineage exploitable" });
if (VOIE === "system-tables" && aReponses)
  sortir("ECHEC", 2, { erreur: "voie « system-tables » déclarée mais l'entrée porte « reponses » (API lineage-tracking) — la voie déclarée et le contenu se contredisent" });
if (VOIE === "api-lineage-tracking") traduireApiLineageTracking(); // ne revient jamais (sortir())

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

const entrees = [...entreesMap].map(([dataset, date]) => ({ dataset, namespace: NS, date }));
const sorties = [...sortiesSet].map(dataset => ({ dataset, namespace: NS }));
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
  origine: { verbe: VERBE, voie: VOIE, source: path.basename(file) },
};

// ---------- Écriture ----------
ecrireLineage(lineage, { tables_entree: entrees.length, tables_sortie: sorties.length, transformations: transformations.length, colonnes: colonnes.length });

// ================================================================================================
// Écriture commune aux deux voies.
// ================================================================================================
function ecrireLineage(lineageProduit, compte) {
  let outPath = sortieArg;
  if (!outPath) {
    const base = path.basename(file).replace(/\.[^.]+$/, "");
    const outDir = sortieDirArg || path.dirname(path.resolve(file));
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) { sortir("ECHEC", 1, { erreur: `dossier de sortie impossible à créer : ${e.message}` }); }
    outPath = path.join(outDir, `${base}.lineage.json`);
  }
  try { fs.writeFileSync(outPath, JSON.stringify(lineageProduit, null, 2) + "\n"); }
  catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); }
  sortir("OK", 0, { voie: VOIE, compte, fichier_produit: outPath });
}

// ================================================================================================
// Voie `api-lineage-tracking` (TF-0893) — GET /api/2.0/lineage-tracking/table-lineage,
// une réponse par table interrogée, grain TABLE. Appelée avant toute lecture de `lignes` ;
// elle ne rend jamais la main (tout chemin finit par sortir()).
// ================================================================================================
function traduireApiLineageTracking() {
  const ENTITES = [
    { champ: "notebookInfos", cle: "notebook_id", prefixe: "notebook" },
    { champ: "jobInfos", cle: "job_id", prefixe: "job" },
    { champ: "pipelineInfos", cle: "pipeline_id", prefixe: "pipeline" },
    { champ: "queryInfos", cle: "query_id", prefixe: "requete" },
  ];
  const entreesMap = new Map();   // dataset côté source d'une arête -> lineage_timestamp le plus récent
  const sortiesMap = new Map();   // dataset côté cible d'une arête -> idem (date non exigée par T4)
  const etapes = new Set();
  const erreursApi = [];
  let horodatageApi = null;

  // Un dataset de ce format est une table QUALIFIÉE : les trois segments viennent de tableInfo
  // (catalog_name, schema_name, name). Un segment manquant est un export incohérent — jamais
  // un nom partiel recollé, qui désignerait un autre objet.
  const datasetDe = (ti, ou) => {
    const parts = [ti && ti.catalog_name, ti && ti.schema_name, ti && ti.name]
      .map(x => (typeof x === "string" ? x.trim() : ""));
    if (parts.some(p => !p)) {
      erreursApi.push(`${ou} : tableInfo incomplet (catalog_name / schema_name / name attendus, obtenu « ${parts.join(".")} ») — nom qualifié impossible à reconstruire, export incohérent`);
      return null;
    }
    return parts.join(".");
  };
  const majDate = (map, dataset, date) => {
    const prev = map.get(dataset);
    if (prev === undefined || (date && (!prev || date > prev))) map.set(dataset, date || prev || null);
    if (date && (!horodatageApi || date > horodatageApi)) horodatageApi = date;
  };
  const relever = (voisin, ou) => {
    if (!voisin || typeof voisin !== "object") { erreursApi.push(`${ou} : entrée de lineage vide ou non structurée`); return null; }
    if (!voisin.tableInfo) {
      avert(`${ou} : entrée sans « tableInfo » (emplacement externe de type fileInfo, ou entité non tabulaire) — ÉCARTÉE : cette voie est au grain table qualifiée, pas au grain fichier`);
      return null;
    }
    for (const e of ENTITES)
      if (Array.isArray(voisin[e.champ]))
        for (const inf of voisin[e.champ]) {
          const id = inf && (inf[e.cle] !== undefined && inf[e.cle] !== null) ? String(inf[e.cle]).trim() : "";
          if (id) etapes.add(`${e.prefixe}_${id}`.replace(/[^\w]+/g, "_"));
        }
    return { dataset: datasetDe(voisin.tableInfo, ou), date: typeof voisin.tableInfo.lineage_timestamp === "string" ? voisin.tableInfo.lineage_timestamp.trim() : "" };
  };

  doc.reponses.forEach((r, i) => {
    const ou = `reponses #${i + 1}`;
    const cible = typeof r?.table_name === "string" ? r.table_name.trim() : "";
    if (!cible) { erreursApi.push(`${ou} : champ « table_name » absent — la table interrogée nomme le pivot de sa réponse, sans elle aucune arête n'est orientée`); return; }
    const rep = r.reponse && typeof r.reponse === "object" ? r.reponse : null;
    if (!rep) { erreursApi.push(`${ou} : champ « reponse » absent ou non structuré (corps de la réponse de l'API attendu)`); return; }
    const ups = Array.isArray(rep.upstreams) ? rep.upstreams : [];
    const downs = Array.isArray(rep.downstreams) ? rep.downstreams : [];
    if (!ups.length && !downs.length)
      avert(`${ou} (« ${cible} ») : réponse sans upstream ni downstream — table isolée dans le relevé, aucune arête produite`);
    for (let j = 0; j < ups.length; j++) {
      const v = relever(ups[j], `${ou} · upstreams #${j + 1}`);
      if (!v || !v.dataset) continue;
      majDate(entreesMap, v.dataset, v.date);        // amont → table interrogée
      majDate(sortiesMap, cible, v.date);
    }
    for (let j = 0; j < downs.length; j++) {
      const v = relever(downs[j], `${ou} · downstreams #${j + 1}`);
      if (!v || !v.dataset) continue;
      majDate(entreesMap, cible, v.date);            // table interrogée → aval
      majDate(sortiesMap, v.dataset, v.date);
    }
  });

  if (erreursApi.length) sortir("ECHEC", 2, { voie: VOIE, erreur: "export API lineage-tracking incohérent — aucune traduction produite", details: erreursApi });
  if (!entreesMap.size || !sortiesMap.size)
    sortir("ECHEC", 2, { voie: VOIE, erreur: "aucune arête de lineage exploitable après agrégation (upstreams et downstreams vides partout) — traduction refusée plutôt qu'un lineage@1 qui échouerait T2/T4" });
  const sansDate = [...entreesMap].filter(([, d]) => !d).map(([t]) => t);
  if (sansDate.length)
    sortir("ECHEC", 2, { voie: VOIE, erreur: "table(s) d'entrée sans `lineage_timestamp` exploitable — traduction refusée plutôt qu'un lineage@1 qui échouerait T2 (date de fraîcheur obligatoire)", tables_sans_date: sansDate });
  if (!etapes.size)
    sortir("ECHEC", 2, { voie: VOIE, erreur: "aucune entité d'exécution nommée (notebookInfos / jobInfos / pipelineInfos / queryInfos absents de toutes les réponses) — appeler l'API avec `include_entity_lineage=true` ; traduction refusée plutôt qu'un lineage@1 qui échouerait T3" });

  // Le grain de cette voie est la TABLE : pas de champ `colonnes` (T6 reste optionnel), et un
  // niveau de maturité 0 assumé — cf. l'en-tête de ce fichier.
  avert("voie « api-lineage-tracking » : lineage au grain TABLE, `confiance.niveau` = 0 (échelle REX X6 : les niveaux 1 à 3 sont des grains COLONNE). La capture est bien runtime — c'est dit dans `confiance.methode` et dans le type des transformations —, mais un grain table ne se déclare pas colonne");
  ecrireLineage({
    format: "forge-data/lineage@1",
    artefact: doc.artefact,
    entrees: [...entreesMap].map(([dataset, date]) => ({ dataset, namespace: NS, date })),
    transformations: [...etapes].map(etape => ({ etape, type: "runtime" })),
    sorties: [...sortiesMap.keys()].map(dataset => ({ dataset, namespace: NS })),
    horodatage: horodatageApi || new Date().toISOString(),
    confiance: {
      niveau: 0,
      methode: "traduction automatique des réponses de GET /api/2.0/lineage-tracking/table-lineage (Unity Catalog Databricks, include_entity_lineage=true) — capture runtime au grain TABLE, TF-0893 ; voie ouverte parce que system.access est refusé (SQLSTATE 42501, INSUFFICIENT_PERMISSIONS) sur un workspace réel avec les droits d'une mission. Niveau 0 : la capture est runtime mais le grain est table (REX X6)",
    },
    origine: { verbe: VERBE, voie: VOIE, source: path.basename(file) },
  }, {
    tables_entree: entreesMap.size, tables_sortie: sortiesMap.size,
    transformations: etapes.size, colonnes: 0, reponses_lues: doc.reponses.length,
  });
}
