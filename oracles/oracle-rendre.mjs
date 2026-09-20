#!/usr/bin/env node
// oracle-rendre — Domaine « Un livrable dont l'usage est un RENDU : ce qui se mécanise sans
// ouvrir l'outil, et ce qui ne se mécanise pas se DÉCLARE » (déterministe). TF-1175, 17/09/2026,
// retour Produit-62 RF-21.
//
// POURQUOI CET ORACLE. Un rapport Power BI généré a passé 22 contrôles de recette et 7 contrôles
// d'audit, a été publié sur GO humain, et ne rendait AUCUN visuel : « Chargement de votre
// rapport… » sans fin, export PDF `Succeeded` en 557 à 569 s sur 6 configurations, PDF de 943 à
// 1 415 octets et ZÉRO caractère, quand le rapport du client sur la même capacité s'exporte en
// 41 s et 137 506 octets. La cause : la forme de la référence de source dans les expressions,
// invisible d'un contrôle qui lit le JSON. Le contrôle « en-têtes repris au caractère près,
// 70/70 » rendait PASS sur des en-têtes que PERSONNE ne voyait. Deux jours de mandat, deux
// diagnostics faux, un GO de publication dépensé sur un rapport invisible.
//
// LA FRONTIÈRE, et c'est tout l'objet : un contrôle qui lit le fichier prouve la forme du
// fichier, jamais ce que le lecteur voit. Cet oracle juge donc ce qui se mécanise SANS l'outil —
// les liaisons d'un visuel vers les objets du modèle, l'existence des mesures référencées, les
// visuels qui n'affichent rien — et il EXIGE que le reste, qui demande l'ouverture réelle du
// rapport, soit déclaré comme geste joué et daté (RN5). Ce qui n'est pas mécanisable n'est pas
// pour autant facultatif : il est nommé, ou le livrable n'est pas rendu.
//
// Format `forge-data/rendu@1` :
//   { format, id,
//     mise_en_page: { … forge-data/mise-en-page@1 : pages → visuels → projections … },
//     inventaire?: [ { objet, type: "table"|"colonne"|"mesure" } ],
//     inventaire_ref?: "<couverture@1 à côté de ce fichier>"   (son bloc source.inventaire),
//     gestes_de_verification: [ { geste, fait_le, par?, resultat,
//         nature?: "export_rendu",                    ce geste EST la preuve du rendu (RN6)
//         mesure_export?: { fichier_telecharge, secondes, borne_s, octets, plancher_octets,
//                           pages: [ { page, caracteres } ],
//                           libelles_erreur_cherches: [ … ], libelles_erreur_trouves: [ … ] } } ] }
//
//   RN1  format + id ; mise_en_page au format `forge-data/mise-en-page@1` avec des pages ;
//        inventaire du modèle non vide (inline, ou `inventaire_ref` vers un `couverture@1`
//        existant — celui que `traduire-modele-semantique --inventaire` produit déjà) ;
//   RN2  LIAISONS : toute projection d'un visuel porteur de données résout à un objet de
//        l'inventaire (comparaison INSENSIBLE À LA CASSE, TF-0972) — un champ qui ne résout à
//        rien est un visuel qui n'affichera rien, et aucun contrôle de forme ne le voit ;
//   RN3  MESURES : une projection en `Table[Mesure]` existe à l'inventaire ET y est typée
//        `mesure` — une mesure supprimée du modèle, ou un nom de colonne cité comme mesure,
//        rend le visuel en erreur sans faire échouer la publication ;
//   RN4  VISUELS VIDES : un visuel porteur de données sans aucune projection AFFICHÉE n'affiche
//        rien ; une projection déclarée `active: false` est comptée comme non affichée et dite
//        (elle était l'un des quatre défauts de forme du cas mesuré) ;
//   RN5  LE GESTE QUI NE SE MÉCANISE PAS SE DÉCLARE : au moins un geste de vérification du
//        RENDU RÉEL, chacun avec son libellé (≥ 4 mots), sa date (AAAA-MM-JJ) et son résultat.
//        Sans lui, le livrable est déclaré rendu sur la foi de contrôles qui lisent son fichier —
//        très exactement le défaut de RF-21, et le seul que cet oracle ne peut pas mesurer seul ;
//   RN6  ET LA MESURE DE CE GESTE SE JUGE (TF-1188, retour Produit-62 RF-29 du 18/09/2026). RN5
//        exige un résultat ÉCRIT ; une phrase écrite se contente de « export Succeeded », et c'est
//        littéralement ce qu'affichait le service le 15/09 sur un PDF de 1 415 octets et ZÉRO
//        caractère. Un geste qui déclare `nature: "export_rendu"` porte donc son bloc
//        `mesure_export`, et ce bloc est CHIFFRÉ puis confronté à ses propres bornes : fichier
//        réellement TÉLÉCHARGÉ (le statut du service n'est pas le fichier), durée sous la borne
//        déclarée, octets au-dessus du plancher déclaré, chaque page du fichier exporté porte du
//        texte, et aucun des libellés d'erreur CHERCHÉS n'est trouvé — chercher zéro libellé et
//        n'en trouver aucun ne prouve rien. Mesuré le 18/09 sur le même rapport, après correction :
//        27,0 s, 449 705 octets, 1 page, 2 235 caractères, 0 libellé d'erreur.
// non_juge : CE QUE LE LECTEUR VOIT — le rendu réel (pages affichées, données, polices, couleurs,
// libellés d'erreur du service, durée et poids d'un export) ne s'obtient qu'en ouvrant le rapport
// ou en l'exportant depuis le service, et c'est le geste que RN5 exige déclaré : publier →
// exporter → lire l'image du fichier exporté → verdict (durée sous borne, octets au-dessus du
// plancher, texte extrait non vide par page, aucun libellé d'erreur du service) ;
// la forme native des expressions du rapport (référence de source, alias, en-têtes) — profil
// Power BI de forge-audit, jamais jugé ici ; la FIDÉLITÉ de la mise en page à un rapport
// d'origine — `oracles/oracle-reconstruire.mjs` de ce dépôt (TF-1176) ; la justesse des valeurs
// affichées — `oracles/oracle-reconcilier.mjs` de ce dépôt.
// Usage : node oracle-rendre.mjs <rendu.json> [--json-only]
import fs from "node:fs";
import path from "node:path";

const DOM = "Livrable dont l'usage est un rendu : liaisons, mesures, visuels vides, geste de vérification déclaré et sa mesure d'export jugée (RN1-RN6)";
const NON_JUGE = [
  "CE QUE LE LECTEUR VOIT : le rendu réel (pages affichées, données, polices, couleurs) ne s'obtient qu'en ouvrant le rapport ou en l'exportant depuis le service — c'est le geste que RN5 exige DÉCLARÉ, daté et résulté, et dont RN6 juge la mesure quand elle est portée ; l'oracle ne JOUE aucun export, il confronte des nombres rapportés à leurs bornes déclarées",
  "la forme native des expressions du rapport (référence de source, alias du From, en-têtes de colonnes) — profil Power BI de forge-audit, jamais jugé ici",
  "la FIDÉLITÉ de la mise en page à un rapport d'origine fourni en entrée — `oracles/oracle-reconstruire.mjs` de ce dépôt (TF-1176)",
  "la justesse des valeurs affichées — `oracles/oracle-reconcilier.mjs` de ce dépôt, sur deux lots de mesures sous tolérance",
];
const TYPES_OBJET = ["table", "colonne", "mesure"];
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const out = (verdict, code, extra = {}) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-rendre", domaine: DOM, artefact: file || null,
    verdict, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "RN1-RN6 sans écart", where: file }],
    non_juge: NON_JUGE, ...extra }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "RN1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "RN1", "JSON invalide", file); out("FAIL", 1); }

// RN1 — forme, et l'inventaire du modèle : inline, ou repris d'une couverture@1 déjà relevée.
if (d.format !== "forge-data/rendu@1") add("bloquant", "RN1", `format « ${d.format} » (attendu forge-data/rendu@1)`, file);
if (!d.id) add("bloquant", "RN1", "id du rendu non nommé", file);
const mep = d.mise_en_page;
const pages = Array.isArray(mep?.pages) ? mep.pages : [];
if (!mep || mep.format !== "forge-data/mise-en-page@1")
  add("bloquant", "RN1", `mise_en_page au format « ${mep?.format} » (attendu forge-data/mise-en-page@1)`, file);
if (!pages.length) add("bloquant", "RN1", "mise_en_page sans page — il n'y a rien à rendre", file);

let inventaire = Array.isArray(d.inventaire) ? d.inventaire : null;
if (!inventaire && d.inventaire_ref) {
  const pi = path.join(path.dirname(path.resolve(file)), d.inventaire_ref);
  if (!fs.existsSync(pi)) add("bloquant", "RN1", `inventaire_ref introuvable à côté du rendu : ${d.inventaire_ref}`, file);
  else {
    let cv = null;
    try { cv = JSON.parse(fs.readFileSync(pi, "utf8")); } catch { add("bloquant", "RN1", `inventaire_ref illisible (JSON attendu) : ${d.inventaire_ref}`, file); }
    if (cv && cv.format !== "forge-data/couverture@1") add("bloquant", "RN1", `inventaire_ref au format « ${cv.format} » (attendu forge-data/couverture@1)`, file);
    else if (cv) inventaire = Array.isArray(cv.source?.inventaire) ? cv.source.inventaire : null;
  }
}
if (!inventaire || !inventaire.length)
  add("bloquant", "RN1", "inventaire du modèle absent ou vide (inline ou `inventaire_ref`) — sans lui, aucune liaison ne peut être vérifiée et l'oracle rendrait PASS sur n'importe quoi", file);
const parObjet = new Map();
(inventaire || []).forEach((o, i) => {
  const nom = String(o?.objet || "").trim();
  if (!nom) { add("bloquant", "RN1", "objet d'inventaire sans nom", `inventaire #${i + 1}`); return; }
  if (o.type !== undefined && !TYPES_OBJET.includes(o.type))
    add("bloquant", "RN1", `objet « ${nom} » de type « ${o.type} » hors du jeu fermé {${TYPES_OBJET.join(", ")}}`, `inventaire #${i + 1}`);
  parObjet.set(nom.toLowerCase(), o);
});

// RN2 à RN4 — la mise en page, visuel par visuel. Un visuel `porte_donnees: false` (logo, titre,
// image) ne projette rien par construction : le juger sur ses liaisons serait un faux positif,
// convention déjà tenue par `traduire-modele-semantique --usage-restitution`.
let visuelsDonnees = 0, projectionsJugees = 0, champsInconnus = 0, inactives = 0;
const EST_MESURE = /^(.+)\[(.+)\]$/;
pages.forEach((p, ip) => {
  const nomPage = String(p?.page || `#${ip + 1}`);
  const visuels = Array.isArray(p?.visuels) ? p.visuels : [];
  if (!visuels.length) add("bloquant", "RN4", `page « ${nomPage} » sans aucun visuel — une page vide n'affiche rien`, `page ${nomPage}`);
  visuels.forEach((v, iv) => {
    const nomVisuel = String(v?.visuel || `#${iv + 1}`);
    const ou = `page ${nomPage} › visuel ${nomVisuel}`;
    if (v?.porte_donnees === false) return;
    visuelsDonnees++;
    const projections = Array.isArray(v?.projections) ? v.projections : [];
    const affichees = projections.filter(pr => pr?.active !== false);
    const masquees = projections.length - affichees.length;
    if (masquees > 0) { inactives += masquees; add("avertissement", "RN4", `${masquees} projection(s) déclarée(s) « active: false » — déclarées et jamais affichées, l'un des défauts de forme du cas mesuré`, ou); }
    if (!affichees.length) { add("bloquant", "RN4", `visuel porteur de données sans aucune projection affichée — il n'affichera rien, et aucun contrôle sur le fichier ne le dit`, ou); return; }
    affichees.forEach(pr => {
      const champ = String(pr?.champ || "").trim();
      projectionsJugees++;
      if (!champ) { add("bloquant", "RN2", "projection sans champ nommé", ou); return; }
      const trouve = parObjet.get(champ.toLowerCase());
      if (!trouve) { champsInconnus++; add("bloquant", "RN2", `champ « ${champ} » projeté par ce visuel et absent de l'inventaire du modèle — le visuel n'affichera rien`, ou); return; }
      // RN3 — une projection écrite en `Table[Mesure]` désigne une mesure : l'inventaire doit la
      // typer comme telle. Un nom de colonne cité en mesure rend le visuel en erreur.
      if (EST_MESURE.test(champ) && trouve.type !== undefined && trouve.type !== "mesure")
        add("bloquant", "RN3", `champ « ${champ} » projeté comme une MESURE mais inventorié en « ${trouve.type} » — le visuel sera en erreur sans que la publication échoue`, ou);
    });
  });
});

// RN5 — ce qui exige l'ouverture réelle du rapport. Déclaré, daté, résulté : jamais tu.
// RN6 — et quand ce geste est l'export, ses NOMBRES sont confrontés à leurs bornes.
const gestes = Array.isArray(d.gestes_de_verification) ? d.gestes_de_verification : [];
let mesures = 0;
if (!gestes.length)
  add("bloquant", "RN5", "aucun geste de vérification du RENDU déclaré — un livrable dont l'usage est un rendu ne se déclare pas livré sur des contrôles qui lisent son fichier (publier → exporter → lire l'image de l'export → verdict)", file);
gestes.forEach((g, i) => {
  const ou = `gestes_de_verification #${i + 1}`;
  const libelle = typeof g?.geste === "string" ? g.geste.trim() : "";
  if (libelle.split(/\s+/).filter(Boolean).length < 4)
    add("bloquant", "RN5", `geste de vérification en ${libelle ? libelle.split(/\s+/).length : 0} mot(s) — le geste se NOMME (au moins 4 mots), sinon nul ne peut le rejouer`, ou);
  if (!DATE_ISO.test(String(g?.fait_le || "")))
    add("bloquant", "RN5", `geste « ${libelle.slice(0, 40)} » sans date AAAA-MM-JJ — un geste sans date a pu être joué sur une version antérieure du livrable`, ou);
  if (!String(g?.resultat || "").trim())
    add("bloquant", "RN5", `geste « ${libelle.slice(0, 40)} » sans résultat écrit — un geste joué dont personne ne dit ce qu'il a montré ne prouve rien`, ou);

  // RN6 — la mesure de l'export, quand le geste se déclare comme LA preuve du rendu.
  const m = g?.mesure_export && typeof g.mesure_export === "object" ? g.mesure_export : null;
  if (g?.nature === "export_rendu" && !m) {
    add("bloquant", "RN6", `geste déclaré « export_rendu » sans bloc \`mesure_export\` — un geste qui se présente comme LA preuve du rendu rend ses nombres (durée, octets, texte par page, libellés d'erreur), sinon il rend une phrase`, ou);
    return;
  }
  if (!m) return;
  mesures++;
  const nb = v => (Number.isFinite(Number(v)) ? Number(v) : null);
  if (m.fichier_telecharge !== true)
    add("bloquant", "RN6", "mesure d'export sans `fichier_telecharge: true` — le STATUT rendu par le service n'est pas le fichier : les exports du cas mesuré rendaient `Succeeded` pour 943 à 1 415 octets et zéro caractère", ou);
  const sec = nb(m.secondes), borne = nb(m.borne_s);
  if (sec === null || borne === null || borne <= 0)
    add("bloquant", "RN6", `durée « ${m.secondes} » ou borne « ${m.borne_s} » absente ou non numérique — une durée sans borne déclarée ne se juge pas`, ou);
  else if (sec > borne)
    add("bloquant", "RN6", `export en ${sec} s contre une borne déclarée à ${borne} s — un export qui traîne est le premier symptôme d'une page qui ne rend pas (557 à 569 s au cas mesuré)`, ou);
  const oct = nb(m.octets), plancher = nb(m.plancher_octets);
  if (oct === null || plancher === null || plancher <= 0)
    add("bloquant", "RN6", `octets « ${m.octets} » ou plancher « ${m.plancher_octets} » absent ou non numérique — un poids sans plancher déclaré ne se juge pas`, ou);
  else if (oct < plancher)
    add("bloquant", "RN6", `fichier exporté de ${oct} octets sous le plancher déclaré de ${plancher} — un PDF vide en pesait 1 415 et passait pour un succès`, ou);
  const pagesExport = Array.isArray(m.pages) ? m.pages : [];
  if (!pagesExport.length)
    add("bloquant", "RN6", "mesure d'export sans aucune page lue — le fichier se rend en images et son texte s'extrait page par page, sinon rien n'est lu", ou);
  const vides = pagesExport.filter(p => !(nb(p?.caracteres) > 0)).map((p, i) => String(p?.page ?? i + 1));
  if (vides.length)
    add("bloquant", "RN6", `${vides.length} page(s) du fichier exporté sans aucun caractère : ${vides.map(x => `« ${x} »`).join(" · ")} — c'est le défaut exact du 15/09, un export déclaré réussi que personne ne voyait`, ou);
  const cherches = Array.isArray(m.libelles_erreur_cherches) ? m.libelles_erreur_cherches.filter(x => String(x || "").trim()) : [];
  if (!cherches.length)
    add("bloquant", "RN6", "aucun libellé d'erreur du service CHERCHÉ — chercher zéro libellé et n'en trouver aucun ne prouve rien : le service écrit ses erreurs DANS la page, et un export peut réussir en les rendant à la place des données", ou);
  const trouves = Array.isArray(m.libelles_erreur_trouves) ? m.libelles_erreur_trouves : [];
  if (trouves.length)
    add("bloquant", "RN6", `${trouves.length} libellé(s) d'erreur du service dans le texte rendu : ${trouves.slice(0, 3).map(x => `« ${typeof x === "string" ? x : x?.libelle} »`).join(" · ")} — la page porte du texte, et c'est du texte d'erreur`, ou);
  if (!F.some(f => f.regle === "RN6" && f.where === ou))
    add("info", "RN6", `export prouvé sur le fichier TÉLÉCHARGÉ : ${sec} s (borne ${borne}), ${oct} octets (plancher ${plancher}), ${pagesExport.length} page(s) lue(s), ${cherches.length} libellé(s) d'erreur cherché(s), 0 trouvé`, ou);
});
// Aucune mesure nulle part : le verdict de rendu repose sur de la prose. Constat, jamais blocage —
// la doctrine dit qu'un rendu non joué reste `non_juge` et SE DIT, et une règle qui refuserait ici
// une livraison entière se ferait désactiver le jour même.
if (gestes.length && !mesures)
  add("avertissement", "RN6", "aucun geste ne porte de `mesure_export` — le verdict de rendu repose sur une phrase ; le geste qui prouve le rendu se déclare `nature: \"export_rendu\"` et rend ses nombres (durée, octets, texte par page, libellés d'erreur cherchés et trouvés)", file);

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0, {
  compte: {
    pages: pages.length, visuels_porteurs_de_donnees: visuelsDonnees, projections_jugees: projectionsJugees,
    champs_inconnus: champsInconnus, projections_inactives: inactives,
    objets_inventaire: parObjet.size, gestes_de_verification: gestes.length, mesures_d_export: mesures,
  },
});
