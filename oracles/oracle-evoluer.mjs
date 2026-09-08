#!/usr/bin/env node
// oracle-evoluer — Domaine « Projection des évolutions d'une couche : complétude ligne à ligne
// et provenance de chaque colonne » (déterministe). TF-0937, retour du 08/09/2026.
//
// LE FAIT MESURÉ. `forge-data/lineage@1` déclare les entrées, les transformations et les sorties
// PROPOSÉES d'un artefact servi. Il ne dit pas, colonne par colonne, ce qui change dans chaque
// couche ni d'où ça vient. Or c'est la PREMIÈRE question d'une équipe data devant une reprise, et
// elle s'est reconstituée à la main : 397 lignes de provenance (119 en Silver, 278 en Gold)
// relevées depuis les DDL, le mapping et le catalogue, sans qu'aucun oracle puisse dire si la
// reconstitution était complète.
//
// CE QUE CET ORACLE JUGE, ET CE QU'IL NE JUGE PAS. Il juge la FORME et la COMPLÉTUDE INTERNE de
// la projection : chaque ligne porte les cinq champs du chapitre attendu (table, colonne, type,
// évolution, provenance), chaque table annoncée est projetée jusqu'à ses colonnes, et les comptes
// affichés sont ceux qu'on recalcule. Il ne juge PAS que la projection couvre tout le DDL réel :
// cette question-là est celle de `oracles/oracle-couvrir.mjs`, qui exige une SECONDE source
// (l'inventaire) — la confondre avec celle-ci rendrait les deux fausses.
//
//   EV1  format `forge-data/evolutions@1`, `id`, `couche` nommée, `date` ISO, `lignes` non vide ;
//   EV2  chaque ligne porte `table`, `colonne`, `type`, `evolution` du jeu fermé, et une
//        `provenance` typée du jeu fermé ; aucun couple table+colonne n'est projeté deux fois
//        (un doublon gonfle les comptes et la projection ment) ;
//   EV3  COMPLÉTUDE INTERNE : toute table déclarée au bloc `tables` a au moins une ligne, et
//        toute table citée par une ligne est déclarée au bloc `tables`. Une table annoncée sans
//        colonne projetée est le trou exact que la reconstitution à la main laissait ;
//   EV4  toute provenance `indeterminee` porte un motif d'au moins 4 mots — une provenance vide
//        est un trou, une provenance vraisemblable posée au jugé est pire : elle fait passer la
//        projection pour complète. Constatée en AVERTISSEMENT et comptée : l'indétermination
//        motivée est un état légitime d'une reprise, l'ignorer ne l'est pas ;
//   EV5  les COMPTES affichés (`comptes.colonnes`, `comptes.par_evolution`,
//        `comptes.provenance_indeterminee`) sont RECALCULÉS et confrontés — un compte recopié
//        d'une synthèse précédente est ce qui a laissé passer trois PASS (TF-0911).
//
// non_juge : la JUSTESSE de chaque provenance (l'oracle vérifie qu'elle est typée et motivée,
// jamais qu'elle est vraie) ; l'EXHAUSTIVITÉ de la projection contre le DDL réel — c'est
// `oracles/oracle-couvrir.mjs` de ce dépôt, sur une seconde source ; la forme du lineage pointé
// (`oracles/oracle-tracer.mjs` de ce dépôt).
// Usage : node oracle-evoluer.mjs <evolutions.json> [--json-only]
import fs from "node:fs";

const DOM = "Projection des évolutions d'une couche : complétude ligne à ligne, provenance typée, comptes recalculés (EV1-EV5)";
const NON_JUGE = [
  "la JUSTESSE d'une provenance — cet oracle vérifie qu'elle est TYPÉE et, si elle est indéterminée, MOTIVÉE ; il ne sait pas si « couche_existante » dit vrai",
  "l'EXHAUSTIVITÉ de la projection contre le DDL réel de la couche : une colonne que le DDL fourni ne portait pas n'est manquante pour personne ici. Cette question exige une SECONDE source et appartient à `oracles/oracle-couvrir.mjs` de ce dépôt",
  "la forme de la déclaration de lineage citée en origine — `oracles/oracle-tracer.mjs` de ce dépôt",
  "la pertinence métier d'une évolution retenue (créée plutôt que déplacée, par exemple) : l'oracle exige un type du jeu fermé, il ne l'arbitre pas",
];
const EVOLUTIONS = ["table_creee", "table_completee", "table_deplacee", "colonne_ajoutee", "colonne_corrigee", "inchangee"];
const PROVENANCES = ["mapping", "couche_existante", "cle_substitution", "technique", "commentaire_ddl", "indeterminee"];
const DATE_ISO = /^\d{4}-\d{2}-\d{2}/;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
let projection = null;
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-evoluer", domaine: DOM, artefact: file || null,
    verdict, projection, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "EV1-EV5 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "EV1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "EV1", "JSON invalide", file); out("FAIL", 1); }

// ---- EV1 · squelette -------------------------------------------------------------------------
if (d.format !== "forge-data/evolutions@1") add("bloquant", "EV1", `format « ${d.format} » (attendu forge-data/evolutions@1)`, file);
if (!d.id) add("bloquant", "EV1", "id de la projection non nommé", file);
if (!d.couche) add("bloquant", "EV1", "couche absente — une projection d'évolutions se rattache à UNE couche nommée (silver, gold, …) ; sans elle, deux projections se confondent", file);
if (!DATE_ISO.test(String(d.date || ""))) add("bloquant", "EV1", "date absente ou hors format ISO — une projection est datée ou elle est périmée sans qu'on le sache", file);
const lignes = Array.isArray(d.lignes) ? d.lignes : [];
if (!lignes.length) add("bloquant", "EV1", "aucune ligne projetée — une projection vide se lirait « aucune évolution », ce qui est le contraire de « rien n'a été relevé »", file);

// ---- EV2 · chaque ligne porte les cinq champs du chapitre, et une seule fois ------------------
const vues = new Map();
const retenues = [];
lignes.forEach((l, i) => {
  const ou = `lignes #${i + 1}`;
  const table = l && typeof l.table === "string" ? l.table.trim() : "";
  const colonne = l && typeof l.colonne === "string" ? l.colonne.trim() : "";
  if (!table) { add("bloquant", "EV2", "ligne sans table", ou); return; }
  if (!colonne) { add("bloquant", "EV2", `ligne de « ${table} » sans colonne — la projection se lit colonne par colonne, c'est sa raison d'être`, ou); return; }
  if (!l.type) add("bloquant", "EV2", `« ${table}.${colonne} » sans type — un changement de type est précisément ce qu'une équipe data cherche`, ou);
  if (!EVOLUTIONS.includes(l.evolution)) add("bloquant", "EV2", `« ${table}.${colonne} » : évolution « ${l.evolution} » hors du jeu fermé {${EVOLUTIONS.join(", ")}}`, ou);
  const p = l.provenance && typeof l.provenance === "object" ? l.provenance : null;
  if (!p) add("bloquant", "EV2", `« ${table}.${colonne} » sans provenance — d'où ça vient est la moitié de la question posée`, ou);
  else if (!PROVENANCES.includes(p.type)) add("bloquant", "EV2", `« ${table}.${colonne} » : provenance de type « ${p.type} » hors du jeu fermé {${PROVENANCES.join(", ")}}`, ou);
  const cle = `${table.toLowerCase()}.${colonne.toLowerCase()}`;
  if (vues.has(cle)) { add("bloquant", "EV2", `« ${table}.${colonne} » projetée plus d'une fois — un doublon gonfle les comptes et la projection ment`, ou); return; }
  vues.set(cle, true);
  retenues.push({ table, colonne, evolution: l.evolution, provenance: p, ou });
});

// ---- EV3 · complétude interne : tables annoncées ↔ tables projetées ---------------------------
const tablesDeclarees = Array.isArray(d.tables) ? d.tables : [];
if (!tablesDeclarees.length) add("bloquant", "EV3", "bloc « tables » absent — sans lui, une table entièrement oubliée à la projection ne manque à personne", file);
const nomsDeclares = new Set(tablesDeclarees.map(t => String(t && t.table || "").toLowerCase()).filter(Boolean));
const nomsProjetes = new Set(retenues.map(l => l.table.toLowerCase()));
for (const t of tablesDeclarees) {
  const nom = String(t && t.table || "").trim();
  if (!nom) { add("bloquant", "EV3", "table déclarée sans nom", "tables"); continue; }
  if (!nomsProjetes.has(nom.toLowerCase()))
    add("bloquant", "EV3", `table « ${nom} » annoncée mais AUCUNE de ses colonnes n'est projetée — c'est le trou exact que la reconstitution à la main laissait`, "tables");
}
for (const nom of nomsProjetes) if (!nomsDeclares.has(nom))
  add("bloquant", "EV3", `des lignes citent « ${nom} », absente du bloc « tables » — soit la projection déborde de son périmètre, soit le périmètre est faux`, "lignes");

// ---- EV4 · une provenance indéterminée se MOTIVE ----------------------------------------------
const indeterminees = retenues.filter(l => l.provenance && l.provenance.type === "indeterminee");
for (const l of indeterminees) {
  const motif = typeof l.provenance.motif === "string" ? l.provenance.motif.trim() : "";
  if (motif.split(/\s+/).filter(Boolean).length < 4)
    add("bloquant", "EV4", `« ${l.table}.${l.colonne} » : provenance indéterminée SANS motif écrit (au moins 4 mots) — un trou non motivé se lit comme une décision`, l.ou);
}
if (indeterminees.length)
  add("avertissement", "EV4",
    `${indeterminees.length} provenance(s) INDÉTERMINÉE(S) sur ${retenues.length} ligne(s) — état légitime d'une reprise tant qu'il est motivé et compté, ` +
    `jamais tant qu'il est comblé par une provenance vraisemblable : ${indeterminees.slice(0, 8).map(l => `« ${l.table}.${l.colonne} »`).join(" · ")}${indeterminees.length > 8 ? ` (+${indeterminees.length - 8} autres)` : ""}`,
    "lignes");

// ---- EV5 · les comptes se RECALCULENT, ils ne se recopient pas --------------------------------
const parEvolution = retenues.reduce((acc, l) => { acc[l.evolution] = (acc[l.evolution] || 0) + 1; return acc; }, {});
projection = { tables: tablesDeclarees.length, colonnes: retenues.length, par_evolution: parEvolution,
               provenance_indeterminee: indeterminees.length };
const c = d.comptes && typeof d.comptes === "object" ? d.comptes : null;
if (c) {
  if (c.colonnes !== undefined && Number(c.colonnes) !== retenues.length)
    add("bloquant", "EV5", `comptes.colonnes annonce ${c.colonnes}, recalculé ${retenues.length} — un compte recopié d'une synthèse précédente est ce qui a laissé passer trois PASS`, file);
  if (c.tables !== undefined && Number(c.tables) !== tablesDeclarees.length)
    add("bloquant", "EV5", `comptes.tables annonce ${c.tables}, recalculé ${tablesDeclarees.length}`, file);
  if (c.provenance_indeterminee !== undefined && Number(c.provenance_indeterminee) !== indeterminees.length)
    add("bloquant", "EV5", `comptes.provenance_indeterminee annonce ${c.provenance_indeterminee}, recalculé ${indeterminees.length} — c'est le chiffre qui dit ce qui reste à faire`, file);
  if (c.par_evolution && typeof c.par_evolution === "object") {
    for (const k of new Set([...Object.keys(c.par_evolution), ...Object.keys(parEvolution)]))
      if (Number(c.par_evolution[k] || 0) !== (parEvolution[k] || 0))
        add("bloquant", "EV5", `comptes.par_evolution['${k}'] annonce ${c.par_evolution[k] || 0}, recalculé ${parEvolution[k] || 0} — ce sont ces cartes de comptage que le lecteur lit avant le tableau`, file);
  }
} else add("avertissement", "EV5", "aucun bloc « comptes » — la projection se lit alors ligne à ligne, sans les cartes de comptage qui en disent l'ampleur", file);

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
