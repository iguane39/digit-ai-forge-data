#!/usr/bin/env node
// oracle-reconstruire — Domaine « Reconstruction d'un rapport existant : sa mise en page est
// CONSERVÉE, jamais réinventée » (déterministe). TF-1176, 17/09/2026, retour Produit-62 RF-22.
//
// POURQUOI CET ORACLE. Un générateur de rapport a réinventé, deux jours durant, la mise en page
// d'un rapport que le client possédait déjà et avait fourni en entrée du mandat : segments
// réalignés, tableau pleine page, page en 1600 × 900 contre 1280 × 720 à l'origine, sans fond,
// sans titre, sans bouton de réinitialisation, sans signet, sans largeurs de colonnes ni tri —
// alors que le fichier d'entrée portait sa mise en page ENTIÈRE (2 pages, 19 visuels positionnés
// et formatés, 60 largeurs de colonnes, 3 ressources d'image, un thème). Vingt-trois contrôles de
// recette et sept contrôles d'audit rendaient PASS, dont « en-têtes repris au caractère près,
// 70 / 70 » : l'invariant MESURÉ était le texte des en-têtes, l'invariant PROTÉGÉ était « le
// lecteur retrouve SON rapport ». Le destinataire l'a lu deux jours avant de le dire.
//
// RÈGLE DE RECONSTRUCTION DE LA FORGE, que cet oracle rend exécutable : quand le rapport à
// reconstruire EXISTE (PBIX, PBIP, ou tout format qui porte sa mise en page), cette mise en page
// est CONSERVÉE et transposée — seules les liaisons changent ; une mise en page générée n'est
// qu'un REPLI, déclaré comme tel avec son motif, jamais un défaut par omission.
//
// Format `forge-data/reconstruction@1` :
//   { format, id, mode: "transposition" | "repli_genere", motif_du_repli?: "…",
//     tolerance_px: 0,
//     source:  { origine, releve_par, date?, pages: [ { page, largeur, hauteur, ordre?, visible?,
//                 visuels: [ { visuel, type, x, y, largeur, hauteur } ] } ],
//               ressources?: [ "theme.json", … ] },
//     produit: { origine?, pages: [ … même forme … ],
//               ressources?: [ { nom, depuis, referencee } ] },
//     ecarts_assumes?: [ { objet, motif } ] }
//
//   RS1  format + id ; mode dans le jeu fermé ; tolerance_px entier ≥ 0 ; source et produit
//        portent des pages ; la source nomme son ORIGINE et QUI l'a relevée (une mise en page
//        « de référence » sans provenance se recopie du produit qu'elle est censée juger) ;
//   RS2  DOCTRINE DU REPLI : le mode `repli_genere` exige un `motif_du_repli` écrit (≥ 6 mots).
//        Sous ce mode, les écarts de RS3 à RS6 sont COMPTÉS et NOMMÉS en avertissement au lieu
//        de bloquer — le repli est une décision assumée, pas un silence : sans motif, il bloque ;
//   RS3  PAGES : bijection des noms, et pour chaque page appariée mêmes largeur, hauteur, ordre
//        et visibilité (c'est le 1600 × 900 contre 1280 × 720 qui passait inaperçu) ;
//   RS4  VISUELS : bijection par page, et pour chaque visuel apparié mêmes type, x, y, largeur,
//        hauteur, à `tolerance_px` près — la géométrie au pixel, prototype P24 du produit ;
//   RS5  tout objet de la source absent du produit (ou l'inverse) porte son `motif` (≥ 4 mots,
//        convention CV4 / RA4) dans `ecarts_assumes` — sinon écarté et OUBLIÉ sont indiscernables ;
//   RS6  RESSOURCES : chaque ressource de la source est portée par le produit (`depuis`) ET
//        référencée (`referencee: true`) — une ressource copiée que rien ne référence est un fond
//        d'écran que le lecteur ne verra jamais.
// non_juge : le RENDU lui-même (ce que le lecteur voit à l'écran, polices, couleurs, données
// affichées) — une géométrie fidèle ne dit rien de ce qui s'affiche dedans ; la justesse du
// relevé de la source (il se produit en
// lisant le fichier d'origine, chez le produit, jamais ici) ; un rapport construit SANS rapport
// d'origine sort du domaine : il n'y a rien à conserver, et cet oracle n'a rien à dire.
// Usage : node oracle-reconstruire.mjs <reconstruction.json> [--json-only]
import fs from "node:fs";

const DOM = "Reconstruction d'un rapport existant : mise en page conservée, géométrie au pixel, repli déclaré (RS1-RS6)";
const NON_JUGE = [
  "le RENDU lui-même — ce que le lecteur voit à l'écran (polices, couleurs, données affichées) : une géométrie fidèle ne dit rien de ce qui s'affiche dedans ; `oracles/oracle-rendre.mjs` de ce dépôt (TF-1175) pour ce qui se mécanise, et le geste de vérification qu'il exige déclaré pour le reste",
  "la justesse du relevé de la source : il se produit en lisant le fichier d'origine chez le produit, jamais ici — cet oracle compare deux relevés, il n'en lit aucun fichier natif",
  "les objets de FORMATAGE fins (polices, couleurs, largeurs de colonnes, tri) au-delà de la géométrie et des ressources déclarées ici",
  "un rapport construit sans rapport d'origine : il n'y a rien à conserver, et ce domaine ne s'applique pas",
];
const MODES = ["transposition", "repli_genere"];

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const out = (verdict, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-reconstruire", domaine: DOM, artefact: file || null,
    verdict, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "RS1-RS6 sans écart", where: file }],
    non_juge: NON_JUGE, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "RS1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "RS1", "JSON invalide", file); out("FAIL", 1); }

// RS1 — forme
if (d.format !== "forge-data/reconstruction@1") add("bloquant", "RS1", `format « ${d.format} » (attendu forge-data/reconstruction@1)`, file);
if (!d.id) add("bloquant", "RS1", "id de la reconstruction non nommé", file);
const mode = String(d.mode || "").trim();
if (!MODES.includes(mode)) add("bloquant", "RS1", `mode « ${d.mode} » hors du jeu fermé {${MODES.join(", ")}} — une reconstruction dit si elle transpose ou si elle se replie`, file);
const tol = d.tolerance_px;
if (!Number.isInteger(tol) || tol < 0) add("bloquant", "RS1", `tolerance_px « ${tol} » absente ou invalide — l'écart admis se DÉCLARE (0 pour la géométrie au pixel), il ne se devine pas`, file);
const pagesSource = Array.isArray(d.source?.pages) ? d.source.pages : [];
const pagesProduit = Array.isArray(d.produit?.pages) ? d.produit.pages : [];
if (!pagesSource.length) add("bloquant", "RS1", "source.pages absent ou vide — sans relevé du rapport d'origine, il n'y a rien à conserver et rien à juger", file);
if (!pagesProduit.length) add("bloquant", "RS1", "produit.pages absent ou vide", file);
if (!String(d.source?.origine || "").trim()) add("bloquant", "RS1", "source.origine absente — le fichier d'entrée du mandat se nomme (c'est lui qui fait foi sur la mise en page)", file);
if (!String(d.source?.releve_par || "").trim()) add("bloquant", "RS1", "source.releve_par absent — un relevé de référence sans auteur ni outil peut avoir été recopié du produit qu'il juge", file);

// RS2 — la doctrine du repli. Un repli MOTIVÉ est une décision : les écarts sont alors comptés et
// nommés en avertissement. Un repli sans motif est le défaut d'origine — une mise en page
// réinventée que personne n'a décidée — et il bloque.
const repli = mode === "repli_genere";
const motifRepli = String(d.motif_du_repli || "").trim();
const motsRepli = motifRepli ? motifRepli.split(/\s+/).length : 0;
if (repli && motsRepli < 6)
  add("bloquant", "RS2", `mode « repli_genere » avec un motif de ${motsRepli} mot(s) — une mise en page GÉNÉRÉE alors que le rapport d'origine est fourni n'est admise que déclarée et motivée (au moins 6 mots)`, file);
if (!repli && motifRepli)
  add("avertissement", "RS2", "motif_du_repli déclaré en mode « transposition » — sans effet, le repli n'est pas le mode retenu", file);
// Sévérité des constats de comparaison : bloquante en transposition, comptée en repli motivé.
const sevEcart = repli ? "avertissement" : "bloquant";

const ecartsAssumes = Array.isArray(d.ecarts_assumes) ? d.ecarts_assumes : [];
const motifParObjet = new Map();
ecartsAssumes.forEach((e, i) => {
  const ou = `ecarts_assumes #${i + 1}${e.objet ? ` (${e.objet})` : ""}`;
  if (!e.objet) { add("bloquant", "RS5", "écart assumé sans objet nommé", ou); return; }
  const motif = typeof e.motif === "string" ? e.motif.trim() : "";
  if (motif.split(/\s+/).filter(Boolean).length < 4)
    add(sevEcart, "RS5", `écart assumé sur « ${e.objet} » sans motif écrit (au moins 4 mots) — écarté et OUBLIÉ sont indiscernables sans lui`, ou);
  motifParObjet.set(String(e.objet), motif);
});
const assume = objet => motifParObjet.has(objet) && motifParObjet.get(objet).split(/\s+/).filter(Boolean).length >= 4;

// RS3 — les pages : bijection, taille, ordre, visibilité.
const parNom = liste => new Map(liste.filter(p => p && p.page).map(p => [String(p.page), p]));
const src = parNom(pagesSource), prd = parNom(pagesProduit);
let ecartsGeometrie = 0, visuelsCompares = 0;
for (const [nom, ps] of src) {
  const ou = `page ${nom}`;
  const pp = prd.get(nom);
  if (!pp) {
    if (!assume(`page ${nom}`)) { ecartsGeometrie++; add(sevEcart, "RS5", `page « ${nom} » de la source absente du produit et non déclarée dans ecarts_assumes`, ou); }
    continue;
  }
  for (const champ of ["largeur", "hauteur"]) {
    if (ps[champ] !== pp[champ]) { ecartsGeometrie++; add(sevEcart, "RS3", `page « ${nom} » : ${champ} ${pp[champ]} au produit contre ${ps[champ]} à l'origine — le lecteur ne retrouve pas la page qu'il connaît`, ou); }
  }
  if (ps.ordre !== undefined && ps.ordre !== pp.ordre) { ecartsGeometrie++; add(sevEcart, "RS3", `page « ${nom} » : ordre ${pp.ordre} au produit contre ${ps.ordre} à l'origine`, ou); }
  if (ps.visible !== undefined && ps.visible !== pp.visible) { ecartsGeometrie++; add(sevEcart, "RS3", `page « ${nom} » : visibilité ${pp.visible} au produit contre ${ps.visible} à l'origine`, ou); }

  // RS4 — les visuels de cette page : bijection puis géométrie au pixel.
  const vs = new Map((Array.isArray(ps.visuels) ? ps.visuels : []).filter(v => v && v.visuel).map(v => [String(v.visuel), v]));
  const vp = new Map((Array.isArray(pp.visuels) ? pp.visuels : []).filter(v => v && v.visuel).map(v => [String(v.visuel), v]));
  for (const [nv, v] of vs) {
    const ouv = `page ${nom} › visuel ${nv}`;
    const w = vp.get(nv);
    if (!w) {
      if (!assume(`page ${nom} › visuel ${nv}`)) { ecartsGeometrie++; add(sevEcart, "RS5", `visuel « ${nv} » de la source absent du produit et non déclaré dans ecarts_assumes`, ouv); }
      continue;
    }
    visuelsCompares++;
    if (String(v.type || "") !== String(w.type || "")) { ecartsGeometrie++; add(sevEcart, "RS4", `visuel « ${nv} » : type « ${w.type} » au produit contre « ${v.type} » à l'origine`, ouv); }
    for (const champ of ["x", "y", "largeur", "hauteur"]) {
      const a = Number(v[champ]), b = Number(w[champ]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) { ecartsGeometrie++; add(sevEcart, "RS4", `visuel « ${nv} » : ${champ} absent ou non numérique (origine ${v[champ]}, produit ${w[champ]})`, ouv); continue; }
      const ecart = Math.abs(a - b);
      if (ecart > (Number.isInteger(tol) && tol >= 0 ? tol : 0)) { ecartsGeometrie++; add(sevEcart, "RS4", `visuel « ${nv} » : ${champ} ${b} au produit contre ${a} à l'origine (écart ${ecart} px, tolérance ${tol})`, ouv); }
    }
  }
  for (const nv of vp.keys()) {
    if (!vs.has(nv) && !assume(`page ${nom} › visuel ${nv}`)) { ecartsGeometrie++; add(sevEcart, "RS5", `visuel « ${nv} » ajouté par le produit, absent de la source et non déclaré dans ecarts_assumes`, `page ${nom} › visuel ${nv}`); }
  }
}
for (const nom of prd.keys()) {
  if (!src.has(nom) && !assume(`page ${nom}`)) { ecartsGeometrie++; add(sevEcart, "RS5", `page « ${nom} » ajoutée par le produit, absente de la source et non déclarée dans ecarts_assumes`, `page ${nom}`); }
}

// RS6 — les ressources : présentes ET référencées. Une ressource renommée reste rattachée à son
// nom d'origine par `depuis` : les noms courts sont une contrainte de chemin, pas une perte.
const ressourcesSource = Array.isArray(d.source?.ressources) ? d.source.ressources.map(String) : [];
const ressourcesProduit = Array.isArray(d.produit?.ressources) ? d.produit.ressources : [];
const parDepuis = new Map(ressourcesProduit.filter(r => r && r.depuis).map(r => [String(r.depuis), r]));
for (const r of ressourcesSource) {
  const portee = parDepuis.get(r);
  if (!portee) { add(sevEcart, "RS6", `ressource « ${r} » de la source absente du produit — le fond, le thème ou l'image d'un bouton manquant change ce que le lecteur voit`, "ressources"); continue; }
  if (portee.referencee !== true) add(sevEcart, "RS6", `ressource « ${r} » copiée sous « ${portee.nom || "(sans nom)"} » mais jamais RÉFÉRENCÉE par la mise en page — copiée et invisible`, "ressources");
}

if (repli) add("info", "RS2", `mode « repli_genere »${motsRepli >= 6 ? " motivé" : " SANS motif recevable"} : ${ecartsGeometrie} écart(s) de mise en page comptés et nommés ci-dessus en avertissement, jamais tus — la mise en page d'origine n'est pas conservée${motsRepli >= 6 ? ", et c'est une décision déclarée" : ", et personne ne l'a décidé"}`, file);

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0, {
  compte: {
    pages_source: pagesSource.length, pages_produit: pagesProduit.length,
    visuels_compares: visuelsCompares, ecarts_geometrie: ecartsGeometrie,
    ressources_source: ressourcesSource.length, ecarts_assumes: ecartsAssumes.length,
    mode, tolerance_px: tol,
  },
});
