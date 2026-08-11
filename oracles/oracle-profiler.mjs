#!/usr/bin/env node
// oracle-profiler — Domaine « Qualité de données : assertions exécutables » (déterministe).
// Niveau fixé par la barre Great Expectations (registre la-barre, 11/08/2026) : la qualité
// s'exprime en ASSERTIONS DÉCLARATIVES UNITAIRES à verdict machine — jamais en prose.
//   P1  format `forge-data/assertions@1`, liste non vide ;
//   P2  chaque assertion nomme son objet (table/colonne) et son type dans le jeu fermé
//       {non_nul, unique, bornes, ensemble, motif, fraicheur} avec les paramètres du type ;
//   P3  aucun vocabulaire subjectif (« propre », « correct », « bon », « valide »,
//       « cohérent ») en guise de condition — une assertion se mesure ou n'est pas.
// non_juge : l'EXÉCUTION des assertions sur un dataset réel (composée : skill
// data-quality-auditor) ; la pertinence métier des seuils ; l'échantillonnage.
// Usage : node oracle-profiler.mjs <assertions.json> [--json-only]
import fs from "node:fs";

const DOM = "Qualité de données : assertions exécutables (P1-P3)";
const NON_JUGE = [
  "exécution des assertions sur données réelles — composée via le skill data-quality-auditor, jamais réécrite ici",
  "pertinence métier des seuils et des bornes (revue humaine)",
  "profilage exploratoire (distributions, outliers) — data-quality-auditor",
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
  for (const p of TYPES[a.type]) if (a[p] === undefined || a[p] === "")
    add("bloquant", "P2", `paramètre « ${p} » requis par le type ${a.type}`, ou);
  const libre = [a.condition, a.description].filter(Boolean).join(" ");
  if (libre && SUBJECTIF.test(libre))
    add("bloquant", "P3", `vocabulaire subjectif « ${libre.match(SUBJECTIF)[0]} » — une assertion se mesure ou n'est pas`, ou);
});
out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
