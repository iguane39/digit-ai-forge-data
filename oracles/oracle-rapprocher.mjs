#!/usr/bin/env node
// oracle-rapprocher — Domaine « Rapprochement modèle ↔ extrait externe » (déterministe).
// TF-0975, 14/09/2026, retour Produit-62 (RETOURS 20260908k + ledger seq 69).
//
// POURQUOI CET ORACLE. Les deux oracles voisins mesurent autre chose, et leur en-tête le dit :
// `oracle-couvrir` compare un mapping à l'INVENTAIRE DE SA SOURCE (donc en AMONT, jamais à ce
// que l'aval publie) ; `oracle-reconcilier` compare deux lots de VALEURS de mesures déjà
// identifiées, sous tolérance, et son non_juge écarte explicitement la structure. Ce qu'un
// client remet quand on lui demande à quoi ressemble le rapport est un EXPORT — des intitulés
// et des lignes — et rien ne rapprochait un modèle de reconstruction de cette pièce EXTERNE.
// Mesure réelle : 60 en-têtes d'un tableau livré et 60 colonnes d'une feuille d'export
// correspondent un pour un, au même libellé et au même rang, zéro orphelin dans les deux
// sens ; 60 des 66 colonnes du modèle sont portées par l'extrait, 6 ne le sont pas et chacune
// porte sa raison écrite. Sans ce rapprochement la cible restait une hypothèse argumentée ;
// avec lui elle est prouvée contre une pièce du client.
//
// Format `forge-data/rapprochement@1` :
//   { modele: { nom, objets: [string] }, extrait: { nom, intitules: [string] },
//     dictionnaire?: [ { concept, cote_modele, cote_extrait } ],
//     correspondances: [ { objet_modele, intitule_extrait, via: "litteral"|"dictionnaire" } ],
//     ecarts_extrait: [ { intitule, motif? } ],
//     absents_extrait: [ { objet_modele, motif, visuel } ] }
//
//   RA1  format + id ; modele.objets et extrait.intitules non vides ;
//   RA2  BIJECTION dans les DEUX SENS : tout intitulé de l'extrait est soit apparié
//        (`correspondances`), soit déclaré en écart (`ecarts_extrait`) — un intitulé ni
//        l'un ni l'autre est un OUBLI, exactement ce qu'une lecture à sens unique ne voit
//        jamais (c'est là que 28 colonnes sont sorties : 20 au TS commerce, 8 au TS gestion
//        loc) ; tout objet du modèle est soit apparié, soit déclaré absent
//        (`absents_extrait`) ;
//   RA3  toute correspondance non littérale (`via: "dictionnaire"`) référence une entrée du
//        `dictionnaire` DÉCLARÉE ; et le dictionnaire n'invente rien : `cote_modele` doit
//        exister dans `modele.objets`, `cote_extrait` dans `extrait.intitules` — un concept
//        qui cite un intitulé absent des deux sources est refusé (mesuré : 0 intitulé
//        inventé sur 120 cités) ;
//   RA4  chaque objet du modèle ABSENT de l'extrait porte un `motif` (≥ 4 mots, même
//        convention que CV4 d'`oracles/oracle-couvrir.mjs`) ET le `visuel` qui l'explique —
//        sinon absent et OUBLIÉ sont indiscernables (la leçon des exclusions déclarées de
//        CV4, transposée au rapprochement).
// non_juge : la pertinence métier d'un motif ou d'un concept de dictionnaire — l'oracle
// exige l'un et l'autre, il ne les arbitre pas ; la lecture de l'export lui-même (isolement
// des lignes non-données — `scripts/isoler-lignes-non-donnees.mjs`, TF-0976, à exécuter
// avant) ; la correspondance colonne à colonne au grain VALEUR (oracle-reconcilier).
// Usage : node oracle-rapprocher.mjs <rapprochement.json> [--json-only]
import fs from "node:fs";

const DOM = "Rapprochement modèle ↔ extrait externe, bijection dans les deux sens (RA1-RA4)";
const NON_JUGE = [
  "la pertinence métier d'un motif d'absence ou d'un concept de dictionnaire — l'oracle exige le motif et le concept, il ne les arbitre pas",
  "la lecture de l'export lui-même (isolement des lignes non-données) — `scripts/isoler-lignes-non-donnees.mjs`, TF-0976, à exécuter en amont",
  "la correspondance au grain VALEUR (deux lots de mesures sous tolérance) — `oracles/oracle-reconcilier.mjs` de ce dépôt",
  "la complétude du mapping contre l'inventaire de sa source — `oracles/oracle-couvrir.mjs` de ce dépôt, qui mesure l'AMONT quand celui-ci mesure l'AVAL",
];

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const out = (verdict, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-rapprocher", domaine: DOM, artefact: file || null,
    verdict, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "RA1-RA4 sans écart", where: file }],
    non_juge: NON_JUGE, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "RA1", "fichier introuvable", String(file)); out("FAIL", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "RA1", "JSON invalide", file); out("FAIL", 1); }

// RA1
if (d.format !== "forge-data/rapprochement@1") add("bloquant", "RA1", `format « ${d.format} » (attendu forge-data/rapprochement@1)`, file);
if (!d.id) add("bloquant", "RA1", "id du rapprochement non nommé", file);
const objetsModele = Array.isArray(d.modele?.objets) ? d.modele.objets : [];
const intitulesExtrait = Array.isArray(d.extrait?.intitules) ? d.extrait.intitules : [];
if (!objetsModele.length) add("bloquant", "RA1", "modele.objets absent ou vide", file);
if (!intitulesExtrait.length) add("bloquant", "RA1", "extrait.intitules absent ou vide", file);

const correspondances = Array.isArray(d.correspondances) ? d.correspondances : [];
const ecartsExtrait = Array.isArray(d.ecarts_extrait) ? d.ecarts_extrait : [];
const absentsExtrait = Array.isArray(d.absents_extrait) ? d.absents_extrait : [];
const dictionnaire = Array.isArray(d.dictionnaire) ? d.dictionnaire : [];

// RA2 — bijection dans les DEUX SENS.
const setObjetsModele = new Set(objetsModele);
const setIntitulesExtrait = new Set(intitulesExtrait);
const appariesModele = new Set(correspondances.map(c => c.objet_modele));
const appariesExtrait = new Set(correspondances.map(c => c.intitule_extrait));
correspondances.forEach((c, i) => {
  const ou = `correspondances #${i + 1}`;
  if (!setObjetsModele.has(c.objet_modele)) add("bloquant", "RA2", `correspondance vers un objet « ${c.objet_modele} » absent de modele.objets`, ou);
  if (!setIntitulesExtrait.has(c.intitule_extrait)) add("bloquant", "RA2", `correspondance vers un intitulé « ${c.intitule_extrait} » absent de extrait.intitules`, ou);
});
const declaresEcart = new Set(ecartsExtrait.map(e => e.intitule));
for (const intitule of intitulesExtrait) {
  if (!appariesExtrait.has(intitule) && !declaresEcart.has(intitule))
    add("bloquant", "RA2", `intitulé « ${intitule} » de l'extrait ni apparié à un objet du modèle, ni déclaré en écart — un intitulé sans verdict est un OUBLI`, "extrait.intitules");
}
const declaresAbsents = new Set(absentsExtrait.map(a => a.objet_modele));
for (const objet of objetsModele) {
  if (!appariesModele.has(objet) && !declaresAbsents.has(objet))
    add("bloquant", "RA2", `objet du modèle « ${objet} » ni apparié à un intitulé de l'extrait, ni déclaré absent — absent et OUBLIÉ sont indiscernables sans cette déclaration`, "modele.objets");
}

// RA3 — le dictionnaire ne cite QUE des objets qui existent réellement dans les deux sources ;
// toute correspondance « dictionnaire » y renvoie une entrée déclarée.
const dictParConcept = new Map(dictionnaire.map(c => [c.concept, c]));
dictionnaire.forEach((c, i) => {
  const ou = `dictionnaire #${i + 1}${c.concept ? ` (${c.concept})` : ""}`;
  if (!c.concept) { add("bloquant", "RA3", "concept de dictionnaire sans nom", ou); return; }
  if (!setObjetsModele.has(c.cote_modele)) add("bloquant", "RA3", `concept « ${c.concept} » : cote_modele « ${c.cote_modele} » n'existe dans AUCUNE des deux sources — un dictionnaire n'invente pas ses objets`, ou);
  if (!setIntitulesExtrait.has(c.cote_extrait)) add("bloquant", "RA3", `concept « ${c.concept} » : cote_extrait « ${c.cote_extrait} » n'existe dans AUCUNE des deux sources — un dictionnaire n'invente pas ses objets`, ou);
});
correspondances.forEach((c, i) => {
  if (c.via === "dictionnaire" && !dictParConcept.has(c.concept))
    add("bloquant", "RA3", `correspondance non littérale sans entrée de dictionnaire déclarée (concept « ${c.concept || "(absent)"} »)`, `correspondances #${i + 1}`);
});

// RA4 — chaque absence porte son motif ET le visuel qui l'explique.
absentsExtrait.forEach((a, i) => {
  const ou = `absents_extrait #${i + 1}${a.objet_modele ? ` (${a.objet_modele})` : ""}`;
  if (!a.objet_modele) { add("bloquant", "RA4", "absence sans objet_modele nommé", ou); return; }
  const motif = typeof a.motif === "string" ? a.motif.trim() : "";
  if (motif.split(/\s+/).filter(Boolean).length < 4) add("bloquant", "RA4", `objet « ${a.objet_modele} » absent de l'extrait sans motif écrit (au moins 4 mots) — absent et OUBLIÉ sont indiscernables sans lui`, ou);
  if (!a.visuel || !String(a.visuel).trim()) add("bloquant", "RA4", `objet « ${a.objet_modele} » absent de l'extrait sans le VISUEL qui l'explique`, ou);
});

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0, {
  compte: {
    objets_modele: objetsModele.length, intitules_extrait: intitulesExtrait.length,
    correspondances: correspondances.length, ecarts_extrait: ecartsExtrait.length, absents_extrait: absentsExtrait.length,
  },
});
