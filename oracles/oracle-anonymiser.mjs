#!/usr/bin/env node
// oracle-anonymiser — Domaine « Anonymisation d'un extrait de production destiné à une base de
// développement ou de qualification : individualisation, corrélation, inférence » (déterministe).
// TF-2011, 29/10/2026, décision D-91 (a) du porteur.
//
// LE FAIT MESURÉ. Étude du pilot du 29/10/2026 : aucune forge ne masquait une base, et deux
// produits avaient écrit leur propre outil, dont l'un PSEUDONYMISE sous clé secrète. Or « pseudonymisation
// is not a method of anonymisation » (avis 05/2014 du groupe de l'article 29, WP216, §4) : la donnée
// pseudonymisée reste personnelle. La décision du porteur admet l'extrait de production en base de
// développement à une condition qui se MESURE : un contrôle exécuté refuse tout extrait où une
// personne reste reconnaissable selon les trois critères de l'avis.
//
// CE QUE L'ORACLE JUGE : l'extrait MASQUÉ tel qu'il est sur le disque, confronté à l'extrait SOURCE
// et à la déclaration `forge-data/masquage@1`. Il ne croit rien du rapport `forge-data/anonymisation@1`
// qui les relie : tout compte, toute mesure qu'il porte est RECALCULÉE (convention CV6 de cette forge).
// Il n'importe rien du verbe qui produit l'extrait (`scripts/anonymiser.mjs`) : son lecteur CSV/JSONL
// et ses mesures sont les siens — un juge qui partage le code du jugé partage ses défauts.
// Les findings ne citent JAMAIS une valeur de la source : un compte, une table, une colonne et des
// numéros d'enregistrement de l'extrait masqué, rien d'autre — un oracle qui recopierait l'identifiant
// fuité dans son rapport le ferait fuir une seconde fois, vers le ledger.
//
//   AN1   pièces et forme : rapport `forge-data/anonymisation@1` (id, date), déclaration lisible,
//         extrait source PRÉSENT (sans lui, ni l'identité, ni la corrélation ne se mesurent : l'oracle
//         se joue avant la destruction de la source), un fichier masqué par table déclarée, AUCUN autre
//         fichier dans le dossier masqué (un fichier égaré à côté d'un extrait masqué est la fuite la
//         plus banale), en-têtes masqués = colonnes déclarées non supprimées ;
//   AN2   classement exhaustif : chaque table et chaque colonne de la SOURCE est déclarée, une fois,
//         avec une classe du jeu fermé et une stratégie du jeu fermé ; une colonne déclarée absente de
//         la source est une déclaration périmée ; « conserver » et « exclue » portent un motif écrit
//         (≥ 4 mots, convention CV4) ; la déclaration nomme son auteur ;
//   AN3   identifiants directs : jamais conservés (déclaration) ; AUCUNE valeur d'une colonne
//         d'identifiant ou de clé remplacée n'est égale à une valeur de la même colonne source
//         (mesure) ; un courriel de remplacement vit sur un domaine réservé (RFC 2606) ; aucun
//         courriel de la source n'apparaît tel quel dans une cellule masquée, quelle que soit sa colonne ;
//   AN4   pseudonymisation refusée comme anonymisation : stratégie de la famille hachage, chiffrement,
//         table de correspondance ou jeton (déclaration) ; clé ou graine portée par la déclaration ou
//         par le rapport ; colonne personnelle aux valeurs en forme d'EMPREINTE (32, 40, 64 ou 128
//         chiffres hexadécimaux, ou base64 de mêmes longueurs) ; remplacement qui SUIT les répétitions
//         de sa source valeur pour valeur (profil de fréquences dominé par celui de la source) ;
//   AN5   individualisation (k-anonymat) : k déclaré ≥ 5, plancher de la forge ; dans chaque table à
//         quasi-identifiants, chaque classe d'équivalence (valeurs MASQUÉES des quasi-identifiants)
//         compte au moins k personnes distinctes (colonne `personne`), ou k lignes à défaut ;
//   AN6   corrélation : dans une table personnelle, aucune colonne conservée, généralisée, bruitée,
//         agrégée ou remplacée ne relie une ligne masquée à MOINS DE k lignes source — une ligne est reliable
//         quand sa valeur se retrouve dans moins de k lignes de la même colonne source ET dans moins
//         de k lignes masquées ; part reliable ≤ `seuils.jointure_max` (0 par défaut, plafond 0,01) ;
//   AN7   inférence : l déclaré ≥ 2, plancher de la forge ; chaque attribut sensible compte au moins
//         l valeurs distinctes dans chaque classe (l-diversité, WP216 §3.2.2) ; avec `seuils.t`,
//         la distance de variation entre la répartition de la classe et celle de la table ne dépasse
//         pas t (t-closeness, mesurée sur les attributs catégoriels) ;
//   AN8   texte libre : supprimé ou remplacé, jamais conservé (déclaration) ; aucune valeur masquée
//         égale à une valeur de la même colonne source (mesure) ;
//   AN9   intégrité référentielle : chaque `reference` résout à une colonne déclarée d'une table
//         active, de stratégie compatible ; chaque valeur non vide d'une clé étrangère masquée existe
//         dans la colonne cible masquée, et cette cible est unique ;
//   AN10  comptes recalculés : lignes source, lignes masquées et retraits annoncés par le rapport,
//         part retirée ≤ `seuils.suppression_max`, mesures k, l et t annoncées — tout se recompte.
//
// Usage : node oracles/oracle-anonymiser.mjs <anonymisation.json | dossier masqué> [--source <dossier>] [--json-only]
// Codes : 0 PASS ; 1 FAIL ; 2 SKIP (cible introuvable).
import fs from "node:fs";
import path from "node:path";

const DOM = "Anonymisation d'un extrait de production pour une base de développement ou de qualification : individualisation, corrélation, inférence (AN1-AN10, avis WP216)";
const NON_JUGE = [
  "la réidentification par croisement avec une source EXTERNE à l'extrait (autre base, données publiques, autre extrait qui a fui) : l'oracle ne connaît que la source qu'on lui remet, et les moyens « raisonnablement susceptibles d'être utilisés » par un tiers (WP216 §2.2.2) ne s'énumèrent pas",
  "la qualification juridique de l'extrait : selon l'avis WP216 (§2.2.2), tant que le responsable garde la donnée source au niveau de l'événement, l'extrait masqué qu'il en tire reste pour lui une donnée personnelle ; l'oracle mesure les trois critères techniques, il ne tranche pas cette question de droit",
  "la justesse du classement : une colonne déclarée non personnelle qui est en fait un quasi-identifiant échappe au k-anonymat — l'erreur critique que l'avis nomme « Missing some quasi-identifiers » (§3.2.1.2) ; l'oracle n'avertit que sur le NOM de la colonne",
  "le profil d'une personne À TRAVERS les tables : les classes se mesurent table par table, jamais sur la réunion des lignes d'une même personne (ses commandes et leurs dates prises ensemble)",
  "l'inférence probabiliste hors `seuils.t` : sans t, seule l'inférence CERTAINE est refusée (l-diversité) ; t ne se mesure que sur un attribut catégoriel (50 modalités au plus) — un attribut sensible continu se généralise en tranches pour être mesuré ; l'attaque de proximité (valeurs distinctes mais voisines) n'est pas mesurée",
  "une pseudonymisation par clé dont la sortie n'a ni la forme d'une empreinte ni le profil de répétition de sa source, sur une colonne aux valeurs toutes distinctes : sans la clé, elle est indiscernable d'un tirage aléatoire — la déclaration la refuse, la mesure ne la voit pas",
  "un identifiant logé à l'INTÉRIEUR d'un texte d'une autre colonne : seule l'égalité exacte de cellule est cherchée (et, pour les courriels de la source, dans toutes les colonnes)",
  "la garde de la graine et la destruction de l'extrait source après chargement : ce sont des gestes, hors fichiers ; l'oracle vérifie seulement que ni la déclaration ni le rapport ne portent de clé ou de graine",
  "l'utilité de l'extrait masqué pour les tests (distorsion, cas limites perdus avec les lignes retirées)",
  "le rechargement dans le schéma de destination (NOT NULL, CHECK, clés étrangères appliquées par le moteur) : il se prouve en rechargeant, par exemple avec `scripts/exercer-anonymiser-postgres.mjs` de ce dépôt sur un PostgreSQL éphémère",
];
const SEUILS_FORGE = { k_min: 5, l_min: 2, jointure_max: 0.01, categories_max_t: 50 };
const CLASSES = ["identifiant_direct", "quasi_identifiant", "attribut_sensible", "texte_libre", "technique", "non_personnelle"];
const PERSONNELLES = new Set(["identifiant_direct", "quasi_identifiant", "attribut_sensible", "texte_libre"]);
const STRATEGIES = ["supprimer", "generaliser", "remplacer", "bruiter", "agreger", "conserver"];
const FAMILLE_PSEUDO = ["pseudonymiser", "pseudonymisation", "hacher", "hachage", "hash", "hmac", "chiffrer", "chiffrement",
  "tokeniser", "tokenisation", "jeton", "table_correspondance", "correspondance"];
const GRAINES_ADMISES = ["fournie_non_conservee", "tiree_au_hasard_non_conservee", "aucune"];
const DOMAINE_RESERVE = /(^|\.)(test|example|invalid|localhost)$|^example\.(com|net|org)$/i;
const EMPREINTES = [/^[0-9a-f]{32}$/i, /^[0-9a-f]{40}$/i, /^[0-9a-f]{64}$/i, /^[0-9a-f]{128}$/i,
  /^[A-Za-z0-9+/]{22}(==)?$/, /^[A-Za-z0-9+/]{27}=?$/, /^[A-Za-z0-9+/]{43}=?$/, /^[A-Za-z0-9+/]{86}(==)?$/,
  /^[A-Za-z0-9_-]{22}$/, /^[A-Za-z0-9_-]{27}$/, /^[A-Za-z0-9_-]{43}$/, /^[A-Za-z0-9_-]{86}$/];
const DATE_ISO = /^\d{4}-\d{2}-\d{2}/;
const NOMBRE = /^-?\d+(\.\d+)?$/;

// ---- arguments et sortie --------------------------------------------------------------------------
const args = process.argv.slice(2);
const jsonOnly = args.includes("--json-only");
let cible = null, sourceForcee = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--source") { sourceForcee = args[++i] || null; continue; }
  if (args[i].startsWith("--")) continue;
  if (!cible) cible = args[i];
}
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const mesures = {};
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-anonymiser", domaine: DOM, artefact: cible || null, verdict,
    seuils_forge: SEUILS_FORGE, mesures,
    findings: F.length ? F : [{ sev: "info", regle: "—", msg: "AN1-AN10 sans écart", where: cible }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
const fin = () => out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
const premiers = (rangs) => rangs.slice(0, 5).map(i => i + 1).join(", ") + (rangs.length > 5 ? ` (+${rangs.length - 5})` : "");
const mots = (s) => (typeof s === "string" ? s.trim().split(/\s+/).filter(Boolean).length : 0);

// ---- lecteurs propres à l'oracle (jamais ceux du verbe) -----------------------------------------
/** CSV : rend des enregistrements de cellules ; null = champ vide NON cité, "" = vide cité. */
function cellulesCsv(texte) {
  const s = texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
  const recs = [];
  let rec = [], val = "", etat = "debut"; // debut | brut | cite | apres_cite
  const pousser = () => { rec.push(etat === "debut" ? null : etat === "brut" ? (val === "" ? null : val) : val); val = ""; etat = "debut"; };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (etat === "cite") {
      if (c === '"' && s[i + 1] === '"') { val += '"'; i += 2; continue; }
      if (c === '"') { etat = "apres_cite"; i++; continue; }
      val += c; i++; continue;
    }
    if (c === ",") { pousser(); i++; continue; }
    if (c === "\n" || (c === "\r" && s[i + 1] === "\n")) { pousser(); recs.push(rec); rec = []; i += c === "\r" ? 2 : 1; continue; }
    if (etat === "debut" && c === '"') { etat = "cite"; i++; continue; }
    if (etat === "apres_cite") throw new Error(`caractère après un champ cité (enregistrement ${recs.length + 1})`);
    if (c === '"') throw new Error(`guillemet dans un champ non cité (enregistrement ${recs.length + 1})`);
    etat = "brut"; val += c; i++;
  }
  if (etat === "cite") throw new Error("champ cité non refermé");
  if (etat !== "debut" || rec.length) { pousser(); recs.push(rec); }
  return recs;
}
function lire(fichier, forme) {
  const texte = fs.readFileSync(fichier, "utf8");
  if (forme === "csv") {
    const recs = cellulesCsv(texte);
    if (!recs.length) throw new Error("fichier sans en-tête");
    const [entete, ...corps] = recs;
    corps.forEach((r, i) => { if (r.length !== entete.length) throw new Error(`enregistrement ${i + 1} : ${r.length} champ(s) pour ${entete.length}`); });
    return { colonnes: entete, lignes: corps };
  }
  const colonnes = [], objets = [];
  texte.split(/\r?\n/).forEach((l, i) => {
    if (!l.trim()) return;
    let o; try { o = JSON.parse(l); } catch { throw new Error(`ligne ${i + 1} : JSON invalide`); }
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error(`ligne ${i + 1} : objet attendu`);
    for (const k of Object.keys(o)) if (!colonnes.includes(k)) colonnes.push(k);
    objets.push(o);
  });
  return { colonnes, lignes: objets.map(o => colonnes.map(k => (o[k] === null || o[k] === undefined ? null : typeof o[k] === "object" ? JSON.stringify(o[k]) : String(o[k])))) };
}
const colonneDe = (tab, nom) => { const j = tab.colonnes.indexOf(nom); return j < 0 ? null : tab.lignes.map(r => r[j]); };
const vide = (v) => v === null || v === "";
const estNumerique = (vals) => vals.some(v => !vide(v)) && vals.every(v => vide(v) || NOMBRE.test(v));
const normer = (v, num) => (vide(v) ? null : num && NOMBRE.test(v) ? String(Number(v)) : v);
const compter = (vals) => { const m = new Map(); for (const v of vals) if (v !== null) m.set(v, (m.get(v) || 0) + 1); return m; };

// ---- AN1 · pièces --------------------------------------------------------------------------------
if (!cible || !fs.existsSync(cible)) { add("info", "AN1", "cible introuvable (rapport anonymisation.json ou dossier masqué)", String(cible)); out("SKIP", 2); }
const manifeste = fs.statSync(cible).isDirectory() ? path.join(cible, "anonymisation.json") : cible;
if (!fs.existsSync(manifeste)) { add("bloquant", "AN1", "rapport anonymisation.json absent du dossier masqué : un extrait sans son rapport ne dit ni sa source ni sa déclaration", cible); fin(); }
const dirM = path.dirname(manifeste);
let m = null, d = null;
try { m = JSON.parse(fs.readFileSync(manifeste, "utf8")); } catch { add("bloquant", "AN1", "rapport : JSON invalide", manifeste); fin(); }
if (m.format !== "forge-data/anonymisation@1") add("bloquant", "AN1", `format du rapport « ${m.format} » (attendu forge-data/anonymisation@1)`, manifeste);
if (!m.id) add("bloquant", "AN1", "id du rapport absent", manifeste);
if (!DATE_ISO.test(String(m.date || ""))) add("bloquant", "AN1", "date du rapport absente ou hors format ISO", manifeste);
const cheminDecl = m.masquage ? path.resolve(dirM, m.masquage) : null;
if (!cheminDecl || !fs.existsSync(cheminDecl)) { add("bloquant", "AN1", "déclaration de masquage introuvable (champ « masquage » du rapport)", manifeste); fin(); }
try { d = JSON.parse(fs.readFileSync(cheminDecl, "utf8")); } catch { add("bloquant", "AN1", "déclaration : JSON invalide", cheminDecl); fin(); }
if (d.format !== "forge-data/masquage@1") add("bloquant", "AN1", `format de la déclaration « ${d.format} » (attendu forge-data/masquage@1)`, cheminDecl);
if (!d.id) add("bloquant", "AN1", "id de la déclaration absent", cheminDecl);
if (!DATE_ISO.test(String(d.date || ""))) add("bloquant", "AN1", "date de la déclaration absente ou hors format ISO", cheminDecl);
const forme = (m.masque && m.masque.forme) || (m.source && m.source.forme);
if (!["csv", "jsonl"].includes(forme)) { add("bloquant", "AN1", `forme « ${forme} » hors du jeu {csv, jsonl}`, manifeste); fin(); }
if (m.source && m.source.forme && m.source.forme !== forme) add("bloquant", "AN1", "la source et l'extrait masqué n'ont pas la même forme", manifeste);
const dirMasque = path.resolve(dirM, (m.masque && m.masque.dossier) || ".");
const dirSource = sourceForcee ? path.resolve(sourceForcee) : (m.source && m.source.dossier ? path.resolve(dirM, m.source.dossier) : null);
const sourcePresente = !!(dirSource && fs.existsSync(dirSource) && fs.statSync(dirSource).isDirectory());
if (!sourcePresente) add("bloquant", "AN1", "extrait SOURCE introuvable : sans lui, ni l'identité (AN3), ni la corrélation (AN6), ni le texte libre (AN8), ni les comptes (AN10) ne se mesurent — l'oracle se joue AVANT de détruire la source, ou avec --source <dossier>", manifeste);

const tablesDecl = Array.isArray(d.tables) ? d.tables : [];
const actives = tablesDecl.filter(t => t && t.nom && t.exclue !== true);
const declParNom = new Map(tablesDecl.filter(t => t && t.nom).map(t => [t.nom, t]));
const colDecl = new Map();
for (const t of actives) for (const c of (Array.isArray(t.colonnes) ? t.colonnes : [])) if (c && c.nom) colDecl.set(`${t.nom}.${c.nom}`, { table: t.nom, ...c });
const strategieDe = (c) => String((c && c.strategie) || "");

// Dossier masqué : seulement le rapport, la déclaration et une table par table active.
const admis = new Set([path.basename(manifeste).toLowerCase(), ...actives.map(t => `${t.nom}.${forme}`.toLowerCase())]);
if (path.resolve(path.dirname(cheminDecl)).toLowerCase() === dirMasque.toLowerCase()) admis.add(path.basename(cheminDecl).toLowerCase());
if (fs.existsSync(dirMasque)) {
  for (const e of fs.readdirSync(dirMasque, { withFileTypes: true }))
    if (e.isDirectory() || !admis.has(e.name.toLowerCase()))
      add("bloquant", "AN1", `« ${e.name} » se trouve dans le dossier masqué sans être une table déclarée, le rapport ou la déclaration — un fichier égaré à côté d'un extrait masqué est la fuite la plus banale`, dirMasque);
} else add("bloquant", "AN1", "dossier masqué introuvable", dirMasque);

const masque = new Map(), source = new Map();
for (const t of actives) {
  const fm = path.join(dirMasque, `${t.nom}.${forme}`);
  if (!fs.existsSync(fm)) add("bloquant", "AN1", `table « ${t.nom} » déclarée sans fichier masqué (${t.nom}.${forme})`, dirMasque);
  else { try { masque.set(t.nom, lire(fm, forme)); } catch (e) { add("bloquant", "AN1", `${t.nom}.${forme} masqué illisible : ${e.message}`, fm); } }
  if (sourcePresente) {
    const fs_ = path.join(dirSource, `${t.nom}.${forme}`);
    if (!fs.existsSync(fs_)) add("bloquant", "AN1", `table « ${t.nom} » absente de l'extrait source`, dirSource);
    else { try { source.set(t.nom, lire(fs_, forme)); } catch (e) { add("bloquant", "AN1", `${t.nom}.${forme} source illisible : ${e.message}`, fs_); } }
  }
}
for (const t of actives) {
  const tm = masque.get(t.nom); if (!tm) continue;
  const attendues = (t.colonnes || []).filter(c => c && c.nom && strategieDe(c) !== "supprimer").map(c => c.nom);
  const supprimees = (t.colonnes || []).filter(c => c && c.nom && strategieDe(c) === "supprimer").map(c => c.nom);
  for (const c of tm.colonnes) {
    if (supprimees.includes(c)) add("bloquant", "AN1", `${t.nom}.${c} est déclarée SUPPRIMÉE et figure dans l'extrait masqué`, `${t.nom}.${forme}`);
    else if (!attendues.includes(c)) add("bloquant", "AN1", `${t.nom}.${c} figure dans l'extrait masqué sans être déclarée`, `${t.nom}.${forme}`);
  }
  for (const c of attendues) if (!tm.colonnes.includes(c)) add("bloquant", "AN1", `${t.nom}.${c} déclarée et absente de l'extrait masqué`, `${t.nom}.${forme}`);
}

// ---- AN2 · classement exhaustif ------------------------------------------------------------------
if (!d.auteur || !String(d.auteur).trim()) add("bloquant", "AN2", "la déclaration ne nomme pas son auteur : un classement sans auteur n'est pas opposable", cheminDecl);
const vuesTables = new Set();
for (const t of tablesDecl) {
  if (!t || !t.nom) { add("bloquant", "AN2", "table déclarée sans nom", cheminDecl); continue; }
  if (vuesTables.has(t.nom)) add("bloquant", "AN2", `table « ${t.nom} » déclarée deux fois`, cheminDecl);
  vuesTables.add(t.nom);
  if (t.exclue === true) { if (mots(t.motif) < 4) add("bloquant", "AN2", `table « ${t.nom} » exclue sans motif écrit (au moins 4 mots)`, cheminDecl); continue; }
  const vues = new Set();
  for (const c of (Array.isArray(t.colonnes) ? t.colonnes : [])) {
    const ou = `${t.nom}.${c && c.nom}`;
    if (!c || !c.nom) { add("bloquant", "AN2", `table « ${t.nom} » : colonne déclarée sans nom`, cheminDecl); continue; }
    if (vues.has(c.nom)) add("bloquant", "AN2", `${ou} déclarée deux fois`, cheminDecl);
    vues.add(c.nom);
    if (!CLASSES.includes(c.classe)) add("bloquant", "AN2", `${ou} : classe « ${c.classe} » hors du jeu fermé {${CLASSES.join(", ")}} — une colonne non classée est un refus`, cheminDecl);
    const st = strategieDe(c);
    if (!STRATEGIES.includes(st) && !FAMILLE_PSEUDO.includes(st.toLowerCase())) add("bloquant", "AN2", `${ou} : stratégie « ${st} » hors du jeu fermé {${STRATEGIES.join(", ")}}`, cheminDecl);
    if (st === "conserver" && mots(c.motif) < 4) add("bloquant", "AN2", `${ou} : « conserver » sans motif écrit (au moins 4 mots)`, cheminDecl);
    if (st === "generaliser" && !["date", "code_postal_departement", "prefixe", "tranche", "regroupement"].includes(c.methode)) add("bloquant", "AN2", `${ou} : méthode de généralisation « ${c.methode} » inconnue`, cheminDecl);
    if (st === "remplacer" && !c.reference && !["cle", "courriel", "nom", "texte", "constante"].includes(c.synthetique)) add("bloquant", "AN2", `${ou} : « remplacer » sans générateur synthétique connu ni « reference »`, cheminDecl);
    const nomNu = String(c.nom).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (["technique", "non_personnelle"].includes(c.classe) && /(^|_)(nom|prenom|email|e?mail|courriel|tel|telephone|phone|mobile|adresse|address|rue|naissance|birth|dob|iban|bic|nir|secu|ssn|ip|login|password|mot_de_passe)(_|$)/.test(nomNu))
      add("avertissement", "AN2", `${ou} classée « ${c.classe} » alors que son nom évoque une donnée personnelle — classement à revoir`, cheminDecl);
  }
  if (t.personne !== undefined && !vues.has(t.personne)) add("bloquant", "AN2", `table « ${t.nom} » : personne « ${t.personne} » n'est pas une colonne déclarée`, cheminDecl);
}
if (sourcePresente) {
  for (const f of fs.readdirSync(dirSource).filter(f => /\.(csv|jsonl)$/i.test(f))) {
    const nom = f.replace(/\.(csv|jsonl)$/i, "");
    if (!declParNom.has(nom)) add("bloquant", "AN2", `table « ${nom} » de la source absente de la déclaration : ses colonnes ne sont pas classées`, dirSource);
  }
  for (const t of actives) {
    const ts = source.get(t.nom); if (!ts) continue;
    const declarees = new Set((t.colonnes || []).filter(c => c && c.nom).map(c => c.nom));
    for (const c of ts.colonnes) if (!declarees.has(c)) add("bloquant", "AN2", `${t.nom}.${c} : colonne de la source NON CLASSÉE`, cheminDecl);
    for (const c of declarees) if (!ts.colonnes.includes(c)) add("bloquant", "AN2", `${t.nom}.${c} déclarée et absente de la source — déclaration périmée`, cheminDecl);
  }
}

// ---- AN3 · identifiants directs ------------------------------------------------------------------
const estCleRemplacee = (c) => strategieDe(c) === "remplacer" && (c.synthetique === "cle" || !!c.reference);
const pseudo = (c) => FAMILLE_PSEUDO.includes(strategieDe(c).toLowerCase()); // jugée par AN4, avec son motif propre
for (const [ou, c] of colDecl) if (c.classe === "identifiant_direct" && !["supprimer", "remplacer"].includes(strategieDe(c)) && !pseudo(c))
  add("bloquant", "AN3", `${ou} : identifiant direct déclaré « ${strategieDe(c)} » — un identifiant direct se supprime ou se remplace, jamais il ne se garde`, cheminDecl);
// Les courriels de la source, pris dans TOUTES ses colonnes d'identifiant, supprimées comprises :
// un courriel retiré de sa colonne peut avoir été recopié dans une autre.
const courrielsSource = new Set();
for (const [, c] of colDecl) {
  const ts = source.get(c.table);
  if (ts && c.classe === "identifiant_direct") for (const v of colonneDe(ts, c.nom) || []) if (!vide(v) && v.includes("@")) courrielsSource.add(v.toLowerCase());
}
const dejaSignalees = new Set();
for (const [ou, c] of colDecl) {
  const tm = masque.get(c.table), ts = source.get(c.table);
  if (!tm || strategieDe(c) === "supprimer") continue;
  const vm = colonneDe(tm, c.nom); if (!vm) continue;
  if (c.classe === "identifiant_direct" || estCleRemplacee(c)) {
    if (ts) {
      const vs = colonneDe(ts, c.nom) || [];
      const num = estNumerique(vs) && estNumerique(vm);
      const ens = new Set(vs.map(v => normer(v, num)).filter(v => v !== null));
      const rangs = vm.map((v, i) => [i, normer(v, num)]).filter(([, v]) => v !== null && ens.has(v)).map(([i]) => i);
      if (rangs.length) { dejaSignalees.add(ou); add("bloquant", "AN3", `${ou} : ${rangs.length} valeur(s) masquée(s) ÉGALE(S) à une valeur de la colonne source — un identifiant gardé désigne la personne (enregistrements ${premiers(rangs)} de ${c.table}.${forme})`, `${c.table}.${forme}`); }
    }
  }
  if (c.synthetique === "courriel") {
    const rangs = vm.map((v, i) => [i, v]).filter(([, v]) => !vide(v) && !(/@([^@\s]+)$/.test(v) && DOMAINE_RESERVE.test(v.split("@").pop()))).map(([i]) => i);
    if (rangs.length) add("bloquant", "AN3", `${ou} : ${rangs.length} courriel(s) de remplacement hors domaine réservé (RFC 2606 : .test, .example, .invalid, .localhost, example.com/.net/.org) — un courriel de développement ne doit jamais pouvoir partir (enregistrements ${premiers(rangs)})`, `${c.table}.${forme}`);
  }
}
if (courrielsSource.size) for (const [nom, tm] of masque) tm.colonnes.forEach((col, j) => {
  if (dejaSignalees.has(`${nom}.${col}`)) return;
  const rangs = tm.lignes.map((r, i) => [i, r[j]]).filter(([, v]) => !vide(v) && courrielsSource.has(v.toLowerCase())).map(([i]) => i);
  if (rangs.length) add("bloquant", "AN3", `${nom}.${col} : ${rangs.length} cellule(s) portent tel quel un courriel de la source (enregistrements ${premiers(rangs)})`, `${nom}.${forme}`);
});

// ---- AN4 · pseudonymisation refusée --------------------------------------------------------------
for (const [ou, c] of colDecl) if (FAMILLE_PSEUDO.includes(strategieDe(c).toLowerCase()))
  add("bloquant", "AN4", `${ou} : stratégie « ${strategieDe(c)} » — une pseudonymisation (hachage, chiffrement, table de correspondance, jeton) garde un lien calculable vers la personne ; elle n'est pas une anonymisation (WP216 §4)`, cheminDecl);
for (const k of ["graine", "cle", "cle_secrete", "sel"]) if (d[k] !== undefined) add("bloquant", "AN4", `la déclaration porte « ${k} » : une clé conservée avec l'extrait le rend réversible`, cheminDecl);
if (!GRAINES_ADMISES.includes(m.graine)) add("bloquant", "AN4", `rapport : graine « ${m.graine === undefined ? "(absente)" : "valeur écrite"} » — le rapport dit seulement si une graine a existé (${GRAINES_ADMISES.join(", ")}) ; une graine écrite à côté de l'extrait est une clé de pseudonymisation`, manifeste);
else if (m.graine === "fournie_non_conservee") add("avertissement", "AN4", "graine fournie : l'extrait est reproductible par qui la détient — elle se garde comme une clé et se détruit après usage", manifeste);
for (const [ou, c] of colDecl) {
  const tm = masque.get(c.table);
  if (!tm || !PERSONNELLES.has(c.classe) || strategieDe(c) === "supprimer") continue;
  const vm = (colonneDe(tm, c.nom) || []).filter(v => !vide(v));
  if (vm.length >= 3) for (const re of EMPREINTES) {
    const n = vm.filter(v => re.test(v)).length;
    if (n >= 3 && n / vm.length >= 0.5) { add("bloquant", "AN4", `${ou} : ${n} valeur(s) sur ${vm.length} ont la forme d'une EMPREINTE (hachage) — une empreinte se recalcule depuis la valeur source : c'est une pseudonymisation`, `${c.table}.${forme}`); break; }
  }
  const ts = source.get(c.table);
  if (ts && strategieDe(c) === "remplacer" && !estCleRemplacee(c) && c.synthetique !== "constante") {
    const cs = [...compter((colonneDe(ts, c.nom) || []).filter(v => !vide(v))).values()].sort((a, b) => b - a);
    const cm = [...compter(vm).values()].sort((a, b) => b - a);
    if (cs.length >= 2 && cs[0] >= 2 && cm.length && cm[0] >= 2 && cm.length >= 0.5 * cs.length && cm.length <= cs.length && cm.every((n, i) => n <= cs[i]))
      add("bloquant", "AN4", `${ou} : le remplacement SUIT les répétitions de la source valeur pour valeur (${cm.length} valeurs masquées distinctes, profil de fréquences dominé par celui de la source) — un remplacement déterministe est une pseudonymisation`, `${c.table}.${forme}`);
  }
}

// ---- classes d'équivalence (AN5, AN7) ------------------------------------------------------------
const s = d.seuils || {};
const kDecl = s.k, lDecl = s.l;
if (!Number.isInteger(kDecl) || kDecl < SEUILS_FORGE.k_min) add("bloquant", "AN5", `seuils.k = ${kDecl} : entier ≥ ${SEUILS_FORGE.k_min} exigé — plancher de la forge (taille minimale de classe la plus courante des précédents de diffusion non publique)`, cheminDecl);
if (!Number.isInteger(lDecl) || lDecl < SEUILS_FORGE.l_min) add("bloquant", "AN7", `seuils.l = ${lDecl} : entier ≥ ${SEUILS_FORGE.l_min} exigé — plancher de la forge (le seuil qui défait l'inférence certaine)`, cheminDecl);
if (s.t !== undefined && !(typeof s.t === "number" && s.t > 0 && s.t <= 1)) add("bloquant", "AN7", `seuils.t = ${s.t} : nombre dans ]0 ; 1] attendu`, cheminDecl);
const k = Number.isInteger(kDecl) && kDecl >= SEUILS_FORGE.k_min ? kDecl : SEUILS_FORGE.k_min;
const l = Number.isInteger(lDecl) && lDecl >= SEUILS_FORGE.l_min ? lDecl : SEUILS_FORGE.l_min;
const tDecl = typeof s.t === "number" && s.t > 0 && s.t <= 1 ? s.t : null;
for (const t of actives) {
  const tm = masque.get(t.nom); if (!tm) continue;
  const presentes = (role) => (t.colonnes || []).filter(c => c && c.classe === role && strategieDe(c) !== "supprimer" && tm.colonnes.includes(c.nom)).map(c => c.nom);
  const Q = presentes("quasi_identifiant"), S = presentes("attribut_sensible");
  if (!Q.length && !S.length) continue;
  const ix = (c) => tm.colonnes.indexOf(c);
  if (t.personne !== undefined && !tm.colonnes.includes(t.personne)) { add("bloquant", "AN5", `table « ${t.nom} » : la colonne personne « ${t.personne} » manque à l'extrait masqué — les personnes ne se comptent pas`, `${t.nom}.${forme}`); continue; }
  const classes = new Map();
  tm.lignes.forEach((r, i) => { const cle = JSON.stringify(Q.map(c => r[ix(c)])); if (!classes.has(cle)) classes.set(cle, []); classes.get(cle).push(i); });
  const e = { lignes: tm.lignes.length, quasi_identifiants: Q, attributs_sensibles: S, personne: t.personne ?? null, classes: classes.size };
  if (Q.length) {
    const tailles = [...classes.values()].map(rs => ({ rs, n: t.personne !== undefined ? new Set(rs.map(i => tm.lignes[i][ix(t.personne)] ?? "∅")).size : rs.length }));
    e.k_mesure = tailles.length ? Math.min(...tailles.map(x => x.n)) : null;
    const petites = tailles.filter(x => x.n < k);
    if (petites.length) {
      const rangs = petites.flatMap(x => x.rs).sort((a, b) => a - b);
      add("bloquant", "AN5", `${t.nom} : ${petites.length} classe(s) d'équivalence de moins de k = ${k} ${t.personne !== undefined ? "personnes" : "lignes"} (plus petite : ${e.k_mesure}) — ${rangs.length} ligne(s) restent individualisables (enregistrements ${premiers(rangs)})`, `${t.nom}.${forme}`);
    } else add("info", "AN5", `${t.nom} : k mesuré = ${e.k_mesure} sur ${classes.size} classe(s) (${t.personne !== undefined ? "personnes distinctes" : "lignes"}), quasi-identifiants ${Q.join(", ")}`, `${t.nom}.${forme}`);
    if (t.personne === undefined) add("avertissement", "AN5", `${t.nom} : aucune colonne « personne » déclarée — k est compté en LIGNES, et une personne à plusieurs lignes gonfle sa classe`, cheminDecl);
  }
  if (S.length) {
    e.l_mesure = {}; e.t_mesure = {};
    for (const c of S) {
      const glob = compter(tm.lignes.map(r => r[ix(c)] ?? "∅"));
      let lMin = Infinity, tMax = 0; const fautivesL = [], fautivesT = [];
      for (const rs of classes.values()) {
        const rep = compter(rs.map(i => tm.lignes[i][ix(c)] ?? "∅"));
        lMin = Math.min(lMin, rep.size);
        if (rep.size < l) fautivesL.push(rs);
        if (glob.size <= SEUILS_FORGE.categories_max_t) {
          let dv = 0; for (const v of new Set([...rep.keys(), ...glob.keys()])) dv += Math.abs((rep.get(v) || 0) / rs.length - (glob.get(v) || 0) / tm.lignes.length);
          dv /= 2; tMax = Math.max(tMax, dv);
          if (tDecl !== null && dv > tDecl + 1e-9) fautivesT.push(rs);
        }
      }
      e.l_mesure[c] = lMin === Infinity ? null : lMin;
      if (glob.size <= SEUILS_FORGE.categories_max_t) e.t_mesure[c] = Math.round(tMax * 1e4) / 1e4;
      if (fautivesL.length) { const rangs = fautivesL.flat().sort((a, b) => a - b); add("bloquant", "AN7", `${t.nom}.${c} : ${fautivesL.length} classe(s) comptent moins de l = ${l} valeurs distinctes (plus petite : ${e.l_mesure[c]}) — qui sait qu'une personne est dans la classe en DÉDUIT la valeur sensible (enregistrements ${premiers(rangs)})`, `${t.nom}.${forme}`); }
      else add("info", "AN7", `${t.nom}.${c} : l mesuré = ${e.l_mesure[c]} sur ${classes.size} classe(s)`, `${t.nom}.${forme}`);
      if (fautivesT.length) { const rangs = fautivesT.flat().sort((a, b) => a - b); add("bloquant", "AN7", `${t.nom}.${c} : ${fautivesT.length} classe(s) s'écartent de la répartition de la table de plus de t = ${tDecl} (écart maximal ${e.t_mesure[c]}) — la classe révèle une valeur sensible avec une forte probabilité (enregistrements ${premiers(rangs)})`, `${t.nom}.${forme}`); }
      else if (glob.size <= SEUILS_FORGE.categories_max_t) add("info", "AN7", `${t.nom}.${c} : t mesuré = ${e.t_mesure[c]}${tDecl === null ? " (aucun seuil t déclaré : l'inférence probabiliste n'est pas refusée)" : ` ≤ ${tDecl}`}`, `${t.nom}.${forme}`);
      else add("info", "AN7", `${t.nom}.${c} : t non mesuré, attribut continu (${glob.size} valeurs distinctes)`, `${t.nom}.${forme}`);
    }
  }
  mesures[t.nom] = e;
}

// ---- AN6 · corrélation ---------------------------------------------------------------------------
let jMax = 0;
if (s.jointure_max !== undefined) {
  if (typeof s.jointure_max === "number" && s.jointure_max >= 0 && s.jointure_max <= SEUILS_FORGE.jointure_max) jMax = s.jointure_max;
  else add("bloquant", "AN6", `seuils.jointure_max = ${s.jointure_max} : nombre dans [0 ; ${SEUILS_FORGE.jointure_max}] attendu (plafond de la forge)`, cheminDecl);
}
const personnelles = new Set(actives.filter(t => (t.colonnes || []).some(c => c && PERSONNELLES.has(c.classe))).map(t => t.nom));
for (let change = true; change;) {
  change = false;
  for (const [, c] of colDecl) if (c.reference && strategieDe(c) !== "supprimer" && !personnelles.has(c.table) && personnelles.has(String(c.reference).split(".")[0])) { personnelles.add(c.table); change = true; }
}
// Toute stratégie qui laisse une valeur, généralisation comprise : une généralisation qui ne
// généralise rien (une date sans heure ramenée au jour) garde la valeur source. Pour un
// quasi-identifiant, le k-anonymat garantit déjà au moins k occurrences de chaque valeur masquée.
for (const [ou, c] of colDecl) {
  if (!personnelles.has(c.table) || c.classe === "identifiant_direct" || estCleRemplacee(c)) continue;
  if (!["conserver", "bruiter", "agreger", "remplacer", "generaliser"].includes(strategieDe(c))) continue;
  const tm = masque.get(c.table), ts = source.get(c.table);
  if (!tm || !ts) continue;
  const vm = colonneDe(tm, c.nom), vs = colonneDe(ts, c.nom);
  if (!vm || !vs) continue;
  const num = estNumerique(vs) && estNumerique(vm);
  const nS = compter(vs.map(v => normer(v, num))), nM = compter(vm.map(v => normer(v, num)));
  const nonVides = vm.filter(v => !vide(v)).length;
  const rangs = vm.map((v, i) => [i, normer(v, num)]).filter(([, v]) => v !== null && (nS.get(v) || 0) > 0 && nS.get(v) < k && nM.get(v) < k).map(([i]) => i);
  const part = nonVides ? rangs.length / nonVides : 0;
  mesures[c.table] = mesures[c.table] || {};
  mesures[c.table].jointure = { ...(mesures[c.table].jointure || {}), [c.nom]: Math.round(part * 1e4) / 1e4 };
  if (part > jMax + 1e-12)
    add("bloquant", "AN6", `${ou} : ${rangs.length} ligne(s) masquée(s) sur ${nonVides} (${(100 * part).toFixed(1)} %) se relient à moins de k = ${k} lignes source par cette seule colonne — une clé de jointure vers la production (enregistrements ${premiers(rangs)}) ; bruiter, généraliser ou regrouper`, `${c.table}.${forme}`);
}

// ---- AN8 · texte libre ---------------------------------------------------------------------------
for (const [ou, c] of colDecl) {
  if (c.classe !== "texte_libre") continue;
  if (!["supprimer", "remplacer"].includes(strategieDe(c)) && !pseudo(c)) add("bloquant", "AN8", `${ou} : texte libre déclaré « ${strategieDe(c)} » — une saisie libre porte n'importe quoi (nom, téléphone, diagnostic) ; elle se supprime ou se remplace`, cheminDecl);
  const tm = masque.get(c.table), ts = source.get(c.table);
  if (!tm || !ts || strategieDe(c) === "supprimer") continue;
  const vm = colonneDe(tm, c.nom), vs = colonneDe(ts, c.nom);
  if (!vm || !vs) continue;
  const ens = new Set(vs.filter(v => !vide(v)));
  const rangs = vm.map((v, i) => [i, v]).filter(([, v]) => !vide(v) && ens.has(v)).map(([i]) => i);
  if (rangs.length) add("bloquant", "AN8", `${ou} : ${rangs.length} texte(s) libre(s) masqué(s) identique(s) à un texte de la source (enregistrements ${premiers(rangs)})`, `${c.table}.${forme}`);
}

// ---- AN9 · intégrité référentielle ---------------------------------------------------------------
for (const [ou, c] of colDecl) {
  if (c.reference === undefined || strategieDe(c) === "supprimer") continue;
  const cibleDecl = colDecl.get(String(c.reference));
  if (!cibleDecl) { add("bloquant", "AN9", `${ou} : reference « ${c.reference} » ne résout à aucune colonne d'une table active`, cheminDecl); continue; }
  const cibleRemplacee = estCleRemplacee(cibleDecl);
  if (cibleRemplacee && strategieDe(c) !== "remplacer") add("bloquant", "AN9", `${ou} : la cible ${c.reference} est remplacée, la référence doit l'être aussi`, cheminDecl);
  if (strategieDe(cibleDecl) === "conserver" && strategieDe(c) !== "conserver") add("bloquant", "AN9", `${ou} : la cible ${c.reference} est conservée, la référence doit l'être aussi`, cheminDecl);
  if (!cibleRemplacee && strategieDe(cibleDecl) !== "conserver") add("bloquant", "AN9", `${ou} : la cible ${c.reference} n'est ni une clé remplacée ni une colonne conservée — l'intégrité ne se garde pas`, cheminDecl);
  const tm = masque.get(c.table), tc = masque.get(cibleDecl.table);
  if (!tm || !tc) continue;
  const vm = colonneDe(tm, c.nom), vc = colonneDe(tc, cibleDecl.nom);
  if (!vm || !vc) { add("bloquant", "AN9", `${ou} : colonne ou cible absente de l'extrait masqué`, `${c.table}.${forme}`); continue; }
  const cibles = vc.filter(v => !vide(v));
  const ens = new Set(cibles);
  if (ens.size !== cibles.length) add("bloquant", "AN9", `${c.reference} : ${cibles.length - ens.size} doublon(s) dans la colonne cible — une référence ne pointe que vers une valeur unique`, `${cibleDecl.table}.${forme}`);
  const rangs = vm.map((v, i) => [i, v]).filter(([, v]) => !vide(v) && !ens.has(v)).map(([i]) => i);
  if (rangs.length) add("bloquant", "AN9", `${ou} : ${rangs.length} référence(s) vers une ligne ABSENTE de ${c.reference} masquée (enregistrements ${premiers(rangs)})`, `${c.table}.${forme}`);
}

// ---- AN10 · comptes recalculés -------------------------------------------------------------------
const supMax = s.suppression_max === undefined ? 0 : s.suppression_max;
if (!(typeof supMax === "number" && supMax >= 0 && supMax < 1)) add("bloquant", "AN10", `seuils.suppression_max = ${s.suppression_max} : nombre dans [0 ; 1[ attendu`, cheminDecl);
for (const t of actives) {
  const tm = masque.get(t.nom), ts = source.get(t.nom);
  if (!tm || !ts) continue;
  const r = m.tables && m.tables[t.nom];
  const nS = ts.lignes.length, nM = tm.lignes.length;
  (mesures[t.nom] = mesures[t.nom] || {}).lignes_source = nS;
  mesures[t.nom].lignes = nM;
  if (!r) { add("bloquant", "AN10", `rapport : aucune entrée pour la table « ${t.nom} »`, manifeste); continue; }
  if (r.lignes_source !== nS) add("bloquant", "AN10", `${t.nom} : le rapport annonce ${r.lignes_source} ligne(s) source, la source en compte ${nS}`, manifeste);
  if (r.lignes_masque !== nM) add("bloquant", "AN10", `${t.nom} : le rapport annonce ${r.lignes_masque} ligne(s) masquée(s), l'extrait en compte ${nM}`, manifeste);
  const retirees = (r.supprimees_classe || 0) + (r.supprimees_cascade || 0);
  if (retirees !== nS - nM) add("bloquant", "AN10", `${t.nom} : le rapport annonce ${retirees} ligne(s) retirée(s), la différence mesurée est ${nS - nM}`, manifeste);
  if (nM > nS) add("bloquant", "AN10", `${t.nom} : l'extrait masqué compte plus de lignes que la source`, `${t.nom}.${forme}`);
  if (nS && (nS - nM) / nS > supMax + 1e-12) add("bloquant", "AN10", `${t.nom} : ${nS - nM} ligne(s) retirée(s) sur ${nS} (${(100 * (nS - nM) / nS).toFixed(1)} %), au-delà de suppression_max = ${(100 * supMax).toFixed(1)} %`, `${t.nom}.${forme}`);
  const annonce = m.mesures && m.mesures[t.nom], mes = mesures[t.nom];
  if (annonce && mes) {
    if (annonce.k_atteint !== undefined && mes.k_mesure !== undefined && annonce.k_atteint !== mes.k_mesure) add("bloquant", "AN10", `${t.nom} : le rapport annonce k = ${annonce.k_atteint}, l'oracle mesure ${mes.k_mesure}`, manifeste);
    for (const [c, v] of Object.entries(annonce.l_atteint || {})) if (mes.l_mesure && mes.l_mesure[c] !== undefined && mes.l_mesure[c] !== v) add("bloquant", "AN10", `${t.nom}.${c} : le rapport annonce l = ${v}, l'oracle mesure ${mes.l_mesure[c]}`, manifeste);
    for (const [c, v] of Object.entries(annonce.t_mesure || {})) if (mes.t_mesure && mes.t_mesure[c] !== undefined && Math.abs(mes.t_mesure[c] - v) > 1e-3) add("bloquant", "AN10", `${t.nom}.${c} : le rapport annonce t = ${v}, l'oracle mesure ${mes.t_mesure[c]}`, manifeste);
  }
}

fin();
