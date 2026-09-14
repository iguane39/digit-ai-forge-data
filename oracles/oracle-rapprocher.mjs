#!/usr/bin/env node
// oracle-rapprocher — Domaine « Rapprochement d'un modèle avec un EXTRAIT du rapport livré par
// le client : la seule preuve EXTERNE qu'une reconstruction visera juste » (déterministe).
// TF-0975, 14/09/2026.
//
// CE QUE LES DEUX ORACLES VOISINS NE MESURENT PAS, ET LEUR EN-TÊTE LE DIT. `oracle-couvrir`
// compare un mapping à l'INVENTAIRE DE SA SOURCE — donc en AMONT, jamais à ce que l'aval publie.
// `oracle-reconcilier` compare deux lots de VALEURS de mesures identifiées sous tolérance, et son
// non_juge écarte explicitement la structure. Or ce qu'un client remet quand on lui demande à quoi
// ressemble le rapport est un EXPORT : des intitulés et des lignes — ni un inventaire de source, ni
// des valeurs mesurées. Sans un rapprochement DIRECT entre le modèle et cet export, la cible d'une
// reconstruction reste une hypothèse argumentée ; avec lui, elle est prouvée contre une PIÈCE DU
// CLIENT.
//
// TROIS EXIGENCES, ET CE SONT EXACTEMENT CELLES QU'IL A FALLU ÉCRIRE À LA MAIN SANS CET ORACLE :
//   RP1-RP2  squelette et unicité : modèle et extrait déclarés, chaque objet et chaque intitulé
//            nommé une seule fois ;
//   RP3      DICTIONNAIRE DE CONCEPTS DÉCLARÉ : toute correspondance NON LITTÉRALE passe par une
//            entrée { intitule_extrait, objet_modele, motif } — jamais par une ressemblance de
//            noms CALCULÉE. Une entrée dont l'intitulé ou l'objet n'existe dans AUCUNE des deux
//            sources est un intitulé INVENTÉ, refusé ;
//   RP4      LE RAPPROCHEMENT SE LIT DANS LES DEUX SENS, côté modèle d'abord : tout objet du
//            modèle est RAPPROCHÉ (littéralement, ou par le dictionnaire) OU DÉCLARÉ ABSENT avec
//            son motif ET le visuel qui l'explique — jamais les deux à la fois. Sans cette règle,
//            « absent » et « oublié » sont INDISCERNABLES (la leçon de CV5 d'`oracle-couvrir`,
//            transposée au rapprochement) ;
//   RP5      cohérence des absences : un objet déclaré absent existe bien dans le modèle ;
//   RP6      et côté EXTRAIT : un intitulé de l'extrait SANS équivalent au modèle est un ÉCART DE
//            PLEIN DROIT — jamais un silence. Toujours informationnel : découvrir ces intitulés
//            EST la valeur du rapprochement (28 colonnes sorties de leur périmètre par ce biais
//            sur le cas mesuré), pas une anomalie à corriger dans ce document ;
//   RP7      un `taux_declare` se RECALCULE, il ne se recopie pas (même défaut que CV6 : un taux
//            recopié d'une synthèse précédente est ce qui laisse passer un rapprochement faux).
//
// Deux taux : `taux.retenu` = rapprochés / (objets du modèle − absences déclarées) ; `taux.brut` =
// rapprochés / objets du modèle. RP7 juge `taux_declare` contre `taux.retenu`.
//
// non_juge : la JUSTESSE MÉTIER d'une correspondance du dictionnaire ou d'un motif d'absence —
// l'oracle exige qu'ils existent et soient formés, il ne les arbitre pas ; la détection d'un
// rapprochement NON déclaré qui existerait par ressemblance de noms approximative (l'oracle ne
// calcule aucune ressemblance, c'est l'exigence RP3 elle-même) ; la correction d'un intitulé côté
// extrait (RP6 le compte et le nomme, il ne dit jamais qu'il faut l'ajouter au modèle ou l'écarter).
// Usage : node oracle-rapprocher.mjs <rapprochement.json> [--json-only]
import fs from "node:fs";

const DOM = "Rapprochement d'un modèle avec un extrait du rapport livré par le client (RP1-RP7)";
const NON_JUGE = [
  "la JUSTESSE MÉTIER d'une correspondance du dictionnaire — l'oracle exige qu'elle existe dans les deux sources et porte un motif, il ne l'arbitre pas",
  "la JUSTESSE MÉTIER d'un motif ou d'un visuel d'absence — un motif bien formé peut être faux, l'oracle ne le vérifie pas sur le terrain",
  "un rapprochement NON déclaré qui existerait par ressemblance de noms APPROXIMATIVE — l'oracle ne calcule aucune ressemblance ; c'est l'exigence RP3 elle-même, pas une limite qui la contournerait",
  "que faire d'un intitulé côté extrait sans équivalent (RP6) — l'oracle le compte et le nomme, il ne dit jamais s'il faut l'ajouter au modèle ou l'écarter : cette décision reste humaine",
];
const MOTIF_MIN_MOTS = 4;
const motifValide = m => typeof m === "string" && m.trim().split(/\s+/).filter(Boolean).length >= MOTIF_MIN_MOTS;
const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
let rapprochement = null;
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-rapprocher", domaine: DOM, artefact: file || null,
    verdict, rapprochement, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "RP1-RP7 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "RP1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "RP1", "JSON invalide", file); out("FAIL", 1); }

// ---- RP1 · squelette -------------------------------------------------------------------------
if (d.format !== "forge-data/rapprochement@1") add("bloquant", "RP1", `format « ${d.format} » (attendu forge-data/rapprochement@1)`, file);
if (!d.id) add("bloquant", "RP1", "id du rapprochement non nommé", file);
const modele = d.modele && typeof d.modele === "object" ? d.modele : null;
const extrait = d.extrait && typeof d.extrait === "object" ? d.extrait : null;
if (!modele) add("bloquant", "RP1", "bloc « modele » absent — sans lui, rien à rapprocher", file);
if (!extrait) add("bloquant", "RP1", "bloc « extrait » absent — la pièce du client, sans elle le rapprochement n'est pas EXTERNE", file);
const objetsBruts = modele && Array.isArray(modele.objets) ? modele.objets : [];
const intitulesBruts = extrait && Array.isArray(extrait.intitules) ? extrait.intitules : [];
if (modele && !objetsBruts.length) add("bloquant", "RP1", "modele.objets absent ou vide", "modele");
if (extrait && !intitulesBruts.length) add("bloquant", "RP1", "extrait.intitules absent ou vide", "extrait");

// ---- RP2 · unicité, chaque objet et chaque intitulé nommé une seule fois ----------------------
const objets = [];
{ const vus = new Set();
  objetsBruts.forEach((o, i) => {
    const nom = typeof o === "string" ? o.trim() : "";
    if (!nom) { add("bloquant", "RP2", "objet du modèle non nommé", `modele.objets #${i + 1}`); return; }
    const cle = norm(nom);
    if (vus.has(cle)) { add("bloquant", "RP2", `objet « ${nom} » déclaré plus d'une fois dans le modèle`, `modele.objets #${i + 1}`); return; }
    vus.add(cle); objets.push({ nom, cle });
  });
}
const intitules = [];
{ const vus = new Set();
  intitulesBruts.forEach((s, i) => {
    const nom = typeof s === "string" ? s.trim() : "";
    if (!nom) { add("bloquant", "RP2", "intitulé de l'extrait non nommé", `extrait.intitules #${i + 1}`); return; }
    const cle = norm(nom);
    if (vus.has(cle)) { add("bloquant", "RP2", `intitulé « ${nom} » déclaré plus d'une fois dans l'extrait`, `extrait.intitules #${i + 1}`); return; }
    vus.add(cle); intitules.push({ nom, cle });
  });
}
const objetParCle = new Map(objets.map(o => [o.cle, o]));
const intituleParCle = new Map(intitules.map(i => [i.cle, i]));

// ---- RP3 · dictionnaire de concepts DÉCLARÉ, jamais une ressemblance calculée -----------------
const dictionnaire = Array.isArray(d.dictionnaire) ? d.dictionnaire : [];
const dictParIntitule = new Map(); // cle intitulé -> objet.cle
dictionnaire.forEach((e, i) => {
  const ou = `dictionnaire #${i + 1}`;
  const ie = e && typeof e.intitule_extrait === "string" ? e.intitule_extrait.trim() : "";
  const om = e && typeof e.objet_modele === "string" ? e.objet_modele.trim() : "";
  if (!ie || !om) { add("bloquant", "RP3", "entrée de dictionnaire sans « intitule_extrait » ou sans « objet_modele »", ou); return; }
  const cleIe = norm(ie), cleOm = norm(om);
  if (!intituleParCle.has(cleIe)) add("bloquant", "RP3", `dictionnaire : intitulé « ${ie} » INVENTÉ — absent de \`extrait.intitules\``, ou);
  if (!objetParCle.has(cleOm)) add("bloquant", "RP3", `dictionnaire : objet « ${om} » INVENTÉ — absent de \`modele.objets\``, ou);
  if (!motifValide(e.motif)) add("bloquant", "RP3", `entrée « ${ie} » → « ${om} » sans motif écrit (au moins ${MOTIF_MIN_MOTS} mots) — une correspondance non littérale sans motif n'est pas distinguable d'une ressemblance devinée`, ou);
  if (intituleParCle.has(cleIe) && objetParCle.has(cleOm)) dictParIntitule.set(cleIe, cleOm);
});

// ---- RP4/RP6 · le rapprochement dans les DEUX sens ---------------------------------------------
// Côté modèle : rapproché (littéral ou dictionnaire), déclaré absent, ou NI L'UN NI L'AUTRE — et
// c'est cette troisième case que CV5 (`oracle-couvrir`) a nommée « absent et oublié
// indiscernables », transposée ici.
const absences = Array.isArray(d.absences_modele) ? d.absences_modele : [];
const absenceParObjet = new Map();
absences.forEach((a, i) => {
  const ou = `absences_modele #${i + 1}`;
  const obj = a && typeof a.objet === "string" ? a.objet.trim() : "";
  if (!obj) { add("bloquant", "RP5", "absence sans objet nommé", ou); return; }
  const cle = norm(obj);
  if (!objetParCle.has(cle)) { add("bloquant", "RP5", `absence déclarée pour « ${obj} », inconnu de \`modele.objets\``, ou); return; }
  if (!motifValide(a.motif)) add("bloquant", "RP4", `absence de « ${obj} » sans motif écrit (au moins ${MOTIF_MIN_MOTS} mots) — sinon absent et oublié sont indiscernables`, ou);
  if (!a.visuel || !String(a.visuel).trim()) add("bloquant", "RP4", `absence de « ${obj} » sans le VISUEL qui l'explique — un motif sans visuel ne se vérifie pas à l'écran`, ou);
  absenceParObjet.set(cle, { obj, ou });
});

const rapprochesModele = [], orphelinsModele = [], contradictionsCles = new Set();
for (const o of objets) {
  const litteral = intituleParCle.has(o.cle);
  const viaDict = [...dictParIntitule.values()].includes(o.cle);
  const absent = absenceParObjet.has(o.cle);
  if ((litteral || viaDict) && absent) {
    contradictionsCles.add(o.cle);
    add("bloquant", "RP4", `objet « ${o.nom} » à la fois RAPPROCHÉ et déclaré ABSENT — les deux ne peuvent pas être vrais`, absenceParObjet.get(o.cle).ou);
    continue;
  }
  if (litteral || viaDict) rapprochesModele.push(o);
  else if (absent) { /* déjà jugé par RP4 ci-dessus (motif/visuel) */ }
  else { orphelinsModele.push(o); add("bloquant", "RP4", `objet « ${o.nom} » NI rapproché (littéral ou dictionnaire) NI déclaré absent avec motif — absent et oublié sont indiscernables`, "modele.objets"); }
}

// RP6 · côté extrait — toujours informationnel : la DÉCOUVERTE de l'écart est la valeur.
const rapprochesCleExtrait = new Set([...rapprochesModele.map(o => o.cle), ...dictParIntitule.keys()]);
const ecartsExtrait = intitules.filter(i => !rapprochesCleExtrait.has(i.cle) && !dictParIntitule.has(i.cle));
if (ecartsExtrait.length) {
  const noms = ecartsExtrait.slice(0, 10).map(i => `« ${i.nom} »`).join(" · ");
  const reste = ecartsExtrait.length > 10 ? ` (+${ecartsExtrait.length - 10} autres)` : "";
  add("info", "RP6", `${ecartsExtrait.length} intitulé(s) de l'extrait SANS équivalent au modèle — écart de plein droit, découverte du rapprochement, jamais un défaut de ce document : ${noms}${reste}`, "extrait.intitules");
} else if (intitules.length) {
  add("info", "RP6", "aucun intitulé de l'extrait sans équivalent au modèle", "extrait.intitules");
}

// ---- RP7 · un taux déclaré se RECALCULE ---------------------------------------------------------
const retenus = objets.length -
  absences.filter(a => objetParCle.has(norm(a.objet || "")) && !contradictionsCles.has(norm(a.objet || ""))).length -
  contradictionsCles.size;
const pct = (n, sur) => (sur > 0 ? Math.round((n / sur) * 1000) / 10 : null);
rapprochement = {
  modele_objets: objets.length, extrait_intitules: intitules.length,
  rapproches: rapprochesModele.length, absents_motives: absenceParObjet.size, orphelins_modele: orphelinsModele.length,
  ecarts_extrait: ecartsExtrait.length,
  taux: { retenu: pct(rapprochesModele.length, retenus), brut: pct(rapprochesModele.length, objets.length) },
};
if (d.taux_declare !== undefined) {
  const td = Number(d.taux_declare);
  if (!Number.isFinite(td)) add("bloquant", "RP7", `taux_declare « ${d.taux_declare} » non numérique`, file);
  else if (rapprochement.taux.retenu === null) add("bloquant", "RP7", "taux_declare posé alors qu'aucun taux n'est calculable (périmètre retenu vide)", file);
  else if (Math.abs(td - rapprochement.taux.retenu) > 0.1)
    add("bloquant", "RP7", `taux_declare ${td} % contre ${rapprochement.taux.retenu} % recalculé (${rapprochesModele.length}/${retenus}) — un taux recopié n'est jamais recalculé`, file);
}

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
