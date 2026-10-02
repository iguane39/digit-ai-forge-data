#!/usr/bin/env node
// lire-modele-pbix — verbe (TF-1226, 02/10/2026, option décidée D-51 (a)) : LIT un fichier
// .pbix BINAIRE (archive ZIP Power BI Desktop) et en EXTRAIT le JSON du modèle sémantique porté
// par la partie `DataModelSchema`, encodée en UTF-16 (avec BOM) — jamais en UTF-8. Générateur,
// pas un oracle.
//
// POURQUOI CE VERBE. Le pipeline texte de cette forge (traduire-modele-semantique.mjs) suppose
// un projet déjà EXPORTÉ en texte (TMDL/PBIP) — exactement ce qu'un client ne remet jamais
// spontanément : il remet le .pbix qu'il ouvre dans Power BI Desktop. `DataModelSchema` est la
// partie qui porte le modèle au format TMSL (JSON) pour un classeur enregistré au stockage de
// modèle HÉRITÉ (non-PBIP) — partie documentée par la communauté de rétro-ingénierie du format
// (pbi-tools, pbix-tools), jamais par une connexion au service (loi n° 4) : ce lecteur ouvre le
// FICHIER REMIS, point, et ne contacte jamais un point de terminaison XMLA.
//
// LIMITE ASSUMÉE ET DITE (refus propre, jamais un modèle inventé) : un .pbix enregistré au
// stockage « Power BI Project » (TMDL inline) peut NE PAS porter `DataModelSchema` — dans ce
// cas le lecteur le DIT (ECHEC, exit 2) et renvoie vers traduire-modele-semantique.mjs, qui lit
// alors le dossier TMDL déjà exporté à côté. Ce lecteur ne lit QUE la DÉFINITION du modèle
// (tables, colonnes, mesures, DAX) — jamais une ligne de donnée réelle du classeur : ce n'est
// pas sa partie, et une lecture de donnée mérite son propre mandat.
//
// PREUVE PARTIELLE, DITE AU LIEU D'ÊTRE TUE (TF-1226) : la fixture de preuve en boucle de ce
// verbe est une construction STRUCTURELLEMENT CONFORME au format documenté (ZIP + JSON UTF-16
// dans une partie `DataModelSchema`) — PAS un fichier .pbix remis par un client réel. Aucun
// fichier de ce type n'était disponible dans ce dépôt ni dans les accès de cette session au
// moment de TF-1226. Le jour où un mandat en remet un, il entre dans `fixtures/` et cette note
// se retire.
//
// Usage : node lire-modele-pbix.mjs <fichier.pbix> [--sortie <fichier.json>] [--json-only]
// Codes : 0 modèle extrait ; 1 échec d'écriture disque ; 2 fichier absent / pas une archive ZIP /
// DataModelSchema absente / JSON invalide après décodage — jamais un modèle inventé.
import fs from "node:fs";
import path from "node:path";
import { lireArchiveZip } from "./lib-zip-minimal.mjs";

const VERBE = "lire-modele-pbix";
const DOM = "Extraction du modèle sémantique (DataModelSchema, JSON UTF-16) d'un fichier .pbix binaire (TF-1226)";
const NOM_PARTIE = "DataModelSchema";

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const jsonOnly = args.includes("--json-only");
const source = args.find(a => !a.startsWith("--"));
const sortieArg = opt("--sortie");

const sortir = (sortie, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ verbe: VERBE, domaine: DOM, source: source || null, sortie, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};

if (!source || !fs.existsSync(source) || !fs.statSync(source).isFile())
  sortir("ECHEC", 2, { erreur: `fichier introuvable : ${source}` });

let zip;
try {
  zip = lireArchiveZip(fs.readFileSync(source));
} catch (e) {
  sortir("ECHEC", 2, { erreur: `archive ZIP illisible : ${e.message}` });
}

if (!zip.existe(NOM_PARTIE))
  sortir("ECHEC", 2, { erreur: `partie « ${NOM_PARTIE} » absente de l'archive — ce .pbix est peut-être au format PBIP (projet texte, voir traduire-modele-semantique.mjs) ou ne porte aucun modèle importé` });

const brut = zip.lire(NOM_PARTIE);

// Décodage UTF-16 : la partie porte un BOM dans le cas documenté (FF FE = little-endian, le cas
// écrit par Power BI Desktop ; FE FF = big-endian, jamais observé mais pas supposé absent en
// silence) — jamais lu en UTF-8, c'est exactement ce que TF-1226 reproche aux lecteurs existants.
let texte;
if (brut.length >= 2 && brut[0] === 0xff && brut[1] === 0xfe) {
  texte = brut.subarray(2).toString("utf16le");
} else if (brut.length >= 2 && brut[0] === 0xfe && brut[1] === 0xff) {
  // Big-endian : Node ne porte pas nativement 'utf16be' — on permute les paires d'octets avant
  // de décoder en little-endian.
  const corps = brut.subarray(2);
  const permute = Buffer.alloc(corps.length);
  for (let i = 0; i + 1 < corps.length; i += 2) { permute[i] = corps[i + 1]; permute[i + 1] = corps[i]; }
  texte = permute.toString("utf16le");
} else {
  texte = brut.toString("utf16le"); // sans BOM : Power BI Desktop écrit en little-endian
}

let modele;
try {
  modele = JSON.parse(texte);
} catch (e) {
  sortir("ECHEC", 2, { erreur: `${NOM_PARTIE} décodée mais JSON invalide : ${e.message}` });
}

const tables = modele?.model?.tables || [];
const doc = {
  format: "forge-data/pbix-modele-lu@1",
  source: path.relative(process.cwd(), source).replace(/\\/g, "/") || source,
  modele,
};

let fichierProduit = null;
if (sortieArg) {
  try { fs.writeFileSync(sortieArg, JSON.stringify(doc, null, 2) + "\n"); }
  catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); }
  fichierProduit = sortieArg;
}

sortir("OK", 0, {
  compte: {
    tables: tables.length,
    colonnes: tables.reduce((s, t) => s + (t.columns?.length || 0), 0),
    mesures: tables.reduce((s, t) => s + (t.measures?.length || 0), 0),
  },
  fichier_produit: fichierProduit,
  document: fichierProduit ? undefined : doc,
});
