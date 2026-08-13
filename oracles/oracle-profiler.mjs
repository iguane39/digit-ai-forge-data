#!/usr/bin/env node
// oracle-profiler — Domaine « Qualité de données : assertions exécutables » (déterministe).
// Niveau fixé par la barre Great Expectations (registre la-barre, 11/08/2026) : la qualité
// s'exprime en ASSERTIONS DÉCLARATIVES UNITAIRES à verdict machine — jamais en prose.
//   P1  format `forge-data/assertions@1`, liste non vide ;
//   P2  chaque assertion nomme son objet (table/colonne) et son type dans le jeu fermé,
//       avec les paramètres EXACTS de son type (RD-2, SCC_ALX 13/08 — jeu documenté ici,
//       plus seulement dans la constante TYPES) :
//         non_nul   → objet
//         unique    → objet
//         bornes    → objet, min, max
//         ensemble  → objet, valeurs
//         motif     → objet, regex
//         fraicheur → objet, max_age_jours ;
//   P3  aucun vocabulaire subjectif (« propre », « correct », « bon », « valide »,
//       « cohérent ») en guise de condition — une assertion se mesure ou n'est pas ;
//   P4  (optionnel, rétro-compatible) pont qualité↔lineage — champ `lineage_ref` pointant
//       un fichier forge-data/lineage@1 : transcription maison du facet OpenLineage
//       `dataQualityAssertions` (qui rattache une assertion à un dataset/colonne précis du
//       graphe de lineage). Si présent : le fichier existe et chaque assertion.objet
//       référence un dataset déclaré (entrees/sorties) ou une colonne déclarée (`colonnes`,
//       T6) de ce lineage — sinon le pont est rompu (référence non vérifiable).
// non_juge : l'EXÉCUTION des assertions sur un dataset réel (composée : skill
// data-quality-auditor) ; la pertinence métier des seuils ; l'échantillonnage ; la
// résolution du pont au-delà de la référence directe (chaîne multi-saut, hors v0).
// Usage : node oracle-profiler.mjs <assertions.json> [--json-only]
import fs from "node:fs";
import path from "node:path";

const DOM = "Qualité de données : assertions exécutables (P1-P3, P4 optionnel pont lineage)";
const NON_JUGE = [
  "exécution des assertions sur données réelles — composée via le skill data-quality-auditor, jamais réécrite ici",
  "pertinence métier des seuils et des bornes (revue humaine)",
  "profilage exploratoire (distributions, outliers) — data-quality-auditor",
  "résolution du pont qualité↔lineage au-delà de la référence directe (chaîne multi-saut, hors v0)",
];
const TYPES = {
  non_nul: ["objet"],
  unique: ["objet"],
  bornes: ["objet", "min", "max"],
  ensemble: ["objet", "valeurs"],
  motif: ["objet", "regex"],
  fraicheur: ["objet", "max_age_jours"],
};
const SUBJECTIF = /\b(propre|correct|bon|bonne|valide|cohérent|fiable)\w*\b|\bde qualité\b/i;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-profiler", domaine: DOM, artefact: file || null,
    verdict, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "P1-P3 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "P1", "fichier introuvable", String(file)); out("SKIP", 2); }
let doc = null;
try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "P1", "JSON invalide", file); out("FAIL", 1); }
if (doc.format !== "forge-data/assertions@1") add("bloquant", "P1", `format « ${doc.format} » (attendu forge-data/assertions@1)`, file);
if (!Array.isArray(doc.assertions) || !doc.assertions.length) add("bloquant", "P1", "liste d'assertions absente ou vide", file);
else doc.assertions.forEach((a, i) => {
  const ou = `assertion #${i + 1}`;
  if (!a.objet) add("bloquant", "P2", "objet manquant (table/colonne visée)", ou);
  if (!TYPES[a.type]) { add("bloquant", "P2", `type « ${a.type} » hors du jeu fermé {${Object.keys(TYPES).join(", ")}}`, ou); return; }
  // RD-2 : le message NOMME le jeu complet des paramètres du type — l'utilisateur n'a plus
  // à lire la constante TYPES pour savoir quoi fournir (5 FAIL identiques constatés faute
  // de cette liste dans le message, SCC_ALX 13/08).
  for (const p of TYPES[a.type]) if (a[p] === undefined || a[p] === "")
    add("bloquant", "P2",
      `paramètre « ${p} » requis — le type ${a.type} attend : ${TYPES[a.type].join(", ")}`, ou);
  const libre = [a.condition, a.description].filter(Boolean).join(" ");
  if (libre && SUBJECTIF.test(libre))
    add("bloquant", "P3", `vocabulaire subjectif « ${libre.match(SUBJECTIF)[0]} » — une assertion se mesure ou n'est pas`, ou);
});
if (doc.lineage_ref) {
  const lineagePath = path.join(path.dirname(path.resolve(file)), doc.lineage_ref);
  if (!fs.existsSync(lineagePath)) add("bloquant", "P4", `lineage_ref introuvable : ${doc.lineage_ref}`, file);
  else {
    let lin = null;
    try { lin = JSON.parse(fs.readFileSync(lineagePath, "utf8")); } catch { add("bloquant", "P4", "lineage_ref n'est pas un JSON valide", doc.lineage_ref); }
    if (lin) {
      if (lin.format !== "forge-data/lineage@1") add("bloquant", "P4", `lineage_ref au format « ${lin.format} » (attendu forge-data/lineage@1)`, doc.lineage_ref);
      const datasets = [
        ...(Array.isArray(lin.entrees) ? lin.entrees.map(e => e.dataset) : []),
        ...(Array.isArray(lin.sorties) ? lin.sorties.map(s => s.dataset) : []),
      ].filter(Boolean);
      const colonnes = new Set((Array.isArray(lin.colonnes) ? lin.colonnes : []).flatMap(c => [c.sortie, ...(Array.isArray(c.entrees) ? c.entrees : [])]));
      (Array.isArray(doc.assertions) ? doc.assertions : []).forEach((a, i) => {
        if (!a.objet) return; // absence déjà signalée par P2
        const lie = datasets.some(ds => a.objet === ds || a.objet.startsWith(`${ds}.`)) || colonnes.has(a.objet);
        if (!lie) add("bloquant", "P4", `assertion sur « ${a.objet} » ne référence aucun dataset/colonne du lineage pointé (${doc.lineage_ref}) — pont dataQualityAssertions rompu`, `assertion #${i + 1}`);
      });
    }
  }
}
out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
