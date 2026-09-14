#!/usr/bin/env node
// isoler-contexte-extrait — verbe (TF-0976, 14/09/2026) : LIT un export tabulaire délimité
// (CSV/TSV) et ISOLE les lignes NON-DONNÉES qu'il porte — pied « Filtres appliqués » de Power BI,
// ligne de totaux, ligne vide terminale — pour rendre DEUX sorties, JAMAIS UNE : les lignes de
// données, et un objet `contexte_de_l_extrait` portant les prédicats lus au pied. Générateur, pas
// un oracle.
//
// LE FAIT MESURÉ. Sur les trois feuilles d'un classeur Power BI exporté, la lecture naïve comptait
// 21 559, 21 719 et 14 121 lignes ; les données réelles sont 21 557, 21 716 et 14 117 — une ligne
// vide et une ligne de pied par feuille. Le pied atterrit dans la PREMIÈRE colonne, donc sa valeur
// devient une MODALITÉ FANTÔME de cette colonne : un dénombrement par période en rend deux au lieu
// d'une, et tout taux de remplissage est faux d'une ligne. LE SECOND EFFET EST LE PLUS COÛTEUX À
// IGNORER : ce pied est ce qui DIT que l'extrait est un INSTANTANÉ FILTRÉ (« Period n'est pas nul »,
// « Period est 202606 », « Country_ n'est pas vide »). Sans lui, un extrait de portée filtrée se
// lit comme un extrait complet — et c'est indécidable autrement : rien d'autre dans le fichier ne
// porte cette information.
//
// ÉCART DÉCLARÉ À LA PROPOSITION D'ORIGINE (contrat de campagne, section « Écarts à la lettre »).
// La proposition visait un classeur `.xlsx` (binaire, zip + XML). Ce dépôt n'a AUCUNE dépendance
// externe (README, section Prérequis) et ce verbe ne l'ajoute pas : il lit un export CSV/TSV — le
// MÊME contenu de pied qu'un export `.xlsx` du même rapport, Power BI exportant aussi bien en
// délimité, sans perte du pied. Lire le binaire `.xlsx` directement (zip + XML minimal, sans
// dépendance) reste À FAIRE, nommément, pour le jour où seul ce format est fourni.
//
// LE CONTRAT DE DÉTECTION, NOMMÉ :
//   - PIED « Filtres appliqués » : la dernière ligne non entièrement vide du fichier, dont la
//     PREMIÈRE cellule porte le marqueur « Filtres appliqués » (insensible à la casse et à
//     l'accentuation). Le reste de cette cellule est découpé en clauses (une par ligne interne,
//     le texte est un champ CSV multi-lignes) et chaque clause est parsée en un prédicat
//     { champ, operateur, valeur } — jeu fermé d'opérateurs { est, n_est_pas, n_est_pas_vide,
//     n_est_pas_nul, non_reconnu }. Une clause NON RECONNUE est gardée (jamais tue) avec son texte
//     brut, et compte comme dette de lecture.
//   - LIGNE DE TOTAUX : une ligne dont la première cellule vaut exactement « Total » ou « Totaux »
//     (insensible à la casse) — limite ASSUMÉE : une vraie modalité nommée « Total » serait
//     écartée à tort (non_juge).
//   - LIGNE VIDE TERMINALE : une ou plusieurs lignes entièrement vides en fin de fichier (après
//     retrait du pied s'il y en a un).
//   - RÈGLE DE CONTRAT : un extrait sans pied détecté n'est PAS supposé complet — `portee` vaut
//     "inconnue" et le dit en avertissement. Un extrait dont le contexte n'est pas déclaré est un
//     extrait de PORTÉE INCONNUE, pas un extrait complet par défaut.
//
// Usage : node scripts/isoler-contexte-extrait.mjs --fichier <export.csv> [--separateur <car>]
//         [--sortie <fichier.json>] [--json-only]
// Codes : 0 extrait lu (avec ou sans pied) ; 2 fichier absent/illisible/sans ligne de données.
import fs from "node:fs";
import path from "node:path";

const VERBE = "isoler-contexte-extrait";
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const jsonOnly = args.includes("--json-only");
const fichierArg = opt("--fichier") || args.find(a => !a.startsWith("--"));
const sepArg = opt("--separateur") || ",";
const sortieArg = opt("--sortie");

const AVERT = [];
const avert = m => AVERT.push(m);
const sortir = (sortie, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ verbe: VERBE, source: fichierArg || null, sortie, avertissements: AVERT, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};

if (!fichierArg || !fs.existsSync(fichierArg)) sortir("ECHEC", 2, { erreur: `fichier introuvable : ${fichierArg}` });
let texte;
try { texte = fs.readFileSync(fichierArg, "utf8"); }
catch (e) { sortir("ECHEC", 2, { erreur: `lecture impossible : ${e.message}` }); }

// ---------- Parseur CSV minimal (RFC4180 : champs entre guillemets, virgules et retours à la
// ligne internes préservés) — aucune dépendance externe, loi n° 4 et Prérequis de ce dépôt. -------
function parseCsv(src, sep) {
  const lignes = [];
  let ligne = [], champ = "", enQuote = false, vu = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (enQuote) {
      if (c === '"') { if (src[i + 1] === '"') { champ += '"'; i++; } else enQuote = false; }
      else champ += c;
    } else if (c === '"') { enQuote = true; vu = true; }
    else if (c === sep) { ligne.push(champ); champ = ""; vu = true; }
    else if (c === "\r") { /* le \n qui suit clôt la ligne */ }
    else if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; vu = false; }
    else { champ += c; vu = true; }
  }
  if (vu || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes;
}

const lignesBrutes = parseCsv(texte, sepArg);
if (lignesBrutes.length < 2) sortir("ECHEC", 2, { erreur: "aucune ligne de données : un en-tête et au moins une ligne sont attendus" });

const entetes = lignesBrutes[0];
let corps = lignesBrutes.slice(1);
const ecartees = [];
const videRe = l => l.every(c => (c || "").trim() === "");

// ---------- 1. Pied « Filtres appliqués » — dernière ligne non vide, marqueur en première cellule
const MARQUEUR_PIED = /filtres\s+appliqu[ée]s/i;
const OPERATEURS = [
  { re: /^(.+?)\s+n['’]est pas vide$/i, operateur: "n_est_pas_vide", valeur: () => null },
  { re: /^(.+?)\s+n['’]est pas nul(?:le)?$/i, operateur: "n_est_pas_nul", valeur: () => null },
  { re: /^(.+?)\s+n['’]est pas\s+(.+)$/i, operateur: "n_est_pas", valeur: m => m[2].trim() },
  { re: /^(.+?)\s+est\s+(.+)$/i, operateur: "est", valeur: m => m[2].trim() },
];
const parserClause = clause => {
  const c = clause.trim();
  if (!c) return null;
  for (const o of OPERATEURS) { const m = c.match(o.re); if (m) return { champ: m[1].trim(), operateur: o.operateur, valeur: o.valeur(m) }; }
  return { champ: null, operateur: "non_reconnu", valeur: null, brut: c };
};

let contexte = null;
let finIdx = corps.length - 1;
while (finIdx >= 0 && videRe(corps[finIdx])) finIdx--;
if (finIdx >= 0 && MARQUEUR_PIED.test((corps[finIdx][0] || "").split(/\r?\n/)[0])) {
  const brutPied = corps[finIdx][0];
  const clauses = brutPied.split(/\r?\n/).slice(1).map(l => l.trim()).filter(Boolean);
  const predicats = clauses.map(parserClause).filter(Boolean);
  const nonReconnues = predicats.filter(p => p.operateur === "non_reconnu");
  if (nonReconnues.length)
    avert(`pied de l'extrait : ${nonReconnues.length} clause(s) NON RECONNUE(S), gardée(s) sans être interprétée(s) — ${nonReconnues.map(p => `« ${p.brut} »`).join(", ")}`);
  contexte = { predicats, source: brutPied };
  ecartees.push({ ligne: finIdx + 2, type: "pied_filtres", brut: corps[finIdx].join(sepArg) });
  corps.splice(finIdx, 1);
}

// ---------- 2. Lignes vides terminales (après retrait éventuel du pied) --------------------------
while (corps.length && videRe(corps[corps.length - 1])) {
  ecartees.push({ ligne: corps.length + 1, type: "vide_terminale", brut: "" });
  corps.pop();
}

// ---------- 3. Ligne de totaux — limite assumée (non_juge) : une vraie modalité « Total » serait
// écartée à tort ; aucune fixture réelle mesurée ne porte ce cas, et la règle est nommée pour
// pouvoir être discutée plutôt que découverte en silence.
for (let i = corps.length - 1; i >= 0; i--) {
  if (/^(total|totaux)$/i.test((corps[i][0] || "").trim())) {
    ecartees.push({ ligne: i + 2, type: "ligne_totaux", brut: corps[i].join(sepArg) });
    corps.splice(i, 1);
  }
}

if (!contexte) avert("aucun pied « Filtres appliqués » détecté — la PORTÉE de cet extrait reste INCONNUE : un rapprochement qui l'emploie comme référence doit le DIRE, jamais le supposer complet");

const doc = {
  format: "forge-data/contexte-extrait@1",
  source: path.relative(process.cwd(), fichierArg).replace(/\\/g, "/") || fichierArg,
  entetes,
  lignes: corps.map(l => Object.fromEntries(entetes.map((h, i) => [h, l[i] !== undefined ? l[i] : ""]))),
  lignes_ecartees: ecartees.sort((a, b) => a.ligne - b.ligne),
  contexte_de_l_extrait: contexte,
  portee: contexte ? "declaree" : "inconnue",
};

let cible = sortieArg;
if (cible) {
  try { fs.mkdirSync(path.dirname(path.resolve(cible)), { recursive: true }); fs.writeFileSync(cible, JSON.stringify(doc, null, 2) + "\n"); }
  catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); }
}

sortir("OK", 0, {
  compte: {
    lignes_source: lignesBrutes.length - 1,
    lignes_donnees: doc.lignes.length,
    lignes_ecartees: doc.lignes_ecartees.length,
    par_type: doc.lignes_ecartees.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {}),
  },
  portee: doc.portee,
  fichier_produit: cible || null,
  document: cible ? undefined : doc,
});
