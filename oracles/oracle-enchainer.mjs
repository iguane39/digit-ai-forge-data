#!/usr/bin/env node
// oracle-enchainer — Domaine « Une chaîne de travail déclarée a ses étapes ÉCRITES, chacune avec
// le porteur qui la juge » (déterministe). TF-1179, 17/09/2026, retour Produit-62 RF-24.
//
// LE FAIT MESURÉ. Migrer un rapport vers un nouveau modèle était une chaîne promise — un mandat,
// une sortie nommée — dont aucune étape n'était écrite nulle part. Elles ont été découvertes une
// à une par l'échec : 3 jours de chantier, 3 défauts vus par l'humain AVANT tout oracle (un
// rapport qui ne rend rien pendant 2 jours sous 29 contrôles PASS, un périmètre pris au modèle,
// une mise en page réinventée pendant 2 jours sous 23 contrôles PASS), 3 fausses pistes mesurées
// avant la cause, 6 exports de 9 minutes, 4 lots de retours. Chaque étape a fini par avoir son
// geste et son contrôle — mais après. C'est la classe `chaine-declaree-etapes-non-ecrites`.
//
// CE QUE CET ORACLE JUGE, ET POURQUOI C'EST CELA. Écrire la procédure ne suffit pas : une étape
// qui cite un contrôle inexistant, ou une règle que ce contrôle ne porte pas, redevient de la
// discipline — elle se lit comme une garantie et n'en est pas une. L'oracle exige donc que chaque
// étape nomme un porteur qui EXISTE sur le disque, que chaque règle citée EXISTE dans le fichier
// de ce porteur, que ce qui ne se mécanise pas soit déclaré geste humain AVEC son enregistreur, et
// que le document que les humains lisent porte les mêmes étapes que la déclaration machine.
//
// Format `forge-data/chaine@1` :
//   { format, id, document, racine?,
//     etapes: [ { id, rang, etape, entree, sortie,
//                 porteur: { type: "oracle"|"script"|"geste_humain",
//                            chemin?, regles?: [...], geste?,
//                            enregistre_par?: { chemin, regle } } } ] }
//
//   CH1  forme : format, id, document déclaré, étapes non vides ; chaque étape porte un id unique,
//        un libellé (≥ 4 mots), une ENTRÉE et une SORTIE nommées — une étape dont on ne sait ni ce
//        qu'elle prend ni ce qu'elle rend ne se rejoue pas, elle se raconte ;
//   CH2  ORDRE : les rangs sont des entiers contigus de 1 à n, sans doublon. L'ordre est la moitié
//        de la procédure : un périmètre relevé APRÈS la conception est le périmètre du modèle,
//        c'est-à-dire tout ce qui existe — le défaut mesuré, exactement ;
//   CH3  PORTEUR : chaque étape nomme un porteur du jeu fermé {oracle, script, geste_humain} ; un
//        porteur `oracle` ou `script` porte un chemin qui EXISTE (résolu depuis `racine`, par
//        défaut la racine de ce dépôt). Une étape sans porteur existant est une étape NON ÉCRITE ;
//   CH4  RÈGLES : un porteur `oracle` nomme les règles qu'il fait jouer, et chacune se retrouve
//        dans le fichier de cet oracle — « chaque étape cite son oracle » devient décoratif dès que
//        personne ne vérifie que la règle citée y est (un identifiant de règle survit à sa règle) ;
//   CH5  GESTE HUMAIN : ce qui ne se mécanise pas se déclare `geste_humain`, avec son geste NOMMÉ
//        (≥ 6 mots, rejouable) et l'ENREGISTREUR qui en garde la trace (`enregistre_par` : un
//        contrôle existant et sa règle). « À faire à la main » sans enregistreur est une étape que
//        personne ne peut prouver jouée — c'est la doctrine RN5, appliquée à la chaîne ;
//   CH6  DOCUMENT : le document de la procédure EXISTE et CITE chaque étape par son id. Une chaîne
//        déclarée en machine et absente du document que les humains lisent est la même chaîne non
//        écrite, déplacée d'un cran (convention R9 de `oracle-restituer`).
// non_juge : que la procédure ait été SUIVIE — un contrôle ne remplace pas un geste, et aucune
// trace d'exécution n'est lue ici ; la JUSTESSE de la procédure (l'ordre des étapes est celui que
// le rédacteur déclare : l'oracle exige qu'il soit écrit et contigu, il ne l'arbitre pas) ; ce que
// chaque porteur juge de son côté — ses propres règles, ses propres fixtures ; la complétude de la
// chaîne (une étape qui manque à la déclaration ET au document n'est visible d'aucune règle de
// forme : c'est la limite structurelle, celle-là même qui a coûté les 3 jours du retour).
// Usage : node oracle-enchainer.mjs <chaine.json> [--json-only]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOM = "Chaîne de travail déclarée : étapes ordonnées, chacune avec un porteur qui existe (CH1-CH6)";
const NON_JUGE = [
  "que la procédure ait été SUIVIE : aucune trace d'exécution n'est lue ici — un contrôle ne remplace pas un geste",
  "la JUSTESSE de la procédure : l'oracle exige que l'ordre soit écrit et contigu, il n'arbitre pas l'ordre choisi",
  "ce que chaque porteur juge de son côté — ses règles et ses fixtures lui appartiennent ; ici seule leur EXISTENCE est vérifiée",
  "la COMPLÉTUDE de la chaîne : une étape absente à la fois de la déclaration et du document n'est visible d'aucune règle de forme — c'est la limite structurelle, et c'est elle qui a coûté les 3 jours du retour",
];
const TYPES_PORTEUR = ["oracle", "script", "geste_humain"];
const ici = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
let chaine = null;
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-enchainer", domaine: DOM, artefact: file || null,
    verdict, chaine, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "CH1-CH6 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "CH1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "CH1", "JSON invalide", file); out("FAIL", 1); }

// La racine des chemins : déclarée à côté de la chaîne, sinon la racine de ce dépôt. Une chaîne
// écrite par un produit pointe ses propres outils ; la procédure de la forge pointe les siens.
const racine = d.racine ? path.resolve(path.dirname(path.resolve(file)), d.racine) : path.join(ici, "..");
const resoudre = c => path.resolve(racine, c);
const mots = s => String(s || "").trim().split(/\s+/).filter(Boolean).length;
// Une règle est CITÉE si son identifiant apparaît en entier : `\b` sépare sur les caractères non
// alphanumériques, donc « R1-R5 » cite bien R1, tandis que « R10 » ne cite pas R1 — la confusion
// exacte qui ferait passer une règle absente pour une règle présente.
const cite = (texte, id) => new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m").test(texte);

// ---- CH1 · forme ------------------------------------------------------------------------------
if (d.format !== "forge-data/chaine@1") add("bloquant", "CH1", `format « ${d.format} » (attendu forge-data/chaine@1)`, file);
if (!d.id) add("bloquant", "CH1", "id de la chaîne non nommé", file);
if (!String(d.document || "").trim())
  add("bloquant", "CH1", "`document` absent — une chaîne déclarée en machine sans document lisible par un humain n'est écrite pour personne", file);
const etapes = Array.isArray(d.etapes) ? d.etapes : [];
if (!etapes.length) add("bloquant", "CH1", "aucune étape déclarée — une chaîne sans étape écrite est très exactement le défaut de la classe `chaine-declaree-etapes-non-ecrites`", file);

const ids = new Map();
const rangs = [];
let porteursOracle = 0, porteursScript = 0, gestesHumains = 0, reglesVerifiees = 0;
etapes.forEach((e, i) => {
  const id = typeof e?.id === "string" ? e.id.trim() : "";
  const ou = `etapes #${i + 1}${id ? ` (${id})` : ""}`;
  if (!id) add("bloquant", "CH1", "étape sans id — une étape qu'on ne peut pas citer ne se retrouve ni au document ni dans un ledger", ou);
  else if (ids.has(id)) add("bloquant", "CH1", `id d'étape « ${id} » déclaré deux fois — deux étapes sous le même nom se confondent au premier renvoi`, ou);
  else ids.set(id, e);
  if (mots(e?.etape) < 4) add("bloquant", "CH1", `libellé d'étape en ${mots(e?.etape)} mot(s) — une étape se NOMME (au moins 4 mots), sinon nul ne sait quoi faire`, ou);
  if (!String(e?.entree || "").trim()) add("bloquant", "CH1", "étape sans `entree` — ce qu'elle prend en entrée se nomme, ou l'étape ne se rejoue pas", ou);
  if (!String(e?.sortie || "").trim()) add("bloquant", "CH1", "étape sans `sortie` — ce qu'elle rend se nomme, sinon l'étape suivante ne sait pas ce qu'elle reçoit", ou);

  // ---- CH2 · l'ordre, qui est la moitié de la procédure --------------------------------------
  if (!Number.isInteger(e?.rang)) add("bloquant", "CH2", `rang « ${e?.rang} » absent ou non entier — une chaîne dont l'ordre n'est pas écrit se rejoue dans le désordre, et c'est ainsi qu'un périmètre se relève après la conception`, ou);
  else rangs.push(e.rang);

  // ---- CH3 · le porteur existe ----------------------------------------------------------------
  const p = e?.porteur && typeof e.porteur === "object" ? e.porteur : null;
  if (!p) { add("bloquant", "CH3", "étape sans porteur — une étape que rien ne juge est une étape non écrite, quel que soit le soin de son libellé", ou); return; }
  if (!TYPES_PORTEUR.includes(p.type)) { add("bloquant", "CH3", `porteur de type « ${p.type} » hors du jeu fermé {${TYPES_PORTEUR.join(", ")}}`, ou); return; }

  if (p.type === "geste_humain") {
    // ---- CH5 · ce qui ne se mécanise pas se déclare, avec son enregistreur ---------------------
    gestesHumains++;
    if (mots(p.geste) < 6)
      add("bloquant", "CH5", `geste humain en ${mots(p.geste)} mot(s) — le geste se DÉCRIT (au moins 6 mots : ce qu'on ouvre, ce qu'on lit, ce qu'on en conclut), sinon « à faire à la main » ne se rejoue pas`, ou);
    const en = p.enregistre_par && typeof p.enregistre_par === "object" ? p.enregistre_par : null;
    if (!en) { add("bloquant", "CH5", "geste humain sans `enregistre_par` — un geste dont la trace n'atterrit nulle part ne se prouve pas joué (doctrine RN5)", ou); return; }
    const cible = String(en.chemin || "");
    if (!cible || !fs.existsSync(resoudre(cible))) { add("bloquant", "CH5", `enregistreur « ${cible || "(vide)"} » introuvable depuis la racine déclarée — la trace du geste n'a nulle part où aller`, ou); return; }
    const src = fs.readFileSync(resoudre(cible), "utf8");
    if (!String(en.regle || "").trim()) add("bloquant", "CH5", `enregistreur « ${cible} » cité sans la règle qui EXIGE la trace — un contrôle qui n'exige rien n'enregistre rien`, ou);
    else if (!cite(src, String(en.regle).trim())) add("bloquant", "CH5", `règle « ${en.regle} » introuvable dans « ${cible} » — l'enregistreur cité ne porte pas la règle qu'on lui prête`, ou);
    else reglesVerifiees++;
    return;
  }

  const chemin = String(p.chemin || "");
  if (!chemin) { add("bloquant", "CH3", `porteur de type « ${p.type} » sans chemin — un porteur qui se cherche par son nom ne se trouve pas (leçon TF-0379)`, ou); return; }
  const abs = resoudre(chemin);
  if (!fs.existsSync(abs)) { add("bloquant", "CH3", `porteur « ${chemin} » introuvable depuis la racine déclarée — l'étape cite un contrôle qui n'existe pas, et se lit pourtant comme une garantie`, ou); return; }
  if (p.type === "oracle") porteursOracle++; else porteursScript++;

  // ---- CH4 · les règles citées existent dans le porteur ---------------------------------------
  if (p.type !== "oracle") return;
  const regles = Array.isArray(p.regles) ? p.regles.filter(r => String(r || "").trim()) : [];
  if (!regles.length) { add("bloquant", "CH4", `oracle « ${chemin} » cité sans aucune règle — citer un oracle sans dire ce qu'il fait jouer laisse croire qu'il juge tout`, ou); return; }
  const src = fs.readFileSync(abs, "utf8");
  for (const r of regles) {
    if (cite(src, String(r).trim())) { reglesVerifiees++; continue; }
    add("bloquant", "CH4", `règle « ${r} » introuvable dans « ${chemin} » — un identifiant de règle survit à sa règle, et l'étape continue de s'en réclamer`, ou);
  }
});

// ---- CH2 · rangs contigus de 1 à n ------------------------------------------------------------
if (rangs.length) {
  const tri = [...rangs].sort((a, b) => a - b);
  const attendu = tri.map((_, i) => i + 1);
  if (JSON.stringify(tri) !== JSON.stringify(attendu))
    add("bloquant", "CH2", `rangs ${JSON.stringify(tri)} — attendus contigus de 1 à ${rangs.length} : un rang manquant est une étape perdue, un rang doublé est un ordre que deux personnes liront différemment`, "etapes");
}

// ---- CH6 · le document porte les mêmes étapes que la déclaration ------------------------------
let manquantesDoc = [];
if (String(d.document || "").trim()) {
  const doc = resoudre(String(d.document));
  if (!fs.existsSync(doc))
    add("bloquant", "CH6", `document « ${d.document} » introuvable depuis la racine déclarée — la procédure n'existe que dans un fichier machine que personne ne lit`, file);
  else {
    const texte = fs.readFileSync(doc, "utf8");
    manquantesDoc = [...ids.keys()].filter(id => !cite(texte, id));
    if (manquantesDoc.length)
      add("bloquant", "CH6", `${manquantesDoc.length} étape(s) déclarée(s) et ABSENTE(S) du document lu par les humains : ${manquantesDoc.map(x => `« ${x} »`).join(" · ")} — une chaîne écrite pour la machine seule est la même chaîne non écrite, déplacée d'un cran`, d.document);
  }
}

chaine = {
  etapes: etapes.length, ids: [...ids.keys()],
  porteurs: { oracle: porteursOracle, script: porteursScript, geste_humain: gestesHumains },
  regles_verifiees: reglesVerifiees, etapes_absentes_du_document: manquantesDoc.length,
  racine: path.relative(process.cwd(), racine).replace(/\\/g, "/") || ".",
};
if (!F.some(f => f.sev === "bloquant") && etapes.length)
  add("info", "CH3", `${etapes.length} étape(s) ordonnée(s), toutes pourvues d'un porteur existant (${porteursOracle} oracle(s), ${porteursScript} script(s), ${gestesHumains} geste(s) humain(s)) et ${reglesVerifiees} règle(s) citée(s) retrouvée(s) dans leur porteur`, "etapes");

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
