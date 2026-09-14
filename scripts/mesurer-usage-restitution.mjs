#!/usr/bin/env node
// mesurer-usage-restitution — verbe (TF-0971, 14/09/2026) : LIT la mise en page d'un rapport de
// restitution (les visuels et les champs qu'ils projettent) et croise ce relevé avec le modèle
// pour rendre TROIS populations de colonnes — affichée, lue_par_mesure, jamais_lue — là où
// `oracle-couvrir` ne mesure la couverture que contre le MODÈLE, jamais contre ce qui est à
// l'écran. Générateur, pas un oracle (le jugement de sa sortie appartient à
// `oracles/oracle-usage-restitution.mjs`, format `forge-data/usage-restitution@1`).
//
// LE FAIT MESURÉ. `oracle-couvrir` et la recette d'un produit comparaient un mapping aux 342
// colonnes du MODÈLE et rendaient FAIL sur 38 orphelines. Sur ces 342 colonnes, 66 SEULEMENT
// étaient mobilisées par les 83 champs des 16 visuels porteurs de données du rapport (21
// projetées telles quelles, 45 lues par des mesures affichées) ; 276 ne l'étaient JAMAIS, et 10
// des 27 tables du modèle étaient entièrement inutilisées. Conséquence directe sur la priorité :
// des 38 colonnes sans ligne de mapping, 20 étaient réellement mobilisées et 18 ne l'étaient pas
// — la dette bloquante était deux fois plus petite que celle que l'oracle de couverture annonçait,
// et cet oracle ne peut structurellement pas le dire (il ne connaît rien de la mise en page).
//
// CE VERBE COMPOSE, IL NE DUPLIQUE PAS. Il attend en entrée deux artefacts DÉJÀ produits par cette
// forge, jamais un modèle re-parsé : un INVENTAIRE d'objets du modèle (`--modele`, au format
// `forge-data/couverture@1` — champ `source.inventaire` — ou la forme la plus courte
// `{ "objets": ["Table.colonne", "Table[Mesure]", ...] }`) et une RÉSOLUTION DAX (`--resolution`,
// format `forge-data/resolution-dax@1` de `scripts/traduire-modele-semantique.mjs
// --resolution-dax`, TF-0972) qui dit, pour chaque mesure, ses colonnes terminales. Le croisement
// avec `oracle-couvrir` (orphelins ∩ jamais_lue) N'EST PAS automatisé ici, délibérément : c'est une
// simple intersection ensembliste entre cette sortie et `couverture.orphelins`, et l'automatiser
// dupliquerait `oracle-couvrir` plutôt que de le composer.
//
// LE FORMAT DE MISE EN PAGE LU, ET LA LIMITE DITE. Ce lecteur scanne un projet de rapport au
// format PBIR (Power BI Enhanced Report Format — JSON texte, un fichier `visual.json` par
// visuel sous `definition/pages/**/visuals/**/`) : AUCUNE dépendance externe, AUCUNE connexion
// (loi n° 4), le même principe texte que TMDL pour le modèle sémantique. Le signal recherché est
// le champ `queryRef` (convention stable de ce format : CHAQUE champ projeté dans un visuel — la
// case-value indifférente au type de puits, catégorie, valeur, infobulle — porte cette chaîne
// "Table.Membre"). LIMITE ASSUMÉE ET DITE, comme partout dans cette forge : le binaire `.pbix` n'est
// PAS lu ici (un export PBIP/PBIR du même rapport porte la même mise en page en texte) ; un
// visuel qui n'émettrait pas `queryRef` (visuel personnalisé tiers, format antérieur à 2024)
// échappe à la mesure — nommé dans `avertissements`, jamais supposé absent de la mise en page.
//
// Usage : node scripts/mesurer-usage-restitution.mjs --modele <inventaire.json>
//         --resolution <resolution-dax.json> --rapport <dossier PBIR> [--sortie <f.json>] [--json-only]
// Codes : 0 relevé produit (avec ou sans référence non résolue) ; 2 entrée absente/illisible/vide.
import fs from "node:fs";
import path from "node:path";

const VERBE = "mesurer-usage-restitution";
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const jsonOnly = args.includes("--json-only");
const modeleArg = opt("--modele");
const resolutionArg = opt("--resolution");
const rapportArg = opt("--rapport");
const sortieArg = opt("--sortie");

const AVERT = [];
const avert = m => AVERT.push(m);
const sortir = (sortie, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ verbe: VERBE, modele: modeleArg || null, resolution: resolutionArg || null, rapport: rapportArg || null,
    sortie, avertissements: AVERT, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};

for (const [nom, val] of [["--modele", modeleArg], ["--resolution", resolutionArg], ["--rapport", rapportArg]])
  if (!val) sortir("ECHEC", 2, { erreur: `argument ${nom} requis` });
for (const [nom, val] of [["--modele", modeleArg], ["--resolution", resolutionArg]])
  if (!fs.existsSync(val)) sortir("ECHEC", 2, { erreur: `${nom} introuvable : ${val}` });
if (!fs.existsSync(rapportArg) || !fs.statSync(rapportArg).isDirectory())
  sortir("ECHEC", 2, { erreur: `--rapport doit être un dossier de projet PBIR : ${rapportArg}` });

// ---------- Table/membre : parsing tolérant aux guillemets (même grammaire que la résolution DAX,
// scripts/traduire-modele-semantique.mjs --resolution-dax, TF-0972) ---------------------------
const nomDe = s => String(s || "").trim().replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1");
const KEY_QUALIFIE = /^(?:'([^']*)'|([^.[\]]+))(?:\.(?:'([^']*)'|([^.[\]]+))|\[([^\]]+)\])$/;
const decouper = ref => {
  const m = String(ref || "").trim().match(KEY_QUALIFIE);
  if (!m) return null;
  const table = nomDe(m[1] !== undefined ? m[1] : m[2]);
  const membre = nomDe(m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]));
  return table && membre ? { table, membre } : null;
};
const cle = (table, membre) => `${table.toLowerCase()}.${membre.toLowerCase()}`;

// ---------- Modèle : couverture@1 (source.inventaire) ou forme courte { objets: [...] } --------
let modeleDoc;
try { modeleDoc = JSON.parse(fs.readFileSync(modeleArg, "utf8")); } catch (e) { sortir("ECHEC", 2, { erreur: `--modele illisible (JSON attendu) : ${e.message}` }); }
const objetsBruts = modeleDoc.source && Array.isArray(modeleDoc.source.inventaire)
  ? modeleDoc.source.inventaire.map(o => o.objet)
  : (Array.isArray(modeleDoc.objets) ? modeleDoc.objets : null);
if (!objetsBruts || !objetsBruts.length) sortir("ECHEC", 2, { erreur: "--modele ne porte aucun objet (ni source.inventaire, ni objets[])" });

const colonnesModele = new Map(); // cle -> forme canonique "Table.colonne"
const mesuresModele = new Map();  // cle -> forme canonique "Table[Mesure]"
for (const brut of objetsBruts) {
  const parties = String(brut).match(/^(.+?)\[(.+)\]$/); // notation mesure "Table[Mesure]"
  if (parties) { const t = nomDe(parties[1]), m = nomDe(parties[2]); mesuresModele.set(cle(t, m), `${t}[${m}]`); continue; }
  const d = decouper(brut);
  if (d) colonnesModele.set(cle(d.table, d.membre), `${d.table}.${d.membre}`);
}
if (!colonnesModele.size) sortir("ECHEC", 2, { erreur: "--modele : aucune colonne reconnue (notation « Table.colonne » attendue) — rien à mesurer" });

// ---------- Résolution DAX : forge-data/resolution-dax@1 (TF-0972) ------------------------------
let resDoc;
try { resDoc = JSON.parse(fs.readFileSync(resolutionArg, "utf8")); } catch (e) { sortir("ECHEC", 2, { erreur: `--resolution illisible (JSON attendu) : ${e.message}` }); }
if (resDoc.format !== "forge-data/resolution-dax@1") sortir("ECHEC", 2, { erreur: `--resolution au format « ${resDoc.format} » (attendu forge-data/resolution-dax@1)` });
const colonnesParMesure = new Map(); // cle mesure -> Set(cle colonne)
for (const m of (Array.isArray(resDoc.mesures) ? resDoc.mesures : [])) {
  const d = decouper(m.mesure);
  if (!d) continue;
  colonnesParMesure.set(cle(d.table, d.membre), new Set((m.colonnes || []).map(c => { const dc = decouper(c); return dc ? cle(dc.table, dc.membre) : null; }).filter(Boolean)));
}

// ---------- Rapport PBIR : scan récursif des « queryRef » ----------------------------------------
const fichiersJson = dir => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiersJson(p));
    else if (e.isFile() && /\.json$/i.test(e.name)) out.push(p);
  }
  return out;
};
const fichiers = fichiersJson(rapportArg);
if (!fichiers.length) sortir("ECHEC", 2, { erreur: `aucun fichier .json sous ${rapportArg} — un projet PBIR est attendu (definition/pages/**/visuals/**/visual.json)` });
const QUERYREF_RE = /"queryRef"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
const dejsonEscape = s => s.replace(/\\(.)/g, (_, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
const queryRefsBruts = new Set();
for (const f of fichiers) {
  const texte = fs.readFileSync(f, "utf8");
  let m; QUERYREF_RE.lastIndex = 0;
  while ((m = QUERYREF_RE.exec(texte))) queryRefsBruts.add(dejsonEscape(m[1]));
}
if (!queryRefsBruts.size) avert(`aucun \`queryRef\` trouvé dans ${fichiers.length} fichier(s) .json — mise en page vide, ou visuels n'émettant pas cette convention (format antérieur, visuel tiers)`);

// ---------- Classement : affichée / mesure affichée / non résolue -------------------------------
const affichee = new Set(), mesuresAffichees = new Set(), nonResolues = [];
for (const brut of queryRefsBruts) {
  const d = decouper(brut);
  if (!d) { nonResolues.push(brut); avert(`référence de mise en page « ${brut} » NON DÉCOUPABLE en table.membre — ignorée`); continue; }
  const k = cle(d.table, d.membre);
  if (colonnesModele.has(k)) { affichee.add(k); continue; }
  if (mesuresModele.has(k)) { mesuresAffichees.add(k); continue; }
  nonResolues.push(brut);
  avert(`référence de mise en page « ${brut} » NON RÉSOLUE — ni colonne ni mesure connue du modèle fourni (\`--modele\`)`);
}

const luesParMesure = new Set();
for (const km of mesuresAffichees) for (const kc of (colonnesParMesure.get(km) || [])) if (colonnesModele.has(kc)) luesParMesure.add(kc);
// Une colonne directement affichée ET lue par une mesure ne compte qu'une fois, côté « affichée »
// (le plus fort des deux statuts) — sinon la somme des trois populations dépasserait le total.
for (const k of affichee) luesParMesure.delete(k);

const jamaisLue = new Set([...colonnesModele.keys()].filter(k => !affichee.has(k) && !luesParMesure.has(k)));

const doc = {
  format: "forge-data/usage-restitution@1",
  id: `usage_${path.basename(path.resolve(rapportArg))}`,
  modele: { objets_totaux: colonnesModele.size + mesuresModele.size, colonnes: colonnesModele.size, mesures: mesuresModele.size },
  rapport: { source: path.relative(process.cwd(), rapportArg).replace(/\\/g, "/") || rapportArg, fichiers: fichiers.length, references_lues: queryRefsBruts.size },
  populations: {
    affichee: [...affichee].map(k => colonnesModele.get(k)).sort(),
    lue_par_mesure: [...luesParMesure].map(k => colonnesModele.get(k)).sort(),
    jamais_lue: [...jamaisLue].map(k => colonnesModele.get(k)).sort(),
  },
  mesures_affichees: [...mesuresAffichees].map(k => mesuresModele.get(k)).sort(),
  references_non_resolues: nonResolues,
  compte: { affichee: affichee.size, lue_par_mesure: luesParMesure.size, jamais_lue: jamaisLue.size,
            mesures_affichees: mesuresAffichees.size, references_non_resolues: nonResolues.length },
};

let cible = sortieArg;
if (cible) {
  try { fs.mkdirSync(path.dirname(path.resolve(cible)), { recursive: true }); fs.writeFileSync(cible, JSON.stringify(doc, null, 2) + "\n"); }
  catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); }
}
sortir("OK", 0, { compte: doc.compte, fichier_produit: cible || null, document: cible ? undefined : doc });
