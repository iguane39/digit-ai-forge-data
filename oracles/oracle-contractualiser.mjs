#!/usr/bin/env node
// oracle-contractualiser — Domaine « Data contract exécutable : schéma + SLA + propriétaire
// + version » (déterministe).
// Niveau fixé par la barre ODCS v3.1.0 (Bitol / Linux Foundation — registre la-barre,
// 12/08/2026, verdict retenu documenté dans references/STANDARDS-DATA.md) : un data
// contract engage un accord producteur↔consommateur INSPECTABLE sur quatre piliers —
// schéma (objets + propriétés typées), SLA (garanties mesurables), propriétaire (qui
// répond) et versionnage (statut de cycle de vie). Transcription maison
// (`forge-data/contrat@1`, v0 — les 11 sections complètes d'ODCS ne sont pas toutes
// couvertes, cf. non_juge) :
//   C1  format + id du contrat nommé (ODCS apiVersion/kind/id) ;
//   C2  schema non vide — chaque objet nommé, chaque propriété nommée et typée dans le jeu
//       fermé {string, entier, decimal, booleen, date, timestamp} (ODCS logicalType) ;
//   C3  sla non vide — chaque garantie a une propriete du jeu fermé {fraicheur,
//       disponibilite, retention, frequence} (ODCS slaProperties.property), une valeur et
//       une unite ;
//   C4  proprietaire déclaré — equipe ET contact joignable (ODCS team + support) : un
//       contrat sans responsable n'engage personne ;
//   C5  versionnage — version au format semver (x.y.z) et statut dans le jeu fermé ODCS
//       {brouillon, actif, deprecie, retire} (draft/active/deprecated/retired).
// non_juge : conformité aux 11 sections complètes du standard ODCS (v0 couvre les 4
// piliers cités par l'item TF-0108 : schéma, SLA, propriétaire, version — pricing,
// infrastructure, rôles opérationnels hors v0) ; véracité runtime du SLA annoncé (le
// producteur respecte-t-il vraiment sa fraîcheur déclarée — D-D2, hors v0) ; validation du
// type physique déclaré contre le moteur de stockage cible.
// Usage : node oracle-contractualiser.mjs <contrat.json> [--json-only]
import fs from "node:fs";

const DOM = "Data contract exécutable : schéma + SLA + propriétaire + version (C1-C5, niveau ODCS v3.1)";
const NON_JUGE = [
  "conformité aux 11 sections complètes du standard ODCS — v0 couvre les 4 piliers exigés par l'item (schéma, SLA, propriétaire, version)",
  "véracité runtime du SLA annoncé (le producteur respecte-t-il sa fraîcheur déclarée — hors v0)",
  "validation du type physique déclaré contre le moteur de stockage cible",
];
const TYPES_PROPRIETE = ["string", "entier", "decimal", "booleen", "date", "timestamp"];
const SLA_PROPRIETES = ["fraicheur", "disponibilite", "retention", "frequence"];
const STATUTS = ["brouillon", "actif", "deprecie", "retire"];
const SEMVER = /^\d+\.\d+\.\d+$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-contractualiser", domaine: DOM, artefact: file || null,
    verdict, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "C1-C5 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "C1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "C1", "JSON invalide", file); out("FAIL", 1); }
if (d.format !== "forge-data/contrat@1") add("bloquant", "C1", `format « ${d.format} » (attendu forge-data/contrat@1)`, file);
if (!d.id) add("bloquant", "C1", "id du contrat non nommé", file);

if (!Array.isArray(d.schema) || !d.schema.length) add("bloquant", "C2", "schema absent ou vide — un contrat sans schéma n'engage rien", file);
else d.schema.forEach((o, i) => {
  const ou = `schema #${i + 1}`;
  if (!o.objet) add("bloquant", "C2", "objet non nommé", ou);
  if (!Array.isArray(o.proprietes) || !o.proprietes.length) add("bloquant", "C2", "propriétés absentes ou vides", ou);
  else o.proprietes.forEach((p, j) => {
    const oup = `${ou} · propriete #${j + 1}`;
    if (!p.nom) add("bloquant", "C2", "propriété non nommée", oup);
    if (!TYPES_PROPRIETE.includes(p.type)) add("bloquant", "C2", `type « ${p.type} » hors du jeu fermé {${TYPES_PROPRIETE.join(", ")}}`, oup);
  });
});

if (!Array.isArray(d.sla) || !d.sla.length) add("bloquant", "C3", "sla absent ou vide — un contrat sans garantie mesurable n'engage rien", file);
else d.sla.forEach((s, i) => {
  const ou = `sla #${i + 1}`;
  if (!SLA_PROPRIETES.includes(s.propriete)) add("bloquant", "C3", `propriete « ${s.propriete} » hors du jeu fermé {${SLA_PROPRIETES.join(", ")}}`, ou);
  if (s.valeur === undefined || s.valeur === "") add("bloquant", "C3", "valeur manquante", ou);
  if (!s.unite) add("bloquant", "C3", "unite manquante", ou);
});

const prop = d.proprietaire || {};
if (!prop.equipe) add("bloquant", "C4", "équipe propriétaire non déclarée — un contrat sans responsable n'engage personne", file);
if (!prop.contact || !EMAIL.test(prop.contact)) add("bloquant", "C4", "contact joignable absent ou invalide (adresse attendue)", file);

if (!SEMVER.test(d.version || "")) add("bloquant", "C5", `version « ${d.version} » hors format semver (x.y.z)`, file);
if (!STATUTS.includes(d.statut)) add("bloquant", "C5", `statut « ${d.statut} » hors du jeu fermé {${STATUTS.join(", ")}}`, file);

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
