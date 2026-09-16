#!/usr/bin/env node
// oracle-modeliser — Domaine « Modèle dimensionnel déclaré de la couche Gold : granularité, dimensions
// conformes, clés de substitution, dimension temps, changements lents, matrice en bus »
// (déterministe). TF-0860, lot L3 de l'étude d'opportunité du pilot du 07/09/2026.
//
// Niveau fixé par la barre Kimball Group — Dimensional Modeling Techniques (registre la-barre,
// validée humain le 07/09/2026, décision D-6 a) : la couche Gold EST le modèle dimensionnel
// qui sert la restitution ; forge-audit l'exige en revue (ADR0801 invariante, CTL-D05-10 et
// CTL-D05-13), personne ne le jugeait mécaniquement — STANDARDS-DATA.md portait « Kimball :
// retenu (référence de modélisation) — pas d'oracle » depuis le 11/08. Cet oracle juge la
// FORME DÉCLARÉE du modèle (format `forge-data/modele-dimensionnel@1` ou `@2`), conçu depuis
// les questions des rapports, AVANT sa construction — jamais la donnée qu'il contiendra.
//   M1  format (@1 ou @2) + id ; faits et dimensions non vides ;
//   M2  chaque fait déclare sa GRANULARITÉ en une phrase (≥ 6 mots, « une ligne par … ») et au
//       moins une mesure dont l'agrégation est dans le jeu fermé {somme, moyenne, compte,
//       compte_distinct, min, max, semi_additive, non_additive} ;
//   M3  dimensions CONFORMES : chaque dimension définie UNE fois ; toute dimension référencée
//       par un fait existe ; une dimension jamais référencée est signalée (avertissement) ;
//   M4  chaque dimension porte une clé de substitution ET une clé naturelle, distinctes, un
//       type de changement lent dans {0, 1, 2, 3} et au moins un attribut ;
//   M5  dimension temps : exactement une dimension de rôle « temps », granularité « jour »,
//       bornes ISO debut ≤ fin, déclarée contiguë, référencée par CHAQUE fait ;
//   M6  matrice en bus : présente ; chaque fait nomme un processus de la matrice et ses
//       dimensions sont un sous-ensemble de celles du processus.
//
// TF-1044 (14/09/2026, retour Produit-62 RD-14) — la clé JSON `grain` reste valide (rétro-
// compatibilité, `modele-dimensionnel@1`) mais le glossaire de restitution rend le mot
// « granularité » au destinataire ; `granularite` est désormais un ALIAS accepté partout où
// `grain` l'était (fait comme dimension temps), et devient la clé NOMINALE d'un
// `modele-dimensionnel@2`. Les deux clés présentes avec des valeurs différentes sont un
// avertissement (M2/M5) — `granularite` fait foi, jamais un silence sur la divergence.
// non_juge : véracité de la granularité réelle contre la table construite (une mesure, pas une
// déclaration — voir oracle-reconcilier) ; pertinence métier du type de changement lent choisi ;
// performance et volumétrie ; correspondance colonne à colonne avec le modèle sémantique aval
// (forge-audit).
// Usage : node oracle-modeliser.mjs <modele.json> [--json-only]
import fs from "node:fs";

const DOM = "Modèle dimensionnel déclaré : granularité, dimensions conformes, clés, temps, matrice en bus (M1-M6, niveau Kimball)";
const NON_JUGE = [
  "véracité de la granularité réelle contre la table construite — une mesure (`oracles/oracle-reconcilier.mjs` et `scripts/mesurer_base.py` de ce dépôt), jamais une déclaration",
  "pertinence métier du type de changement lent retenu par dimension (0-3) — arbitrage du concepteur",
  "performance et volumétrie de la couche Gold",
  "correspondance colonne à colonne avec le modèle sémantique aval — profil Power BI de forge-audit",
];
const AGREGATIONS = ["somme", "moyenne", "compte", "compte_distinct", "min", "max", "semi_additive", "non_additive"];
const TYPES_CHANGEMENT = [0, 1, 2, 3];
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-modeliser", domaine: DOM, artefact: file || null,
    verdict, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "M1-M6 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "M1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "M1", "JSON invalide", file); out("FAIL", 1); }

// M1 — @2 est accepté au même titre que @1 (TF-1044) : les deux ne diffèrent que par la clé
// NOMINALE de la granularité (`grain` en @1, `granularite` en @2), jamais par la forme jugée ici.
const FORMATS = ["forge-data/modele-dimensionnel@1", "forge-data/modele-dimensionnel@2"];
if (!FORMATS.includes(d.format)) add("bloquant", "M1", `format « ${d.format} » (attendu ${FORMATS.join(" ou ")})`, file);
if (!d.id) add("bloquant", "M1", "id du modèle non nommé", file);
// TF-1044 — `granularite` est l'alias de `grain` (fait comme dimension temps) : les deux
// clés cohabitent, `granularite` fait foi en cas de désaccord, et le désaccord est dit.
const granulariteDe = (obj, regle, ou) => {
  const g = obj.granularite, legacy = obj.grain;
  if (g !== undefined && legacy !== undefined && String(g).trim() !== String(legacy).trim())
    add("avertissement", regle, `« grain » (${String(legacy).slice(0, 40)}) et « granularite » (${String(g).slice(0, 40)}) déclarés avec des valeurs différentes — granularite (clé nominale de modele-dimensionnel@2) fait foi`, ou);
  return String(g ?? legacy ?? "").trim();
};
const faits = Array.isArray(d.faits) ? d.faits : [];
const dims = Array.isArray(d.dimensions) ? d.dimensions : [];
if (!faits.length) add("bloquant", "M1", "aucun fait déclaré — un modèle dimensionnel sans fait n'est pas un modèle", file);
if (!dims.length) add("bloquant", "M1", "aucune dimension déclarée", file);

// M3 · conformité : une définition par nom
const nomsDims = new Map();
dims.forEach((dim, i) => {
  const nom = String(dim.nom || "").trim();
  const ou = `dimension #${i + 1}${nom ? ` (${nom})` : ""}`;
  if (!nom) { add("bloquant", "M3", "dimension sans nom", ou); return; }
  if (nomsDims.has(nom.toLowerCase())) add("bloquant", "M3", `dimension « ${nom} » définie plus d'une fois — une dimension conforme n'a qu'une définition`, ou);
  nomsDims.set(nom.toLowerCase(), dim);
});
const dimExiste = n => nomsDims.has(String(n || "").toLowerCase());
const referencees = new Set();

// M2 · granularité et mesures de chaque fait (clé `grain`, alias `granularite` — TF-1044)
faits.forEach((f, i) => {
  const ou = `fait #${i + 1}${f.nom ? ` (${f.nom})` : ""}`;
  if (!f.nom) add("bloquant", "M2", "fait sans nom", ou);
  const grain = granulariteDe(f, "M2", ou);
  const mots = grain ? grain.split(/\s+/).length : 0;
  if (!grain) add("bloquant", "M2", "granularité absente — un fait déclare sa granularité en une phrase avant toute mesure (« une ligne par … »), clé `grain` ou `granularite`", ou);
  else if (mots < 6 || !/\bpar\b/i.test(grain)) add("bloquant", "M2", `granularité « ${grain.slice(0, 60)} » trop courte ou sans « par » : la phrase dit une ligne par QUOI (≥ 6 mots)`, ou);
  const mesures = Array.isArray(f.mesures) ? f.mesures : [];
  if (!mesures.length) add("bloquant", "M2", "aucune mesure — un fait sans mesure ne sert aucune question", ou);
  mesures.forEach((m, j) => {
    const oum = `${ou} · mesure #${j + 1}${m.nom ? ` (${m.nom})` : ""}`;
    if (!m.nom) add("bloquant", "M2", "mesure sans nom", oum);
    if (!AGREGATIONS.includes(m.agregation)) add("bloquant", "M2", `agrégation « ${m.agregation} » hors du jeu fermé {${AGREGATIONS.join(", ")}}`, oum);
  });
  const refs = Array.isArray(f.dimensions) ? f.dimensions : [];
  if (!refs.length) add("bloquant", "M3", "fait sans dimension — un fait se lit par ses dimensions", ou);
  refs.forEach(r => {
    if (!dimExiste(r)) add("bloquant", "M3", `dimension « ${r} » référencée par le fait mais jamais définie`, ou);
    else referencees.add(String(r).toLowerCase());
  });
});
for (const [nom] of nomsDims) if (!referencees.has(nom)) add("avertissement", "M3", `dimension « ${nom} » définie mais référencée par aucun fait`, `dimension ${nom}`);

// M4 · clés et changements lents
for (const [nom, dim] of nomsDims) {
  const ou = `dimension ${nom}`;
  if (!dim.cle_substitution) add("bloquant", "M4", "clé de substitution absente", ou);
  if (!dim.cle_naturelle) add("bloquant", "M4", "clé naturelle absente", ou);
  if (dim.cle_substitution && dim.cle_naturelle && String(dim.cle_substitution).toLowerCase() === String(dim.cle_naturelle).toLowerCase())
    add("bloquant", "M4", `clé de substitution « ${dim.cle_substitution} » identique à la clé naturelle — la clé de substitution est distincte par construction`, ou);
  if (!TYPES_CHANGEMENT.includes(dim.type_changement)) add("bloquant", "M4", `type de changement lent « ${dim.type_changement} » hors du jeu fermé {0, 1, 2, 3}`, ou);
  if (!Array.isArray(dim.attributs) || !dim.attributs.length) add("bloquant", "M4", "aucun attribut — une dimension sans attribut ne filtre ni ne regroupe rien", ou);
}

// M5 · dimension temps
const temps = dims.filter(x => String(x.role || "").toLowerCase() === "temps");
if (temps.length !== 1) add("bloquant", "M5", `${temps.length} dimension(s) de rôle « temps » — il en faut exactement une, contiguë à la granularité jour`, file);
else {
  const t = temps[0];
  const ou = `dimension ${t.nom} (temps)`;
  const grainTemps = granulariteDe(t, "M5", ou);
  if (grainTemps.toLowerCase() !== "jour") add("bloquant", "M5", `granularité « ${grainTemps || "(absente)"} » — la dimension temps se déclare à la granularité jour, clé \`grain\` ou \`granularite\``, ou);
  if (!DATE_ISO.test(String(t.debut || "")) || !DATE_ISO.test(String(t.fin || ""))) add("bloquant", "M5", "bornes debut/fin absentes ou hors format AAAA-MM-JJ", ou);
  else if (t.debut > t.fin) add("bloquant", "M5", `bornes inversées (${t.debut} > ${t.fin})`, ou);
  if (t.contigue !== true) add("bloquant", "M5", "dimension temps non déclarée contiguë — une table de dates trouée fausse toute comparaison de périodes", ou);
  faits.forEach((f, i) => {
    const refs = (Array.isArray(f.dimensions) ? f.dimensions : []).map(r => String(r).toLowerCase());
    if (!refs.includes(String(t.nom).toLowerCase())) add("bloquant", "M5", `fait « ${f.nom || `#${i + 1}`} » ne référence pas la dimension temps « ${t.nom} »`, `fait ${f.nom || `#${i + 1}`}`);
  });
}

// M6 · matrice en bus
const bus = Array.isArray(d.matrice_bus) ? d.matrice_bus : [];
if (!bus.length) add("bloquant", "M6", "matrice en bus absente — la matrice (processus métier × dimensions) précède le modèle", file);
else {
  const parProcessus = new Map(bus.map(b => [String(b.processus || "").toLowerCase(), (Array.isArray(b.dimensions) ? b.dimensions : []).map(x => String(x).toLowerCase())]));
  faits.forEach((f, i) => {
    const ou = `fait ${f.nom || `#${i + 1}`}`;
    const proc = String(f.processus || "").toLowerCase();
    if (!proc || !parProcessus.has(proc)) { add("bloquant", "M6", `processus « ${f.processus || "(absent)" } » du fait absent de la matrice en bus`, ou); return; }
    const attendues = parProcessus.get(proc);
    (Array.isArray(f.dimensions) ? f.dimensions : []).forEach(r => {
      if (!attendues.includes(String(r).toLowerCase())) add("bloquant", "M6", `dimension « ${r} » du fait absente de la ligne « ${f.processus} » de la matrice en bus`, ou);
    });
  });
}

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
