#!/usr/bin/env node
// traduire-modele-semantique — verbe (TF-0894, 08/09/2026) : LIT un modèle sémantique Power BI
// au format texte TMDL (projet PBIP) et le TRADUIT en brouillon de
// `forge-data/modele-dimensionnel@1`, le format que `oracles/oracle-modeliser.mjs` juge déjà.
// Générateur, pas un oracle.
//
// POURQUOI CE VERBE. Le modèle sémantique est la Pierre de Rosette d'un mandat de
// reconstruction de rapport (doctrine REX X3) : c'est le seul artefact qui relie les requêtes
// vers la source, les mesures exposées et les champs que les visuels emploient. Aucun verbe de
// cette forge ne le lisait. Coût constaté sur un rapport réel : 25 requêtes T-SQL embarquées,
// 160 mesures, 17 relations, 78 champs de visuels — extraction outillée à la main, puis un
// mapping de 47 lignes dérivé à la main.
//
// FORMAT D'ENTRÉE : le MÊME que `oracles/verifier-modele-semantique.mjs` de forge-audit —
// `--modele <dossier definition/ ou .SemanticModel/>`, fichiers `.tmdl` lus récursivement. Le
// format d'entrée est réemployé DÉLIBÉRÉMENT : un seul artefact à produire côté client, deux
// usages. La frontière tient et ne bouge pas : forge-audit JUGE le modèle sémantique (règles
// MS1-MS6, contrôles AuditCore) et cet oracle n'est pas dupliqué ici ; forge-data le TRADUIT
// vers son propre format, et le jugement du résultat appartient à `oracle-modeliser`.
// Jamais de connexion à un point de terminaison XMLA ni au service (loi n° 4) : le projet PBIP
// est fourni, comme tout artefact de cette forge.
//
// CE QUE TMDL PORTE, ET CE QU'IL NE PORTE PAS. C'est le cœur de la conception de ce verbe.
//   Lu dans les fichiers : les tables et leurs colonnes ; les mesures et leur expression DAX ;
//   les relations (donc, par leur ORIENTATION, quelle table est un fait — côté `fromColumn`,
//   le « plusieurs » — et laquelle est une dimension — côté `toColumn`) ; la clé de
//   substitution de chaque dimension (la colonne visée par la relation) ; la dimension temps
//   (`dataCategory: Time`) ; l'agrégation d'une mesure quand son DAX commence par une fonction
//   d'agrégation reconnue.
//   ABSENT de TMDL, structurellement : le GRAIN d'un fait en une phrase ; la CLÉ NATURELLE
//   d'une dimension ; son TYPE DE CHANGEMENT LENT ; les bornes et la contiguïté de la dimension
//   temps (propriétés de la DONNÉE, pas de la définition — forge-audit le déclare aussi en
//   non_juge) ; la MATRICE EN BUS.
//
// ET CE VERBE NE LES INVENTE PAS. Un brouillon qui remplirait ces champs de valeurs
// vraisemblables PASSERAIT `oracle-modeliser` en mentant — exactement le défaut que TF-0911
// vient de coûter (un livrable jugé PASS trois fois, et incomplet). Les champs non lus restent
// donc ABSENTS, chacun nommé dans `a_completer`, et l'oracle les réclame en clair. Pour les
// fournir, un fichier de complément HUMAIN (`--complement`, format
// `forge-data/complement-modele@1`) : avec lui, et seulement avec lui, le brouillon PASSE
// `oracle-modeliser` sans retouche. La complétion humaine est ainsi MÉCANIQUE, pas un
// paragraphe de documentation qu'on oublie de lire.
// Un complément qui prétend redéfinir un champ LU dans les fichiers est averti et ignoré :
// le modèle livré est la vérité de ce qu'il porte.
//
// Format du complément :
//   { "format": "forge-data/complement-modele@1", "id": "<id du modèle>",
//     "matrice_bus": [ { "processus": …, "dimensions": [ … ] } ],
//     "faits":      { "<table>": { "grain": "une ligne par …", "processus": "…",
//                                  "mesures": { "<mesure>": "<agrégation>" } } },
//     "dimensions": { "<table>": { "cle_naturelle": "…", "type_changement": 0..3,
//                                  "grain": "jour", "debut": "AAAA-MM-JJ", "fin": "AAAA-MM-JJ",
//                                  "contigue": true } } }
//
// MODE --inventaire (TF-0917) : le même dossier TMDL, mais traduit vers le bloc `source.inventaire`
// de `forge-data/couverture@1` — celui que `oracles/oracle-couvrir.mjs` attendait DÉJÀ RELEVÉ. Sans
// ce mode, l'inventaire du modèle se recopiait à la main entre le verbe et l'oracle, et une recopie
// est l'endroit exact où la couverture ment sans que personne le voie : un objet oublié n'est
// orphelin pour personne. Objets typés `table` / `colonne` / `mesure`, `date` et `releve_par` posés.
// Restent absents et NOMMÉS : le `namespace` de l'instance (TMDL ne le porte pas — `--namespace`)
// et le bloc `mapping` (le livrable jugé, produit ailleurs).
//
// Usage : node scripts/traduire-modele-semantique.mjs --modele <dossier> [--complement <f.json>]
//         [--sortie <fichier>] [--sortie-dir <dossier>] [--json-only]
//         node scripts/traduire-modele-semantique.mjs --modele <dossier> --inventaire
//         [--namespace <uri de l'instance>] [--date AAAA-MM-JJ] [--sortie <fichier>]
//         node scripts/traduire-modele-semantique.mjs --modele <dossier> --resolution-references
//         [--sortie <fichier>]   # TF-0972 : résolution NOMMÉE des références DAX
//         node scripts/traduire-modele-semantique.mjs --modele <dossier> --usage-restitution
//         --mise-en-page <fichier> [--orphelins <fichier>] [--sortie <fichier>]
//         # TF-0971 : trois populations (affichee, lue_par_mesure, jamais_lue) + croisement couverture
// Codes : 0 brouillon produit ; 1 échec d'écriture disque ; 2 entrée absente/illisible/
// incohérente (aucune table, aucune relation, orientation indécidable) — jamais un modèle inventé.
import fs from "node:fs";
import path from "node:path";

const VERBE = "traduire-modele-semantique";
const DOM = "Traduction d'un modèle sémantique Power BI (TMDL, projet PBIP) → brouillon forge-data/modele-dimensionnel@1 (TF-0894)";
// Dérivation de l'agrégation depuis la tête de l'expression DAX. DISTINCTCOUNT avant COUNT :
// l'inverse rendrait « compte » sur un décompte distinct, une erreur silencieuse et plausible.
const AGREGATIONS_DAX = [
  { motif: /^\s*DISTINCTCOUNT\s*\(/i, agregation: "compte_distinct" },
  { motif: /^\s*SUMX?\s*\(/i, agregation: "somme" },
  { motif: /^\s*AVERAGEX?\s*\(/i, agregation: "moyenne" },
  { motif: /^\s*COUNT(?:ROWS|A|X)?\s*\(/i, agregation: "compte" },
  { motif: /^\s*MINX?\s*\(/i, agregation: "min" },
  { motif: /^\s*MAXX?\s*\(/i, agregation: "max" },
];

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const jsonOnly = args.includes("--json-only");
const modeleArg = opt("--modele") || args.find(a => !a.startsWith("--"));
const complementArg = opt("--complement");
const sortieArg = opt("--sortie");
const sortieDirArg = opt("--sortie-dir");

const AVERT = [];
const A_COMPLETER = [];
const avert = m => AVERT.push(m);
const aCompleter = m => A_COMPLETER.push(m);
const sortir = (sortie, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ verbe: VERBE, domaine: DOM, source: modeleArg || null, sortie,
    avertissements: AVERT, a_completer: A_COMPLETER, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};

if (!modeleArg || !fs.existsSync(modeleArg) || !fs.statSync(modeleArg).isDirectory())
  sortir("ECHEC", 2, { erreur: `dossier de modèle introuvable : ${modeleArg} — attendu le dossier definition/ ou .SemanticModel/ d'un projet PBIP` });

// ---------- Lecture TMDL ------------------------------------------------------------------
const fichiersTmdl = dir => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiersTmdl(p));
    else if (e.isFile() && /\.tmdl$/i.test(e.name)) out.push(p);
  }
  return out;
};
const niveau = l => { const m = l.match(/^(\t*| *)/)[0]; return m.includes("\t") ? m.length : Math.floor(m.length / 4); };
const nomDe = s => String(s || "").trim().replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1");

const tables = new Map();  // nom -> { colonnes:[{nom,isKey}], mesures:[{nom,dax}], dataCategory }
const relations = [];      // { id, from, to, active }
const fichiers = fichiersTmdl(modeleArg);
if (!fichiers.length) sortir("ECHEC", 2, { erreur: `aucun fichier .tmdl sous ${modeleArg} — un modèle sémantique au format TMDL est attendu, pas un .pbix binaire` });

for (const f of fichiers) {
  const lignes = fs.readFileSync(f, "utf8").split(/\r?\n/);
  let bloc = null, sousBloc = null;
  for (const brut of lignes) {
    if (!brut.trim() || /^\s*\/\//.test(brut)) continue;
    const lvl = niveau(brut);
    const l = brut.trim();
    let m;
    if (lvl === 0) {
      sousBloc = null;
      if ((m = l.match(/^table\s+(.+)$/))) {
        bloc = { type: "table", nom: nomDe(m[1]) };
        if (!tables.has(bloc.nom)) tables.set(bloc.nom, { colonnes: [], mesures: [], dataCategory: null });
      } else if ((m = l.match(/^relationship\s+(.+)$/))) {
        bloc = { type: "relationship" };
        relations.push({ id: nomDe(m[1]), from: null, to: null, active: true });
      } else bloc = { type: "autre" };
      continue;
    }
    if (!bloc) continue;
    if (bloc.type === "table") {
      const t = tables.get(bloc.nom);
      if (lvl === 1) {
        if ((m = l.match(/^measure\s+('[^']+'|"[^"]+"|\S+)\s*=\s*(.*)$/))) { sousBloc = { type: "measure", ref: { nom: nomDe(m[1]), dax: m[2].trim() } }; t.mesures.push(sousBloc.ref); }
        else if ((m = l.match(/^column\s+('[^']+'|"[^"]+"|\S+)/))) { sousBloc = { type: "column", ref: { nom: nomDe(m[1]), isKey: false } }; t.colonnes.push(sousBloc.ref); }
        else if ((m = l.match(/^dataCategory\s*:\s*(\S+)/))) { t.dataCategory = m[1]; sousBloc = null; }
        else sousBloc = null;
      } else if (lvl >= 2 && sousBloc) {
        if (sousBloc.type === "column" && /^isKey\b/.test(l)) sousBloc.ref.isKey = true;
        // Une expression DAX repliée sur les lignes suivantes : on recolle la tête, seule
        // utile ici (l'agrégation se lit à la première fonction, jamais au corps entier).
        if (sousBloc.type === "measure" && !sousBloc.ref.dax) sousBloc.ref.dax = l;
      }
    } else if (bloc.type === "relationship") {
      const r = relations[relations.length - 1];
      if ((m = l.match(/^fromColumn\s*:\s*(.+)$/))) r.from = m[1].trim();
      else if ((m = l.match(/^toColumn\s*:\s*(.+)$/))) r.to = m[1].trim();
      else if ((m = l.match(/^isActive\s*:\s*(\S+)/))) r.active = m[1].toLowerCase() !== "false";
    }
  }
}

if (!tables.size) sortir("ECHEC", 2, { erreur: "aucune table lue dans les fichiers TMDL — le modèle n'existe pas dans le dossier fourni" });

const idModele = path.basename(path.resolve(modeleArg)).replace(/\.SemanticModel$/i, "");

// ---------- Moteur de résolution des références DAX (TF-0972) — CALCULÉ UNE FOIS, consommé par
// --resolution-references (qui le RENDLE) et --usage-restitution (qui s'en sert pour suivre une
// mesure affichée jusqu'à ses colonnes de base). Contrat détaillé au commentaire du premier mode.
const tableParNomBas = new Map();
for (const nom of tables.keys()) tableParNomBas.set(nom.toLowerCase(), nom);
const REF_DAX = /(?:'([^']+)'|([A-Za-z_]\w*))?\[([^\]]+)\]/g;

const resoudreDans = (nomTable, refBas) => {
  const t = tables.get(nomTable);
  if (!t) return null;
  const col = t.colonnes.find(c => c.nom.toLowerCase() === refBas);
  if (col) return { table: nomTable, objet: col.nom, type: "colonne" };
  const mes = t.mesures.find(m => m.nom.toLowerCase() === refBas);
  if (mes) return { table: nomTable, objet: mes.nom, type: "mesure" };
  return null;
};

const resoudreReferenceDax = (tableQualifiee, refBrut, tablePorteuse) => {
  const refBas = refBrut.toLowerCase();
  if (tableQualifiee) {
    const nomReel = tableParNomBas.get(tableQualifiee.toLowerCase());
    if (!nomReel) return { statut: "non_resolue", motif: `table « ${tableQualifiee} » inconnue du modèle` };
    const r = resoudreDans(nomReel, refBas);
    return r ? { statut: "resolue", ...r } : { statut: "non_resolue", motif: `« ${refBrut} » absente de la table « ${nomReel} »` };
  }
  const local = resoudreDans(tablePorteuse, refBas);
  if (local) return { statut: "resolue", ...local };
  const candidats = [...tables.keys()].filter(n => n !== tablePorteuse).map(n => resoudreDans(n, refBas)).filter(Boolean);
  if (candidats.length === 1) return { statut: "resolue", ...candidats[0] };
  if (candidats.length > 1) return { statut: "ambigue", motif: `« ${refBrut} » trouvée dans ${candidats.length} tables : ${candidats.map(c => c.table).join(", ")}`, candidats };
  return { statut: "non_resolue", motif: `« ${refBrut} » absente de la table porteuse « ${tablePorteuse} » et du reste du modèle` };
};

const mesuresParCle = new Map();
for (const [nomTable, t] of tables) for (const m of t.mesures) {
  const refs = [];
  let match;
  const re = new RegExp(REF_DAX.source, "g");
  while ((match = re.exec(m.dax || "")) !== null) {
    const tableQualifiee = match[1] || match[2] || null;
    const refBrut = match[3];
    refs.push({ brut: `${tableQualifiee || ""}[${refBrut}]`, resolution: resoudreReferenceDax(tableQualifiee, refBrut, nomTable) });
  }
  mesuresParCle.set(`${nomTable}[${m.nom}]`, { table: nomTable, nom: m.nom, dax: m.dax || "", references: refs });
}

const colonnesAtteintes = (cle, vus = new Set()) => {
  if (vus.has(cle)) return [];
  vus.add(cle);
  const m = mesuresParCle.get(cle);
  if (!m) return [];
  const out = [];
  for (const r of m.references) {
    if (r.resolution.statut !== "resolue") continue;
    if (r.resolution.type === "colonne") out.push(`${r.resolution.table}.${r.resolution.objet}`);
    else out.push(...colonnesAtteintes(`${r.resolution.table}[${r.resolution.objet}]`, vus));
  }
  return [...new Set(out)];
};

// ---------- Mode --inventaire (TF-0917) : le bloc source.inventaire de forge-data/couverture@1 ----
// `oracle-couvrir` (TF-0911) attend un inventaire DÉJÀ relevé, et ce verbe lit précisément la
// source qui le contient. Entre les deux, il n'y avait qu'une transcription à la main : sur le
// cas réel, 25 requêtes, 160 mesures et 17 relations recopiées dans un mapping de 47 lignes
// AVANT tout jugement. Or une transcription est exactement l'endroit où la couverture peut
// mentir sans que personne le voie — un objet oublié à la recopie n'est orphelin pour personne.
// Ce mode ferme la chaîne TMDL → couverture@1 sans transcription.
//
// Placé AVANT la lecture des relations, et c'est délibéré : un inventaire ÉNUMÈRE ce que la
// source contient, il n'a pas besoin de savoir quelle table est un fait. Un modèle sans
// relation active n'a pas de modèle dimensionnel, mais il a bien un inventaire.
//
// Ce qui reste ABSENT, comme partout dans ce verbe : le `namespace` de l'instance (TMDL ne le
// porte pas — `--namespace` le fournit) et le bloc `mapping` (le livrable JUGÉ, produit par
// ailleurs). Les poser au jugé ferait PASSER CV1/CV2 en mentant.
if (args.includes("--inventaire") || args.includes("--couverture")) {
  const inventaire = [];
  for (const [nomTable, t] of tables) {
    inventaire.push({ objet: nomTable, type: "table" });
    for (const c of t.colonnes) inventaire.push({ objet: `${nomTable}.${c.nom}`, type: "colonne" });
    for (const me of t.mesures) inventaire.push({ objet: `${nomTable}[${me.nom}]`, type: "mesure" });
  }
  const dateReleve = opt("--date") || new Date().toISOString().slice(0, 10);
  const source = { nom: idModele, date: dateReleve,
    releve_par: `${VERBE} --inventaire (lecture TMDL du projet PBIP fourni, ${fichiers.length} fichier(s)) — aucune transcription humaine` };
  const ns = opt("--namespace");
  if (ns) source.namespace = ns;
  else aCompleter("source.namespace absent — TMDL ne porte pas l'INSTANCE qui a servi (T7 : deux modèles homonymes sur deux espaces de travail sont la règle) ; à fournir par --namespace (CV2)");
  source.inventaire = inventaire;
  aCompleter("bloc « mapping » absent — c'est le livrable dont la couverture se mesure, produit hors de ce verbe ; à ajouter avant de juger (CV1)");
  const doc = {
    format: "forge-data/couverture@1",
    id: `couverture_${idModele}_${dateReleve}`,
    source,
    origine: { verbe: VERBE, mode: "inventaire",
      source: path.relative(process.cwd(), modeleArg).replace(/\\/g, "/") || modeleArg,
      fichiers_tmdl: fichiers.length, statut: "brouillon" },
  };
  let cible = sortieArg;
  if (!cible) {
    const outDir = sortieDirArg || path.dirname(path.resolve(modeleArg));
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) { sortir("ECHEC", 1, { erreur: `dossier de sortie impossible à créer : ${e.message}` }); }
    cible = path.join(outDir, `${idModele}.couverture.json`);
  }
  try { fs.writeFileSync(cible, JSON.stringify(doc, null, 2) + "\n"); }
  catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); }
  sortir("OK", 0, {
    compte: { tables_lues: tables.size, objets: inventaire.length,
              par_type: { table: tables.size,
                          colonne: inventaire.filter(o => o.type === "colonne").length,
                          mesure: inventaire.filter(o => o.type === "mesure").length } },
    statut: "brouillon",
    fichier_produit: cible,
  });
}

// ---------- Mode --resolution-references (TF-0972) : résolution NOMMÉE des références DAX -------
// Mesure sur les 160 mesures DAX d'un modèle réel (Produit-62, RD-10, ledger seq 63-65) :
// (1) LA CASSE — DAX est insensible à la casse ; une comparaison sensible perd la référence
//     (« Indexation Indice » ne lisait plus aucune colonne d'indice) ;
// (2) LES RÉFÉRENCES NON QUALIFIÉES — [Ref] cherchée SEULEMENT dans la table porteuse s'arrête
//     trop tôt quand la mesure visée vit dans une AUTRE table (« EFFORT RATE (AR) » ne
//     remontait que 2 colonnes sur 8 attendues).
// Effet cumulé avant correction : 42 colonnes lues au lieu de 45, 279 colonnes déclarées
// inutilisées au lieu de 276 — un SOUS-COMPTAGE SILENCIEUX, sans une seule erreur affichée.
//
// LE CONTRAT (celui que ce mode expose, et qu'aucun outil de la forge ne prononçait) :
//   - index insensible à la casse sur les noms de table, de colonne et de mesure ;
//   - une référence QUALIFIÉE (`Table[Ref]` ou `'Table Name'[Ref]`) se résout dans CETTE
//     table (colonne, puis mesure) ; table inconnue ou référence absente → NON RÉSOLUE ;
//   - une référence NON QUALIFIÉE (`[Ref]`) se cherche D'ABORD dans la table PORTEUSE de la
//     mesure (colonne, puis mesure), PUIS dans le reste du modèle si elle n'y est pas ;
//     trouvée dans plusieurs autres tables → AMBIGUË (candidats nommés) ; nulle part →
//     NON RÉSOLUE ;
//   - FERMETURE TRANSITIVE : une référence résolue vers une MESURE fait suivre la résolution
//     dans les références DE CETTE MESURE, jusqu'à n'obtenir que des colonnes — sans elle,
//     une mesure qui n'appelle que d'autres mesures seurait comptée comme n'atteignant AUCUNE
//     colonne (protection anti-cycle : une mesure déjà visitée ne se revisite pas) ;
//   - un JOURNAL des références non résolues et ambiguës est rendu AVEC le résultat, jamais
//     à part — c'est ce zéro (ou ce compte) qui rend le relevé opposable.
// Limite déclarée (non_juge) : seule la PREMIÈRE ligne de l'expression DAX d'une mesure est
// lue (comme pour l'agrégation dérivée, cf. en-tête de ce verbe) — une expression repliée sur
// plusieurs lignes n'est pas résolue au-delà de sa première ligne.
if (args.includes("--resolution-references")) {
  const mesures = [];
  const nonResolues = [], ambigues = [];
  let totalRefs = 0, totalResolues = 0;
  for (const [cle, m] of mesuresParCle) {
    totalRefs += m.references.length;
    for (const r of m.references) {
      if (r.resolution.statut === "resolue") totalResolues++;
      else if (r.resolution.statut === "ambigue") ambigues.push({ mesure: cle, reference: r.brut, motif: r.resolution.motif });
      else nonResolues.push({ mesure: cle, reference: r.brut, motif: r.resolution.motif });
    }
    mesures.push({ mesure: cle, dax: m.dax, references: m.references.map(r => ({ reference: r.brut, resolution: r.resolution })), colonnes_atteintes: colonnesAtteintes(cle) });
  }
  const taux = totalRefs ? Math.round((totalResolues / totalRefs) * 1000) / 10 : 100;
  const doc = {
    format: "forge-data/resolution-references@1",
    id: `resolution_${idModele}`,
    modele: idModele,
    mesures,
    journal: { non_resolues: nonResolues, ambigues },
    compte: { references: totalRefs, resolues: totalResolues, non_resolues: nonResolues.length, ambigues: ambigues.length, taux_resolution: taux },
  };
  let cible = sortieArg;
  if (cible) { try { fs.writeFileSync(cible, JSON.stringify(doc, null, 2) + "\n"); } catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); } }
  sortir("OK", 0, { compte: doc.compte, fichier_produit: cible || null, document: cible ? undefined : doc });
}

// ---------- Mode --usage-restitution (TF-0971) : trois populations, jamais une seule mesure --
// FAIT MESURÉ (Produit-62, RD-9, ledger seq 63-65) : `oracle-couvrir` compare un mapping à
// L'INVENTAIRE DE SA SOURCE (342 colonnes du modèle) — jamais à ce qui est réellement À
// L'ÉCRAN. Relevé manuel : 66 colonnes seulement mobilisées par 83 champs de 16 visuels
// porteurs de données (21 projetées telles quelles, 45 lues par 54 mesures DAX affichées),
// 276 jamais lues, 10 tables sur 27 entièrement inutilisées. Conséquence directe sur la
// priorité : des 38 colonnes sans ligne de mapping, 20 sont réellement mobilisées et 18 ne le
// sont pas — la dette bloquante mesurée est deux fois plus petite que celle que la couverture
// seule annonce, et sans ce croisement rien ne peut le dire.
//
// LECTEUR DE MISE EN PAGE, à côté du lecteur de modèle : entrée `--mise-en-page <fichier>`,
// format `forge-data/mise-en-page@1` — { rapport, pages: [ { page, visuels: [ { visuel,
// porte_donnees?, projections: [ { champ } ] } ] } ] }, `champ` dans la MÊME nomenclature que
// `--inventaire` (`Table.colonne` pour une projection directe, `Table[Mesure]` pour une mesure
// affichée). Un visuel décoratif (image, forme, texte libre) se déclare `porte_donnees: false`
// et ne projette rien — jamais deviné à la forme du nom.
//
// TROIS POPULATIONS, JAMAIS UNE SEULE : `affichee` (colonne projetée telle quelle par un
// visuel), `lue_par_mesure` (colonne atteinte par FERMETURE TRANSITIVE depuis une mesure
// affichée — le moteur de résolution de TF-0972, réemployé, jamais réécrit), `jamais_lue` (ni
// l'une ni l'autre). Un champ projeté qui ne résout à AUCUNE colonne ni mesure du modèle est
// un `champ_inconnu`, averti, jamais silencieusement ignoré.
//
// CROISEMENT AVEC LA COUVERTURE (optionnel, `--orphelins <fichier.json>`, `{ orphelins:
// ["Table.colonne", …] }` — la liste que rend `oracle-couvrir.mjs` sur ses colonnes sans ligne
// de mapping) : RÈGLE OPPOSABLE, une couverture de reconstruction se mesure D'ABORD sur les
// colonnes MOBILISÉES (`affichee` ∪ `lue_par_mesure`) — un orphelin `jamais_lue` se déclare en
// EXCLUSION MOTIVÉE (`oracle-couvrir`, règle `exclusion`) au lieu de gonfler la dette.
if (args.includes("--usage-restitution")) {
  const miseEnPageArg = opt("--mise-en-page");
  if (!miseEnPageArg || !fs.existsSync(miseEnPageArg))
    sortir("ECHEC", 2, { erreur: `mise en page introuvable : ${miseEnPageArg} — --mise-en-page <fichier.json> est requis` });
  let mep;
  try { mep = JSON.parse(fs.readFileSync(miseEnPageArg, "utf8")); }
  catch (e) { sortir("ECHEC", 2, { erreur: `mise en page illisible (JSON attendu) : ${e.message}` }); }
  if (mep.format !== "forge-data/mise-en-page@1")
    sortir("ECHEC", 2, { erreur: `mise en page au format « ${mep.format} » (attendu forge-data/mise-en-page@1)` });

  const toutesColonnes = new Set();
  for (const [nomTable, t] of tables) for (const c of t.colonnes) toutesColonnes.add(`${nomTable}.${c.nom}`);

  const affichee = new Set();
  const lueParMesure = new Set();
  const champsInconnus = [];
  for (const page of (Array.isArray(mep.pages) ? mep.pages : [])) {
    for (const v of (Array.isArray(page.visuels) ? page.visuels : [])) {
      if (v.porte_donnees === false) continue; // un visuel décoratif ne projette rien — déclaré, jamais deviné
      for (const p of (Array.isArray(v.projections) ? v.projections : [])) {
        const champ = String(p?.champ || "");
        const mMesure = champ.match(/^(.+)\[(.+)\]$/);
        if (mMesure) {
          const [, nomTable, nomMesure] = mMesure;
          const t = tables.get(nomTable);
          const mesure = t && t.mesures.find(m => m.nom.toLowerCase() === nomMesure.toLowerCase());
          if (!mesure) { champsInconnus.push({ page: page.page, visuel: v.visuel, champ }); continue; }
          for (const c of colonnesAtteintes(`${nomTable}[${mesure.nom}]`)) lueParMesure.add(c);
        } else if (toutesColonnes.has(champ)) {
          affichee.add(champ);
        } else {
          champsInconnus.push({ page: page.page, visuel: v.visuel, champ });
        }
      }
    }
  }
  const jamaisLue = [...toutesColonnes].filter(c => !affichee.has(c) && !lueParMesure.has(c));
  const tablesJamaisLues = [...tables.keys()].filter(nomTable => {
    const colsTable = [...toutesColonnes].filter(c => c.startsWith(`${nomTable}.`));
    return colsTable.length > 0 && colsTable.every(c => jamaisLue.includes(c));
  });

  let croisementCouverture = null;
  const orphelinsArg = opt("--orphelins");
  if (orphelinsArg) {
    if (!fs.existsSync(orphelinsArg)) sortir("ECHEC", 2, { erreur: `fichier d'orphelins introuvable : ${orphelinsArg}` });
    let orph;
    try { orph = JSON.parse(fs.readFileSync(orphelinsArg, "utf8")); }
    catch (e) { sortir("ECHEC", 2, { erreur: `fichier d'orphelins illisible (JSON attendu) : ${e.message}` }); }
    const listeOrphelins = Array.isArray(orph?.orphelins) ? orph.orphelins : [];
    const mobilises = listeOrphelins.filter(o => affichee.has(o) || lueParMesure.has(o));
    const nonMobilises = listeOrphelins.filter(o => !affichee.has(o) && !lueParMesure.has(o));
    croisementCouverture = {
      source: path.relative(process.cwd(), orphelinsArg).replace(/\\/g, "/") || orphelinsArg,
      orphelins_declares: listeOrphelins.length,
      orphelins_mobilises: mobilises.length,
      orphelins_non_mobilises: nonMobilises.length,
      detail: { mobilises, non_mobilises: nonMobilises },
    };
  }

  const doc = {
    format: "forge-data/usage-restitution@1",
    id: `usage_${idModele}`,
    modele: idModele,
    rapport: mep.rapport || null,
    populations: { affichee: [...affichee], lue_par_mesure: [...lueParMesure], jamais_lue: jamaisLue },
    champs_inconnus: champsInconnus,
    croisement_couverture: croisementCouverture,
    compte: {
      colonnes_modele: toutesColonnes.size, affichee: affichee.size, lue_par_mesure: lueParMesure.size,
      jamais_lue: jamaisLue.length, tables_jamais_lues: tablesJamaisLues,
    },
  };
  let cible = sortieArg;
  if (cible) { try { fs.writeFileSync(cible, JSON.stringify(doc, null, 2) + "\n"); } catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); } }
  sortir("OK", 0, { compte: doc.compte, champs_inconnus: champsInconnus, fichier_produit: cible || null, document: cible ? undefined : doc });
}

const refDe = ref => { const m = String(ref || "").match(/^('([^']+)'|[^.]+)\.(.+)$/); return m ? { table: nomDe(m[1]), colonne: nomDe(m[3]) } : null; };
const actives = relations.filter(r => r.active && r.from && r.to).map(r => ({ id: r.id, from: refDe(r.from), to: refDe(r.to) })).filter(r => r.from && r.to);
if (!actives.length)
  sortir("ECHEC", 2, { erreur: "aucune relation active exploitable — sans relation, rien ne dit quelle table est un FAIT et laquelle une DIMENSION : l'orientation ne se devine pas, et un modèle dimensionnel deviné serait faux sans être détectable" });

// ---------- Faits, dimensions : l'orientation des relations, jamais une heuristique de nom ----
const nomsFaits = new Set(actives.map(r => r.from.table));
const nomsDims = new Map();  // table -> clé de substitution (colonne visée par la relation)
for (const r of actives) if (!nomsDims.has(r.to.table)) nomsDims.set(r.to.table, r.to.colonne);
for (const n of nomsDims.keys()) if (nomsFaits.has(n))
  avert(`table « ${n} » à la fois côté fait et côté dimension (flocon, ou table de pont) — traduite en FAIT ; sa lecture en dimension est à trancher humainement`);
for (const n of nomsDims.keys()) if (nomsFaits.has(n)) nomsDims.delete(n);
for (const n of tables.keys()) if (!nomsFaits.has(n) && !nomsDims.has(n))
  avert(`table « ${n} » reliée à rien dans le modèle — ni fait ni dimension, ÉCARTÉE du brouillon (une table isolée n'appartient à aucune étoile)`);
if (!nomsFaits.size || !nomsDims.size)
  sortir("ECHEC", 2, { erreur: `orientation indécidable : ${nomsFaits.size} fait(s) et ${nomsDims.size} dimension(s) déduits des relations — un modèle dimensionnel exige au moins un de chaque` });

// ---------- Complément humain (ce que TMDL ne porte pas) -------------------------------------
let comp = { faits: {}, dimensions: {} };
if (complementArg) {
  if (!fs.existsSync(complementArg)) sortir("ECHEC", 2, { erreur: `complément introuvable : ${complementArg}` });
  try { comp = JSON.parse(fs.readFileSync(complementArg, "utf8")); }
  catch (e) { sortir("ECHEC", 2, { erreur: `complément illisible (JSON attendu) : ${e.message}` }); }
  if (comp.format !== "forge-data/complement-modele@1")
    sortir("ECHEC", 2, { erreur: `complément au format « ${comp.format} » (attendu forge-data/complement-modele@1)` });
  comp.faits = comp.faits || {};
  comp.dimensions = comp.dimensions || {};
  for (const n of Object.keys(comp.faits)) if (!nomsFaits.has(n)) avert(`complément : fait « ${n} » inconnu du modèle lu — ignoré`);
  for (const n of Object.keys(comp.dimensions)) if (!nomsDims.has(n)) avert(`complément : dimension « ${n} » inconnue du modèle lu — ignorée`);
}
// Un champ LU dans les fichiers prime toujours sur le complément : le modèle livré est la
// vérité de ce qu'il porte, et un complément qui le contredit est une dérive, pas une correction.
const completer = (lu, source, cle, ou) => {
  const c = source ? source[cle] : undefined;
  if (lu !== undefined && lu !== null && lu !== "") {
    if (c !== undefined && String(c) !== String(lu)) avert(`complément : « ${cle} » de ${ou} prétend redéfinir une valeur LUE dans le modèle (« ${c} » contre « ${lu} ») — ignoré, le modèle livré fait foi`);
    return lu;
  }
  return c;
};

// ---------- Construction du brouillon ---------------------------------------------------------
const faits = [];
for (const nom of nomsFaits) {
  const t = tables.get(nom) || { mesures: [] };
  const cf = comp.faits[nom] || {};
  const dimsDuFait = [...new Set(actives.filter(r => r.from.table === nom).map(r => r.to.table))].filter(d => nomsDims.has(d));
  const mesures = t.mesures.map(me => {
    const trouvee = AGREGATIONS_DAX.find(a => a.motif.test(me.dax || ""));
    const agregation = trouvee ? trouvee.agregation : ((cf.mesures || {})[me.nom]);
    if (!trouvee) {
      if (agregation) avert(`mesure « ${nom}[${me.nom}] » : agrégation non déductible du DAX (« ${(me.dax || "").slice(0, 40)} ») — reprise du complément : ${agregation}`);
      else aCompleter(`fait « ${nom} » · mesure « ${me.nom} » : agrégation non déductible du DAX (« ${(me.dax || "").slice(0, 40)} ») — à déclarer au complément`);
    }
    return agregation ? { nom: me.nom, agregation } : { nom: me.nom };
  });
  if (!t.mesures.length) aCompleter(`fait « ${nom} » : aucune mesure définie sur cette table dans le modèle — un fait sans mesure ne sert aucune question (M2)`);
  const fait = { nom, dimensions: dimsDuFait, mesures };
  const grain = cf.grain;
  if (grain) fait.grain = grain; else aCompleter(`fait « ${nom} » : GRAIN absent — TMDL ne porte pas la phrase de grain (« une ligne par … ») ; à déclarer au complément (M2)`);
  const processus = cf.processus;
  if (processus) fait.processus = processus; else aCompleter(`fait « ${nom} » : PROCESSUS métier absent — il n'existe pas dans TMDL ; à déclarer au complément avec la ligne correspondante de la matrice en bus (M6)`);
  faits.push(fait);
}

const dimensions = [];
for (const [nom, cleSub] of nomsDims) {
  const t = tables.get(nom) || { colonnes: [], dataCategory: null };
  const cd = comp.dimensions[nom] || {};
  // La clé de substitution est LUE (colonne visée par la relation) : un complément qui prétend
  // la redéfinir est averti et ignoré — le modèle livré fait foi sur ce qu'il porte.
  const dim = { nom, cle_substitution: completer(cleSub, cd, "cle_substitution", `dimension « ${nom} »`) };
  const estTemps = /^time$/i.test(String(t.dataCategory || ""));
  if (estTemps) dim.role = "temps";
  const attributs = t.colonnes.map(c => c.nom).filter(c => c.toLowerCase() !== String(cleSub).toLowerCase());
  if (attributs.length) dim.attributs = attributs;
  else aCompleter(`dimension « ${nom} » : aucun attribut hors clé de substitution (M4)`);
  if (cd.cle_naturelle) dim.cle_naturelle = cd.cle_naturelle;
  else aCompleter(`dimension « ${nom} » : CLÉ NATURELLE absente — TMDL ne distingue pas la clé de substitution de la clé métier ; à déclarer au complément (M4)`);
  if ([0, 1, 2, 3].includes(cd.type_changement)) dim.type_changement = cd.type_changement;
  else aCompleter(`dimension « ${nom} » : TYPE DE CHANGEMENT LENT absent — il n'existe pas dans TMDL ; à déclarer au complément, jeu {0, 1, 2, 3} (M4)`);
  if (estTemps) {
    // Le grain, les bornes et la CONTIGUÏTÉ d'une dimension temps sont des propriétés de la
    // DONNÉE, pas de la définition — forge-audit le déclare aussi en non_juge. Les lire dans un
    // fichier TMDL serait les inventer.
    for (const [cle, regle] of [["grain", "M5"], ["debut", "M5"], ["fin", "M5"], ["contigue", "M5"]]) {
      const v = completer(undefined, cd, cle, `dimension « ${nom} »`);
      if (v !== undefined) dim[cle] = v;
      else aCompleter(`dimension temps « ${nom} » : « ${cle} » absent — grain, bornes et contiguïté se mesurent sur la DONNÉE, jamais dans la définition TMDL ; à déclarer au complément (${regle})`);
    }
  }
  dimensions.push(dim);
}

const idLu = idModele;
const brouillon = {
  format: "forge-data/modele-dimensionnel@1",
  id: comp.id || idLu,
  dimensions,
  faits,
  origine: { verbe: VERBE, source: path.relative(process.cwd(), modeleArg).replace(/\\/g, "/") || modeleArg,
             fichiers_tmdl: fichiers.length, complement: complementArg || null, statut: A_COMPLETER.length ? "brouillon" : "complete" },
};
if (Array.isArray(comp.matrice_bus) && comp.matrice_bus.length) brouillon.matrice_bus = comp.matrice_bus;
else aCompleter("MATRICE EN BUS absente — elle PRÉCÈDE le modèle (processus métier × dimensions) et ne se relit pas dans le modèle construit : la dériver du TMDL satisferait M6 sans rien vouloir dire. À déclarer au complément (M6)");

let outPath = sortieArg;
if (!outPath) {
  const outDir = sortieDirArg || path.dirname(path.resolve(modeleArg));
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) { sortir("ECHEC", 1, { erreur: `dossier de sortie impossible à créer : ${e.message}` }); }
  outPath = path.join(outDir, `${idLu}.modele-dimensionnel.json`);
}
try { fs.writeFileSync(outPath, JSON.stringify(brouillon, null, 2) + "\n"); }
catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); }

sortir("OK", 0, {
  compte: { tables_lues: tables.size, relations_actives: actives.length, faits: faits.length,
            dimensions: dimensions.length, mesures: faits.reduce((s, f) => s + f.mesures.length, 0) },
  statut: brouillon.origine.statut,
  fichier_produit: outPath,
});
