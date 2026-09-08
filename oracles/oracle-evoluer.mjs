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
//   EV4  (TF-0955) toute provenance SANS objet — `colonne_technique`, `cle_de_la_table`,
//        `regle_en_clair`, `non_documentee` — porte une PHRASE déclarée d'au moins 4 mots. Le jeu
//        fermé ne prévoyait que le cas heureux : sur 396 colonnes mesurées, 255 ne citaient aucun
//        objet résolu et n'avaient rien à dire d'autre que leur propre cellule. Les
//        `non_documentee` sont comptées et remontées comme DETTE (avertissement + `dette`),
//        jamais laissées passer et jamais comblées par une provenance vraisemblable ;
//   EV5  les COMPTES affichés (`comptes.colonnes`, `comptes.par_evolution`,
//        `comptes.provenance_indeterminee`) sont RECALCULÉS et confrontés — un compte recopié
//        d'une synthèse précédente est ce qui a laissé passer trois PASS (TF-0911) ;
//   EV6  (TF-0942) l'ARBRE schéma › table › colonne existe, ses TROIS niveaux sont peuplés,
//        chaque nœud porte un statut du jeu fermé DE SON NIVEAU, chaque parent cité existe au
//        niveau au-dessus, l'agrégat d'un parent est RECOMPTÉ et confronté aux statuts de ses
//        enfants, et les nœuds « colonne » sont en bijection avec les `lignes`. Une projection
//        plate perd la hiérarchie que le lecteur cherche : le statut n'y existe qu'à la ligne la
//        plus fine et un schéma n'y apparaît nulle part comme objet ;
//   EV7  (TF-0943) une provenance `objets_resolus` porte une LISTE d'objets RÉSOLUS, jamais une
//        chaîne de texte : chacun avec sa `couche`, son chemin (`catalogue`, `schema`, `table`,
//        `colonne`), l'`explication` du RÔLE du champ employé et la `source_de_l_explication` du
//        jeu fermé. Un objet expliqué par un dictionnaire exige que ce dictionnaire soit DÉCLARÉ
//        au document. Avec `--catalogue <fichier>` joint, chaque objet doit y EXISTER — sans lui,
//        l'existence reste non jugée et le dit.
//
// non_juge : la JUSTESSE de chaque provenance (l'oracle vérifie qu'elle est typée et motivée,
// jamais qu'elle est vraie) ; l'EXHAUSTIVITÉ de la projection contre le DDL réel — c'est
// `oracles/oracle-couvrir.mjs` de ce dépôt, sur une seconde source ; la forme du lineage pointé
// (`oracles/oracle-tracer.mjs` de ce dépôt).
// Usage : node oracle-evoluer.mjs <evolutions.json> [--catalogue <catalogue.json>] [--json-only]
import fs from "node:fs";

const DOM = "Projection des évolutions d'une couche : complétude ligne à ligne, provenance typée et résolue en objets, comptes recalculés, arbre schéma › table › colonne (EV1-EV7)";
const NON_JUGE = [
  "la JUSTESSE d'une provenance — cet oracle vérifie qu'elle est TYPÉE, expliquée et, quand elle cite des objets, RÉSOLUE ; il ne sait pas si l'explication dit vrai",
  "l'EXISTENCE des objets cités en provenance quand AUCUN catalogue n'est joint (`--catalogue`) : la forme est jugée, l'existence non — et l'oracle le dit en clair au lieu de la supposer",
  "le CONTENU d'un dictionnaire déclaré : l'oracle exige qu'il soit déclaré et cité, jamais qu'il soit exact ou à jour",
  "l'EXHAUSTIVITÉ de la projection contre le DDL réel de la couche : une colonne que le DDL fourni ne portait pas n'est manquante pour personne ici. Cette question exige une SECONDE source et appartient à `oracles/oracle-couvrir.mjs` de ce dépôt",
  "la forme de la déclaration de lineage citée en origine — `oracles/oracle-tracer.mjs` de ce dépôt",
  "la pertinence métier d'une évolution retenue (créée plutôt que déplacée, par exemple) : l'oracle exige un type du jeu fermé, il ne l'arbitre pas",
  "la RÈGLE de dérivation du statut d'un parent (« schema_cree » plutôt que « schema_complete ») : EV6 exige un statut du jeu fermé de son niveau et un agrégat COHÉRENT avec ses enfants, jamais que la règle de dérivation soit la bonne",
];
const EVOLUTIONS = ["table_creee", "table_completee", "table_deplacee", "colonne_ajoutee", "colonne_corrigee", "inchangee"];
// EV6 : un statut par NIVEAU, et le jeu fermé n'est pas le même d'un niveau à l'autre — un
// « table_creee » posé sur une colonne, ou un « colonne_ajoutee » sur un schéma, dit que
// l'arbre a été rempli en recopiant la ligne du dessous.
const STATUTS = { schema: ["schema_cree", "schema_complete", "inchangee"],
                  table: ["table_creee", "table_completee", "table_deplacee", "inchangee"],
                  colonne: ["colonne_ajoutee", "colonne_corrigee", "inchangee"] };
const NIVEAUX = ["schema", "table", "colonne"];
// TF-0955 : le jeu fermé des provenances ne prévoyait que le cas heureux. Mesuré sur 396 colonnes :
// 141 citaient un objet résolu, 255 n'en citaient AUCUN et n'avaient rien à dire d'autre que leur
// propre cellule. Les quatre types sans objet nomment chacun une situation réelle, et chacun exige
// sa phrase — sans quoi « pas d'objet » se relit comme « rien à signaler ».
const PROVENANCES = ["objets_resolus", "colonne_technique", "cle_de_la_table", "regle_en_clair", "non_documentee"];
// D'où vient l'explication d'un objet ou d'une règle : un commentaire au DDL, le catalogue, la
// couche amont, le mapping, un dictionnaire DÉCLARÉ au document, une déclaration humaine — ou
// rien, et alors la provenance est `non_documentee` et rien d'autre.
const SOURCES = ["commentaire_ddl", "catalogue", "couche_existante", "mapping", "dictionnaire_declare", "declaration_humaine", "aucune"];
const MOTS = t => String(t || "").trim().split(/\s+/).filter(Boolean).length;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}/;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
// TF-0943 : le catalogue JOINT est facultatif — sans lui, l'EXISTENCE des objets cités reste
// `non_juge` et le dit, plutôt que d'être supposée. Accepte une liste de noms, un
// { objets: [...] } ou un `forge-data/couverture@1` (bloc source.inventaire).
const catalogueArg = (() => { const i = args.indexOf("--catalogue"); return i >= 0 ? args[i + 1] : null; })();
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
let projection = null;
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-evoluer", domaine: DOM, artefact: file || null,
    verdict, projection, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "EV1-EV7 sans écart", where: file }],
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

// ---- EV4 · toute provenance SANS objet porte sa phrase, et la dette se compte -----------------
// Les quatre types sans objet ne sont pas des synonymes de « rien » : chacun dit POURQUOI aucun
// objet du catalogue n'est nommable. Sans phrase déclarée, la restitution retombe sur la recopie
// de la règle — c'est-à-dire sur la cellule elle-même.
const sansObjet = retenues.filter(l => l.provenance && PROVENANCES.includes(l.provenance.type) && l.provenance.type !== "objets_resolus");
for (const l of sansObjet) {
  if (MOTS(l.provenance.explication) < 4)
    add("bloquant", "EV4", `« ${l.table}.${l.colonne} » : provenance « ${l.provenance.type} » SANS explication écrite (au moins 4 mots) — les quatre types sans objet EXIGENT leur phrase, sinon « aucun objet nommable » se relit « rien à signaler »`, l.ou);
}
const nonDocumentees = retenues.filter(l => l.provenance && l.provenance.type === "non_documentee");
if (nonDocumentees.length)
  add("avertissement", "EV4",
    `DETTE : ${nonDocumentees.length} provenance(s) NON DOCUMENTÉE(S) sur ${retenues.length} ligne(s) — remontée comme dette, jamais laissée passer, et jamais comblée par une provenance vraisemblable : ` +
    `${nonDocumentees.slice(0, 8).map(l => `« ${l.table}.${l.colonne} »`).join(" · ")}${nonDocumentees.length > 8 ? ` (+${nonDocumentees.length - 8} autres)` : ""}`,
    "lignes");

// ---- EV5 · les comptes se RECALCULENT, ils ne se recopient pas --------------------------------
const parEvolution = retenues.reduce((acc, l) => { acc[l.evolution] = (acc[l.evolution] || 0) + 1; return acc; }, {});
const parProvenance = retenues.reduce((acc, l) => { const t = l.provenance && l.provenance.type; if (t) acc[t] = (acc[t] || 0) + 1; return acc; }, {});
projection = { tables: tablesDeclarees.length, colonnes: retenues.length, par_evolution: parEvolution,
               par_provenance: parProvenance, provenance_non_documentee: nonDocumentees.length,
               dette: { non_documentee: nonDocumentees.length,
                        part: retenues.length ? Math.round(nonDocumentees.length * 1000 / retenues.length) / 10 : 0 } };
const c = d.comptes && typeof d.comptes === "object" ? d.comptes : null;
if (c) {
  if (c.colonnes !== undefined && Number(c.colonnes) !== retenues.length)
    add("bloquant", "EV5", `comptes.colonnes annonce ${c.colonnes}, recalculé ${retenues.length} — un compte recopié d'une synthèse précédente est ce qui a laissé passer trois PASS`, file);
  if (c.tables !== undefined && Number(c.tables) !== tablesDeclarees.length)
    add("bloquant", "EV5", `comptes.tables annonce ${c.tables}, recalculé ${tablesDeclarees.length}`, file);
  if (c.provenance_non_documentee !== undefined && Number(c.provenance_non_documentee) !== nonDocumentees.length)
    add("bloquant", "EV5", `comptes.provenance_non_documentee annonce ${c.provenance_non_documentee}, recalculé ${nonDocumentees.length} — c'est le chiffre de la DETTE, celui qui dit ce qui reste à faire`, file);
  if (c.par_provenance && typeof c.par_provenance === "object") {
    for (const k of new Set([...Object.keys(c.par_provenance), ...Object.keys(parProvenance)]))
      if (Number(c.par_provenance[k] || 0) !== (parProvenance[k] || 0))
        add("bloquant", "EV5", `comptes.par_provenance['${k}'] annonce ${c.par_provenance[k] || 0}, recalculé ${parProvenance[k] || 0}`, file);
  }
  if (c.par_evolution && typeof c.par_evolution === "object") {
    for (const k of new Set([...Object.keys(c.par_evolution), ...Object.keys(parEvolution)]))
      if (Number(c.par_evolution[k] || 0) !== (parEvolution[k] || 0))
        add("bloquant", "EV5", `comptes.par_evolution['${k}'] annonce ${c.par_evolution[k] || 0}, recalculé ${parEvolution[k] || 0} — ce sont ces cartes de comptage que le lecteur lit avant le tableau`, file);
  }
} else add("avertissement", "EV5", "aucun bloc « comptes » — la projection se lit alors ligne à ligne, sans les cartes de comptage qui en disent l'ampleur", file);

// ---- EV6 · l'arbre schéma › table › colonne (TF-0942) -----------------------------------------
// Une liste plate ne se relit pas : le statut n'y existe qu'à la ligne la plus fine, et le schéma
// n'y est jamais un objet. L'arbre le rend — donc il se juge, sinon il se remplirait au jugé.
const arbre = Array.isArray(d.arbre) ? d.arbre : [];
if (!arbre.length)
  add("bloquant", "EV6", "bloc « arbre » absent — une projection PLATE perd la hiérarchie schéma › table › colonne : le statut n'existe qu'à la ligne la plus fine et aucun schéma n'apparaît comme objet (produit par `scripts/projeter-evolutions.mjs`)", file);
else {
  const parNiveau = { schema: new Map(), table: new Map(), colonne: new Map() };
  const noeuds = [];
  arbre.forEach((n, i) => {
    const ou = `arbre #${i + 1}`;
    const niveau = n && typeof n.niveau === "string" ? n.niveau.trim() : "";
    const objet = n && typeof n.objet === "string" ? n.objet.trim() : "";
    if (!NIVEAUX.includes(niveau)) { add("bloquant", "EV6", `nœud de niveau « ${n && n.niveau} » hors du jeu fermé {${NIVEAUX.join(" › ")}}`, ou); return; }
    if (!objet) { add("bloquant", "EV6", `nœud de niveau « ${niveau} » sans objet nommé — un nœud anonyme ne se rattache à rien`, ou); return; }
    if (parNiveau[niveau].has(objet.toLowerCase()))
      { add("bloquant", "EV6", `« ${objet} » déclaré deux fois au niveau ${niveau} — un nœud dupliqué fausse l'agrégat de son parent`, ou); return; }
    if (!STATUTS[niveau].includes(n.statut))
      add("bloquant", "EV6", `« ${objet} » (${niveau}) : statut « ${n.statut} » hors du jeu fermé de son niveau {${STATUTS[niveau].join(", ")}} — le statut doit exister À CHAQUE niveau, pas seulement à la ligne la plus fine`, ou);
    parNiveau[niveau].set(objet.toLowerCase(), { objet, niveau, statut: n.statut, parent: n.parent, agrege: n.statut_agrege, ou });
    noeuds.push({ objet, niveau, statut: n.statut, parent: n.parent, agrege: n.statut_agrege, ou });
  });
  for (const niv of NIVEAUX) if (!parNiveau[niv].size)
    add("bloquant", "EV6", `aucun nœud de niveau « ${niv} » — c'est exactement la hiérarchie perdue : « ${niv} » n'apparaît nulle part comme objet`, "arbre");

  // Rattachement : le parent d'un nœud est un objet DÉCLARÉ au niveau juste au-dessus.
  const enfants = new Map();  // clé « niveau|objet » du parent -> statuts de ses enfants
  for (const n of noeuds) {
    const rang = NIVEAUX.indexOf(n.niveau);
    const parent = typeof n.parent === "string" ? n.parent.trim() : "";
    if (rang === 0) {
      if (parent) add("bloquant", "EV6", `« ${n.objet} » est un schéma et cite pourtant un parent « ${parent} » — la racine de l'arbre n'a pas de parent`, n.ou);
      continue;
    }
    if (!parent) { add("bloquant", "EV6", `« ${n.objet} » (${n.niveau}) sans parent — un nœud sans parent est une liste plate déguisée en arbre`, n.ou); continue; }
    const nivParent = NIVEAUX[rang - 1];
    if (!parNiveau[nivParent].has(parent.toLowerCase()))
      { add("bloquant", "EV6", `« ${n.objet} » (${n.niveau}) cite le parent « ${parent} », absent du niveau ${nivParent} — le rattachement pointe dans le vide`, n.ou); continue; }
    const cle = `${nivParent}|${parent.toLowerCase()}`;
    if (!enfants.has(cle)) enfants.set(cle, []);
    enfants.get(cle).push(n.statut);
  }

  // L'agrégat d'un parent se RECOMPTE : c'est le premier chiffre à mentir quand une ligne bouge.
  for (const n of noeuds) {
    if (n.niveau === "colonne") continue;
    const attendu = (enfants.get(`${n.niveau}|${n.objet.toLowerCase()}`) || [])
      .reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {});
    const declare = n.agrege && typeof n.agrege === "object" ? n.agrege : null;
    if (!declare) { add("bloquant", "EV6", `« ${n.objet} » (${n.niveau}) sans « statut_agrege » — c'est l'agrégat « 3 tables dont 2 créées » que le lecteur cherche avant le détail`, n.ou); continue; }
    for (const k of new Set([...Object.keys(declare), ...Object.keys(attendu)]))
      if (Number(declare[k] || 0) !== (attendu[k] || 0))
        add("bloquant", "EV6", `« ${n.objet} » (${n.niveau}) : statut_agrege['${k}'] annonce ${declare[k] || 0}, recompté ${attendu[k] || 0} chez ses enfants — un agrégat incohérent avec ses enfants fait lire un périmètre qui n'existe pas`, n.ou);
  }

  // Bijection arbre ⇄ lignes au niveau colonne : une colonne projetée hors de l'arbre est
  // invisible dans la lecture par niveaux, et l'inverse gonfle l'arbre sans preuve.
  const feuilles = new Set([...parNiveau.colonne.keys()]);
  const attenduesFeuilles = new Set(retenues.map(l => `${l.table}.${l.colonne}`.toLowerCase()));
  for (const f of attenduesFeuilles) if (!feuilles.has(f))
    add("bloquant", "EV6", `« ${f} » est projetée en ligne mais absente de l'arbre — la lecture par niveaux la manque`, "arbre");
  for (const f of feuilles) if (!attenduesFeuilles.has(f))
    add("bloquant", "EV6", `l'arbre porte la colonne « ${f} », qu'aucune ligne ne projette — l'arbre et le détail ne disent pas la même chose`, "arbre");
  if (projection) projection.arbre_par_niveau = { schema: parNiveau.schema.size, table: parNiveau.table.size, colonne: parNiveau.colonne.size };
}

// ---- EV7 · les objets cités sont RÉSOLUS, pas une chaîne de texte (TF-0943) -------------------
// « clients Date_Debut (Type_Avenant 0), Date_Entree, DUREE » ne disait ni où vivent ces
// objets ni à quoi sert chaque champ. Un objet résolu porte sa couche, son chemin et le RÔLE du
// champ employé, avec la source de cette explication — sinon la provenance se relit à la main.
let catalogue = null;
if (catalogueArg) {
  try {
    const brut = JSON.parse(fs.readFileSync(catalogueArg, "utf8"));
    const liste = Array.isArray(brut) ? brut
      : Array.isArray(brut.objets) ? brut.objets
      : (brut.source && brut.source.inventaire && Array.isArray(brut.source.inventaire.objets)) ? brut.source.inventaire.objets
      : null;
    if (!liste) add("bloquant", "EV7", `catalogue joint « ${catalogueArg} » sans liste d'objets (attendu un tableau, un { objets: [...] } ou un forge-data/couverture@1)`, catalogueArg);
    else catalogue = new Set(liste.map(o => String(typeof o === "string" ? o : (o && (o.nom || o.objet)) || "").toLowerCase()).filter(Boolean));
  } catch (e) { add("bloquant", "EV7", `catalogue joint illisible : ${e.message}`, String(catalogueArg)); }
}
const dictionnaires = new Map((Array.isArray(d.dictionnaires) ? d.dictionnaires : [])
  .filter(x => x && x.nom).map(x => [String(x.nom).toLowerCase(), x]));
for (const l of retenues) {
  const p = l.provenance;
  if (!p || p.type !== "objets_resolus") continue;
  const objets = Array.isArray(p.objets) ? p.objets : null;
  if (!objets || !objets.length) {
    add("bloquant", "EV7", `« ${l.table}.${l.colonne} » : provenance « objets_resolus » sans AUCUN objet — c'est le cas heureux revendiqué sans sa preuve ; à défaut d'objet nommable, le type dit lequel des quatre autres cas s'applique`, l.ou);
    continue;
  }
  objets.forEach((o, j) => {
    const ou = `${l.ou} · provenance.objets #${j + 1}`;
    if (!o || typeof o !== "object") { add("bloquant", "EV7", `« ${l.table}.${l.colonne} » : objet de provenance non structuré — la provenance est une LISTE d'objets, plus une chaîne de texte`, ou); return; }
    if (!String(o.table || "").trim()) add("bloquant", "EV7", `« ${l.table}.${l.colonne} » : objet de provenance sans « table » — un objet sans table n'est nommé nulle part`, ou);
    if (!String(o.couche || "").trim()) add("bloquant", "EV7", `« ${l.table}.${l.colonne} » : objet « ${o.table || "?"} » sans « couche » — l'emplacement est la moitié de ce que le lecteur cherche`, ou);
    if (MOTS(o.explication) < 4) add("bloquant", "EV7", `« ${l.table}.${l.colonne} » : objet « ${o.table || "?"} » sans explication du RÔLE du champ employé (au moins 4 mots) — citer un objet sans dire à quoi il sert, c'est recopier la règle`, ou);
    if (!SOURCES.includes(o.source_de_l_explication)) add("bloquant", "EV7", `« ${l.table}.${l.colonne} » : objet « ${o.table || "?"} » dont la source de l'explication « ${o.source_de_l_explication} » est hors du jeu fermé {${SOURCES.join(", ")}}`, ou);
    if (o.source_de_l_explication === "dictionnaire_declare" && !dictionnaires.has(String(o.dictionnaire || "").toLowerCase()))
      add("bloquant", "EV7", `« ${l.table}.${l.colonne} » : objet « ${o.table || "?"} » explique par le dictionnaire « ${o.dictionnaire || "(non cité)"} », qui n'est pas déclaré au bloc « dictionnaires » — un dictionnaire non déclaré n'est pas opposable`, ou);
    if (catalogue) {
      const chemin = [o.catalogue, o.schema, o.table, o.colonne].filter(Boolean).join(".").toLowerCase();
      if (chemin && !catalogue.has(chemin) && o.source_de_l_explication !== "dictionnaire_declare")
        add("bloquant", "EV7", `« ${l.table}.${l.colonne} » : objet « ${chemin} » absent du catalogue joint — soit la provenance nomme un objet qui n'existe pas, soit le catalogue est périmé ; dans les deux cas la provenance ment`, ou);
    }
  });
}
if (!catalogueArg) add("info", "EV7", "aucun catalogue joint (--catalogue) : EV7 juge la FORME des objets cités (chemin, couche, rôle, source), jamais leur EXISTENCE — celle-ci reste non jugée et le dit", file);

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
