#!/usr/bin/env node
// oracle-couvrir — Domaine « Couverture d'un mapping contre l'INVENTAIRE de sa source :
// taux, orphelins, exclusions motivées » (déterministe). TF-0911, retour Produit-10 du
// 08/09/2026.
//
// LE FAIT MESURÉ. Un mapping de reprise a été livré, puis jugé PASS par TROIS oracles de cette
// forge — `oracle-tracer` (le lineage est complet), `oracle-modeliser` (le modèle dimensionnel
// est bien formé), `oracle-restituer` (chaque chiffre du rapport est ancré). Trois synthèses
// PASS, deux jours. Puis le produit a écrit son propre contrôle de couverture et trouvé
// 38 colonnes et 22 mesures ORPHELINES : présentes dans la source, absentes du mapping,
// jamais nommées par personne.
//
// POURQUOI LES TROIS ORACLES NE POUVAIENT PAS LE VOIR. Ils jugent tous la FORME DE CE QUI EST
// DÉCLARÉ : les entrées déclarées sont-elles datées, les dimensions déclarées sont-elles
// conformes, les chiffres restitués sont-ils ancrés. Aucun ne connaît l'INVENTAIRE de la
// source — donc aucun ne peut mesurer ce qui MANQUE. Un mapping vide passerait `oracle-tracer`
// aussi bien qu'un mapping exhaustif, du moment que les trois lignes qu'il déclare sont bien
// formées. C'est la classe de défaut « complétude », et elle ne se déduit d'aucune règle de
// forme : elle exige une SECONDE source, l'inventaire, et une soustraction.
//
// D'où le format `forge-data/couverture@1` : il met face à face l'inventaire relevé de la
// source et les objets que le mapping prétend couvrir, sous des RÈGLES DE RATTACHEMENT
// DÉCLARÉES — parce que « couvert » n'est pas toujours « nommé » (une table reprise en entier
// couvre ses colonnes sans les citer une à une), et parce qu'un objet volontairement laissé de
// côté doit se DIRE, avec son motif. Sans exclusion déclarée, la seule façon d'atteindre 100 %
// serait de mentir ; avec une exclusion sans motif, l'oubli se déguiserait en décision.
//
//   CV1  format + id ; inventaire de la source non vide ; mapping déclaré ;
//   CV2  la source s'identifie : `nom`, `date` ISO, `namespace` (l'INSTANCE — T7 de cette forge,
//        deux catalogues homonymes sur deux instances sont la règle) et `releve_par` (COMMENT
//        l'inventaire a été relevé : un inventaire sans provenance n'est pas opposable) ;
//        chaque objet de l'inventaire est nommé une seule fois, avec un `type` du jeu fermé
//        {colonne, mesure, requete, table, champ_visuel} ;
//   CV3  tout objet cité par le mapping EXISTE dans l'inventaire — le défaut symétrique de
//        l'orphelin, celui que personne ne cherche : un mapping qui référence un objet inconnu
//        de sa source est faux, ou son inventaire est périmé. Dans les deux cas le taux ment ;
//   CV4  règles de rattachement déclarées : `type` ∈ {nomme, table_entiere, exclusion}, portée
//        non vide, et toute EXCLUSION porte un motif d'au moins 4 mots. Une règle qui ne
//        rattache (ou n'exclut) rien est signalée : règle morte, ou portée mal écrite ;
//   CV5  ORPHELINS : tout objet de l'inventaire ni couvert ni exclu est nommé, compté par type,
//        et BLOQUE. PASS à zéro orphelin — c'est la barre du retour ;
//   CV6  si un `taux_declare` figure au document, il doit correspondre au taux RECALCULÉ
//        (0,1 point près) — un taux recopié d'une synthèse précédente est exactement ce qui a
//        laissé passer trois PASS.
//
// Deux taux sont rendus, et ils sont nommés pour qu'aucun ne se lise pour l'autre :
//   `taux.retenu` = couverts / (inventaire − exclus) — la couverture du périmètre RETENU ;
//   `taux.brut`   = couverts / inventaire — la couverture de TOUT ce que la source contient.
// CV6 juge `taux_declare` contre `taux.retenu`.
//
// non_juge : la JUSTESSE de chaque ligne du mapping (cet oracle compte ce qui est rattaché, il
// ne dit pas que le rattachement est correct — voir `oracles/oracle-reconcilier.mjs` pour les
// valeurs) ; l'EXHAUSTIVITÉ de l'inventaire lui-même (si le relevé a manqué 10 colonnes, elles
// ne sont orphelines pour personne — c'est la limite structurelle de la mesure) ; la pertinence
// métier d'une exclusion motivée (l'oracle exige un motif, il ne l'arbitre pas).
// Usage : node oracle-couvrir.mjs <couverture.json> [--json-only]
import fs from "node:fs";

const DOM = "Couverture d'un mapping contre l'inventaire de sa source : taux, orphelins, exclusions motivées (CV1-CV6)";
const NON_JUGE = [
  "la JUSTESSE de chaque rattachement — cet oracle compte ce qui est rattaché, jamais si le rattachement est correct ; les VALEURS se réconcilient avec `oracles/oracle-reconcilier.mjs` de ce dépôt",
  "l'EXHAUSTIVITÉ de l'inventaire lui-même : un objet que le relevé a manqué n'est orphelin pour personne. C'est la limite structurelle de la mesure, d'où l'exigence CV2 de dire COMMENT l'inventaire a été relevé",
  "la pertinence métier d'une exclusion : l'oracle exige un motif écrit, il ne l'arbitre pas",
  "la forme du lineage, du modèle dimensionnel et du rapport — `oracles/oracle-tracer.mjs`, `oracles/oracle-modeliser.mjs`, `oracles/oracle-restituer.mjs` de ce dépôt, qui rendent PASS sur un mapping incomplet : c'est précisément le trou que cet oracle bouche",
];
const TYPES_OBJET = ["colonne", "mesure", "requete", "table", "champ_visuel"];
const TYPES_REGLE = ["nomme", "table_entiere", "exclusion"];
const DATE_ISO = /^\d{4}-\d{2}-\d{2}/;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
let couverture = null;
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-couvrir", domaine: DOM, artefact: file || null,
    verdict, couverture, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "CV1-CV6 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "CV1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "CV1", "JSON invalide", file); out("FAIL", 1); }

// ---- CV1 · squelette ---------------------------------------------------------------------
if (d.format !== "forge-data/couverture@1") add("bloquant", "CV1", `format « ${d.format} » (attendu forge-data/couverture@1)`, file);
if (!d.id) add("bloquant", "CV1", "id de la mesure de couverture non nommé", file);
const src = d.source && typeof d.source === "object" ? d.source : null;
const map = d.mapping && typeof d.mapping === "object" ? d.mapping : null;
if (!src) add("bloquant", "CV1", "bloc « source » absent — sans inventaire de la source, il n'y a rien à soustraire et la couverture n'est pas mesurable", file);
if (!map) add("bloquant", "CV1", "bloc « mapping » absent — le livrable dont on mesure la couverture", file);
const inventaire = src && Array.isArray(src.inventaire) ? src.inventaire : [];
if (src && !inventaire.length) add("bloquant", "CV1", "source.inventaire absent ou vide — un inventaire vide rendrait 100 % de couverture sur rien", "source");

// ---- CV2 · la source s'identifie, et chaque objet est nommé une seule fois ------------------
if (src) {
  if (!src.nom) add("bloquant", "CV2", "source.nom absent", "source");
  if (!DATE_ISO.test(String(src.date || ""))) add("bloquant", "CV2", "source.date absente ou hors format ISO — un inventaire est daté ou il est périmé sans qu'on le sache", "source");
  if (!src.namespace) add("bloquant", "CV2", "source.namespace absent — le « où » se déclare (T7) : deux catalogues homonymes sur deux instances sont la règle, et un inventaire relevé sur la mauvaise instance mesure la couverture d'autre chose", "source");
  if (!src.releve_par) add("bloquant", "CV2", "source.releve_par absent — COMMENT l'inventaire a été relevé (importeur, information_schema, export d'outil) : un inventaire sans provenance n'est pas opposable", "source");
}
const vus = new Map();
const objets = [];
inventaire.forEach((o, i) => {
  const ou = `source.inventaire #${i + 1}`;
  const nom = o && typeof o.objet === "string" ? o.objet.trim() : "";
  if (!nom) { add("bloquant", "CV2", "objet d'inventaire non nommé", ou); return; }
  if (!TYPES_OBJET.includes(o.type)) add("bloquant", "CV2", `type « ${o.type} » hors du jeu fermé {${TYPES_OBJET.join(", ")}}`, ou);
  const cle = nom.toLowerCase();
  if (vus.has(cle)) { add("bloquant", "CV2", `objet « ${nom} » inventorié plus d'une fois — un doublon gonfle le dénominateur et le taux ment`, ou); return; }
  vus.set(cle, true);
  objets.push({ nom, cle, type: o.type });
});

// ---- CV4 · règles de rattachement déclarées ------------------------------------------------
// « Couvert » n'est pas toujours « nommé » : une table reprise en entier couvre ses colonnes
// sans les citer. Et un objet laissé de côté doit se DIRE — sinon la seule façon d'atteindre
// 100 % serait de mentir, et un oubli se lirait comme une décision.
const regles = Array.isArray(d.regles_rattachement) ? d.regles_rattachement : [];
const reglesValides = [];
regles.forEach((r, i) => {
  const ou = `regles_rattachement #${i + 1}`;
  const portee = r && typeof r.portee === "string" ? r.portee.trim() : "";
  if (!TYPES_REGLE.includes(r && r.type)) add("bloquant", "CV4", `type de règle « ${r && r.type} » hors du jeu fermé {${TYPES_REGLE.join(", ")}}`, ou);
  if (!portee) add("bloquant", "CV4", "portée de règle vide — une règle qui ne dit pas sur QUOI elle porte rattache tout ou rien", ou);
  const motif = r && typeof r.motif === "string" ? r.motif.trim() : "";
  if (r && r.type === "exclusion" && motif.split(/\s+/).filter(Boolean).length < 4)
    add("bloquant", "CV4", `exclusion « ${portee || "(portée vide)"} » sans motif écrit (au moins 4 mots) — une exclusion sans motif est un oubli déguisé en décision, et c'est le seul moyen de sortir un objet du dénominateur`, ou);
  if (portee && TYPES_REGLE.includes(r.type)) reglesValides.push({ type: r.type, portee, cle: portee.toLowerCase(), ou, touches: 0 });
});

// Une règle porte sur un objet exact, ou sur tout ce qui est PRÉFIXÉ par elle (`Ventes` couvre
// `Ventes.montant_ht`) — la seule lecture qui rende `table_entiere` utile sans la rendre floue.
const porte = (regle, objet) => objet.cle === regle.cle || objet.cle.startsWith(regle.cle + ".");
const nommes = new Set((map && Array.isArray(map.objets_source) ? map.objets_source : [])
  .filter(x => typeof x === "string" && x.trim()).map(x => x.trim().toLowerCase()));

// ---- CV3 · tout objet cité par le mapping existe dans l'inventaire --------------------------
if (map && !Array.isArray(map.objets_source)) add("bloquant", "CV1", "mapping.objets_source absent — la liste des objets de la source que le mapping prétend couvrir", "mapping");
if (map && !map.artefact) add("bloquant", "CV1", "mapping.artefact absent — le livrable dont on mesure la couverture se nomme (chemin du mapping)", "mapping");
for (const cle of nommes) if (!vus.has(cle))
  add("bloquant", "CV3", `le mapping cite « ${cle} », inconnu de l'inventaire de la source — soit le mapping est faux, soit l'inventaire est périmé ; dans les deux cas le taux ment`, "mapping.objets_source");

// ---- CV5 · orphelins et exclusions ----------------------------------------------------------
const exclus = [], couverts = [], orphelins = [];
for (const o of objets) {
  const excl = reglesValides.find(r => r.type === "exclusion" && porte(r, o));
  if (excl) { excl.touches++; exclus.push(o); continue; }
  const rattache = reglesValides.find(r => r.type !== "exclusion" && porte(r, o));
  if (rattache) rattache.touches++;
  if (nommes.has(o.cle) || rattache) couverts.push(o);
  else orphelins.push(o);
}
for (const r of reglesValides) if (!r.touches)
  add("avertissement", "CV4", `règle « ${r.type} » de portée « ${r.portee} » ne ${r.type === "exclusion" ? "retire" : "rattache"} aucun objet de l'inventaire — règle morte, ou portée mal écrite (une portée mal écrite laisse ses objets ORPHELINS sans le dire)`, r.ou);

const retenus = objets.length - exclus.length;
const pct = (n, sur) => (sur > 0 ? Math.round((n / sur) * 1000) / 10 : null);
couverture = {
  inventorie: objets.length, couverts: couverts.length, exclus: exclus.length, orphelins: orphelins.length,
  taux: { retenu: pct(couverts.length, retenus), brut: pct(couverts.length, objets.length) },
  orphelins_par_type: TYPES_OBJET.reduce((acc, t) => { const n = orphelins.filter(o => o.type === t).length; if (n) acc[t] = n; return acc; }, {}),
};
if (objets.length && retenus === 0)
  add("bloquant", "CV5", "tout l'inventaire est exclu — une couverture de rien n'est pas une couverture de tout", "source.inventaire");
if (orphelins.length) {
  // Le compte EXACT par type d'abord, les premiers NOMMÉS ensuite : un total anonyme ne se
  // corrige pas (38 colonnes et 22 mesures, ce sont ces deux nombres-là qui ont déclenché le
  // retour), et une liste sans total ne dit pas l'ampleur.
  const parType = Object.entries(couverture.orphelins_par_type).map(([t, n]) => `${n} ${t}(s)`).join(", ");
  const noms = orphelins.slice(0, 10).map(o => `« ${o.nom} »`).join(" · ");
  const reste = orphelins.length > 10 ? ` (+${orphelins.length - 10} autres)` : "";
  add("bloquant", "CV5",
    `${orphelins.length} objet(s) ORPHELIN(S) — ${parType} : présents dans l'inventaire de la source, ` +
    `ni rattachés par le mapping ni exclus avec motif. Taux sur périmètre retenu : ${couverture.taux.retenu} % ` +
    `(${couverts.length}/${retenus}). Chacun se rattache, ou s'exclut avec son motif : ${noms}${reste}`,
    "source.inventaire");
} else if (objets.length) {
  add("info", "CV5", `aucun orphelin — ${couverts.length}/${retenus} objets retenus rattachés (${couverture.taux.retenu} %), ${exclus.length} exclu(s) avec motif sur ${objets.length} inventoriés`, "source.inventaire");
}

// ---- CV6 · un taux déclaré se RECALCULE, il ne se recopie pas -------------------------------
if (d.taux_declare !== undefined) {
  const td = Number(d.taux_declare);
  if (!Number.isFinite(td)) add("bloquant", "CV6", `taux_declare « ${d.taux_declare} » non numérique`, file);
  else if (couverture.taux.retenu === null) add("bloquant", "CV6", "taux_declare posé alors qu'aucun taux n'est calculable (périmètre retenu vide)", file);
  else if (Math.abs(td - couverture.taux.retenu) > 0.1)
    add("bloquant", "CV6", `taux_declare ${td} % contre ${couverture.taux.retenu} % recalculé (${couverts.length}/${retenus}) — un taux recopié d'une synthèse précédente est exactement ce qui a laissé passer trois PASS`, file);
}

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
