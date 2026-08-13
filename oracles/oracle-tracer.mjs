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
// non_juge : véracité du lineage déclaré vs réalité d'exécution (capture runtime, hors v0) ;
// résolution colonne→colonne multi-saut (T6 vérifie la référence directe, pas le chemin
// complet) ; le catalogue cible.
// Usage : node oracle-tracer.mjs <lineage.json> [--json-only]
import fs from "node:fs";

const DOM = "Lineage déclaré complet (T1-T5, T6 optionnel grain colonne — niveau OpenLineage)";
const NON_JUGE = [
  "véracité du lineage déclaré contre le plan réellement exécuté (capture runtime — niveau 3, hors v0)",
  "résolution colonne→colonne multi-saut (T6 vérifie que la référence directe existe, pas la chaîne complète)",
  "ingestion dans un catalogue (OpenMetadata ou autre) — instanciation, pas discipline",
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
out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
