#!/usr/bin/env node
// oracle-transformer — Domaine « Forme d'un projet de transformation Silver/Gold : dépendances
// déclarées, description, tests attachés, tests rejoués, documentation générée » (déterministe).
// TF-0861, lot L4 de l'étude d'opportunité du pilot du 07/09/2026.
//
// Niveau fixé par la barre dbt-core (registre la-barre, cible « verbe transformer », validée
// humain le 07/09/2026, D-6 a) : un projet de transformation déclare ses dépendances par
// ref/source (le DAG se déduit, il ne se dessine pas), chaque modèle porte une description et au
// moins un test, la documentation se GÉNÈRE depuis les déclarations. La forme est exigée, l'outil
// est celui du projet : l'oracle lit les artefacts que l'outil faisant foi produit — le
// `manifest.json` de dbt (`target/manifest.json`, JSON, nodes + depends_on + tests), le
// `run_results.json` de `dbt test`, le `catalog.json` de `dbt docs generate` — jamais un YAML
// réinterprété par une grammaire maison (règle R3 de quality-oracles : adossé à l'outil, pas
// réimplémenté). Un projet SQL Delta ou notebooks qui veut être jugé produit les mêmes trois
// fichiers (le format est ouvert), ou déclare qu'il ne le peut pas.
//   TR1  manifest lisible, `nodes` présent, au moins un modèle (resource_type = model) ;
//   TR2  chaque modèle déclare au moins une dépendance (depends_on.nodes : ref ou source) ;
//   TR3  chaque modèle porte une description (≥ 10 caractères) ;
//   TR4  chaque modèle a au moins un test rattaché (node resource_type = test dont depends_on
//        contient le modèle) ;
//   TR5  tests rejoués : `run_results.json` présent à côté, et chaque test qui y figure est
//        `pass` — un test `fail`/`error` est bloquant ; un test du manifest absent des résultats
//        est signalé (avertissement) ; fichier absent : avertissement « tests non rejoués » ;
//   TR6  documentation générée : `catalog.json` présent à côté du manifest (dbt docs generate) —
//        une documentation écrite à part n'est pas une documentation générée.
// non_juge : justesse du SQL des modèles ; couverture des tests (un test par modèle est un
// plancher, pas une suffisance — forge-tests, pan data, mesure l'exercice des contraintes) ;
// fraîcheur des artefacts lus (un manifest de la veille juge le projet de la veille).
// Usage : node oracle-transformer.mjs <dossier-target | manifest.json> [--json-only]
import fs from "node:fs";
import path from "node:path";

const DOM = "Projet de transformation : dépendances déclarées, description, tests attachés et rejoués, documentation générée (TR1-TR6, niveau dbt-core)";
const NON_JUGE = [
  "justesse du SQL des modèles — seule la FORME du projet est jugée",
  "couverture des tests au-delà du plancher « au moins un test par modèle » — forge-tests (pan data) mesure l'exercice réel",
  "fraîcheur des artefacts lus (manifest, run_results, catalog) par rapport au code du projet",
];

const args = process.argv.slice(2);
const cible = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-transformer", domaine: DOM, artefact: cible || null,
    verdict, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "TR1-TR6 sans écart", where: cible }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!cible || !fs.existsSync(cible)) { add("info", "TR1", "cible introuvable", String(cible)); out("SKIP", 2); }
const dossier = fs.statSync(cible).isDirectory() ? cible : path.dirname(cible);
const manifestPath = fs.statSync(cible).isDirectory() ? path.join(cible, "manifest.json") : cible;
if (!fs.existsSync(manifestPath)) { add("bloquant", "TR1", "manifest.json absent — l'outil de transformation produit son manifeste, l'oracle le lit", dossier); out("FAIL", 1); }
let m = null;
try { m = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { add("bloquant", "TR1", "manifest.json invalide", manifestPath); out("FAIL", 1); }
const nodes = m && m.nodes && typeof m.nodes === "object" ? m.nodes : null;
if (!nodes) { add("bloquant", "TR1", "manifest sans `nodes`", manifestPath); out("FAIL", 1); }
const entries = Object.entries(nodes);
const modeles = entries.filter(([, n]) => n && n.resource_type === "model");
const tests = entries.filter(([, n]) => n && n.resource_type === "test");
if (!modeles.length) add("bloquant", "TR1", "aucun modèle (resource_type = model) dans le manifest", manifestPath);

for (const [id, n] of modeles) {
  const ou = `modèle ${n.name || id}`;
  const deps = (n.depends_on && Array.isArray(n.depends_on.nodes)) ? n.depends_on.nodes : [];
  if (!deps.length) add("bloquant", "TR2", "aucune dépendance déclarée (ref/source) — le DAG se déduit des déclarations, un modèle sans amont n'en fait pas partie", ou);
  const desc = String(n.description || "").trim();
  if (desc.length < 10) add("bloquant", "TR3", "description absente ou squelettique (≥ 10 caractères) — la documentation se génère depuis elle", ou);
  const testsDuModele = tests.filter(([, t]) => t.depends_on && Array.isArray(t.depends_on.nodes) && t.depends_on.nodes.includes(id));
  if (!testsDuModele.length) add("bloquant", "TR4", "aucun test rattaché — un modèle sans test n'est pas prouvé", ou);
}

// TR5 · tests rejoués
const rrPath = path.join(dossier, "run_results.json");
if (!fs.existsSync(rrPath)) add("avertissement", "TR5", "run_results.json absent — les tests ne sont pas rejoués, le projet est jugé sur sa forme seule", dossier);
else {
  let rr = null;
  try { rr = JSON.parse(fs.readFileSync(rrPath, "utf8")); } catch { add("bloquant", "TR5", "run_results.json invalide", rrPath); }
  const results = rr && Array.isArray(rr.results) ? rr.results : [];
  const parId = new Map(results.map(r => [r.unique_id, r]));
  for (const [id, t] of tests) {
    const r = parId.get(id);
    if (!r) { add("avertissement", "TR5", `test « ${t.name || id} » présent au manifest mais absent des résultats — non rejoué`, `test ${t.name || id}`); continue; }
    if (String(r.status).toLowerCase() !== "pass") add("bloquant", "TR5", `test « ${t.name || id} » en statut « ${r.status} » — un test rouge n'est pas un test`, `test ${t.name || id}`);
  }
}

// TR6 · documentation générée
if (!fs.existsSync(path.join(dossier, "catalog.json"))) add("bloquant", "TR6", "catalog.json absent — la documentation se GÉNÈRE (dbt docs generate) depuis les déclarations, jamais écrite à part", dossier);

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
