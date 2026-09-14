#!/usr/bin/env node
// isoler-lignes-non-donnees — verbe (TF-0976, 14/09/2026, retour Produit-62 + ledger seq 69).
// LIT un export tabulaire (CSV) et ISOLE les lignes qui ne sont pas des données : ligne vide
// terminale, pied « Filtres appliqués » de Power BI, ligne de totaux. Générateur, pas un oracle.
//
// FAIT MESURÉ : sur les trois feuilles d'un classeur d'export, la lecture naïve comptait
// 21 559 / 21 719 / 14 121 lignes ; les données réelles sont 21 557 / 21 716 / 14 117 — une
// ligne vide et une ligne de pied par feuille. Le pied atterrit dans la PREMIÈRE colonne (les
// autres cellules de sa ligne restent vides) : compté comme donnée, il crée une MODALITÉ
// FANTÔME de la première colonne, et tout dénombrement par cette colonne en rend deux valeurs
// au lieu d'une.
//
// LE SECOND EFFET EST LE PLUS COÛTEUX À IGNORER : ce pied est ce qui dit que l'extrait est un
// INSTANTANÉ FILTRÉ (« Period n'est pas nul, Country_ n'est pas vide ») — sans lui, la PORTÉE de
// l'extrait est invisible. Un extrait dont le contexte n'est pas déclaré est de portée INCONNUE
// (règle de contrat destinée à `oracle-rapprocher.mjs`, TF-0975, qui la juge quand un extrait sert
// de référence). Ce verbe ne juge rien : il LIT et RENDLE DEUX SORTIES, jamais une seule —
// les lignes de données, et le `contexte_de_l_extrait` (les prédicats lus au pied).
//
// CE QUI EST DÉTECTÉ, en balayant les lignes depuis la FIN du fichier (jamais depuis le début —
// un total ou un pied peut légitimement RESSEMBLER à une donnée lue isolément) :
//   - ligne_vide_terminale   : toutes les cellules, une fois découpées, sont vides ;
//   - pied_filtres_appliques : une seule cellule non vide, commençant par « Filtres appliqués » ;
//     son contenu est décomposé en prédicats `{ champ, predicat }` (un par segment séparé par
//     une virgule) et rendu dans `contexte_de_l_extrait.predicats` ;
//   - ligne_totaux           : la première cellule vaut « total » ou « totaux » (insensible à
//     la casse).
// Le balayage S'ARRÊTE à la première ligne qui n'entre dans AUCUN de ces trois cas : une ligne
// de donnée entourée de deux lignes non-données (cas non mesuré à ce jour) resterait donc lue
// comme donnée — limite déclarée, jamais un oubli.
//
// Usage : node isoler-lignes-non-donnees.mjs <extrait.csv> [--sortie <fichier.json>] [--json-only]
// Codes : 0 lignes isolées (données ± contexte) ; 1 échec d'écriture disque ; 2 entrée
// absente/illisible/sans aucune ligne de données — jamais un extrait inventé.
import fs from "node:fs";
import path from "node:path";

const VERBE = "isoler-lignes-non-donnees";
const DOM = "Isolement des lignes non-données d'un export tabulaire (pied « Filtres appliqués », lignes vide et totaux — TF-0976)";

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const jsonOnly = args.includes("--json-only");
const source = args.find(a => !a.startsWith("--"));
const sortieArg = opt("--sortie");

const sortir = (sortie, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ verbe: VERBE, domaine: DOM, source: source || null, sortie, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};

if (!source || !fs.existsSync(source))
  sortir("ECHEC", 2, { erreur: `fichier introuvable : ${source}` });

// Découpage CSV minimal (guillemets doublés pour échapper un guillemet dans un champ cité) —
// suffisant pour un export tabulaire, jamais une bibliothèque tierce (loi n° 4, R-29).
const parseLigne = l => {
  const cells = []; let cur = "", enGuillemets = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (enGuillemets) {
      if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else enGuillemets = false; }
      else cur += c;
    } else if (c === '"') enGuillemets = true;
    else if (c === ",") { cells.push(cur); cur = ""; }
    else cur += c;
  }
  cells.push(cur);
  return cells;
};

const texte = fs.readFileSync(source, "utf8");
const lignesBrutes = texte.split(/\r?\n/);
while (lignesBrutes.length && lignesBrutes[lignesBrutes.length - 1] === "") lignesBrutes.pop();
if (lignesBrutes.length < 2)
  sortir("ECHEC", 2, { erreur: "aucune ligne de données dans le fichier (en-tête seul, ou fichier vide) — rien à isoler" });

const entete = parseLigne(lignesBrutes[0]);
const corps = lignesBrutes.slice(1).map(parseLigne);

const exclues = [];
let fin = corps.length;
while (fin > 0) {
  const row = corps[fin - 1];
  const nonVides = row.map(c => c.trim()).filter(Boolean);
  if (nonVides.length === 0) {
    exclues.unshift({ index: fin, type: "ligne_vide_terminale", brut: lignesBrutes[fin] });
    fin--; continue;
  }
  if (nonVides.length === 1 && /^filtres appliqu[ée]s/i.test(nonVides[0])) {
    exclues.unshift({ index: fin, type: "pied_filtres_appliques", brut: nonVides[0] });
    fin--; continue;
  }
  const premiere = row[0].trim().toLowerCase();
  if (premiere === "total" || premiere === "totaux") {
    exclues.unshift({ index: fin, type: "ligne_totaux", brut: lignesBrutes[fin] });
    fin--; continue;
  }
  break; // première ligne qui n'est ni vide, ni un pied, ni un total : le balayage s'arrête
}

const donnees = corps.slice(0, fin).map(row => Object.fromEntries(entete.map((h, i) => [h, row[i] !== undefined ? row[i] : ""])));

// contexte_de_l_extrait : les prédicats déclarés au pied « Filtres appliqués », jamais
// inventés — absent si aucun pied de ce type n'a été trouvé (extrait de portée non déclarée,
// c'est à `oracle-rapprocher.mjs`, TF-0975, de le dire quand cet extrait sert de référence).
const piedsFiltres = exclues.filter(e => e.type === "pied_filtres_appliques");
let contexteDeLExtrait = null;
if (piedsFiltres.length) {
  const predicats = [];
  for (const p of piedsFiltres) {
    const reste = p.brut.replace(/^filtres appliqu[ée]s\s*:?\s*/i, "");
    for (const segment of reste.split(/\s*,\s*/).filter(Boolean)) {
      const m = segment.match(/^(.*?)\s+((?:n'est pas|est)\s+\S.*)$/i);
      predicats.push(m ? { champ: m[1].trim(), predicat: m[2].trim() } : { champ: null, predicat: segment.trim() });
    }
  }
  contexteDeLExtrait = { predicats, source_pied: piedsFiltres.map(p => p.brut) };
}

const doc = {
  format: "forge-data/extrait-isole@1",
  source: path.relative(process.cwd(), source).replace(/\\/g, "/") || source,
  entete,
  lignes: donnees,
  contexte_de_l_extrait: contexteDeLExtrait,
};

let fichierProduit = null;
if (sortieArg) {
  try { fs.writeFileSync(sortieArg, JSON.stringify(doc, null, 2) + "\n"); }
  catch (e) { sortir("ECHEC", 1, { erreur: `écriture impossible : ${e.message}` }); }
  fichierProduit = sortieArg;
}

sortir("OK", 0, {
  compte: {
    lignes_lues: corps.length, lignes_donnees: donnees.length, lignes_exclues: exclues.length,
    par_type: {
      ligne_vide_terminale: exclues.filter(e => e.type === "ligne_vide_terminale").length,
      pied_filtres_appliques: exclues.filter(e => e.type === "pied_filtres_appliques").length,
      ligne_totaux: exclues.filter(e => e.type === "ligne_totaux").length,
    },
  },
  lignes_exclues: exclues,
  contexte_de_l_extrait: contexteDeLExtrait,
  fichier_produit: fichierProduit,
  document: fichierProduit ? undefined : doc,
});
