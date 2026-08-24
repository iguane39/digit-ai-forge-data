#!/usr/bin/env node
// oracle-tracer — Domaine « Lineage déclaré complet » (déterministe).
// Niveau fixé par la barre OpenLineage (object model — registre la-barre, 11/08/2026) :
// un lineage complet déclare run · job · datasets d'entrée · datasets de sortie · facets.
// Transcription maison (`forge-data/lineage@1`) :
//   T1  format + artefact nommé ;
//   T2  entrées non vides — chaque dataset nommé ET daté (facet de fraîcheur) ;
//   T3  transformations non vides — chaque étape nommée, type ∈ {declaratif, statique,
//       runtime} (bifurcation du REX X5 : l'opaque n'est accessible qu'en runtime) ;
//   T4  sorties non vides + horodatage d'exécution (le « run » d'OpenLineage) ;
//   T5  méta-lineage : confiance.niveau ∈ 0..3 (maturité, REX X6) + confiance.methode ;
//       champ optionnel `etat` ∈ {constate, propose} (RD-4, 13/08) — un mapping proposé
//       (colonne cible non encore alimentée) se déclare, absent = constate
//       (comment ce lineage a été établi — REX X8) ;
//   T6  (optionnel, rétro-compatible) grain colonne — champ `colonnes` : chaque entrée
//       référence une colonne de sortie déclarée (`sortie` = "<dataset>.<colonne>", le
//       dataset devant figurer dans `sorties`) et au moins une colonne d'entrée déclarée
//       (`entrees`, dataset figurant dans `entrees`) ; `transformation` optionnelle doit
//       viser une étape déclarée. Un lineage@1 sans `colonnes` reste T1-T5 valide (v0).
//   T7  L'ENVIRONNEMENT DE CHAQUE DATASET — champ `namespace` sur chaque entrée et chaque
//       sortie (TF-0580, retour SCC_ALX du 24/08). OpenLineage identifie un dataset par le
//       COUPLE (namespace, name) ; la transcription maison n'avait retenu que le nom, et
//       cette moitié perdue est précisément le « où ». Jugée à partir du 2026-08-24 sur
//       l'`horodatage` du lineage lui-même : antériorité DÉCLARÉE plutôt qu'un corpus
//       entier mis en échec rétroactivement (même arbitrage que R11 d'oracle-todo).
// non_juge : véracité du lineage déclaré vs réalité d'exécution (capture runtime, hors v0) ;
// résolution colonne→colonne multi-saut (T6 vérifie la référence directe, pas le chemin
// complet) ; le catalogue cible ; la JUSTESSE d'un `namespace` déclaré (T7 constate qu'il
// est là et qu'il désigne une instance, jamais que c'est la bonne).
// Usage : node oracle-tracer.mjs <lineage.json> [--json-only]
import fs from "node:fs";

const DOM = "Lineage déclaré complet (T1-T5, T6 optionnel grain colonne, T7 environnement des datasets — niveau OpenLineage)";
const NON_JUGE = [
  "véracité du lineage déclaré contre le plan réellement exécuté (capture runtime — niveau 3, hors v0)",
  "résolution colonne→colonne multi-saut (T6 vérifie que la référence directe existe, pas la chaîne complète)",
  "ingestion dans un catalogue (OpenMetadata ou autre) — instanciation, pas discipline",
  "T7 : la JUSTESSE du `namespace` déclaré. L'oracle constate qu'il est présent et qu'il ne se " +
    "réduit pas à un nom de technologie ; il ne peut pas savoir si `databricks://adb-1234…` est " +
    "bien l'instance qui a répondu. Un namespace faux mais bien formé passe — et c'est déjà " +
    "infiniment mieux qu'un namespace absent, qui rend deux archives INDISCERNABLES au lieu de fausses",
  "T7 : un lineage écrit aujourd'hui avec un `horodatage` antérieur au 2026-08-24 échappe au " +
    "jugement. La borne d'antériorité est déclarée, donc contournable ; elle est préférée à la " +
    "mise en échec rétroactive de tout lineage existant (R-33 bis : une règle bruyante se fait " +
    "contourner au lieu de se corriger)",
];
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-tracer", domaine: DOM, artefact: file || null,
    verdict, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "T1-T5 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "T1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "T1", "JSON invalide", file); out("FAIL", 1); }
if (d.format !== "forge-data/lineage@1") add("bloquant", "T1", `format « ${d.format} » (attendu forge-data/lineage@1)`, file);
if (!d.artefact) add("bloquant", "T1", "artefact servi non nommé", file);
if (!Array.isArray(d.entrees) || !d.entrees.length) add("bloquant", "T2", "aucune entrée déclarée — un lineage sans sources n'en est pas un", file);
else d.entrees.forEach((e, i) => {
  if (!e.dataset) add("bloquant", "T2", "dataset d'entrée non nommé", `entrees #${i + 1}`);
  if (!e.date) add("bloquant", "T2", "entrée sans date (facet de fraîcheur exigée)", `entrees #${i + 1}`);
});
if (!Array.isArray(d.transformations) || !d.transformations.length) add("bloquant", "T3", "aucune transformation déclarée (le « job » d'OpenLineage)", file);
else d.transformations.forEach((t, i) => {
  if (!t.etape) add("bloquant", "T3", "étape de transformation non nommée", `transformations #${i + 1}`);
  if (!["declaratif", "statique", "runtime"].includes(t.type))
    add("bloquant", "T3", `type « ${t.type} » hors {declaratif, statique, runtime} — la bifurcation doit être déclarée`, `transformations #${i + 1}`);
});
if (!Array.isArray(d.sorties) || !d.sorties.length || d.sorties.some(s => !s.dataset))
  add("bloquant", "T4", "sorties absentes ou non nommées", file);
if (!d.horodatage) add("bloquant", "T4", "horodatage d'exécution absent (le « run » d'OpenLineage)", file);
const c = d.confiance || {};
if (!(Number.isInteger(c.niveau) && c.niveau >= 0 && c.niveau <= 3))
  add("bloquant", "T5", "confiance.niveau absent ou hors 0..3 (maturité du lineage — REX X6)", file);
if (!c.methode) add("bloquant", "T5", "confiance.methode absente — le méta-lineage dit COMMENT ce lineage a été établi (REX X8)", file);
// RD-4 (SCC_ALX, 13/08) : un mapping PROPOSÉ (colonne cible pas encore alimentée) passait
// T6 sans que rien ne le distingue d'un lineage CONSTATÉ — contourné en texte libre dans
// confiance.methode. Champ optionnel `etat`, jeu fermé, jugé par T5 ; absent = constate
// (rétro-compatible, tous les lineages existants sont des constats).
if (d.etat !== undefined && !["constate", "propose"].includes(d.etat))
  add("bloquant", "T5", `etat « ${d.etat} » hors du jeu fermé {constate, propose} — un lineage projeté se DÉCLARE (RD-4), il ne se glisse pas en texte libre`, file);
if (d.colonnes !== undefined) {
  const dsEntrees = new Set((Array.isArray(d.entrees) ? d.entrees : []).map(e => e.dataset));
  const dsSorties = new Set((Array.isArray(d.sorties) ? d.sorties : []).map(s => s.dataset));
  const etapes = new Set((Array.isArray(d.transformations) ? d.transformations : []).map(t => t.etape));
  const datasetDe = ref => (typeof ref === "string" && ref.includes(".")) ? ref.slice(0, ref.lastIndexOf(".")) : "";
  if (!Array.isArray(d.colonnes) || !d.colonnes.length) {
    add("bloquant", "T6", "colonnes déclaré mais vide — le grain colonne (OpenLineage columnLineage) n'ajoute rien à vide", file);
  } else d.colonnes.forEach((c, i) => {
    const ou = `colonnes #${i + 1}`;
    if (!c.sortie) add("bloquant", "T6", "colonne de sortie non référencée", ou);
    else if (!dsSorties.has(datasetDe(c.sortie))) add("bloquant", "T6", `sortie « ${c.sortie} » ne référence aucun dataset déclaré en sorties`, ou);
    if (!Array.isArray(c.entrees) || !c.entrees.length) add("bloquant", "T6", "aucune colonne d'entrée référencée", ou);
    else c.entrees.forEach(ref => {
      if (!dsEntrees.has(datasetDe(ref))) add("bloquant", "T6", `entrée « ${ref} » ne référence aucun dataset déclaré en entrees`, ou);
    });
    if (c.transformation && !etapes.has(c.transformation)) add("bloquant", "T6", `transformation « ${c.transformation} » non déclarée parmi les étapes`, ou);
  });
}

// ---- T7 — l'ENVIRONNEMENT de chaque dataset (TF-0580, retour SCC_ALX du 24/08) -------------
// LE FAIT MESURÉ. Un poste portait deux profils de connexion vers deux workspaces Databricks
// distincts, exposant TOUS DEUX un catalogue nommé `catalog_any_bronze_d1`. La même requête sur
// l'un et sur l'autre rend deux résultats différents et — c'est là le défaut — deux archives
// STRICTEMENT INDISCERNABLES : plus de 60 mesures prises en onze jours sans que rien ne dise
// laquelle a répondu. La doctrine réclamait le QUOI (`oracle-restituer`, le marqueur) et le
// COMMENT (T1-T6, le lineage) ; personne ne réclamait le OÙ.
//
// POURQUOI C'EST UNE RÉGRESSION DE TRANSCRIPTION, ET PAS UN OUBLI DE RÉDACTEUR. La barre retenue
// pour ce verbe est l'object model d'OpenLineage, où un dataset est identifié par le COUPLE
// (namespace, name) — le namespace étant `scheme://authority`, c'est-à-dire l'instance. La
// transcription maison `forge-data/lineage@1` n'avait retenu que `dataset`, donc la moitié NOM.
// La moitié perdue est exactement celle qui porte le « où ».
//
// ET C'EST UNE DONNÉE QUI N'EST PAS DANS LES DONNÉES. Un export `system.access.column_lineage`
// nomme ses tables `catalogue.schema.table` : trois niveaux qui ne disent RIEN du workspace
// interrogé. Le « où » ne vit pas dans la ligne, il vit dans la CONNEXION — donc il se déclare,
// ou il est perdu pour toujours. Aucune analyse a posteriori ne le retrouvera.
//
// LE JEU FERMÉ DES NAMESPACES QUI NE DISCRIMINENT RIEN. Un champ rempli n'est pas un champ utile :
// « databricks » ne distingue pas deux workspaces Databricks, et c'est le mot que l'on écrit
// spontanément. Même construction à liste fermée que les termes ambigus d'EA2 en conception —
// un namespace qui est un nom de technologie NU est refusé, la convention OpenLineage
// `scheme://authority` étant acceptée sans autre examen.
const TECHNOS_NUES = new Set([
  "databricks", "postgres", "postgresql", "mysql", "mariadb", "oracle", "sqlserver", "mssql",
  "bigquery", "snowflake", "redshift", "athena", "s3", "gcs", "abfss", "adls", "azure", "aws",
  "gcp", "kafka", "file", "local", "hive", "spark", "dbt", "prod", "production", "dev",
  "developpement", "développement", "staging", "recette", "qualif", "test",
]);
// Antériorité DÉCLARÉE plutôt que corpus mis en échec (même arbitrage que R11 d'oracle-todo) :
// T7 ne juge que les lineages dont le `horodatage` est postérieur à la publication de la règle.
const T7_DEPUIS = Date.parse("2026-08-24T00:00:00Z");
const t7Juge = (() => {
  const t = Date.parse(d.horodatage || "");
  return Number.isFinite(t) ? t >= T7_DEPUIS : true; // horodatage illisible : T4 le dit déjà, T7 juge
})();
if (!t7Juge) {
  add("info", "T7", `lineage antérieur au 2026-08-24 (horodatage ${d.horodatage}) — l'environnement des datasets n'est pas jugé : antériorité déclarée, pas oubliée`, file);
} else {
  const jugerNamespace = (o, ou, role) => {
    const ns = o && typeof o.namespace === "string" ? o.namespace.trim() : "";
    if (!ns) {
      add("bloquant", "T7",
        `${role} « ${(o && o.dataset) || "?"} » sans \`namespace\` — OpenLineage identifie un dataset par (namespace, name) ; ` +
        "sans le namespace, deux datasets homonymes sur deux instances rendent deux lineages INDISCERNABLES. " +
        "Le « où » ne vit pas dans la donnée, il vit dans la connexion : il se déclare ou il est perdu",
        ou);
      return;
    }
    if (ns.includes("://")) return; // convention OpenLineage scheme://authority — l'instance est là
    if (TECHNOS_NUES.has(ns.toLowerCase())) {
      add("bloquant", "T7",
        `${role} « ${o.dataset} » : namespace « ${ns} » est un nom de technologie NU — il ne distingue pas deux ` +
        "instances de cette même technologie, qui est exactement le cas mesuré (deux workspaces, un catalogue homonyme). " +
        "Nommer l'INSTANCE : `databricks://adb-0000000000000001.10.azuredatabricks.net`, ou un identifiant stable de l'environnement",
        ou);
    }
  };
  (Array.isArray(d.entrees) ? d.entrees : []).forEach((e, i) => jugerNamespace(e, `entrees #${i + 1}`, "entrée"));
  (Array.isArray(d.sorties) ? d.sorties : []).forEach((s, i) => jugerNamespace(s, `sorties #${i + 1}`, "sortie"));
  if (!F.some(f => f.regle === "T7"))
    add("info", "T7", "chaque dataset déclare son environnement (namespace désignant une instance)", file);
}

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
