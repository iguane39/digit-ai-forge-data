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
//   R4  le fichier lineage_ref existe à côté du rapport (le rapport pointe sa traçabilité) ;
//   R5  COUVERTURE des nombres de prose : tout nombre du corps porte un marqueur, ou
//       l'échappement explicite [c:-]. Avertissement chiffré par défaut, BLOQUANT sous
//       --strict (TF-0378).
//
// R5 (TF-0378, lot SCC_ALX 20260818b) — R1-R4 jugeaient la BIJECTION marqueur ↔ déclaration :
// tout [c:id] du corps est déclaré, toute déclaration est utilisée. Aucune règle ne demandait
// qu'un NOMBRE porte un marqueur. Un chiffre écrit en prose sans marqueur n'existait donc pas
// pour l'oracle, et l'oracle rendait PASS.
//
// MESURE du 18/08 sur les cinq rapports courants d'un projet réel, TOUS PASS le jour même :
// 135 nombres de prose ancrés contre 788 nus. Coût constaté : deux versions successives d'un
// rapport ont publié « sur les 122 cibles à source », nombre posé en dur dans le générateur
// AVANT exécution, faux (138 dans le modèle mesuré) et comptant en plus une colonne que ce
// même projet avait établie inexistante. L'oracle a rendu PASS sur les deux versions ; le
// défaut a été trouvé par relecture, pas par la route.
//
// Les nombres de TABLEAU restent hors champ : ils sont générés, et leur ancrage est porté par
// le chapeau du chapitre. Les juger ligne à ligne exigerait un marqueur par cellule.
// non_juge : justesse des valeurs (oracle-calculs, chemin résolvable en NON_JUGE — TF-0379) ;
// montants commerciaux (oracle-claims) ;
// complétude du lineage pointé (oracle-tracer, à exécuter sur lineage_ref).
// Usage : node oracle-restituer.mjs <rapport.md> [--json-only] [--strict]
import fs from "node:fs";
import path from "node:path";

const DOM = "Restitution : chiffres ancrés, déclaré → généré (R1-R4, niveau dbt)";
// TF-0379 (lot SCC_ALX 20260818b) — un non_juge est une PROMESSE DE PÉRIMÈTRE : le lire, c'est
// comprendre que la famille est couverte ailleurs et cesser de la chercher. Le retour a cherché
// « oracle-calculs » dans trois dépôts puis par nom sous C:\dev, ne l'a pas trouvé, et en a
// conclu que la famille n'était couverte nulle part — après cinq jours de run passés à croire
// l'inverse.
//
// VÉRIFICATION : l'outil EXISTE. Il est versionné à
// `digit-ai-forge-agents/.claude/skills/quality-oracles/scripts/oracle-calculs.mjs`, et il est
// invisible à toute recherche qui ne descend pas dans un dossier `.claude` — ce qu'aucune
// recherche ne fait par défaut. La prémisse du retour est donc fausse ; le coût qu'il rapporte
// est réel. Le remède n'est pas d'absorber l'outil, c'est de rendre la référence RÉSOLVABLE :
// un nom se cherche, un chemin se vérifie. Le self-test le vérifie désormais mécaniquement.
const NON_JUGE = [
  "justesse arithmétique des valeurs — couverte par `digit-ai-forge-agents/.claude/skills/quality-oracles/scripts/oracle-calculs.mjs`, À EXÉCUTER SÉPARÉMENT : elle n'est pas câblée à la batterie de ce dépôt",
  "montants commerciaux et engagements datés — `digit-ai-forge-agents/.claude/skills/quality-oracles/scripts/oracle-claims.mjs`, à exécuter séparément",
  "complétude du lineage pointé — juger lineage_ref avec `oracles/oracle-tracer.mjs` de ce dépôt",
  "R5 : les nombres de TABLEAU sont hors champ — générés, leur ancrage est porté par le chapeau du chapitre ; les juger ligne à ligne exigerait un marqueur par cellule",
  "R5 : sont écartés par nature les dates, millésimes, numérotations de chapitre, unités CSS et nombres écrits en lettres. Un chiffre METIER déguisé en date échappe donc, et c'est une limite, pas un oubli",
  "R5 : l'ancrage est jugé à la PHRASE, les lignes d'un même paragraphe étant réunies au préalable (une phrase repliée n'est pas deux phrases). Deux chiffres d'une même phrase pour un seul marqueur passent : la granularité fine se corrige en rédigeant, pas en resserrant la règle jusqu'au bruit. Une abréviation suivie d'un point coupe la phrase trop tôt — le sens de l'erreur est alors un faux POSITIF, jamais un faux négatif",
];
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
// R5 avertit par défaut et BLOQUE sous --strict. Le défaut n'est pas une indulgence : sur un
// corpus existant, 788 constats bloquants d'un coup feraient désactiver l'oracle entier — et
// un contrôle qu'on désactive ne protège rien (R-33 bis). Le compte, lui, est exact dès le
// premier run, et c'est lui qui rend le rattrapage pilotable.
const strict = args.includes("--strict");
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
// `[c:-]` est l'échappement de R5 (« ce nombre n'a délibérément pas de source »), pas un
// identifiant : le récolter ici ferait échouer R3 sur une convention que R5 vient de poser.
const utilises = [...corpsJugeable.matchAll(/\[c:([\w-]+)\]/g)].map(m => m[1]).filter(id => id !== "-");
const declares = new Set(entrees.map(e => e.id));
for (const u of new Set(utilises)) if (!declares.has(u))
  add("bloquant", "R3", `[c:${u}] utilisé au corps mais jamais déclaré au frontmatter`, "corps");
for (const d of declares) if (!utilises.includes(d))
  add("avertissement", "R3", `chiffre « ${d} » déclaré mais jamais restitué (déclaration morte)`, "frontmatter");
if (lineageRef && !fs.existsSync(path.join(path.dirname(path.resolve(file)), lineageRef)))
  add("bloquant", "R4", `lineage_ref introuvable à côté du rapport : ${lineageRef}`, file);
// --- R5 — couverture des nombres de prose (TF-0378) ---------------------------------------
// Le corps jugeable de R3 a déjà retiré le code et les échappements. On retire en plus les
// LIGNES DE TABLEAU (hors champ, cf. NON_JUGE) et les titres, dont la numérotation n'est pas
// un chiffre restitué.
const ECARTES = [
  { motif: /\b\d{4}-\d{2}-\d{2}\b/g, quoi: "date ISO" },
  { motif: /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, quoi: "date courte" },
  { motif: /\b\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/gi, quoi: "date en lettres" },
  { motif: /\b(?:19|20)\d{2}\b/g, quoi: "millésime" },
  { motif: /\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|pt)\b/gi, quoi: "unité CSS" },
  { motif: /\bv?\d+\.\d+(?:\.\d+)?\b/g, quoi: "numéro de version" },
];
const lignesCorps = corpsJugeable.split(/\r?\n/)
  .filter(l => !/^\s*\|/.test(l))       // lignes de tableau : hors champ, déclaré
  .filter(l => !/^\s*#{1,6}\s/.test(l)); // titres : la numérotation n'est pas un chiffre restitué

// L'unité d'ancrage est la PHRASE : un marqueur dans la phrase couvre ses nombres. C'est ce
// qu'un lecteur lie effectivement — juger au mot exigerait un marqueur par chiffre, juger au
// paragraphe laisserait un seul marqueur couvrir une page.
//
// DEUX DÉFAUTS DE MA PREMIÈRE ÉCRITURE, tous deux mesurés en faux positif sur la fixture
// verte, et tous deux dus à un découpage trop court :
//   1. je découpais LIGNE PAR LIGNE — une phrase repliée sur deux lignes était donc coupée en
//      deux, et un nombre se retrouvait séparé du marqueur qui l'ancrait trois mots plus loin ;
//   2. je coupais sur « : » et « ; », qui n'terminent pas une phrase.
// On réunit donc les lignes d'un même PARAGRAPHE avant de découper, et on ne coupe que sur
// « . », « ! » et « ? ».
const paragraphes = lignesCorps.join(String.fromCharCode(10))
  .split(/(?:\r?\n\s*){2,}/)
  .map(par => par.replace(/\s*\r?\n\s*/g, " ").trim())
  .filter(Boolean);
const nus = [];
for (const par of paragraphes) {
  for (const phrase of par.split(/(?<=[.!?])\s+/)) {
    if (/\[c:[\w-]+\]/.test(phrase)) continue;   // ancrée, ou échappée par [c:-]
    let reste = phrase;
    for (const e of ECARTES) reste = reste.replace(e.motif, " ");
    for (const m of reste.matchAll(/(?<![\w.,])\d+(?:[.,]\d+)?\s*%?/g)) {
      const brut = m[0].trim();
      if (!brut) continue;
      nus.push({ nombre: brut, phrase: phrase.trim().slice(0, 90) });
    }
  }
}
if (nus.length) {
  // Le compte EXACT d'abord, les premiers NOMMÉS ensuite : un total anonyme ne se corrige pas,
  // et une liste sans total ne dit pas l'ampleur. Les deux, jamais l'un sans l'autre.
  const noms = nus.slice(0, 8).map(n => `« ${n.nombre} » dans « ${n.phrase} »`).join(" · ");
  const reste = nus.length > 8 ? ` (+${nus.length - 8} autres)` : "";
  add(strict ? "bloquant" : "avertissement", "R5",
    `${nus.length} nombre(s) de prose SANS marqueur — un chiffre sans marqueur n'existe pas ` +
    `pour cet oracle, et l'oracle rendait PASS (TF-0378 : 788 nus contre 135 ancrés sur cinq ` +
    `rapports réels, tous PASS). Ancrer avec [c:<id>], ou échapper explicitement avec [c:-] ` +
    `si le nombre n'a délibérément pas de source : ${noms}${reste}`,
    "corps");
} else {
  add("info", "R5", `tous les nombres de prose du corps sont ancrés ou échappés explicitement`, "corps");
}

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
