#!/usr/bin/env node
// oracle-jeu-fictif — Domaine « Un jeu de données fictif couvre chaque écran du produit, chaque type
// d'enregistrement, et raconte une histoire cohérente d'un stade à l'autre » (déterministe).
// TF-2085, 03/11/2026, retour RT-40.
//
// LE FAIT. Un « jeu fictif » a été remis en deux coquilles vides : des chantiers, et ni lot, ni
// budget, ni facture. Le porteur l'a rejeté, mot pour mot : « un jeu fictif qui n'a rien n'est pas un
// jeu fictif ». Rien ne définissait ce qu'un jeu fictif doit couvrir, rien ne le jugeait avant la
// remise : le jeu n'était conforme qu'à ce que personne n'avait écrit.
//
// LA DÉFINITION vit en donnée, `references/definition-jeu-fictif.json` (loi n° 4 : datée, sourcée,
// éditable). L'oracle la lit pour ses planchers (un enregistrement par type, une ligne par écran,
// quatre mots de motif, tolérances, origines admises) ; sans elle il ne juge pas et le DIT (SKIP).
// `--definition <chemin>` en désigne une autre.
//
// CE QUE L'ORACLE JUGE : un jeu candidat et la déclaration de ce qu'il devait couvrir, au format
// `forge-data/jeu-fictif@1` :
//   { format, id,
//     releve: { par, date, source },                    la surface du produit s'identifie (JF2)
//     produit: { types: [{ id, libelle, minimum? }],
//                ecrans: [{ id, libelle, lit: [{ type, filtre?: { champ: [valeurs] }, minimum? }] }],
//                cycles?: [{ type, champ, stades: [{ id, exige?: [{ type, cle, minimum? }] }] }],
//                coherences?: [{ id, enfant: { type, cle, montant?, date? }, parent: { type, cle, montant?, date? },
//                                montant?: "somme<=" | "somme=", date?: ">=" | "<=" }] },
//     generateur: { nom, origine, totaux: [{ id, mesure: "compte" | "somme", type, champ?, filtre?, valeur }] },
//     affichage?: { par, date, source, totaux: [{ ecran, total, valeur }] },   les totaux LUS sur les écrans
//     exclusions?: [{ portee: "ecran:<id>" | "type:<id>" | "stade:<type>.<stade>", motif }],
//     jeu | jeu_ref }                                    { <type>: [enregistrement] }, en ligne ou voisin
// Un enregistrement porte un `id`. Un enregistrement d'un type à cycle porte son stade courant dans
// le champ du cycle et `etapes: [{ stade, date, montant? }]`, une par stade franchi.
//
//   JF1  forme : format, id, produit complet (types, écrans qui lisent des types déclarés, cycles et
//        cohérences sur des types déclarés), générateur nommé avec des totaux typés, jeu présent,
//        exclusions qui résolvent. Une pièce manquante se refuse avant tout jugement du contenu ;
//   JF2  la surface du produit est RELEVÉE : qui, quand (ISO), sur quoi — et l'origine du jeu est
//        dans le jeu admis du référentiel (synthétique) ;
//   JF3  chaque écran est ALIMENTÉ : pour chaque type qu'il lit, avec son filtre, le jeu porte au
//        moins le plancher de lignes. Un écran vide est nommé ;
//   JF4  chaque type d'enregistrement est PRÉSENT, avec des identifiants non vides et uniques ; un
//        produit ne peut pas abaisser le plancher du référentiel ;
//   JF5  l'HISTOIRE d'un stade à l'autre : un enregistrement au stade k porte les étapes des stades
//        0 à k, dans l'ordre du cycle, sans trou, aux dates ISO croissantes et aux montants finis et
//        positifs ; chaque stade du cycle est occupé ; un stade qui exige des enregistrements liés
//        les a ;
//   JF6  les enregistrements liés se TIENNENT : chaque clé résout à un parent, la somme des montants
//        enfants respecte la borne du parent, les dates suivent ou précèdent celles du parent. Un
//        parent qui n'a pas atteint l'événement dont dépend la date de l'enfant est refusé pour `>=`
//        (une facture avant le démarrage du lot) et ignoré pour `<=` (un budget avant l'engagement
//        d'un lot pas encore engagé) ;
//   JF7  chaque total que le générateur déclare est RECALCULÉ sur le contenu et lui est égal ;
//   JF8  chaque total lu sur un écran est égal au total que le générateur déclare pour lui. La
//        lecture s'identifie (qui, quand, sur quoi). Sans lecture d'écran, le verdict n'est pas
//        bloqué mais la lacune est DITE.
//
// Une exclusion motivée (≥ quatre mots) est la seule porte de sortie d'un écran, d'un type ou d'un
// stade que le jeu ne porte pas ; elle ne s'applique pas sans motif, et elle est avertie quand elle
// retire quelque chose que le jeu porte déjà.
//
// Les constats de masse sont GROUPÉS (dix noms au plus, le total dit à côté) : un total anonyme ne
// se corrige pas, une liste de mille lignes ne se lit pas.
//
// Usage : node oracles/oracle-jeu-fictif.mjs <jeu-fictif.json> [--definition <chemin>] [--json-only]
// Codes : 0 PASS ; 1 FAIL ; 2 SKIP (cible ou définition introuvable).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ici = path.dirname(fileURLToPath(import.meta.url));
const DOM = "Jeu de données fictif : chaque écran alimenté, chaque type présent, une histoire cohérente d'un stade à l'autre, des totaux qui se recalculent (JF1-JF8)";
const NON_JUGE = [
  "l'EXHAUSTIVITÉ de la liste des écrans, des types et des cycles : elle vient du relevé (JF2 exige de dire qui, quand, sur quoi), pas de cet oracle ; un écran que le relevé omet n'est jamais vu — la couverture du produit lui-même (routes, composants) appartient à forge-tests, qui rejoue le relevé contre le produit",
  "le RENDU réel : les totaux affichés sont ceux que la lecture des écrans a consignés (JF8) ; le geste de lecture lui-même (export, capture, texte extrait) relève de `oracles/oracle-rendre.mjs` (RN5, RN6) — un affichage non joué se DIT, il ne se déduit pas du jeu",
  "la VRAISEMBLANCE : des libellés, des noms et des ordres de grandeur plausibles pour le métier ; l'oracle mesure la structure et la cohérence, pas le réalisme",
  "l'ORIGINE : `origine: synthetique` est déclarée (JF2), non prouvée ; qu'aucune donnée de production n'entre est la frontière de la forge, et un extrait réel se traite par le verbe anonymiser jugé par `oracles/oracle-anonymiser.mjs`",
  "les cas LIMITES (annulation, litige, montant nul, jeu volumineux) : la définition exige l'histoire d'un stade à l'autre, pas l'inventaire des exceptions",
];
const MESURES_ADMISES = ["compte", "somme"];
const COMPARATEURS_MONTANT = ["somme<=", "somme="];
const COMPARATEURS_DATE = [">=", "<="];
const MAX_LISTE = 10;

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json-only");
const iDef = args.indexOf("--definition");
const defPath = iDef >= 0 ? args[iDef + 1] : path.join(ici, "..", "references", "definition-jeu-fictif.json");
const file = args.find((a, i) => !a.startsWith("--") && !(iDef >= 0 && i === iDef + 1));
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const bloque = (regle, msg, where) => add("bloquant", regle, msg, where);
let mesures = null;
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-jeu-fictif", domaine: DOM, artefact: file || null,
    verdict, mesures, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "JF1-JF8 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};

const txt = v => (typeof v === "string" ? v.trim() : "");
const mots = s => s.split(/\s+/).filter(Boolean).length;
const estObjet = v => v !== null && typeof v === "object" && !Array.isArray(v);
const nombre = v => typeof v === "number" && Number.isFinite(v);
const entier = v => Number.isInteger(v);
// Date ISO réelle (le 31 février n'existe pas), ramenée à AAAA-MM-JJ pour se comparer en texte.
const dateNorm = v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(String(v ?? ""));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
const liste = items => items.length <= MAX_LISTE
  ? items.join(" ; ")
  : `${items.slice(0, MAX_LISTE).join(" ; ")} (+${items.length - MAX_LISTE} autres, ${items.length} au total)`;
const filtreTexte = f => (f ? " filtre " + Object.entries(f).map(([k, v]) => `${k}=${[].concat(v).join("|")}`).join(", ") : "");

if (!file || !fs.existsSync(file)) { add("info", "JF1", "fichier introuvable", String(file)); out("SKIP", 2); }

// ---- la définition : sans elle, l'oracle ne juge pas et le dit ---------------------------------------
let def = null;
try { def = JSON.parse(fs.readFileSync(defPath, "utf8")); } catch { /* traité juste dessous */ }
const P = def && estObjet(def.planchers) ? def.planchers : null;
if (!def || def.format !== "forge-data/definition-jeu-fictif@1" || !P
  || !(P.minimum_enregistrements_par_type >= 1) || !(P.minimum_lignes_par_ecran >= 1) || !(P.mots_motif_exclusion >= 1)
  || !nombre(P.tolerance_compte) || !nombre(P.tolerance_somme) || !Array.isArray(P.origines_admises)) {
  add("info", "JF1", `définition du jeu fictif introuvable ou illisible (${defPath}) : sans elle les planchers ne sont pas connus, l'oracle ne juge pas — rétablir \`references/definition-jeu-fictif.json\``, String(defPath));
  out("SKIP", 2);
}

let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "JF1", "JSON invalide", file); out("FAIL", 1); }
if (!estObjet(d)) { bloque("JF1", "la déclaration n'est pas un objet JSON", file); out("FAIL", 1); }

// ---- JF1 · forme ---------------------------------------------------------------------------------------
if (d.format !== "forge-data/jeu-fictif@1") bloque("JF1", `format « ${d.format} » (attendu forge-data/jeu-fictif@1)`, file);
if (!txt(d.id)) bloque("JF1", "id du jeu non nommé", file);

const produit = estObjet(d.produit) ? d.produit : null;
if (!produit) bloque("JF1", "bloc « produit » absent — sans la liste des types, des écrans et des cycles, le jeu se jugerait contre rien", file);

const types = new Map();          // id -> { id, minimum }
(Array.isArray(produit?.types) ? produit.types : []).forEach((t, i) => {
  const ou = `produit.types #${i + 1}`;
  const id = txt(t?.id);
  if (!id) { bloque("JF1", "type d'enregistrement sans id", ou); return; }
  if (types.has(id)) { bloque("JF1", `type « ${id} » déclaré deux fois`, ou); return; }
  if (t.minimum !== undefined && !entier(t.minimum)) bloque("JF1", `type « ${id} » : minimum « ${t.minimum} » n'est pas un entier`, ou);
  types.set(id, { id, minimum: entier(t.minimum) ? t.minimum : undefined });
});
if (produit && !types.size) bloque("JF1", "aucun type d'enregistrement déclaré (produit.types) : un jeu sans types est une coquille par construction", file);

const filtreValide = f => estObjet(f) && Object.keys(f).length > 0 && Object.values(f).every(v => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null));
const ecrans = [];
const ecransIds = new Set();
(Array.isArray(produit?.ecrans) ? produit.ecrans : []).forEach((e, i) => {
  const ou = `produit.ecrans #${i + 1}`;
  const id = txt(e?.id);
  if (!id) { bloque("JF1", "écran sans id", ou); return; }
  if (ecransIds.has(id)) { bloque("JF1", `écran « ${id} » déclaré deux fois`, ou); return; }
  ecransIds.add(id);
  const lit = Array.isArray(e.lit) ? e.lit : [];
  let valide = true;
  if (!lit.length) { bloque("JF1", `écran « ${id} » ne lit aucun type — un écran qui ne lit rien n'est branché à aucune donnée`, ou); valide = false; }
  lit.forEach((l, j) => {
    if (!types.has(txt(l?.type))) { bloque("JF1", `écran « ${id} » lit le type « ${l?.type} », inconnu du produit — il ne peut être jugé alimenté`, `${ou} › lit #${j + 1}`); valide = false; }
    if (l?.filtre !== undefined && !filtreValide(l.filtre)) { bloque("JF1", `écran « ${id} » : filtre illisible (attendu { champ: [valeurs] })`, `${ou} › lit #${j + 1}`); valide = false; }
    if (l?.minimum !== undefined && !(entier(l.minimum) && l.minimum >= 1)) { bloque("JF1", `écran « ${id} » : minimum « ${l.minimum} » n'est pas un entier ≥ 1`, `${ou} › lit #${j + 1}`); valide = false; }
  });
  ecrans.push({ id, libelle: txt(e.libelle), lit, valide, ou });
});
if (produit && !ecrans.length && !F.some(f => /écran/.test(f.msg))) bloque("JF1", "aucun écran déclaré (produit.ecrans) : sans la surface du produit, « chaque écran alimenté » ne veut rien dire", file);

const cycles = [];
(Array.isArray(produit?.cycles) ? produit.cycles : []).forEach((c, i) => {
  const ou = `produit.cycles #${i + 1}`;
  if (!types.has(txt(c?.type))) { bloque("JF1", `cycle sur le type « ${c?.type} », inconnu du produit`, ou); return; }
  if (cycles.some(x => x.type === c.type)) { bloque("JF1", `deux cycles pour le type « ${c.type} »`, ou); return; }
  if (!txt(c.champ)) { bloque("JF1", `cycle de « ${c.type} » sans champ de stade`, ou); return; }
  const stades = Array.isArray(c.stades) ? c.stades : [];
  if (!stades.length) { bloque("JF1", `cycle de « ${c.type} » sans stade`, ou); return; }
  const ids = stades.map(s => txt(s?.id));
  if (ids.some(x => !x) || new Set(ids).size !== ids.length) { bloque("JF1", `cycle de « ${c.type} » : stade sans id ou déclaré deux fois`, ou); return; }
  let ok = true;
  stades.forEach(s => (Array.isArray(s.exige) ? s.exige : []).forEach(x => {
    if (!types.has(txt(x?.type)) || !txt(x?.cle) || (x.minimum !== undefined && !(entier(x.minimum) && x.minimum >= 1))) {
      bloque("JF1", `cycle de « ${c.type} », stade « ${s.id} » : exigence illisible ou sur un type inconnu (${JSON.stringify(x)})`, ou); ok = false;
    }
  }));
  if (ok) cycles.push({ type: c.type, champ: c.champ, stades: stades.map(s => ({ id: s.id, exige: Array.isArray(s.exige) ? s.exige : [] })) });
});

const coherences = [];
(Array.isArray(produit?.coherences) ? produit.coherences : []).forEach((c, i) => {
  const ou = `produit.coherences #${i + 1}`;
  const id = txt(c?.id) || `#${i + 1}`;
  const ok = estObjet(c?.enfant) && estObjet(c?.parent) && types.has(txt(c.enfant.type)) && types.has(txt(c.parent.type)) && txt(c.enfant.cle) && txt(c.parent.cle);
  if (!ok) { bloque("JF1", `cohérence « ${id} » : enfant et parent doivent nommer un type déclaré et une clé`, ou); return; }
  if (c.montant !== undefined && (!COMPARATEURS_MONTANT.includes(c.montant) || !txt(c.enfant.montant) || !txt(c.parent.montant))) { bloque("JF1", `cohérence « ${id} » : montant « ${c.montant} » hors du jeu {${COMPARATEURS_MONTANT.join(", ")}} ou champs de montant manquants`, ou); return; }
  if (c.date !== undefined && (!COMPARATEURS_DATE.includes(c.date) || !txt(c.enfant.date) || !txt(c.parent.date))) { bloque("JF1", `cohérence « ${id} » : date « ${c.date} » hors du jeu {${COMPARATEURS_DATE.join(", ")}} ou champs de date manquants`, ou); return; }
  coherences.push({ id, enfant: c.enfant, parent: c.parent, montant: c.montant, date: c.date });
});

const gen = estObjet(d.generateur) ? d.generateur : null;
if (!gen) bloque("JF1", "bloc « generateur » absent — qui a produit le jeu, et quels totaux il déclare", file);
else if (!txt(gen.nom)) bloque("JF1", "generateur.nom absent — un jeu sans générateur nommé ne se régénère pas", "generateur");
const totaux = new Map();         // id -> total valide
let generateurOk = false;
if (gen) {
  const liste0 = Array.isArray(gen.totaux) ? gen.totaux : [];
  if (!liste0.length) bloque("JF1", "generateur.totaux vide — sans totaux déclarés, rien ne confronte ce que le jeu devait contenir à ce qu'il contient", "generateur");
  else generateurOk = true;
  liste0.forEach((t, i) => {
    const ou = `generateur.totaux #${i + 1}`;
    const id = txt(t?.id);
    if (!id || totaux.has(id)) { bloque("JF1", id ? `total « ${id} » déclaré deux fois` : "total sans id", ou); return; }
    if (!MESURES_ADMISES.includes(t.mesure)) { bloque("JF1", `total « ${id} » : mesure « ${t.mesure} » hors du jeu {${MESURES_ADMISES.join(", ")}}`, ou); totaux.set(id, { id, invalide: true, valeur: t.valeur }); return; }
    if (!types.has(txt(t.type)) || (t.mesure === "somme" && !txt(t.champ)) || (t.filtre !== undefined && !filtreValide(t.filtre)) || !nombre(t.valeur)) {
      bloque("JF1", `total « ${id} » : type inconnu, champ de somme absent, filtre illisible ou valeur non numérique`, ou);
      totaux.set(id, { id, invalide: true, valeur: t.valeur }); return;
    }
    totaux.set(id, { id, mesure: t.mesure, type: t.type, champ: t.champ, filtre: t.filtre, valeur: t.valeur });
  });
}

// Les exclusions : la seule porte de sortie, et elle se motive.
const exclusions = { ecran: new Map(), type: new Map(), stade: new Map() };
const REGLE_DE = { ecran: "JF3", type: "JF4", stade: "JF5" };
(Array.isArray(d.exclusions) ? d.exclusions : []).forEach((x, i) => {
  const ou = `exclusions #${i + 1}`;
  const portee = txt(x?.portee);
  const m = /^(ecran|type):(.+)$/.exec(portee) || /^(stade):(.+)$/.exec(portee);
  if (!m) { bloque("JF1", `exclusion « ${portee || "(vide)"} » : portée illisible (attendu ecran:<id>, type:<id> ou stade:<type>.<stade>)`, ou); return; }
  const [, genre, cible] = m;
  const resolu = genre === "ecran" ? ecransIds.has(cible)
    : genre === "type" ? types.has(cible)
    : (() => { const [t, s] = [cible.slice(0, cible.indexOf(".")), cible.slice(cible.indexOf(".") + 1)]; return cycles.some(c => c.type === t && c.stades.some(z => z.id === s)); })();
  if (!resolu) { bloque("JF1", `exclusion « ${portee} » : la cible est inconnue du produit — une exclusion qui pointe dans le vide ne justifie rien et cache ce qu'elle prétend expliquer`, ou); return; }
  const motif = txt(x.motif);
  if (mots(motif) < P.mots_motif_exclusion) {
    bloque(REGLE_DE[genre], `exclusion « ${portee} » sans motif écrit (au moins ${P.mots_motif_exclusion} mots) : elle ne s'applique pas — une exclusion sans motif est un oubli déguisé en décision`, ou);
    return;
  }
  exclusions[genre].set(cible, { portee, ou });
});

// Le jeu : en ligne, ou dans un fichier voisin.
let jeu = estObjet(d.jeu) ? d.jeu : null;
if (!jeu && d.jeu_ref) {
  const p = path.join(path.dirname(path.resolve(file)), String(d.jeu_ref));
  if (!fs.existsSync(p)) bloque("JF1", `jeu_ref introuvable à côté de la déclaration : ${d.jeu_ref}`, file);
  else { try { jeu = JSON.parse(fs.readFileSync(p, "utf8")); } catch { bloque("JF1", `jeu_ref illisible (JSON attendu) : ${d.jeu_ref}`, file); } }
}
if (!estObjet(jeu)) {
  if (!F.some(f => /jeu_ref/.test(f.msg))) bloque("JF1", "jeu absent (`jeu` ou `jeu_ref`) — sans contenu, il n'y a rien à juger contre la déclaration", file);
  jeu = null;
} else if (Object.values(jeu).some(v => !Array.isArray(v))) {
  bloque("JF1", "jeu mal formé : chaque type doit porter une liste d'enregistrements ({ <type>: [ … ] })", file);
  jeu = null;
}

// ---- JF2 · la surface du produit est relevée, l'origine est synthétique -------------------------------------
const rel = estObjet(d.releve) ? d.releve : null;
if (!rel) bloque("JF2", "bloc « releve » absent — la liste des écrans, des types et des cycles est une opinion tant qu'on ne dit pas qui l'a relevée, quand, et sur quoi", file);
else {
  if (!txt(rel.par)) bloque("JF2", "releve.par absent — QUI a relevé la surface du produit : un relevé sans auteur ne se rejoue pas", "releve");
  if (!dateNorm(rel.date)) bloque("JF2", "releve.date absente ou hors format ISO — un relevé non daté a pu être fait après la génération, sur le jeu lui-même", "releve");
  if (!txt(rel.source)) bloque("JF2", "releve.source absent — LE PRODUIT sur lequel la surface a été relevée, jamais sur le jeu qu'on juge", "releve");
}
if (gen && !P.origines_admises.includes(gen.origine))
  bloque("JF2", `generateur.origine « ${gen.origine ?? "(absente)"} » hors du jeu admis {${P.origines_admises.join(", ")}} — aucune donnée de production n'entre dans la forge ; un extrait réel se traite par le verbe anonymiser`, "generateur");

if (!jeu) out("FAIL", 1);

// ---- Lecture du contenu -------------------------------------------------------------------------------------------
const rows = t => (Array.isArray(jeu[t]) ? jeu[t].filter(estObjet) : []);
const correspond = (r, filtre) => !filtre || Object.entries(filtre).every(([k, v]) => [].concat(v).some(x => String(r[k]) === String(x)));
const etiquette = (t, r) => `${t}#${txt(r?.id) || "?"}`;
for (const t of Object.keys(jeu)) if (!types.has(t))
  add("avertissement", "JF4", `le jeu porte ${jeu[t].length} enregistrement(s) de type « ${t} », inconnu du produit : ignorés par tous les contrôles`, `jeu.${t}`);

// ---- JF4 · chaque type est présent, identifié, unique -------------------------------------------------------
let presents = 0, enregistrements = 0;
for (const [id, t] of types) {
  const lignes = rows(id);
  enregistrements += lignes.length;
  if (lignes.length) presents++;
  if (t.minimum !== undefined && t.minimum < P.minimum_enregistrements_par_type)
    bloque("JF4", `type « ${id} » : minimum ${t.minimum} sous le plancher du référentiel (${P.minimum_enregistrements_par_type}) — un produit relève le plancher, il ne l'abaisse pas`, `produit.types › ${id}`);
  const min = Math.max(t.minimum ?? 0, P.minimum_enregistrements_par_type);
  const vus = new Set(), doublons = new Set();
  let sansId = 0;
  for (const r of lignes) {
    const rid = txt(r.id) || (typeof r.id === "number" ? String(r.id) : "");
    if (!rid) { sansId++; continue; }
    if (vus.has(rid)) doublons.add(rid); else vus.add(rid);
  }
  if (sansId) bloque("JF4", `${sansId} enregistrement(s) de « ${id} » sans identifiant — ni jointure ni localisation possibles`, `jeu.${id}`);
  if (doublons.size) bloque("JF4", `identifiant(s) en double dans « ${id} » : ${liste([...doublons])}`, `jeu.${id}`);
  if (exclusions.type.has(id)) {
    if (lignes.length >= min) add("avertissement", "JF4", `exclusion « type:${id} » retire un type que le jeu porte déjà (${lignes.length} enregistrement(s)) : règle morte, ou portée mal écrite`, exclusions.type.get(id).ou);
    continue;
  }
  if (lignes.length < min) {
    bloque("JF4", `type « ${id} » ${lignes.length ? "sous-peuplé" : "ABSENT du jeu"} : ${lignes.length} enregistrement(s) pour ${min} requis — le peupler, ou déclarer une exclusion motivée`, `jeu.${id}`);
  }
}

// ---- JF3 · chaque écran est alimenté ---------------------------------------------------------------------------------
let alimentes = 0;
for (const e of ecrans) {
  if (!e.valide) continue;
  const vides = [];
  for (const l of e.lit) {
    const requis = Math.max(l.minimum ?? 0, P.minimum_lignes_par_ecran);
    const n = rows(l.type).filter(r => correspond(r, l.filtre)).length;
    if (n < requis) vides.push(`${l.type}${filtreTexte(l.filtre)} : ${n} ligne(s) pour ${requis} requise(s)`);
  }
  if (!vides.length) alimentes++;
  if (exclusions.ecran.has(e.id)) {
    if (!vides.length) add("avertissement", "JF3", `exclusion « ecran:${e.id} » retire un écran déjà alimenté par le jeu : règle morte, ou portée mal écrite`, exclusions.ecran.get(e.id).ou);
    continue;
  }
  if (vides.length) bloque("JF3", `écran « ${e.id} »${e.libelle ? ` (${e.libelle})` : ""} NON ALIMENTÉ — ${vides.join(" ; ")} ; le peupler, ou déclarer une exclusion motivée`, e.ou);
}

// ---- JF5 · l'histoire d'un stade à l'autre ------------------------------------------------------------------------------
let stadesTotal = 0, stadesOccupes = 0;
for (const c of cycles) {
  const ids = c.stades.map(s => s.id);
  const idx = new Map(ids.map((s, i) => [s, i]));
  const ennuis = [];
  const occupes = new Set();
  for (const r of rows(c.type)) {
    const lib = etiquette(c.type, r);
    const courant = r[c.champ];
    if (!idx.has(courant)) { ennuis.push(`${lib} au stade « ${courant ?? "(absent)"} », hors du cycle (${ids.join(" › ")})`); continue; }
    occupes.add(courant);
    const k = idx.get(courant);
    const etapes = Array.isArray(r.etapes) ? r.etapes.filter(estObjet) : [];
    const vues = etapes.map(x => x.stade);
    const attendues = ids.slice(0, k + 1);
    if (JSON.stringify(vues) !== JSON.stringify(attendues))
      ennuis.push(`${lib} au stade « ${courant} » : étapes attendues ${attendues.join(" › ")}, trouvées ${vues.join(" › ") || "aucune"}`);
    let precedente = null;
    for (const x of etapes) {
      const dt = dateNorm(x.date);
      if (!dt) { ennuis.push(`${lib} étape « ${x.stade} » : date absente ou hors format ISO`); continue; }
      if (precedente && dt < precedente.date) ennuis.push(`${lib} : étape « ${x.stade} » du ${dt} antérieure à « ${precedente.stade} » du ${precedente.date}`);
      precedente = { stade: x.stade, date: dt };
      if (x.montant !== undefined && !(nombre(x.montant) && x.montant >= 0)) ennuis.push(`${lib} étape « ${x.stade} » : montant « ${x.montant} » négatif ou non numérique`);
    }
    for (let j = 0; j <= k; j++) for (const x of c.stades[j].exige) {
      const requis = x.minimum ?? 1;
      const n = rows(x.type).filter(o => String(o[x.cle]) === String(r.id)).length;
      if (n < requis) ennuis.push(`${lib} au stade « ${courant} » exige ${requis} ${x.type} lié(s) par ${x.type}.${x.cle}, trouvé(s) : ${n}`);
    }
  }
  if (ennuis.length) bloque("JF5", `${ennuis.length} anomalie(s) d'histoire dans le cycle « ${c.type} » : ${liste(ennuis)}`, `cycle ${c.type}`);
  const vides = [];
  for (const s of ids) {
    stadesTotal++;
    if (occupes.has(s)) stadesOccupes++;
    const ex = exclusions.stade.get(`${c.type}.${s}`);
    if (ex) {
      if (occupes.has(s)) add("avertissement", "JF5", `exclusion « ${ex.portee} » retire un stade déjà occupé par le jeu : règle morte, ou portée mal écrite`, ex.ou);
      continue;
    }
    if (!occupes.has(s)) vides.push(s);
  }
  if (vides.length) bloque("JF5", `cycle « ${c.type} » : ${vides.length} stade(s) sur ${ids.length} que AUCUN enregistrement n'occupe (${vides.join(", ")}) — l'histoire n'est pas entière ; le peupler, ou déclarer une exclusion motivée`, `cycle ${c.type}`);
}

// ---- JF6 · les enregistrements liés se tiennent ---------------------------------------------------------------------
const dateDe = (r, spec) => {
  if (String(spec).startsWith("etape:")) {
    const e = (Array.isArray(r.etapes) ? r.etapes : []).find(x => estObjet(x) && x.stade === spec.slice(6));
    return e ? dateNorm(e.date) : null;
  }
  return dateNorm(r[spec]);
};
for (const c of coherences) {
  const ennuis = [];
  const parents = new Map();
  for (const p of rows(c.parent.type)) {
    const k = String(p[c.parent.cle] ?? "");
    if (!parents.has(k)) parents.set(k, []);
    parents.get(k).push(p);
  }
  const sommes = new Map();
  for (const e of rows(c.enfant.type)) {
    const lib = etiquette(c.enfant.type, e);
    const cle = e[c.enfant.cle];
    const ps = parents.get(String(cle ?? "")) || [];
    if (cle === undefined || cle === null || cle === "" || !ps.length) { ennuis.push(`${lib} : ${c.enfant.cle} « ${cle ?? "(absent)"} » ne résout à aucun ${c.parent.type}.${c.parent.cle}`); continue; }
    if (c.date) {
      const de = dateDe(e, c.enfant.date);
      if (!de) ennuis.push(`${lib} : ${c.enfant.date} absente ou hors format ISO`);
      else for (const p of ps) {
        const dp = dateDe(p, c.parent.date);
        if (!dp) { if (c.date === ">=") ennuis.push(`${lib} du ${de} : ${etiquette(c.parent.type, p)} n'a pas ${c.parent.date}, or l'enfant doit la suivre`); }
        else if (c.date === ">=" ? de < dp : de > dp) ennuis.push(`${lib} du ${de} : ${c.enfant.date} doit être ${c.date} ${c.parent.date} de ${etiquette(c.parent.type, p)} (${dp})`);
      }
    }
    if (c.montant) {
      const m = e[c.enfant.montant];
      if (!(nombre(m) && m >= 0)) ennuis.push(`${lib} : montant « ${m ?? "(absent)"} » négatif ou non numérique`);
      else sommes.set(String(cle), (sommes.get(String(cle)) ?? 0) + m);
    }
  }
  if (c.montant) {
    for (const [cle, s] of sommes) {
      const ps = parents.get(cle) || [];
      const mp = ps.map(p => p[c.parent.montant]);
      if (!mp.every(x => nombre(x) && x >= 0)) { ennuis.push(`${c.parent.type}.${c.parent.cle} « ${cle} » : montant du parent négatif ou non numérique`); continue; }
      const borne = mp.reduce((a, b) => a + b, 0);
      const tol = P.tolerance_somme + 1e-9;
      const tient = c.montant === "somme<=" ? s <= borne + tol : Math.abs(s - borne) <= tol;
      if (!tient) ennuis.push(`${c.parent.type}.${c.parent.cle} « ${cle} » : somme des ${c.enfant.type}.${c.enfant.montant} = ${Math.round(s * 100) / 100} contre ${c.parent.type}.${c.parent.montant} = ${borne} (attendu ${c.montant.slice(5)})`);
    }
  }
  if (ennuis.length) bloque("JF6", `cohérence « ${c.id} » : ${ennuis.length} écart(s) — ${liste(ennuis)}`, `coherence ${c.id}`);
}

// ---- JF7 · les totaux du générateur se recalculent sur le contenu -----------------------------------------------------
const recalcule = t => {
  const l = rows(t.type).filter(r => correspond(r, t.filtre));
  return t.mesure === "compte" ? l.length : Math.round(l.reduce((s, r) => s + (nombre(r[t.champ]) ? r[t.champ] : 0), 0) * 100) / 100;
};
const egal = (mesure, a, b) => Math.abs(a - b) <= (mesure === "compte" ? P.tolerance_compte : P.tolerance_somme) + 1e-9;
let justes = 0, declares = 0;
for (const t of totaux.values()) {
  declares++;
  if (t.invalide) continue;
  const rec = recalcule(t);
  if (egal(t.mesure, t.valeur, rec)) { justes++; continue; }
  bloque("JF7", `total « ${t.id} » déclaré ${t.valeur} par le générateur, ${rec} recalculé sur le contenu (${t.mesure} ${t.type}${t.champ ? "." + t.champ : ""}${filtreTexte(t.filtre)}) — le générateur annonce ce que le jeu ne porte pas`, `generateur.totaux › ${t.id}`);
}

// ---- JF8 · les totaux lus sur les écrans égalent ceux que le générateur déclare ----------------------------------------
let confrontes = 0;
const aff = d.affichage;
if (aff === undefined || aff === null) {
  add("avertissement", "JF8", "aucune lecture d'écran déclarée (bloc « affichage ») : ce que les écrans AFFICHENT n'est pas jugé, seul le contenu du jeu l'est — lire chaque écran après chargement et consigner les totaux", file);
} else if (!estObjet(aff)) {
  bloque("JF8", "bloc « affichage » mal formé (objet attendu)", file);
} else {
  if (!txt(aff.par)) bloque("JF8", "affichage.par absent — QUI a lu les écrans : une lecture sans auteur ne se rejoue pas", "affichage");
  if (!dateNorm(aff.date)) bloque("JF8", "affichage.date absente ou hors format ISO — une lecture non datée a pu précéder le chargement du jeu", "affichage");
  if (!txt(aff.source)) bloque("JF8", "affichage.source absent — SUR QUOI la lecture a été faite (le produit chargé, pas le fichier du jeu)", "affichage");
  const lus = Array.isArray(aff.totaux) ? aff.totaux : [];
  if (!lus.length) bloque("JF8", "affichage.totaux vide — une lecture sans total lu ne confronte rien", "affichage");
  if (generateurOk) lus.forEach((a, i) => {
    const ou = `affichage.totaux #${i + 1}`;
    if (!ecransIds.has(txt(a?.ecran))) { bloque("JF8", `total lu sur l'écran « ${a?.ecran} », que le produit ne déclare pas`, ou); return; }
    const t = totaux.get(txt(a.total));
    if (!t) { bloque("JF8", `écran « ${a.ecran} » affiche le total « ${a.total} », que le générateur ne déclare pas — rien à confronter`, ou); return; }
    if (!nombre(a.valeur)) { bloque("JF8", `écran « ${a.ecran} » : valeur affichée « ${a.valeur} » non numérique pour « ${a.total} »`, ou); return; }
    if (t.invalide) return;
    confrontes++;
    if (!egal(t.mesure, a.valeur, t.valeur))
      bloque("JF8", `écran « ${a.ecran} » affiche ${a.valeur} pour « ${a.total} », le générateur déclare ${t.valeur} — l'écran ne montre pas ce que le jeu devait lui donner`, ou);
  });
}

mesures = {
  ecrans: { declares: ecrans.length, alimentes, exclus: exclusions.ecran.size },
  types: { declares: types.size, presents, exclus: exclusions.type.size },
  enregistrements,
  cycles: { declares: cycles.length, stades: stadesTotal, occupes: stadesOccupes },
  coherences: coherences.length,
  totaux: { declares, recalcules_justes: justes, affiches_confrontes: confrontes },
};
out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
