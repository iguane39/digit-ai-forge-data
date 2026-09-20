#!/usr/bin/env node
// oracle-delimiter — Domaine « Le périmètre d'un livrable migré est ce que les VISUELS LISENT,
// jamais ce que le modèle d'origine CONTIENT » (déterministe). TF-1180, 17/09/2026, retour
// Produit-62 RF-25.
//
// LE FAIT MESURÉ. Le rapport d'origine porte 27 tables, 342 colonnes, 160 mesures et 25 requêtes.
// Ses visuels affichent 83 champs (29 colonnes projetées, 54 mesures) qui lisent 66 colonnes
// réelles. La première proposition servait les 342 colonnes, là où la demande humaine disait
// « uniquement » les colonnes affichées ; puis 3 tables qu'aucun visuel ni aucune mesure ne lit
// sont restées au modèle publié jusqu'à la décision D-32 du 16/09/2026. Personne n'avait demandé
// ce surplus : il coûte à l'actualisation, à la lecture et à la surface exposée.
//
// POURQUOI AUCUN ORACLE EXISTANT NE LE VOIT. `oracle-couvrir` (TF-0911) mesure un mapping contre
// l'INVENTAIRE de sa source : son défaut, c'est l'orphelin — ce que la source contient et que le
// livrable a oublié. Le défaut mesuré ici est le SYMÉTRIQUE, et il est invisible de CV5 : ce que
// le livrable sert et que personne ne lit. Une couverture parfaite (100 % de la source servie)
// est même la façon la plus sûre de le produire. `oracle-rendre` RN2 (TF-1175) juge les liaisons
// du rapport CONSTRUIT ; ici le périmètre se juge AVANT qu'il existe, à la conception, sur le
// relevé du fichier d'origine — c'est l'étape E2 de la procédure de migration, et son gate.
//
// LA RÈGLE DE LA FORGE : le périmètre d'un livrable migré est l'ensemble des objets LUS par un
// visuel ou par une mesure affichée du livrable d'origine, relevé sur ce fichier d'origine AVANT
// toute conception. Tout objet publié hors de cet ensemble est un EXCÉDENT : il se retire, ou il
// porte son exclusion motivée. Un objet n'est jamais retiré de la couche de DONNÉES par cette
// règle — il est retiré du modèle PUBLIÉ, qui est ce que le lecteur actualise et parcourt.
//
// Format `forge-data/perimetre@1` :
//   { format, id,
//     releve: { par, date, source },                 le relevé de l'usage s'identifie (DL2)
//     mise_en_page | mise_en_page_ref,               `forge-data/mise-en-page@1`, ou un `rendu@1`
//     usage | usage_ref,                             `forge-data/usage-restitution@1` (populations)
//     livre | livre_ref,                             le périmètre LIVRÉ : objets du modèle publié,
//                                                    inline, ou le `source.inventaire` d'un
//                                                    `forge-data/couverture@1` déjà relevé
//     correspondances?: [ { usage, livre } ],        un objet renommé par la migration
//     lectures_declarees?: [ { objet, type, par } ], relation | mesure_intermediaire
//     exclusions?: [ { portee, motif } ],
//     taux_declare? }
//
//   DL1  forme : format, id ; mise en page avec des pages ; usage au format usage-restitution@1 ;
//        périmètre livré non vide. L'usage est EXIGÉ, jamais optionnel : la population
//        `lue_par_mesure` (fermeture transitive depuis les mesures affichées) est exactement ce
//        qu'un relevé à la main manque — 45 des 66 colonnes du cas mesuré ;
//   DL2  le relevé s'identifie : `par`, `date` ISO et `source` (LE FICHIER D'ORIGINE sur lequel
//        l'usage a été relevé). Un périmètre relevé après coup, ou sur autre chose que l'entrée
//        du mandat, n'est pas opposable (convention CV2) ;
//   DL3  RIEN DE CE QUE LE LECTEUR VOYAIT N'EST PERDU : tout champ affiché par un visuel porteur
//        de données de l'origine résout à un objet du périmètre livré (casse insensible, TF-0972 ;
//        un renommage se déclare en `correspondances`). Une colonne lue par une mesure sans être
//        affichée est AVERTIE et non bloquante : la migration peut recalculer la mesure autrement ;
//   DL4  EXCÉDENT : tout objet du périmètre livré est LU — projeté par un visuel, atteint par une
//        mesure affichée, ou porté par une lecture déclarée qui résout — ou porte une exclusion
//        motivée (≥ 4 mots, convention CV4). L'excédent non motivé BLOQUE : c'est le défaut mesuré ;
//   DL5  les déclarations RÉSOLVENT : une correspondance, une lecture déclarée ou une exclusion
//        qui cite un objet inconnu du périmètre livré ne justifie rien et cache l'excédent qu'elle
//        prétend expliquer (défaut symétrique de CV3) ;
//   DL6  un `taux_declare` est RECALCULÉ et confronté (0,1 point près, convention CV6).
// non_juge : la JUSTESSE du relevé d'usage lui-même — un visuel oublié au relevé rend ses colonnes
// excédentaires à tort, et un champ inventé les rend nécessaires à tort ; d'où DL2 qui exige de
// dire QUI a relevé QUOI et QUAND, et la chaîne `traduire-modele-semantique --usage-restitution`
// qui produit l'usage sans transcription ; la COMPLÉTUDE du mapping vers la source (le défaut
// symétrique) — `oracles/oracle-couvrir.mjs` de ce dépôt ; les liaisons du rapport CONSTRUIT —
// `oracles/oracle-rendre.mjs` (RN2/RN3) ; la fidélité de la mise en page — `oracle-reconstruire.mjs` ;
// la pertinence métier d'une exclusion (l'oracle exige un motif écrit, il ne l'arbitre pas).
// Usage : node oracle-delimiter.mjs <perimetre.json> [--json-only]
import fs from "node:fs";
import path from "node:path";

const DOM = "Périmètre d'un livrable migré : ce que les visuels lisent, excédent non motivé refusé (DL1-DL6)";
const NON_JUGE = [
  "la JUSTESSE du relevé d'usage : un visuel oublié au relevé rend ses objets excédentaires à tort, un champ inventé les rend nécessaires à tort — d'où DL2 (qui a relevé, quand, sur quel fichier) et la chaîne `traduire-modele-semantique --usage-restitution` qui produit l'usage sans transcription à la main",
  "la COMPLÉTUDE du livrable vers sa source — le défaut symétrique (ce que la source contient et que le livrable a oublié) appartient à `oracles/oracle-couvrir.mjs` de ce dépôt",
  "les liaisons du rapport CONSTRUIT et le geste de vérification du rendu — `oracles/oracle-rendre.mjs` (RN2-RN5) ; la fidélité de sa mise en page — `oracles/oracle-reconstruire.mjs`",
  "la pertinence métier d'une exclusion : l'oracle exige un motif écrit, il ne l'arbitre pas (convention CV4)",
];
const TYPES_OBJET = ["table", "colonne", "mesure"];
const TYPES_LECTURE = ["relation", "mesure_intermediaire"];
const DATE_ISO = /^\d{4}-\d{2}-\d{2}/;
const EST_MESURE = /^(.+)\[(.+)\]$/;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
let perimetre = null;
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-delimiter", domaine: DOM, artefact: file || null,
    verdict, perimetre, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "DL1-DL6 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "DL1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "DL1", "JSON invalide", file); out("FAIL", 1); }

const aCote = ref => path.join(path.dirname(path.resolve(file)), ref);
const lireRef = (ref, regle, quoi) => {
  const p = aCote(ref);
  if (!fs.existsSync(p)) { add("bloquant", regle, `${quoi} introuvable à côté du périmètre : ${ref}`, file); return null; }
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { add("bloquant", regle, `${quoi} illisible (JSON attendu) : ${ref}`, file); return null; }
};

// ---- DL1 · forme, et les trois pièces qui rendent le jugement possible ----------------------
if (d.format !== "forge-data/perimetre@1") add("bloquant", "DL1", `format « ${d.format} » (attendu forge-data/perimetre@1)`, file);
if (!d.id) add("bloquant", "DL1", "id du périmètre non nommé", file);

// La mise en page de l'ORIGINE : elle dit ce que le lecteur voyait. Elle vient inline, ou d'un
// `rendu@1` déjà écrit (TF-1175) — le même document, jamais retapé.
let mep = d.mise_en_page && typeof d.mise_en_page === "object" ? d.mise_en_page : null;
if (!mep && d.mise_en_page_ref) {
  const r = lireRef(d.mise_en_page_ref, "DL1", "mise_en_page_ref");
  if (r) mep = r.format === "forge-data/rendu@1" ? r.mise_en_page : r;
}
const pages = Array.isArray(mep?.pages) ? mep.pages : [];
if (mep && mep.format !== "forge-data/mise-en-page@1")
  add("bloquant", "DL1", `mise en page au format « ${mep.format} » (attendu forge-data/mise-en-page@1)`, file);
if (!mep || !pages.length)
  add("bloquant", "DL1", "mise en page de l'origine absente ou sans page (`mise_en_page` ou `mise_en_page_ref`) — sans ce que les visuels affichent, le périmètre se reprendrait au modèle, très exactement le défaut mesuré", file);

// L'usage relevé : la population `lue_par_mesure` est la fermeture transitive depuis les mesures
// affichées. C'est elle qu'un relevé manuel manque (45 colonnes sur 66 au cas mesuré) ; sans elle
// l'oracle déclarerait excédentaire tout ce qui n'est pas projeté tel quel.
let usage = d.usage && typeof d.usage === "object" ? d.usage : null;
if (!usage && d.usage_ref) usage = lireRef(d.usage_ref, "DL1", "usage_ref");
if (usage && usage.format !== "forge-data/usage-restitution@1")
  add("bloquant", "DL1", `usage au format « ${usage.format} » (attendu forge-data/usage-restitution@1, produit par \`traduire-modele-semantique --usage-restitution\`)`, file);
if (!usage)
  add("bloquant", "DL1", "usage absent (`usage` ou `usage_ref`) — la population `lue_par_mesure` est la fermeture transitive depuis les mesures affichées, celle qu'un relevé à la main manque : sans elle, toute colonne lue par une mesure serait déclarée excédentaire", file);

// Le périmètre LIVRÉ : les objets du modèle publié. Inline, ou le `source.inventaire` d'un
// `couverture@1` déjà relevé (TF-0917) — la seconde source qu'on ne recopie pas.
let livre = Array.isArray(d.livre) ? d.livre : null;
if (!livre && d.livre_ref) {
  const cv = lireRef(d.livre_ref, "DL1", "livre_ref");
  if (cv && cv.format !== "forge-data/couverture@1") add("bloquant", "DL1", `livre_ref au format « ${cv.format} » (attendu forge-data/couverture@1)`, file);
  else if (cv) livre = Array.isArray(cv.source?.inventaire) ? cv.source.inventaire : null;
}
if (!livre || !livre.length)
  add("bloquant", "DL1", "périmètre livré absent ou vide (`livre` ou `livre_ref`) — sans les objets du modèle publié, il n'y a pas d'excédent à mesurer et l'oracle rendrait PASS sur n'importe quoi", file);

const objets = [];
const parCle = new Map();
(livre || []).forEach((o, i) => {
  const ou = `livre #${i + 1}`;
  const nom = typeof o?.objet === "string" ? o.objet.trim() : "";
  if (!nom) { add("bloquant", "DL1", "objet du périmètre livré non nommé", ou); return; }
  if (o.type !== undefined && !TYPES_OBJET.includes(o.type))
    add("bloquant", "DL1", `objet « ${nom} » de type « ${o.type} » hors du jeu fermé {${TYPES_OBJET.join(", ")}}`, ou);
  const cle = nom.toLowerCase();
  if (parCle.has(cle)) { add("bloquant", "DL1", `objet « ${nom} » livré deux fois — un doublon fausse le compte de l'excédent`, ou); return; }
  const e = { nom, cle, type: o.type };
  parCle.set(cle, e);
  objets.push(e);
});

// ---- DL2 · le relevé s'identifie, ou il n'est pas opposable ---------------------------------
const rel = d.releve && typeof d.releve === "object" ? d.releve : null;
if (!rel) add("bloquant", "DL2", "bloc « releve » absent — un périmètre sans relevé identifié est une opinion : qui l'a relevé, quand, et sur quel fichier d'origine", file);
else {
  if (!String(rel.par || "").trim()) add("bloquant", "DL2", "releve.par absent — QUI a relevé l'usage (outil ou personne) : un relevé sans auteur ne se rejoue pas", "releve");
  if (!DATE_ISO.test(String(rel.date || ""))) add("bloquant", "DL2", "releve.date absente ou hors format ISO — un relevé non daté a pu être fait après la conception, quand le périmètre était déjà pris au modèle", "releve");
  if (!String(rel.source || "").trim()) add("bloquant", "DL2", "releve.source absent — LE FICHIER D'ORIGINE sur lequel l'usage a été relevé : le périmètre se relève sur l'entrée du mandat, jamais sur le livrable en cours de construction", "releve");
}

// ---- Correspondances : un objet que la migration a renommé (DL5 juge qu'elles résolvent) -----
const corr = new Map();
(Array.isArray(d.correspondances) ? d.correspondances : []).forEach((c, i) => {
  const ou = `correspondances #${i + 1}`;
  const u = typeof c?.usage === "string" ? c.usage.trim() : "";
  const l = typeof c?.livre === "string" ? c.livre.trim() : "";
  if (!u || !l) { add("bloquant", "DL5", "correspondance incomplète — un renommage nomme ses DEUX côtés (`usage` et `livre`)", ou); return; }
  if (!parCle.has(l.toLowerCase()))
    add("bloquant", "DL5", `correspondance vers « ${l} », inconnu du périmètre livré — un renommage qui pointe dans le vide fait passer un champ perdu pour un champ conservé`, ou);
  corr.set(u.toLowerCase(), l.toLowerCase());
});
const resoudre = nom => corr.get(String(nom).toLowerCase()) || String(nom).toLowerCase();

// ---- DL3 · rien de ce que le lecteur voyait n'est perdu --------------------------------------
const lu = new Set();
let champsAffiches = 0, champsPerdus = 0, visuelsDonnees = 0;
pages.forEach((p, ip) => {
  const nomPage = String(p?.page || `#${ip + 1}`);
  (Array.isArray(p?.visuels) ? p.visuels : []).forEach((v, iv) => {
    if (v?.porte_donnees === false) return;   // un visuel décoratif ne projette rien, convention TF-0971
    visuelsDonnees++;
    const ou = `page ${nomPage} › visuel ${String(v?.visuel || `#${iv + 1}`)}`;
    (Array.isArray(v?.projections) ? v.projections : []).forEach(pr => {
      if (pr?.active === false) return;       // déclarée et jamais affichée : RN4 la compte, pas le périmètre
      const champ = String(pr?.champ || "").trim();
      if (!champ) return;
      champsAffiches++;
      const cle = resoudre(champ);
      if (parCle.has(cle)) { lu.add(cle); return; }
      champsPerdus++;
      add("bloquant", "DL3", `champ « ${champ} » affiché par ce visuel à l'origine et ABSENT du périmètre livré — le lecteur perd un champ qu'il voyait ; s'il a été renommé, la correspondance se déclare`, ou);
    });
  });
});

// Les colonnes atteintes par une mesure AFFICHÉE : lues sans être affichées. Leur absence du
// périmètre livré n'est pas un champ perdu — la migration peut recalculer la mesure autrement —
// mais elle se DIT : c'est là que se cache une mesure qui rendra vide.
const pops = usage?.populations && typeof usage.populations === "object" ? usage.populations : {};
let luesParMesure = 0, luesParMesureAbsentes = 0;
(Array.isArray(pops.lue_par_mesure) ? pops.lue_par_mesure : []).forEach(c => {
  luesParMesure++;
  const cle = resoudre(c);
  if (parCle.has(cle)) lu.add(cle);
  else { luesParMesureAbsentes++; add("avertissement", "DL3", `colonne « ${c} » lue par une mesure affichée de l'origine et absente du périmètre livré — recalcul assumé de la mesure, ou mesure qui rendra vide : à trancher, jamais à ignorer`, "usage.populations.lue_par_mesure"); }
});
(Array.isArray(pops.affichee) ? pops.affichee : []).forEach(c => { const cle = resoudre(c); if (parCle.has(cle)) lu.add(cle); });

// ---- DL5 · les lectures déclarées résolvent ---------------------------------------------------
// Une clé de relation et une mesure intermédiaire ne sont affichées nulle part et sont pourtant
// nécessaires. Elles se DÉCLARENT, et leur justification doit elle-même être lue : une mesure
// intermédiaire que seule une autre mesure jamais affichée lit reste un excédent.
const lectures = [];
(Array.isArray(d.lectures_declarees) ? d.lectures_declarees : []).forEach((l, i) => {
  const ou = `lectures_declarees #${i + 1}`;
  const objet = typeof l?.objet === "string" ? l.objet.trim() : "";
  const par = typeof l?.par === "string" ? l.par.trim() : "";
  if (!TYPES_LECTURE.includes(l?.type))
    add("bloquant", "DL5", `lecture déclarée de type « ${l?.type} » hors du jeu fermé {${TYPES_LECTURE.join(", ")}}`, ou);
  if (!objet || !parCle.has(objet.toLowerCase()))
    { add("bloquant", "DL5", `lecture déclarée pour « ${objet || "(objet vide)"} », inconnu du périmètre livré — elle ne justifie rien`, ou); return; }
  if (!par || !parCle.has(par.toLowerCase()))
    { add("bloquant", "DL5", `« ${objet} » déclaré lu par « ${par || "(rien)"} », inconnu du périmètre livré — une justification qui pointe hors du modèle publié cache l'excédent qu'elle prétend expliquer`, ou); return; }
  lectures.push({ objet: objet.toLowerCase(), par: par.toLowerCase(), nom: objet, nomPar: par, ou });
});

// Point fixe : un objet devient lu si sa lecture déclarée pointe un objet lu, et une TABLE est lue
// dès qu'une de ses colonnes ou de ses mesures l'est. Une chaîne de mesures intermédiaires qui ne
// remonte à aucun affichage ne se stabilise jamais à « lu » — et c'est le résultat voulu.
for (let tour = 0; tour < objets.length + 2; tour++) {
  let bouge = false;
  for (const l of lectures) if (!lu.has(l.objet) && lu.has(l.par)) { lu.add(l.objet); bouge = true; }
  for (const o of objets) {
    if (lu.has(o.cle) || (o.type !== undefined && o.type !== "table")) continue;
    if (objets.some(x => lu.has(x.cle) && (x.cle.startsWith(o.cle + ".") || x.cle.startsWith(o.cle + "[")))) { lu.add(o.cle); bouge = true; }
  }
  if (!bouge) break;
}

// ---- DL4 · l'excédent, et la seule porte de sortie : une exclusion motivée --------------------
const exclusions = [];
(Array.isArray(d.exclusions) ? d.exclusions : []).forEach((e, i) => {
  const ou = `exclusions #${i + 1}`;
  const portee = typeof e?.portee === "string" ? e.portee.trim() : "";
  const motif = typeof e?.motif === "string" ? e.motif.trim() : "";
  if (!portee) { add("bloquant", "DL4", "exclusion sans portée — une exclusion qui ne dit pas sur QUOI elle porte retire tout ou rien", ou); return; }
  if (motif.split(/\s+/).filter(Boolean).length < 4)
    add("bloquant", "DL4", `exclusion « ${portee} » sans motif écrit (au moins 4 mots) — une exclusion sans motif est un oubli déguisé en décision, et c'est la seule porte de sortie de l'excédent`, ou);
  exclusions.push({ cle: portee.toLowerCase(), portee, ou, touches: 0 });
});
const porte = (ex, o) => o.cle === ex.cle || o.cle.startsWith(ex.cle + ".") || o.cle.startsWith(ex.cle + "[");
const exclus = [], lus = [], excedent = [];
for (const o of objets) {
  if (lu.has(o.cle)) { lus.push(o); continue; }
  const ex = exclusions.find(x => porte(x, o));
  if (ex) { ex.touches++; exclus.push(o); continue; }
  excedent.push(o);
}
for (const ex of exclusions) if (!ex.touches)
  add("avertissement", "DL4", `exclusion « ${ex.portee} » ne retire aucun objet du périmètre livré — règle morte, ou portée mal écrite (une portée mal écrite laisse son objet en EXCÉDENT sans le dire)`, ex.ou);
for (const ex of exclusions) {
  const luEtExclu = objets.filter(o => lu.has(o.cle) && porte(ex, o));
  if (luEtExclu.length)
    add("avertissement", "DL4", `exclusion « ${ex.portee} » porte sur ${luEtExclu.length} objet(s) pourtant LU(S) par la restitution (${luEtExclu.slice(0, 3).map(o => `« ${o.nom} »`).join(" · ")}) — l'exclusion ne s'applique pas, l'objet reste au périmètre`, ex.ou);
}

const retenus = objets.length - exclus.length;
const pct = (n, sur) => (sur > 0 ? Math.round((n / sur) * 1000) / 10 : null);
perimetre = {
  livres: objets.length, lus: lus.length, exclus: exclus.length, excedent: excedent.length,
  champs_affiches: champsAffiches, champs_perdus: champsPerdus, visuels_porteurs_de_donnees: visuelsDonnees,
  lues_par_mesure: luesParMesure, lues_par_mesure_absentes: luesParMesureAbsentes,
  taux: { lu: pct(lus.length, retenus), brut: pct(lus.length, objets.length) },
  excedent_par_type: TYPES_OBJET.reduce((acc, t) => { const n = excedent.filter(o => o.type === t).length; if (n) acc[t] = n; return acc; }, {}),
};
if (excedent.length) {
  // Le compte par type d'abord (ce sont « 3 tables » et « 276 colonnes » qui ont déclenché le
  // retour), les objets NOMMÉS ensuite : un total anonyme ne se retire pas.
  const parType = Object.entries(perimetre.excedent_par_type).map(([t, n]) => `${n} ${t}(s)`).join(", ") || `${excedent.length} objet(s)`;
  const noms = excedent.slice(0, 10).map(o => `« ${o.nom} »`).join(" · ");
  const reste = excedent.length > 10 ? ` (+${excedent.length - 10} autres)` : "";
  add("bloquant", "DL4",
    `${excedent.length} objet(s) en EXCÉDENT — ${parType} : publiés au modèle et lus par aucun visuel, aucune mesure affichée ni aucune lecture déclarée. ` +
    `Le périmètre est ce que les visuels lisent : chacun se RETIRE du modèle publié, ou porte son exclusion motivée. ${noms}${reste}`,
    "livre");
} else if (objets.length) {
  add("info", "DL4", `aucun excédent — ${lus.length}/${retenus} objets retenus sont lus par la restitution (${perimetre.taux.lu} %), ${exclus.length} exclu(s) avec motif sur ${objets.length} livrés`, "livre");
}

// ---- DL6 · un taux déclaré se RECALCULE ------------------------------------------------------
if (d.taux_declare !== undefined) {
  const td = Number(d.taux_declare);
  if (!Number.isFinite(td)) add("bloquant", "DL6", `taux_declare « ${d.taux_declare} » non numérique`, file);
  else if (perimetre.taux.lu === null) add("bloquant", "DL6", "taux_declare posé alors qu'aucun taux n'est calculable (périmètre retenu vide)", file);
  else if (Math.abs(td - perimetre.taux.lu) > 0.1)
    add("bloquant", "DL6", `taux_declare ${td} % contre ${perimetre.taux.lu} % recalculé (${lus.length}/${retenus}) — un taux recopié d'une synthèse précédente est exactement ce qui a laissé publier 342 colonnes pour 66 lues`, file);
}

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
