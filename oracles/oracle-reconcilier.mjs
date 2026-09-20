#!/usr/bin/env node
// oracle-reconcilier — Domaine « Réconciliation de deux lots de mesures identifiées : agrégats
// de la couche Gold archivés par mesurer_base.py ↔ valeurs des mesures du modèle sémantique
// (ou de tout autre système aval), sous tolérance déclarée » (déterministe). TF-0864, lot L7
// de l'étude d'opportunité du pilot du 07/09/2026, défaut n° 18 de l'analyse L99 du même jour.
//
// Ce que l'écosystème savait faire : ancrer les nombres d'un rapport Markdown à leurs sources
// (oracle-restituer, R1-R5). Ce qu'il ne savait pas : dire si une mesure exposée dans un modèle
// sémantique ou un visuel VAUT ce que Gold dit. Le précédent des chiffres nus (TF-0378 : 788
// nus contre 135 ancrés sur cinq rapports réels, tous PASS) se serait rejoué en DAX.
// Calibrage : l'oracle lit deux fichiers JSON archivés (format `forge-data/reconciliation@1`),
// jamais une connexion — les lots viennent de mesurer_base.py côté Gold et d'un export du
// modèle sémantique (requête DAX exportée en JSON par l'API du service, ou export de visuel).
//   RC1  format + id ;
//   RC2  tolérance DÉCLARÉE : `relative_pct` et/ou `absolue`, nombres ≥ 0 — jamais implicite ;
//   RC3  deux lots nommés (`reference`, `compare`), chacun avec `nom`, `cible.namespace`
//        (l'INSTANCE, T7 de forge-data : deux catalogues homonymes sont la règle), `date` ISO,
//        `source` (l'archive d'où sortent les valeurs) et `mesures` non vides {id, valeur} ;
//   RC4  chaque mesure du lot de référence a son homologue (même id) dans le lot comparé ;
//        une mesure présente seulement dans le lot comparé est signalée (avertissement) ;
//   RC5  chaque paire est dans la tolérance : |écart| ≤ absolue OU |écart| / |référence| ≤
//        relative_pct / 100 — chaque écart hors tolérance est NOMMÉ avec ses deux valeurs ;
//   RC6  (avertissement) les deux lots datent de plus d'un jour d'écart — comparer deux
//        instants différents est une réconciliation de moins.
//   RC7  (info, TF-1195, retour RF-31 (4) du lot « Produit-62 - RETOURS - 20260918d ») le
//        COMPTE, pas seulement les défauts : combien d'entités comparées sont identiques
//        (écart nul) et combien sont en écart (écart non nul, tolérées ou non) — sans lui,
//        « 2 lots en écart » se lisait comme un défaut général au lieu de 2 sur 220.
// non_juge : véracité des valeurs archivées (la requête a-t-elle été exécutée sur la bonne
// instance — mesurer_base.py archive la cible, c'est lui qui répond) ; justesse de la formule
// DAX ; complétude : les mesures NON archivées ne sont pas réconciliées (D-D2 de la forge :
// on compare des mesures archivées, pas une exécution observée).
// Usage : node oracle-reconcilier.mjs <reconciliation.json> [--json-only]
import fs from "node:fs";

const DOM = "Réconciliation Gold ↔ modèle sémantique : deux lots de mesures identifiées sous tolérance déclarée (RC1-RC7)";
const NON_JUGE = [
  "véracité des valeurs archivées — la cible et la requête de chaque lot sont archivées par mesurer_base.py, pas rejouées ici",
  "justesse de la formule de la mesure aval (DAX) — seule sa VALEUR est comparée",
  "complétude : une mesure jamais archivée n'est pas réconciliée (D-D2 : mesures archivées, pas exécution observée)",
];
const DATE_ISO = /^\d{4}-\d{2}-\d{2}/;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
let compte = null;
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-reconcilier", domaine: DOM, artefact: file || null,
    verdict, compte, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "RC1-RC6 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "RC1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "RC1", "JSON invalide", file); out("FAIL", 1); }

if (d.format !== "forge-data/reconciliation@1") add("bloquant", "RC1", `format « ${d.format} » (attendu forge-data/reconciliation@1)`, file);
if (!d.id) add("bloquant", "RC1", "id de la réconciliation non nommé", file);

// RC2 · tolérance déclarée
const tol = d.tolerance && typeof d.tolerance === "object" ? d.tolerance : null;
const nb = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
const tolRel = tol && nb(tol.relative_pct) ? tol.relative_pct : null;
const tolAbs = tol && nb(tol.absolue) ? tol.absolue : null;
if (tolRel === null && tolAbs === null) add("bloquant", "RC2", "tolérance absente — elle se DÉCLARE (relative_pct et/ou absolue, ≥ 0), jamais implicite", file);

// RC3 · deux lots complets
const lot = (cle) => {
  const l = d[cle];
  const ou = `lot ${cle}`;
  if (!l || typeof l !== "object") { add("bloquant", "RC3", `lot « ${cle} » absent`, file); return null; }
  if (!l.nom) add("bloquant", "RC3", "lot sans nom", ou);
  if (!l.cible || !l.cible.namespace) add("bloquant", "RC3", "cible.namespace absent — le « où » se déclare, deux catalogues homonymes sur deux instances sont la règle (T7)", ou);
  if (!DATE_ISO.test(String(l.date || ""))) add("bloquant", "RC3", "date absente ou hors format ISO", ou);
  if (!l.source) add("bloquant", "RC3", "source absente — l'archive d'où sortent les valeurs (mesurer_base.py, export du modèle) se nomme", ou);
  if (!Array.isArray(l.mesures) || !l.mesures.length) add("bloquant", "RC3", "mesures absentes ou vides", ou);
  else l.mesures.forEach((m, i) => {
    if (!m.id) add("bloquant", "RC3", "mesure sans id", `${ou} · mesure #${i + 1}`);
    if (typeof m.valeur !== "number" || !Number.isFinite(m.valeur)) add("bloquant", "RC3", `valeur non numérique pour « ${m.id || `#${i + 1}`} »`, `${ou} · mesure #${i + 1}`);
  });
  return l;
};
const ref = lot("reference");
const cmp = lot("compare");

if (ref && cmp && Array.isArray(ref.mesures) && Array.isArray(cmp.mesures)) {
  const parId = new Map(cmp.mesures.filter(m => m.id).map(m => [String(m.id), m]));
  const vus = new Set();
  // RC7 · le compte, recalculé ici même — jamais recopié d'un total annoncé ailleurs.
  let identiques = 0, enEcart = 0;
  // RC4 · homologues
  for (const m of ref.mesures) {
    if (!m.id) continue;
    const h = parId.get(String(m.id));
    if (!h) { add("bloquant", "RC4", `mesure « ${m.id} » de la référence sans homologue dans le lot comparé`, `mesure ${m.id}`); continue; }
    vus.add(String(m.id));
    if (typeof m.valeur !== "number" || typeof h.valeur !== "number") continue;
    // RC5 · tolérance
    const ecart = Math.abs(h.valeur - m.valeur);
    if (ecart === 0) identiques++; else enEcart++;
    const okAbs = tolAbs !== null && ecart <= tolAbs;
    const okRel = tolRel !== null && (m.valeur === 0 ? ecart === 0 : ecart / Math.abs(m.valeur) <= tolRel / 100);
    // Sans tolérance déclarée (RC2 déjà rouge), tout écart non nul est un écart : la tolérance
    // implicite est zéro, jamais « à peu près ».
    if (ecart > 0 && !(okAbs || okRel)) {
      const relTxt = m.valeur === 0 ? "n/a" : `${((ecart / Math.abs(m.valeur)) * 100).toFixed(3)} %`;
      add("bloquant", "RC5", `écart hors tolérance sur « ${m.id} » : référence ${m.valeur} (${ref.nom}), comparé ${h.valeur} (${cmp.nom}), écart ${ecart} (${relTxt})`, `mesure ${m.id}`);
    }
  }
  for (const m of cmp.mesures) if (m.id && !vus.has(String(m.id)) && !ref.mesures.some(r => String(r.id) === String(m.id)))
    add("avertissement", "RC4", `mesure « ${m.id} » présente seulement dans le lot comparé — exposée sans référence Gold`, `mesure ${m.id}`);
  // RC7 · le compte se rend toujours, même à zéro écart — pas seulement quand il y a un défaut.
  compte = { comparees: identiques + enEcart, identiques, en_ecart: enEcart };
  add("info", "RC7", `${enEcart} entité(s) en écart contre ${identiques} identique(s) sur ${identiques + enEcart} mesure(s) comparée(s)`, file);
  // RC6 · dates
  const dr = Date.parse(ref.date), dc = Date.parse(cmp.date);
  if (Number.isFinite(dr) && Number.isFinite(dc) && Math.abs(dr - dc) > 24 * 3600 * 1000)
    add("avertissement", "RC6", `les deux lots datent de plus d'un jour d'écart (${ref.date} / ${cmp.date}) — deux instants différents réconcilient moins`, file);
}

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
