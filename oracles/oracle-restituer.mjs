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
//   R6  (optionnel) `reconciliation_ref:` pointe un lot `forge-data/reconciliation@1` existant
//       (TF-0864) — présent et faux : bloquant.
//   R7  (optionnel) `couverture_ref:` pointe une mesure `forge-data/couverture@1` existante
//       (TF-0911) — un rapport de mapping chaîne ainsi la question de la COMPLÉTUDE, celle
//       qu'aucune règle de forme ne pose ; présent et faux : bloquant.
//   R8  VOCABULAIRE DU DESTINATAIRE (TF-0936) : un terme déclaré « machine » au glossaire
//       `references/glossaire-restitution.json` employé dans la prose d'un livrable humain
//       est constaté, compté et rendu par son équivalent de restitution. Avertissement
//       toujours — le terme reste admis dans les schémas et le code, d'où le retrait
//       préalable des spans et blocs de code, qui est la frontière entre les deux registres.
//
// R5 (TF-0378, lot Produit-10 20260818b) — R1-R4 jugeaient la BIJECTION marqueur ↔ déclaration :
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
import { fileURLToPath } from "node:url";

const DOM = "Restitution : chiffres ancrés, déclaré → généré (R1-R4, niveau dbt)";
// TF-0379 (lot Produit-10 20260818b) — un non_juge est une PROMESSE DE PÉRIMÈTRE : le lire, c'est
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
// RD-1 (Produit-10, 13/08) : un rapport qui EXPLIQUE sa convention écrit « [c:id] » dans un
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
// --- R6 — un chiffre peut pointer un LOT DE RÉCONCILIATION (TF-0864, lot L7 du 07/09/2026) -------
// Quand le rapport restitue des mesures d'un modèle sémantique, le frontmatter porte
// `reconciliation_ref:` : le fichier existe à côté du rapport et est au format
// `forge-data/reconciliation@1` (jugé ensuite par oracle-reconcilier, RC1-RC6). Optionnel :
// un rapport sans mesure aval n'en porte pas, et R6 ne dit rien. Présent et faux : bloquant —
// un chiffre qui prétend être réconcilié et ne pointe rien est pire qu'un chiffre nu.
const reconciliationRef = (front.match(/^reconciliation_ref\s*:\s*(.+)$/m) || [])[1]?.trim();
if (reconciliationRef) {
  const pr = path.join(path.dirname(path.resolve(file)), reconciliationRef);
  if (!fs.existsSync(pr)) add("bloquant", "R6", `reconciliation_ref introuvable à côté du rapport : ${reconciliationRef}`, file);
  else {
    let rc = null;
    try { rc = JSON.parse(fs.readFileSync(pr, "utf8")); } catch { add("bloquant", "R6", `reconciliation_ref illisible (JSON attendu) : ${reconciliationRef}`, file); }
    if (rc && rc.format !== "forge-data/reconciliation@1") add("bloquant", "R6", `reconciliation_ref au format « ${rc.format} » (attendu forge-data/reconciliation@1)`, file);
  }
}
// --- R7 — un rapport de mapping peut pointer sa MESURE DE COUVERTURE (TF-0911, 08/09/2026) ------
// R6 chaînait la question « ces chiffres valent-ils ce que Gold dit ». R7 chaîne celle qui l'a
// précédée de deux jours et que personne ne posait : « ce mapping couvre-t-il TOUT ce que la
// source contient ». Trois synthèses PASS (oracle-tracer, oracle-modeliser, oracle-restituer)
// ont été publiées avant que 38 colonnes et 22 mesures orphelines soient trouvées — par un
// contrôle que le produit avait dû écrire lui-même. Même construction que R6 : optionnel (un
// rapport qui ne restitue aucun mapping n'en porte pas, et R7 se tait), bloquant s'il est
// présent et faux — un rapport qui se dit exhaustif en pointant le vide est pire qu'un rapport
// muet. La MESURE, elle, appartient à `oracles/oracle-couvrir.mjs` : R7 chaîne, elle ne compte pas.
const couvertureRef = (front.match(/^couverture_ref\s*:\s*(.+)$/m) || [])[1]?.trim();
if (couvertureRef) {
  const pc = path.join(path.dirname(path.resolve(file)), couvertureRef);
  if (!fs.existsSync(pc)) add("bloquant", "R7", `couverture_ref introuvable à côté du rapport : ${couvertureRef}`, file);
  else {
    let cv = null;
    try { cv = JSON.parse(fs.readFileSync(pc, "utf8")); } catch { add("bloquant", "R7", `couverture_ref illisible (JSON attendu) : ${couvertureRef}`, file); }
    if (cv && cv.format !== "forge-data/couverture@1") add("bloquant", "R7", `couverture_ref au format « ${cv.format} » (attendu forge-data/couverture@1)`, file);
  }
}
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
// --- R8 — le vocabulaire du DESTINATAIRE (TF-0936, retour du 08/09/2026) -------------------
// Le retour tient en une phrase : « utilise le mot granularité plutôt que grain ». Le terme
// machine avait fuité du format vers la page lue par un humain — 33 emplois, dont 25 posés par
// le générateur et 8 recopiés des commentaires DDL. Aucune règle ne pouvait le voir : R1-R7
// jugent l'ancrage des chiffres, pas les mots.
// Les deux vocabulaires COEXISTENT et c'est voulu : `grain` reste le champ de
// `forge-data/modele-dimensionnel@1` (le renommer casserait les artefacts et l'oracle qui les
// juge), et il reste admis partout où le texte parle machine — d'où le retrait préalable des
// spans et blocs de code, qui est ici la frontière exacte entre les deux registres.
// Le glossaire est une DONNÉE éditable, datée et sourcée (loi n° 4), pas une liste en dur :
// `references/glossaire-restitution.json`. Avertissement, jamais bloquant — un mot est un
// arbitrage de rédaction, et une règle de vocabulaire qui bloque une livraison se désactive.
{
  const pGlossaire = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "references", "glossaire-restitution.json");
  let glossaire = null;
  if (fs.existsSync(pGlossaire)) { try { glossaire = JSON.parse(fs.readFileSync(pGlossaire, "utf8")); } catch { /* glossaire illisible : signalé ci-dessous */ } }
  if (!glossaire || !Array.isArray(glossaire.termes))
    add("info", "R8", `glossaire de restitution absent ou illisible (${path.relative(process.cwd(), pGlossaire).replace(/\\/g, "/")}) — le vocabulaire du destinataire n'est pas jugé`, file);
  else {
    for (const t of glossaire.termes) {
      const variantes = (Array.isArray(t.variantes) && t.variantes.length ? t.variantes : [t.machine]).filter(v => typeof v === "string" && v.trim());
      if (!variantes.length || !t.rendu) continue;
      const motif = new RegExp(`\\b(${variantes.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
      const trouves = [...corpsJugeable.matchAll(motif)];
      if (!trouves.length) continue;
      add("avertissement", "R8",
        `${trouves.length} emploi(s) du terme MACHINE « ${t.machine} » dans le corps lu par un humain — ` +
        `le glossaire (${glossaire.date}) rend ce terme « ${t.rendu} » à la restitution. ` +
        `Le terme machine reste admis dans les schémas et le code (${t.portee_machine || "formats et sorties d'oracles"}), ` +
        `d'où son retrait des spans et blocs de code avant ce constat. Motif : ${t.motif || "arbitrage du destinataire"}`,
        "corps");
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
