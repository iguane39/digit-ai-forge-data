#!/usr/bin/env node
// anonymiser — verbe (TF-2011, 29/10/2026). Décision D-91 (a) du porteur, même jour : la base de
// développement ou de qualification d'un produit peut être alimentée par un extrait de SA
// production, à trois conditions — l'extrait est ANONYMISÉ et non pseudonymisé, un contrôle
// exécuté refuse tout extrait où une personne reste reconnaissable (individualisation, corrélation,
// inférence : avis 05/2014 du groupe de l'article 29, WP216), et les fixtures des forges restent
// synthétiques. Générateur, pas un oracle : le jugement appartient à `oracles/oracle-anonymiser.mjs`,
// qui MESURE l'extrait produit ici sans rien croire de ce que ce verbe déclare.
//
// LE FAIT MESURÉ (étude du pilot du 29/10/2026) : aucune forge ne masquait une base ; le profil
// Supabase documentait un export `--data-only` sans masquage ; deux produits avaient écrit leur
// propre outil hors forge, dont un qui PSEUDONYMISE sous clé — une donnée qui reste personnelle.
//
// ENTRÉES
//   --masquage <masquage.json>  déclaration `forge-data/masquage@1` : CHAQUE colonne de CHAQUE table
//                               classée (jeu fermé CLASSES) et dotée d'une stratégie (jeu fermé
//                               STRATEGIES). Une colonne non classée est un REFUS, jamais un défaut.
//   --source <dossier>          extrait sous forme portable : un fichier par table, `<table>.csv`
//                               (en-tête, NULL = champ vide non cité, "" = chaîne vide citée — la
//                               forme de `\copy … WITH (FORMAT csv, HEADER true)` de PostgreSQL) ou
//                               `<table>.jsonl` (un objet par ligne). Une seule forme par dossier.
//   --sortie <dossier>          dossier NEUF (absent ou vide) : l'extrait masqué, une copie de la
//                               déclaration et le rapport `anonymisation.json`
//                               (`forge-data/anonymisation@1`).
//   --graine <texte>            facultative. Absente : tirée au hasard et JAMAIS écrite — l'extrait
//                               n'est pas reproductible, c'est le mode d'un extrait qui sort. Fournie :
//                               la sortie est identique octet pour octet à chaque passage (recette) ;
//                               elle n'est écrite nulle part, et elle se traite comme une CLÉ — avec
//                               elle et l'ordre de la source, la correspondance se recalcule.
//   --date <ISO>                facultative : date écrite au rapport (défaut : maintenant).
//
// CE QUE LE VERBE FAIT, dans cet ordre
//   1. Refuse toute déclaration incomplète ou fautive (exit 2) : table ou colonne non classée,
//      colonne déclarée absente de la source, stratégie de la famille « pseudonymisation »
//      (hachage, chiffrement, table de correspondance, jeton), identifiant direct conservé, texte
//      libre conservé, k sous le plancher de la forge, domaine de courriel non réservé.
//   2. Applique la stratégie de chaque colonne : supprimer · generaliser (date → jour/mois/
//      trimestre/année/décennie, code postal → département, préfixe, tranche, regroupement) ·
//      remplacer (valeur synthétique TIRÉE, jamais dérivée de la valeur source : clé, courriel sur
//      domaine réservé RFC 2606, nom, texte, constante ; ou `reference` à une clé remplacée) ·
//      bruiter (nombre, date) · agreger (micro-agrégation univariée) · conserver (motif écrit).
//   3. Garde l'intégrité référentielle : une clé remplacée l'est par une correspondance tenue EN
//      MÉMOIRE le temps du passage, jamais écrite ; chaque clé étrangère la suit.
//   4. Retire les lignes des classes d'équivalence qui ne tiennent pas k (individualisation), l ou
//      t (inférence), puis les lignes qui pointaient vers elles (cascade), jusqu'au point fixe —
//      dans la limite `seuils.suppression_max` ; au-delà, REFUS sans rien écrire (exit 1).
//   5. Mélange les lignes de chaque table : la position d'une ligne ne relie plus à sa source.
//
// CE QUE LE VERBE NE FAIT JAMAIS : se connecter à une base ; écrire la graine, une empreinte ou une
// correspondance ; écrire dans le dossier source ; écrire un extrait qui ne tient pas sa propre
// déclaration.
//
// HACHAGE INTERNE, DÉCLARÉ : la graine est dérivée en une clé par flux de tirage par
// `crypto.hkdfSync` (HMAC-SHA-256, RFC 5869) et le flux est produit par AES-256-CTR. Aucune
// empreinte, aucune valeur hachée n'est écrite dans l'extrait ni dans le rapport.
//
// Usage : node scripts/anonymiser.mjs --masquage <f> --source <dossier> --sortie <dossier>
//                                      [--graine <texte>] [--date <ISO>] [--json-only]
// Codes : 0 extrait écrit ; 1 seuils inatteignables dans la limite de suppression (rien d'écrit) ;
//         2 entrée invalide ou déclaration refusée (rien d'écrit).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const VERBE = "anonymiser";
export const FORMAT_MASQUAGE = "forge-data/masquage@1";
export const FORMAT_RAPPORT = "forge-data/anonymisation@1";
export const CLASSES = ["identifiant_direct", "quasi_identifiant", "attribut_sensible", "texte_libre", "technique", "non_personnelle"];
export const CLASSES_PERSONNELLES = ["identifiant_direct", "quasi_identifiant", "attribut_sensible", "texte_libre"];
export const STRATEGIES = ["supprimer", "generaliser", "remplacer", "bruiter", "agreger", "conserver"];
// Une stratégie qui garde un lien calculable vers la valeur source : refusée comme anonymisation
// (WP216 §4 : « pseudonymisation is not a method of anonymisation »).
export const PSEUDONYMISATION = ["pseudonymiser", "pseudonymisation", "hacher", "hachage", "hash", "hmac", "chiffrer",
  "chiffrement", "tokeniser", "tokenisation", "jeton", "table_correspondance", "correspondance"];
// Planchers de la forge, motivés au CLAUDE.md (verbe anonymiser) : k = 5, taille minimale de
// cellule la plus courante des précédents (annexe B de l'IOM 2015, p. 231), pour une diffusion
// NON publique ; l = 2, le seuil qui défait l'inférence CERTAINE (WP216 §3.2.2.1).
export const PLANCHER_K = 5;
export const PLANCHER_L = 2;
export const PLAFOND_JOINTURE = 0.01;
export const CATEGORIES_MAX_T = 50;
export const DOMAINES_RESERVES = /(^|\.)(test|example|invalid|localhost)$|^example\.(com|net|org)$/i;
export const METHODES_GENERALISER = ["date", "code_postal_departement", "prefixe", "tranche", "regroupement"];
export const NIVEAUX_DATE = ["jour", "mois", "trimestre", "annee", "decennie"];
export const SYNTHETIQUES = ["cle", "courriel", "nom", "texte", "constante"];
const MOTS_MIN_MOTIF = 4;

// ---- lecture et écriture des formes portables --------------------------------------------------

/** CSV RFC 4180 : NULL = champ vide NON cité, "" = chaîne vide citée (forme de COPY … CSV). */
export function lireCsv(texte) {
  if (texte.charCodeAt(0) === 0xfeff) texte = texte.slice(1);
  const enregistrements = [];
  let champ = "", cite = false, dansGuillemets = false, ligne = [], debutChamp = true;
  const finChamp = () => { ligne.push(cite ? champ : (champ === "" ? null : champ)); champ = ""; cite = false; debutChamp = true; };
  const finLigne = () => { finChamp(); enregistrements.push(ligne); ligne = []; };
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansGuillemets) {
      if (c === '"') { if (texte[i + 1] === '"') { champ += '"'; i++; } else dansGuillemets = false; }
      else champ += c;
      continue;
    }
    if (c === '"') {
      if (!debutChamp) throw new Error(`guillemet au milieu d'un champ non cité (enregistrement ${enregistrements.length + 1})`);
      dansGuillemets = true; cite = true; debutChamp = false; continue;
    }
    if (c === ",") { finChamp(); continue; }
    if (c === "\r" && texte[i + 1] === "\n") continue;
    if (c === "\n") { finLigne(); continue; }
    champ += c; debutChamp = false;
  }
  if (dansGuillemets) throw new Error("guillemet non refermé en fin de fichier");
  if (champ !== "" || cite || ligne.length) finLigne();
  return enregistrements;
}

const champCsv = (v) => (v === null ? "" : (v === "" || /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v));
export const ecrireCsv = (colonnes, lignes) => [colonnes.map(champCsv).join(","), ...lignes.map(l => l.map(champCsv).join(","))].join("\n") + "\n";

/** Une table lue : { colonnes, lignes (chaînes ou null), typesJson (jsonl seulement) }. */
export function lireTable(fichier, forme) {
  const texte = fs.readFileSync(fichier, "utf8");
  if (forme === "csv") {
    const recs = lireCsv(texte);
    if (!recs.length) throw new Error("fichier vide : l'en-tête manque");
    const colonnes = recs[0];
    if (colonnes.some(c => c === null || c === "")) throw new Error("en-tête avec un nom de colonne vide");
    const lignes = recs.slice(1);
    lignes.forEach((l, i) => { if (l.length !== colonnes.length) throw new Error(`enregistrement ${i + 1} : ${l.length} champ(s) pour ${colonnes.length} colonne(s)`); });
    return { colonnes, lignes, typesJson: null };
  }
  const colonnes = [], index = new Map(), objets = [];
  texte.split(/\r?\n/).forEach((brut, i) => {
    if (!brut.trim()) return;
    const sansChaines = brut.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    if (/(?:^|[^\w.])-?\d{16,}/.test(sansChaines))
      throw new Error(`ligne ${i + 1} : entier de 16 chiffres ou plus — JSON.parse le lirait faux (au-delà de 2^53) ; extraire en CSV`);
    let o;
    try { o = JSON.parse(brut); } catch { throw new Error(`ligne ${i + 1} : JSON invalide`); }
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error(`ligne ${i + 1} : un objet JSON est attendu`);
    for (const k of Object.keys(o)) if (!index.has(k)) { index.set(k, colonnes.length); colonnes.push(k); }
    objets.push(o);
  });
  const typesJson = colonnes.map(() => new Set());
  const lignes = objets.map(o => colonnes.map((k, j) => {
    const v = o[k];
    if (v === null || v === undefined) return null;
    typesJson[j].add(typeof v === "object" ? "objet" : typeof v);
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  }));
  return { colonnes, lignes, typesJson: typesJson.map(s => (s.size === 1 ? [...s][0] : "texte")) };
}

function ecrireJsonl(colonnes, lignes, typesSortie) {
  return lignes.map(l => JSON.stringify(Object.fromEntries(colonnes.map((c, j) => {
    const v = l[j];
    if (v === null) return [c, null];
    if (typesSortie[j] === "number" && /^-?\d+(\.\d+)?$/.test(v)) return [c, Number(v)];
    if (typesSortie[j] === "boolean" && (v === "true" || v === "false")) return [c, v === "true"];
    if (typesSortie[j] === "objet") { try { return [c, JSON.parse(v)]; } catch { return [c, v]; } }
    return [c, v];
  })))).join("\n") + (lignes.length ? "\n" : "");
}

// ---- tirage déterministe pour une graine -------------------------------------------------------

/** Un flux de tirage par étiquette : clé = HKDF-SHA-256(graine, étiquette), flux = AES-256-CTR. */
export function creerFlux(graine, etiquette) {
  const cle = Buffer.from(crypto.hkdfSync("sha256", graine, Buffer.from(`${FORMAT_RAPPORT}|graine`), Buffer.from(etiquette, "utf8"), 32));
  const chiffreur = crypto.createCipheriv("aes-256-ctr", cle, Buffer.alloc(16, 0));
  let tampon = Buffer.alloc(0);
  const octets = (n) => {
    while (tampon.length < n) tampon = Buffer.concat([tampon, chiffreur.update(Buffer.alloc(4096, 0))]);
    const r = tampon.subarray(0, n); tampon = tampon.subarray(n); return r;
  };
  const u32 = () => octets(4).readUInt32BE(0);
  /** Entier uniforme dans [0, n), sans biais de modulo (rejet). */
  const entier = (n) => {
    if (!(n >= 1)) throw new Error(`tirage sur un intervalle vide (${n})`);
    if (n <= 2 ** 32) { const lim = Math.floor(2 ** 32 / n) * n; let x; do x = u32(); while (x >= lim); return x % n; }
    const lim = Math.floor(2 ** 48 / n) * n; let x; do x = octets(6).readUIntBE(0, 6); while (x >= lim); return x % n;
  };
  const reel = () => (u32() * 2 ** 21 + (u32() >>> 11)) / 2 ** 53;
  return { octets, entier, reel };
}

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const jeton = (f, n) => Array.from({ length: n }, () => BASE36[f.entier(36)]).join("");
const CONSONNES = "bcdfghjklmnprstvz";
const VOYELLES = ["a", "e", "i", "o", "u", "ou", "ai", "an", "on"];
const syllabe = (f) => CONSONNES[f.entier(CONSONNES.length)] + VOYELLES[f.entier(VOYELLES.length)];
const motInvente = (f) => { const s = syllabe(f) + syllabe(f) + (f.entier(2) ? syllabe(f) : ""); return s[0].toUpperCase() + s.slice(1); };
const LATIN = ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do", "eiusmod", "tempor",
  "incididunt", "labore", "dolore", "magna", "aliqua", "enim", "minim", "veniam", "quis", "nostrud", "exercitation", "ullamco",
  "laboris", "nisi", "aliquip", "commodo", "consequat", "duis", "aute", "irure", "reprehenderit", "voluptate", "velit", "esse"];
const texteFactice = (f) => { const n = 4 + f.entier(6); const m = Array.from({ length: n }, () => LATIN[f.entier(LATIN.length)]); m[0] = m[0][0].toUpperCase() + m[0].slice(1); return m.join(" ") + "."; };

// ---- règles de transformation ------------------------------------------------------------------

const RE_DATE = /^(\d{4})-(\d{2})-(\d{2})(.*)$/;
const RE_HEURE = /^([ T])(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_ENTIER = /^-?\d+$/;
const RE_NOMBRE = /^-?\d+(\.\d+)?$/;
const pad = (n, l = 2) => String(n).padStart(l, "0");
export const canonNombre = (v) => (v !== null && RE_NOMBRE.test(v) ? String(Number(v)) : v);

/** Généralisation d'une date ou d'un horodatage, en gardant sa forme textuelle (rechargeable). */
export function generaliserDate(v, niveau) {
  const m = RE_DATE.exec(v);
  if (!m) return undefined;
  let [, a, mo, j, reste] = m;
  let annee = Number(a), mois = Number(mo);
  if (niveau === "mois") j = "01";
  else if (niveau === "trimestre") { mois = Math.floor((mois - 1) / 3) * 3 + 1; j = "01"; }
  else if (niveau === "annee") { mois = 1; j = "01"; }
  else if (niveau === "decennie") { annee -= annee % 10; mois = 1; j = "01"; }
  const date = `${pad(annee, 4)}-${pad(mois)}-${j}`;
  if (!reste) return date;
  const h = RE_HEURE.exec(reste);
  if (!h) return undefined;
  return `${date}${h[1]}00:00:00${h[5] || ""}`;
}

export function departement(v) {
  if (!/^\d{5}$/.test(v)) return undefined;
  if (/^9[78]/.test(v)) return v.slice(0, 3) + "00";
  if (v.startsWith("20")) return "20000";
  return v.slice(0, 2) + "000";
}

const decimalesDe = (v) => { const i = v.indexOf("."); return i < 0 ? 0 : v.length - i - 1; };

/** Une date « AAAA-MM-JJ[ HH:MM:SS[+TZ]] » en millisecondes UTC, et retour à la même forme (UTC). */
function versEpoch(v) {
  const m = RE_DATE.exec(v); if (!m) return null;
  const [, a, mo, j, reste] = m;
  if (!reste) return { ms: Date.UTC(+a, +mo - 1, +j), forme: "date" };
  const h = RE_HEURE.exec(reste); if (!h) return null;
  let decalage = 0;
  if (h[5] && h[5] !== "Z") { const s = h[5][0] === "-" ? -1 : 1; const hh = +h[5].slice(1, 3); const mm = h[5].length > 3 ? +h[5].slice(-2) : 0; decalage = s * (hh * 60 + mm) * 60000; }
  return { ms: Date.UTC(+a, +mo - 1, +j, +h[2], +h[3], +(h[4] || 0)) - decalage, forme: "horodatage", sep: h[1], tz: h[5] ? (h[5] === "Z" ? "Z" : "+00") : "" };
}
function depuisEpoch(ms, e) {
  const d = new Date(ms);
  const date = `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (e.forme === "date") return date;
  return `${date}${e.sep}${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}${e.tz}`;
}

// ---- validation de la déclaration ----------------------------------------------------------------

const mots = (s) => (typeof s === "string" ? s.trim().split(/\s+/).filter(Boolean).length : 0);
const nomColonne = (t, c) => `${t}.${c}`;

/** Valide la déclaration seule (sans la source). Rend { erreurs, avertissements, tables }. */
export function validerDeclaration(d) {
  const E = [], A = [];
  if (!d || typeof d !== "object") return { erreurs: ["déclaration illisible"], avertissements: A, tables: [] };
  if (d.format !== FORMAT_MASQUAGE) E.push(`format « ${d.format} » (attendu ${FORMAT_MASQUAGE})`);
  if (!d.id) E.push("id de la déclaration absent");
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(d.date || ""))) E.push("date absente ou hors format ISO");
  if (!d.auteur || !String(d.auteur).trim()) E.push("auteur absent : un classement sans auteur n'est pas opposable");
  for (const cle of ["graine", "cle", "cle_secrete", "sel"]) if (d[cle] !== undefined) E.push(`la déclaration porte « ${cle} » : une clé ou une graine conservée avec l'extrait est une clé de pseudonymisation`);
  const s = d.seuils || {};
  if (!Number.isInteger(s.k) || s.k < PLANCHER_K) E.push(`seuils.k = ${s.k} : entier ≥ ${PLANCHER_K} exigé (plancher de la forge)`);
  if (!Number.isInteger(s.l) || s.l < PLANCHER_L) E.push(`seuils.l = ${s.l} : entier ≥ ${PLANCHER_L} exigé (plancher de la forge)`);
  if (s.t !== undefined && !(typeof s.t === "number" && s.t > 0 && s.t <= 1)) E.push(`seuils.t = ${s.t} : nombre dans ]0 ; 1] attendu`);
  if (s.jointure_max !== undefined && !(typeof s.jointure_max === "number" && s.jointure_max >= 0 && s.jointure_max <= PLAFOND_JOINTURE)) E.push(`seuils.jointure_max = ${s.jointure_max} : nombre dans [0 ; ${PLAFOND_JOINTURE}] attendu (plafond de la forge)`);
  if (s.suppression_max !== undefined && !(typeof s.suppression_max === "number" && s.suppression_max >= 0 && s.suppression_max < 1)) E.push(`seuils.suppression_max = ${s.suppression_max} : nombre dans [0 ; 1[ attendu`);
  const tables = Array.isArray(d.tables) ? d.tables : [];
  if (!tables.length) E.push("aucune table déclarée");
  const vues = new Set(), colonnesConnues = new Map();
  for (const t of tables) {
    if (!t || !t.nom) { E.push("table sans nom"); continue; }
    if (vues.has(t.nom)) E.push(`table « ${t.nom} » déclarée deux fois`);
    vues.add(t.nom);
    if (t.exclue === true) { if (mots(t.motif) < MOTS_MIN_MOTIF) E.push(`table « ${t.nom} » exclue sans motif écrit (au moins ${MOTS_MIN_MOTIF} mots)`); continue; }
    const cols = Array.isArray(t.colonnes) ? t.colonnes : [];
    if (!cols.length) E.push(`table « ${t.nom} » : aucune colonne déclarée`);
    const vuesC = new Set();
    for (const c of cols) {
      const ou = nomColonne(t.nom, c && c.nom);
      if (!c || !c.nom) { E.push(`table « ${t.nom} » : colonne sans nom`); continue; }
      if (vuesC.has(c.nom)) E.push(`${ou} déclarée deux fois`);
      vuesC.add(c.nom);
      colonnesConnues.set(ou, { table: t.nom, ...c });
      const strat = String(c.strategie || "");
      if (!CLASSES.includes(c.classe)) E.push(`${ou} : classe « ${c.classe} » hors du jeu fermé {${CLASSES.join(", ")}} — une colonne non classée est un refus`);
      if (PSEUDONYMISATION.includes(strat.toLowerCase())) { E.push(`${ou} : stratégie « ${strat} » = pseudonymisation (lien calculable vers la valeur source), refusée comme anonymisation (WP216 §4)`); continue; }
      if (!STRATEGIES.includes(strat)) { E.push(`${ou} : stratégie « ${strat} » hors du jeu fermé {${STRATEGIES.join(", ")}}`); continue; }
      if (c.classe === "identifiant_direct" && !["supprimer", "remplacer"].includes(strat)) E.push(`${ou} : un identifiant direct se supprime ou se remplace, jamais « ${strat} »`);
      if (c.classe === "texte_libre" && !["supprimer", "remplacer"].includes(strat)) E.push(`${ou} : un texte libre se supprime ou se remplace, jamais « ${strat} »`);
      if (strat === "conserver" && mots(c.motif) < MOTS_MIN_MOTIF) E.push(`${ou} : « conserver » exige un motif écrit (au moins ${MOTS_MIN_MOTIF} mots)`);
      if (strat === "generaliser") {
        if (!METHODES_GENERALISER.includes(c.methode)) E.push(`${ou} : méthode de généralisation « ${c.methode} » hors du jeu {${METHODES_GENERALISER.join(", ")}}`);
        if (c.methode === "date" && !NIVEAUX_DATE.includes(c.niveau)) E.push(`${ou} : niveau « ${c.niveau} » hors du jeu {${NIVEAUX_DATE.join(", ")}}`);
        if (c.methode === "prefixe" && !(Number.isInteger(c.longueur) && c.longueur >= 1)) E.push(`${ou} : « prefixe » exige une longueur entière ≥ 1`);
        if (c.methode === "tranche" && !(typeof c.pas === "number" && c.pas > 0)) E.push(`${ou} : « tranche » exige un pas > 0`);
        if (c.methode === "regroupement") {
          if (!c.groupes || typeof c.groupes !== "object" || !Object.keys(c.groupes).length) E.push(`${ou} : « regroupement » exige des groupes`);
          if (typeof c.defaut !== "string") E.push(`${ou} : « regroupement » exige un « defaut » (la valeur des modalités non listées)`);
          const deja = new Set();
          for (const [g, vals] of Object.entries(c.groupes || {})) {
            if (!Array.isArray(vals) || !vals.length) E.push(`${ou} : groupe « ${g} » vide`);
            for (const v of vals || []) { if (deja.has(v)) E.push(`${ou} : une modalité est rangée dans deux groupes`); deja.add(v); }
          }
          if (Object.values(c.groupes || {}).every(v => Array.isArray(v) && v.length === 1)) E.push(`${ou} : un regroupement dont chaque groupe ne porte qu'une modalité est un renommage, donc une pseudonymisation`);
        }
      }
      if (strat === "remplacer") {
        if (c.reference) { if (c.synthetique) E.push(`${ou} : « reference » et « synthetique » s'excluent`); }
        else if (!SYNTHETIQUES.includes(c.synthetique)) E.push(`${ou} : « remplacer » exige un générateur synthétique du jeu {${SYNTHETIQUES.join(", ")}} ou une « reference »`);
        if (c.synthetique === "constante" && typeof c.valeur !== "string") E.push(`${ou} : « constante » exige une « valeur » textuelle`);
        if (c.synthetique === "courriel" && c.domaine !== undefined && !DOMAINES_RESERVES.test(String(c.domaine))) E.push(`${ou} : domaine « ${c.domaine} » non réservé — un courriel de remplacement vit sur un domaine réservé (RFC 2606 : .test, .example, .invalid, .localhost, example.com/.net/.org)`);
        if (c.synthetique === "cle" && c.plage !== undefined && !(Array.isArray(c.plage) && c.plage.length === 2 && c.plage.every(Number.isSafeInteger) && c.plage[0] <= c.plage[1])) E.push(`${ou} : « plage » attend [min, max] entiers`);
      }
      if (strat === "bruiter") {
        const nb = ["amplitude", "amplitude_relative", "amplitude_jours"].filter(k => c[k] !== undefined);
        if (nb.length !== 1) E.push(`${ou} : « bruiter » exige UNE amplitude parmi amplitude, amplitude_relative, amplitude_jours`);
        for (const k of nb) if (!(typeof c[k] === "number" && c[k] > 0)) E.push(`${ou} : ${k} doit être un nombre > 0`);
        if (c.amplitude_jours !== undefined && !Number.isInteger(c.amplitude_jours)) E.push(`${ou} : amplitude_jours doit être entière`);
      }
      if (strat === "agreger") {
        if (c.methode !== "micro_agregation") E.push(`${ou} : « agreger » connaît la méthode micro_agregation`);
        if (!(Number.isInteger(c.taille_groupe) && c.taille_groupe >= 2)) E.push(`${ou} : taille_groupe entière ≥ 2 exigée`);
        else if (Number.isInteger(s.k) && c.taille_groupe < s.k) A.push(`${ou} : taille_groupe ${c.taille_groupe} < k = ${s.k} — un groupe plus petit que k reste reliable`);
      }
      if (c.reference !== undefined && !/^[^.]+\.[^.]+$/.test(String(c.reference))) E.push(`${ou} : reference « ${c.reference} » attendue sous la forme table.colonne`);
    }
    if (t.personne !== undefined && !vuesC.has(t.personne)) E.push(`table « ${t.nom} » : personne « ${t.personne} » n'est pas une colonne déclarée`);
  }
  // Références : la cible existe, est une clé remplacée (ou suit une référence) ou une colonne conservée.
  for (const [ou, c] of colonnesConnues) {
    if (!c.reference) continue;
    const cible = colonnesConnues.get(c.reference);
    if (!cible) { E.push(`${ou} : reference « ${c.reference} » ne résout à aucune colonne déclarée`); continue; }
    if (c.strategie === "supprimer") continue;
    const cibleRemplacee = cible.strategie === "remplacer" && (cible.synthetique === "cle" || cible.reference);
    if (cibleRemplacee && c.strategie !== "remplacer") E.push(`${ou} : la cible ${c.reference} est remplacée, la référence doit l'être aussi (remplacer)`);
    if (cible.strategie === "conserver" && c.strategie !== "conserver") E.push(`${ou} : la cible ${c.reference} est conservée, la référence doit l'être aussi (conserver)`);
    if (!cibleRemplacee && cible.strategie !== "conserver") E.push(`${ou} : la cible ${c.reference} n'est ni une clé remplacée ni une colonne conservée — l'intégrité référentielle ne se garde pas`);
  }
  for (const [ou, c] of colonnesConnues) {
    const nom = String(c.nom).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (["technique", "non_personnelle"].includes(c.classe) && /(^|_)(nom|prenom|email|e?mail|courriel|tel|telephone|phone|mobile|adresse|address|rue|naissance|birth|dob|iban|bic|nir|secu|ssn|ip|login|password|mot_de_passe)(_|$)/.test(nom))
      A.push(`${ou} : classée « ${c.classe} » alors que son nom évoque une donnée personnelle — classement à revoir`);
  }
  return { erreurs: E, avertissements: A, tables, colonnes: colonnesConnues };
}

/** Ordre de rechargement (parents d'abord) ; null si un cycle entre tables l'empêche. */
export function ordreChargement(tablesActives, colonnes) {
  const deps = new Map(tablesActives.map(t => [t, new Set()]));
  for (const c of colonnes.values()) {
    if (!c.reference || c.strategie === "supprimer" || !deps.has(c.table)) continue;
    const cible = c.reference.split(".")[0];
    if (cible !== c.table && deps.has(cible)) deps.get(c.table).add(cible);
  }
  const ordre = [], faits = new Set();
  while (ordre.length < tablesActives.length) {
    const pret = tablesActives.find(t => !faits.has(t) && [...deps.get(t)].every(x => faits.has(x)));
    if (!pret) return null;
    ordre.push(pret); faits.add(pret);
  }
  return ordre;
}

// ---- le passage ----------------------------------------------------------------------------------

class Refus extends Error { constructor(motifs, code = 2) { super(motifs.join(" ; ")); this.motifs = motifs; this.code = code; } }

export function anonymiser({ masquage, source, sortie, graine, date }) {
  // 1. déclaration
  if (!masquage || !fs.existsSync(masquage)) throw new Refus([`déclaration introuvable : ${masquage}`]);
  let d;
  try { d = JSON.parse(fs.readFileSync(masquage, "utf8")); } catch { throw new Refus(["déclaration : JSON invalide"]); }
  const v = validerDeclaration(d);
  if (v.erreurs.length) throw new Refus(v.erreurs);
  const avertissements = [...v.avertissements];
  const k = d.seuils.k, l = d.seuils.l, t = d.seuils.t;
  const suppressionMax = d.seuils.suppression_max ?? 0;

  // 2. source
  if (!source || !fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new Refus([`dossier source introuvable : ${source}`]);
  if (!sortie) throw new Refus(["--sortie absent"]);
  const abs = (p) => path.resolve(p).toLowerCase();
  if (abs(sortie) === abs(source) || abs(sortie).startsWith(abs(source) + path.sep.toLowerCase()))
    throw new Refus(["la sortie ne s'écrit jamais dans le dossier source"]);
  if (fs.existsSync(sortie) && fs.readdirSync(sortie).length) throw new Refus([`la sortie ${sortie} existe et n'est pas vide : un extrait masqué s'écrit dans un dossier neuf`]);
  const fichiers = fs.readdirSync(source).filter(f => /\.(csv|jsonl)$/i.test(f));
  const formes = new Set(fichiers.map(f => f.toLowerCase().endsWith(".csv") ? "csv" : "jsonl"));
  if (formes.size > 1) throw new Refus(["le dossier source mêle CSV et JSONL : une seule forme par extrait"]);
  if (!fichiers.length) throw new Refus(["le dossier source ne porte aucune table (.csv ou .jsonl)"]);
  const forme = [...formes][0];
  const declarees = new Map(v.tables.map(x => [x.nom, x]));
  const motifs = [];
  for (const f of fichiers) { const nom = f.replace(/\.(csv|jsonl)$/i, ""); if (!declarees.has(nom)) motifs.push(`table « ${nom} » présente dans la source et absente de la déclaration : ses colonnes ne sont pas classées`); }
  const actives = v.tables.filter(x => x.exclue !== true).map(x => x.nom);
  const donnees = new Map();
  for (const nom of actives) {
    const f = path.join(source, `${nom}.${forme}`);
    if (!fs.existsSync(f)) { motifs.push(`table « ${nom} » déclarée et absente de la source (${nom}.${forme})`); continue; }
    try { donnees.set(nom, lireTable(f, forme)); } catch (e) { motifs.push(`${nom}.${forme} : ${e.message}`); }
  }
  if (motifs.length) throw new Refus(motifs);
  for (const nom of actives) {
    const tab = donnees.get(nom), decl = declarees.get(nom);
    const declCols = new Set(decl.colonnes.map(c => c.nom));
    for (const c of tab.colonnes) if (!declCols.has(c)) motifs.push(`${nom}.${c} : colonne de la source NON CLASSÉE — refus`);
    for (const c of declCols) if (!tab.colonnes.includes(c)) motifs.push(`${nom}.${c} : déclarée et absente de la source — déclaration périmée`);
  }
  if (motifs.length) throw new Refus(motifs);

  const graineOctets = graine !== undefined && graine !== null ? Buffer.from(String(graine), "utf8") : crypto.randomBytes(32);
  const modeGraine = graine !== undefined && graine !== null ? "fournie_non_conservee" : "tiree_au_hasard_non_conservee";
  const colDecl = (table, col) => declarees.get(table).colonnes.find(c => c.nom === col);
  const valeursSource = (table, col) => { const tab = donnees.get(table); const j = tab.colonnes.indexOf(col); return tab.lignes.map(r => r[j]); };

  // Valeurs interdites aux générateurs : toute valeur source d'un identifiant ou d'un texte libre.
  const interdits = new Set();
  for (const nom of actives) for (const c of declarees.get(nom).colonnes)
    if (["identifiant_direct", "texte_libre"].includes(c.classe)) for (const x of valeursSource(nom, c.nom)) if (x) interdits.add(x.toLowerCase());

  // 3. correspondances des clés remplacées (en mémoire seulement)
  const correspondances = new Map();
  for (const nom of actives) for (const c of declarees.get(nom).colonnes) {
    if (c.strategie !== "remplacer" || c.synthetique !== "cle") continue;
    const ou = nomColonne(nom, c.nom);
    const vals = valeursSource(nom, c.nom).filter(x => x !== null && x !== "");
    const distinctes = [...new Set(vals)];
    const ensembleSource = new Set(distinctes);
    const f = creerFlux(graineOctets, `${ou}|cle`);
    const corr = new Map(), pris = new Set();
    const genre = distinctes.every(x => RE_ENTIER.test(x)) ? "entier" : distinctes.every(x => RE_UUID.test(x)) ? "uuid" : "texte";
    let lo = 1, hi = 1;
    if (genre === "entier") {
      const maxAbs = distinctes.reduce((m, x) => Math.max(m, Math.abs(Number(x))), 0);
      [lo, hi] = c.plage || [1, Math.min(2147483647, Math.max(2 * maxAbs, 10 * distinctes.length, 1000))];
      const libres = (hi - lo + 1) - distinctes.filter(x => Number(x) >= lo && Number(x) <= hi).length;
      if (libres < 2 * distinctes.length) throw new Refus([`${ou} : plage [${lo} ; ${hi}] trop étroite pour ${distinctes.length} clés tirées hors des valeurs source`]);
    }
    for (const x of distinctes) {
      let y, essais = 0;
      do {
        if (++essais > 10000) throw new Refus([`${ou} : tirage d'une clé synthétique impossible`]);
        if (genre === "entier") y = String(lo + f.entier(hi - lo + 1));
        else if (genre === "uuid") { const b = Buffer.from(f.octets(16)); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80; const h = b.toString("hex"); y = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; }
        else y = "k" + jeton(f, 12);
      } while (ensembleSource.has(y) || pris.has(y) || interdits.has(y.toLowerCase()));
      pris.add(y); corr.set(x, y);
    }
    correspondances.set(ou, corr);
  }
  const correspondanceDe = (ref, chemin = new Set()) => {
    if (chemin.has(ref)) throw new Refus([`cycle de références autour de ${ref}`]);
    chemin.add(ref);
    if (correspondances.has(ref)) return correspondances.get(ref);
    const [tb, cl] = ref.split(".");
    const c = colDecl(tb, cl);
    return c && c.reference ? correspondanceDe(c.reference, chemin) : null;
  };

  // 4. transformation colonne par colonne
  const compteurs = {};
  const compter = (ou, cle, n = 1) => { compteurs[ou] = compteurs[ou] || {}; compteurs[ou][cle] = (compteurs[ou][cle] || 0) + n; };
  const masquees = new Map();
  const aAgreger = [];
  /** Micro-agrégation univariée sur les lignes VIVANTES : groupes de n valeurs consécutives, chaque
   *  valeur remplacée par la moyenne de son groupe ; une moyenne qui tomberait sur une valeur source
   *  rare (moins de k occurrences) est décalée d'une unité de son dernier chiffre. */
  const agreger = ({ nom, c, jo, j, ou, rare }, comptes) => {
    const m = masquees.get(nom), src = donnees.get(nom).lignes.map(r => r[j]);
    const idx = src.map((x, i) => [i, x]).filter(([i, x]) => m.vivantes[i] && x !== null && x !== "" && RE_NOMBRE.test(x)).sort((p, q) => Number(p[1]) - Number(q[1]) || p[0] - q[0]);
    const n = c.taille_groupe, dp = c.decimales ?? Math.max(0, ...idx.map(([, x]) => decimalesDe(x)));
    const groupes = [];
    for (let g = 0; g < idx.length; g += n) groupes.push(idx.slice(g, g + n));
    if (groupes.length > 1 && groupes[groupes.length - 1].length < n) groupes[groupes.length - 2].push(...groupes.pop());
    for (const g of groupes) {
      const brute = g.reduce((s, [, x]) => s + Number(x), 0) / g.length, u = 10 ** -dp;
      let moy = brute.toFixed(dp);
      for (let e = 1; rare(moy) && e <= 20; e++) moy = (brute + (e % 2 ? 1 : -1) * Math.ceil(e / 2) * u).toFixed(dp);
      if (rare(moy) && comptes) compter(ou, "collisions_restantes");
      for (const [i] of g) m.lignes[i][jo] = moy;
    }
  };
  for (const nom of actives) {
    const tab = donnees.get(nom), decl = declarees.get(nom);
    const sortieCols = decl.colonnes.filter(c => c.strategie !== "supprimer");
    const lignes = tab.lignes.map(() => new Array(sortieCols.length).fill(null));
    sortieCols.forEach((c, jo) => {
      const ou = nomColonne(nom, c.nom);
      const j = tab.colonnes.indexOf(c.nom);
      const src = tab.lignes.map(r => r[j]);
      const f = creerFlux(graineOctets, `${ou}|${c.strategie}`);
      const numerique = src.some(x => x !== null && x !== "") && src.every(x => x === null || x === "" || RE_NOMBRE.test(x));
      const compteSource = new Map();
      for (const x of src) if (x !== null && x !== "") { const cx = numerique ? canonNombre(x) : x; compteSource.set(cx, (compteSource.get(cx) || 0) + 1); }
      const rare = (y) => { const n = compteSource.get(numerique ? canonNombre(y) : y) || 0; return n > 0 && n < k; };
      let sorties;
      switch (c.strategie) {
        case "conserver": sorties = src.slice(); break;
        case "generaliser": sorties = src.map(x => {
          if (x === null || x === "") return x;
          let y;
          if (c.methode === "date") y = generaliserDate(x, c.niveau);
          else if (c.methode === "code_postal_departement") y = departement(x);
          else if (c.methode === "prefixe") y = x.slice(0, c.longueur) + (c.remplissage ?? "0").repeat(Math.max(0, x.length - c.longueur));
          else if (c.methode === "tranche") {
            if (!RE_NOMBRE.test(x)) y = undefined;
            else { const b = Math.floor(Number(x) / c.pas) * c.pas; const dp = decimalesDe(String(c.pas)); const fmt = (n) => (dp ? n.toFixed(dp) : String(Math.round(n))); y = c.forme === "libelle" ? (dp ? `[${fmt(b)} ; ${fmt(b + c.pas)}[` : `${fmt(b)}-${fmt(b + c.pas - 1)}`) : fmt(b); }
          } else if (c.methode === "regroupement") {
            y = c.defaut;
            for (const [g, vals] of Object.entries(c.groupes)) if (vals.includes(x)) { y = g; break; }
          }
          if (y === undefined) { compter(ou, "hors_format"); return c.hors_format ?? null; }
          return y;
        }); break;
        case "remplacer": {
          if (c.reference) {
            const corr = correspondanceDe(c.reference);
            sorties = src.map(x => { if (x === null || x === "") return x; const y = corr.get(x); if (y === undefined) { compter(ou, "references_orphelines"); return null; } return y; });
            break;
          }
          if (c.synthetique === "cle") { const corr = correspondances.get(ou); sorties = src.map(x => (x === null || x === "" ? x : corr.get(x))); break; }
          const pris = new Set();
          const tirer = (gen) => { let y, essais = 0; do { if (++essais > 1000) throw new Refus([`${ou} : génération synthétique impossible sans collision`]); y = gen(); } while (pris.has(y.toLowerCase()) || interdits.has(y.toLowerCase()) || compteSource.has(y)); pris.add(y.toLowerCase()); return y; };
          const domaine = c.domaine || "example.invalid";
          sorties = src.map(x => {
            if (x === null || x === "") return x;
            if (c.synthetique === "constante") return c.valeur;
            if (c.synthetique === "courriel") return tirer(() => `u${jeton(f, 10)}@${domaine}`);
            if (c.synthetique === "nom") return tirer(() => motInvente(f));
            return tirer(() => texteFactice(f));
          });
          break;
        }
        case "bruiter": sorties = src.map(x => {
          if (x === null || x === "") return x;
          if (c.amplitude_jours !== undefined) {
            const e = versEpoch(x);
            if (!e) { compter(ou, "hors_format"); return null; }
            let y, essais = 0;
            do {
              const pas = e.forme === "date" ? 86400000 : 1000;
              const amp = Math.round(c.amplitude_jours * 86400000 / pas);
              let dlt = f.entier(2 * amp) - amp; if (dlt >= 0) dlt += 1;
              y = depuisEpoch(e.ms + dlt * pas, e);
            } while (rare(y) && ++essais < 20);
            if (rare(y)) compter(ou, "collisions_restantes");
            return y;
          }
          if (!RE_NOMBRE.test(x)) { compter(ou, "hors_format"); return null; }
          const n = Number(x), dp = c.decimales ?? decimalesDe(x);
          const a = c.amplitude !== undefined ? c.amplitude : Math.abs(n) * c.amplitude_relative;
          let y, essais = 0;
          do {
            let z = n + (2 * f.reel() - 1) * a;
            if (Array.isArray(c.bornes)) z = Math.min(Math.max(z, c.bornes[0]), c.bornes[1]);
            y = z.toFixed(dp); if (/^-0(\.0+)?$/.test(y)) y = y.slice(1);
          } while (rare(y) && ++essais < 20);
          if (rare(y)) compter(ou, "collisions_restantes");
          return y;
        }); break;
        case "agreger": {
          // Calculée ici sur toutes les lignes, puis RECALCULÉE sur les seules lignes retenues à
          // chaque tour de suppression (étape 5) : un groupe amputé par un retrait tomberait sinon
          // sous sa taille, et sa moyenne redeviendrait reliable.
          sorties = src.map(x => (x !== null && x !== "" && !RE_NOMBRE.test(x) ? (compter(ou, "hors_format"), null) : x));
          aAgreger.push({ nom, c, jo, j, ou, rare });
          break;
        }
        default: throw new Refus([`${ou} : stratégie non appliquée`]);
      }
      sorties.forEach((y, i) => { lignes[i][jo] = y; });
    });
    masquees.set(nom, { colonnes: sortieCols.map(c => c.nom), lignes, vivantes: lignes.map(() => true), typesJson: tab.typesJson ? sortieCols.map(c => tab.typesJson[tab.colonnes.indexOf(c.nom)]) : null });
  }

  // 5. classes d'équivalence, suppression et cascade jusqu'au point fixe
  const supprimees = Object.fromEntries(actives.map(x => [x, { classe: 0, cascade: 0 }]));
  const quasi = (nom) => declarees.get(nom).colonnes.filter(c => c.classe === "quasi_identifiant" && c.strategie !== "supprimer").map(c => c.nom);
  const sensibles = (nom) => declarees.get(nom).colonnes.filter(c => c.classe === "attribut_sensible" && c.strategie !== "supprimer").map(c => c.nom);
  const mesurer = (nom) => {
    const m = masquees.get(nom), Q = quasi(nom), S = sensibles(nom), P = declarees.get(nom).personne;
    const ix = (c) => m.colonnes.indexOf(c);
    const classes = new Map();
    m.lignes.forEach((r, i) => { if (!m.vivantes[i]) return; const cle = JSON.stringify(Q.map(c => r[ix(c)])); if (!classes.has(cle)) classes.set(cle, []); classes.get(cle).push(i); });
    const repartition = (rangs, c) => { const n = new Map(); for (const i of rangs) { const x = m.lignes[i][ix(c)]; n.set(x, (n.get(x) || 0) + 1); } return n; };
    const tous = m.lignes.map((_, i) => i).filter(i => m.vivantes[i]);
    const globales = new Map(S.map(c => [c, repartition(tous, c)]));
    const res = [];
    for (const rangs of classes.values()) {
      const taille = P ? new Set(rangs.map(i => m.lignes[i][ix(P)] ?? "∅")).size : rangs.length;
      const lParS = {}, tParS = {};
      for (const c of S) {
        const rep = repartition(rangs, c);
        lParS[c] = rep.size;
        const glob = globales.get(c);
        if (glob.size <= CATEGORIES_MAX_T) {
          let dv = 0; const vals = new Set([...rep.keys(), ...glob.keys()]);
          for (const x of vals) dv += Math.abs((rep.get(x) || 0) / rangs.length - (glob.get(x) || 0) / tous.length);
          tParS[c] = dv / 2;
        }
      }
      res.push({ rangs, taille, lParS, tParS });
    }
    return { Q, S, P, classes: res, continus: S.filter(c => globales.get(c).size > CATEGORIES_MAX_T) };
  };
  for (let tour = 0; tour < 50; tour++) {
    let change = false;
    for (const a of aAgreger) agreger(a, false);
    for (const nom of actives) {
      const { Q, S, classes } = mesurer(nom);
      if (!Q.length && !S.length) continue;
      const m = masquees.get(nom);
      for (const cl of classes) {
        const echecK = Q.length && cl.taille < k;
        const echecL = Object.values(cl.lParS).some(x => x < l);
        const echecT = t !== undefined && Object.values(cl.tParS).some(x => x > t + 1e-12);
        if (echecK || echecL || echecT) for (const i of cl.rangs) { m.vivantes[i] = false; supprimees[nom].classe++; change = true; }
      }
    }
    for (const nom of actives) for (const c of declarees.get(nom).colonnes) {
      if (!c.reference || c.strategie === "supprimer") continue;
      const [tc, cc] = c.reference.split(".");
      const mc = masquees.get(tc); if (!mc) continue;
      const jc = mc.colonnes.indexOf(cc);
      const vivantesCible = new Set(mc.lignes.filter((_, i) => mc.vivantes[i]).map(r => r[jc]));
      const m = masquees.get(nom), j = m.colonnes.indexOf(c.nom);
      m.lignes.forEach((r, i) => { if (m.vivantes[i] && r[j] !== null && r[j] !== "" && !vivantesCible.has(r[j])) { m.vivantes[i] = false; supprimees[nom].cascade++; change = true; } });
    }
    if (!change) break;
    if (tour === 49) throw new Refus(["la suppression n'atteint pas de point fixe en 50 tours"], 1);
  }
  for (const a of aAgreger) agreger(a, true);
  const depassements = [];
  for (const nom of actives) {
    const n = donnees.get(nom).lignes.length, s = supprimees[nom].classe + supprimees[nom].cascade;
    if (n && s / n > suppressionMax + 1e-12) {
      const { classes } = mesurer(nom);
      depassements.push(`${nom} : ${s} ligne(s) retirée(s) sur ${n} (${(100 * s / n).toFixed(1)} %), au-delà de suppression_max = ${(100 * suppressionMax).toFixed(1)} % — ${supprimees[nom].classe} pour une classe sous k, l ou t, ${supprimees[nom].cascade} par cascade ; ${classes.length} classe(s) restante(s). Généraliser davantage les quasi-identifiants, ou relever suppression_max en le motivant`);
    }
  }
  if (depassements.length) throw new Refus(depassements, 1);

  // 6. mesures rendues (l'oracle les recalcule, il ne les croit pas)
  const mesures = {};
  for (const nom of actives) {
    const { Q, S, P, classes, continus } = mesurer(nom);
    if (!Q.length && !S.length) continue;
    const e = { quasi_identifiants: Q, attributs_sensibles: S, personne: P ?? null, classes: classes.length };
    if (Q.length) e.k_atteint = classes.length ? Math.min(...classes.map(c => c.taille)) : null;
    if (S.length) {
      e.l_atteint = Object.fromEntries(S.map(c => [c, classes.length ? Math.min(...classes.map(x => x.lParS[c])) : null]));
      e.t_mesure = Object.fromEntries(S.filter(c => !continus.includes(c)).map(c => [c, classes.length ? Math.round(Math.max(...classes.map(x => x.tParS[c])) * 1e4) / 1e4 : null]));
      if (continus.length) e.t_non_mesure = continus;
    }
    if (Q.length && !P) avertissements.push(`${nom} : k compté en LIGNES (aucune « personne » déclarée) — une personne à plusieurs lignes gonfle ses classes`);
    mesures[nom] = e;
  }

  // 7. mélange, écriture
  fs.mkdirSync(sortie, { recursive: true });
  const tablesRapport = {};
  for (const nom of actives) {
    const m = masquees.get(nom);
    const vivantes = m.lignes.filter((_, i) => m.vivantes[i]);
    const f = creerFlux(graineOctets, `${nom}|melange`);
    for (let i = vivantes.length - 1; i > 0; i--) { const j = f.entier(i + 1); [vivantes[i], vivantes[j]] = [vivantes[j], vivantes[i]]; }
    const fichier = `${nom}.${forme}`;
    // Type JSON d'une colonne de sortie (forme jsonl) : celui de la source quand la valeur garde
    // sa nature (conservée, clé, nombre bruité ou agrégé, borne de tranche), du texte sinon.
    const typeSortie = (tj, jo) => {
      const c = colDecl(nom, m.colonnes[jo]);
      if (c.strategie === "conserver") return tj;
      if (c.strategie === "remplacer" && (c.synthetique === "cle" || c.reference)) return tj;
      if (["bruiter", "agreger"].includes(c.strategie) && tj === "number") return "number";
      if (c.methode === "tranche" && c.forme !== "libelle" && tj === "number") return "number";
      return "string";
    };
    fs.writeFileSync(path.join(sortie, fichier), forme === "csv" ? ecrireCsv(m.colonnes, vivantes) : ecrireJsonl(m.colonnes, vivantes, m.typesJson.map(typeSortie)), "utf8");
    tablesRapport[nom] = { fichier, lignes_source: donnees.get(nom).lignes.length, lignes_masque: vivantes.length, supprimees_classe: supprimees[nom].classe, supprimees_cascade: supprimees[nom].cascade };
  }
  fs.copyFileSync(masquage, path.join(sortie, "masquage.json"));
  const colonnesRapport = Object.fromEntries(Object.entries(compteurs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const rapport = {
    format: FORMAT_RAPPORT, id: d.id, date: date || new Date().toISOString(),
    outil: "digit-ai-forge-data/scripts/anonymiser.mjs", masquage: "masquage.json",
    source: { dossier: path.relative(sortie, source).split(path.sep).join("/") || ".", forme },
    masque: { dossier: ".", forme },
    graine: modeGraine,
    ordre_chargement: ordreChargement(actives, v.colonnes),
    tables: tablesRapport, mesures, colonnes: colonnesRapport, avertissements,
  };
  if (rapport.ordre_chargement === null) avertissements.push("cycle de clés étrangères entre tables : recharger par sections (pre-data, données, post-data)");
  fs.writeFileSync(path.join(sortie, "anonymisation.json"), JSON.stringify(rapport, null, 2) + "\n", "utf8");
  return rapport;
}

// ---- CLI -----------------------------------------------------------------------------------------
const lanceEnDirect = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase().split("\\").join("/") === path.resolve(process.argv[1]).toLowerCase().split("\\").join("/");
if (lanceEnDirect) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const jsonOnly = args.includes("--json-only");
  const ecrire = (o, code) => { process.stdout.write(JSON.stringify({ verbe: VERBE, ...o }, null, jsonOnly ? 0 : 2) + "\n"); process.exit(code); };
  try {
    const r = anonymiser({ masquage: opt("--masquage"), source: opt("--source"), sortie: opt("--sortie"), graine: opt("--graine"), date: opt("--date") });
    ecrire({ verdict: "ECRIT", sortie: opt("--sortie"), graine: r.graine, tables: r.tables, mesures: r.mesures, avertissements: r.avertissements,
      suite: `juger avant tout chargement : node oracles/oracle-anonymiser.mjs ${path.join(opt("--sortie"), "anonymisation.json")}` }, 0);
  } catch (e) {
    if (e instanceof Refus) ecrire({ verdict: e.code === 1 ? "ECHEC" : "REFUS", motifs: e.motifs, ecrit: false }, e.code);
    ecrire({ verdict: "REFUS", motifs: [String(e && e.message || e)], ecrit: false }, 2);
  }
}
