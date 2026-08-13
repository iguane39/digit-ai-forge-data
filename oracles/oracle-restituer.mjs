#!/usr/bin/env node
// oracle-restituer — Domaine « Restitution : chiffres ancrés, déclaré → généré » (déterministe).
// Niveau fixé par la barre dbt-core (registre la-barre, 11/08/2026) : tout artefact servi
// déclare ses dépendances ; la documentation se génère DES déclarations — un chiffre sans
// source déclarée n'existe pas.
// Contrat du rapport : frontmatter YAML avec `lineage_ref:` (déclaration lineage@1 jugeable
// par oracle-tracer) et `chiffres:` (liste - id: … / valeur: … / source: … / date: …) ;
// corps : chaque chiffre restitué porte un marqueur [c:<id>].
//   R1  frontmatter présent avec lineage_ref ET bloc chiffres non vide ;
//   R2  chaque entrée chiffres a id, valeur, source, date — sinon le chiffre n'existe pas ;
//   R3  bijection corps ↔ déclarations : tout [c:id] du corps est déclaré ; tout id déclaré
//       est utilisé (sinon avertissement : déclaration morte) ;
//   R4  le fichier lineage_ref existe à côté du rapport (le rapport pointe sa traçabilité).
// non_juge : justesse des valeurs (oracle-calculs) ; montants commerciaux (oracle-claims) ;
// complétude du lineage pointé (oracle-tracer, à exécuter sur lineage_ref).
// Usage : node oracle-restituer.mjs <rapport.md> [--json-only]
import fs from "node:fs";
import path from "node:path";

const DOM = "Restitution : chiffres ancrés, déclaré → généré (R1-R4, niveau dbt)";
const NON_JUGE = [
  "justesse arithmétique des valeurs (oracle-calculs de quality-oracles)",
  "montants commerciaux et engagements datés (oracle-claims)",
  "complétude du lineage pointé — juger lineage_ref avec oracle-tracer",
];
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-restituer", domaine: DOM, artefact: file || null,
    verdict, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "R1-R4 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "R1", "fichier introuvable", String(file)); out("SKIP", 2); }
const texte = fs.readFileSync(file, "utf8");
const fm = texte.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!fm) { add("bloquant", "R1", "frontmatter YAML absent — un rapport se génère de ses déclarations", file); out("FAIL", 1); }
const front = fm[1];
const lineageRef = (front.match(/^lineage_ref\s*:\s*(.+)$/m) || [])[1]?.trim();
if (!lineageRef) add("bloquant", "R1", "lineage_ref absent du frontmatter", file);
// bloc chiffres : liste YAML simple `- id: x` puis champs indentés — parsé ligne à
// ligne (un lookahead paresseux capturait vide au premier saut de ligne : constaté).
const lignesFront = front.split(/\r?\n/);
const debutChiffres = lignesFront.findIndex(l => /^chiffres\s*:\s*$/.test(l));
const entrees = [];
if (debutChiffres !== -1) {
  let cur = null;
  for (let i = debutChiffres + 1; i < lignesFront.length; i++) {
    const l = lignesFront[i];
    if (/^\S/.test(l)) break; // fin du bloc indenté
    const mId = l.match(/^\s*-\s*id\s*:\s*(\S+)/);
    if (mId) { cur = { id: mId[1] }; entrees.push(cur); continue; }
    const mKV = l.match(/^\s+(valeur|source|date)\s*:\s*(.+)$/);
    if (mKV && cur) cur[mKV[1]] = mKV[2].trim();
  }
}
if (!entrees.length) add("bloquant", "R1", "bloc chiffres: absent ou vide — aucun chiffre déclaré", file);
for (const e of entrees) for (const ch of ["valeur", "source", "date"])
  if (!e[ch]) add("bloquant", "R2", `chiffre « ${e.id} » sans ${ch} — un chiffre sans source déclarée n'existe pas`, `chiffres:${e.id}`);
const corps = texte.slice(fm[0].length);
// RD-1 (SCC_ALX, 13/08) : un rapport qui EXPLIQUE sa convention écrit « [c:id] » dans un
// span de code — c'est une mention de la méthode, pas la citation d'un chiffre. Les blocs
// ``` … ``` et les spans `…` sont retirés avant le rapprochement, et la séquence échappée
// [[c:id]] reste affichable sans jamais être comptée. Sans cela, aucun document
// méthodologique ne pouvait décrire sa propre traçabilité (faux positif mesuré : R3 FAIL
// « [c:id] utilisé au corps mais jamais déclaré »).
const corpsJugeable = corps
  .replace(/```[\s\S]*?```/g, "")
  .replace(/`[^`\n]*`/g, "")
  .replace(/\[\[c:[\w-]+\]\]/g, "");
const utilises = [...corpsJugeable.matchAll(/\[c:([\w-]+)\]/g)].map(m => m[1]);
const declares = new Set(entrees.map(e => e.id));
for (const u of new Set(utilises)) if (!declares.has(u))
  add("bloquant", "R3", `[c:${u}] utilisé au corps mais jamais déclaré au frontmatter`, "corps");
for (const d of declares) if (!utilises.includes(d))
  add("avertissement", "R3", `chiffre « ${d} » déclaré mais jamais restitué (déclaration morte)`, "frontmatter");
if (lineageRef && !fs.existsSync(path.join(path.dirname(path.resolve(file)), lineageRef)))
  add("bloquant", "R4", `lineage_ref introuvable à côté du rapport : ${lineageRef}`, file);
out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
