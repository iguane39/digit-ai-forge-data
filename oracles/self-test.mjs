#!/usr/bin/env node
// self-test.mjs — double sens des quatre oracles de discipline (fixtures synthétiques) :
// chaque verte PASSE (exit 0), chaque rouge ÉCHOUE (exit 1) en déclenchant les règles
// attendues, avec findings localisants. Inclut aussi le round-trip du verbe importer
// (TF-0139) : brouillon produit → doit PASSER oracle-profiler/oracle-contractualiser.
// À rejouer après toute modification.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ici = path.dirname(fileURLToPath(import.meta.url));
const fx = f => path.join(ici, "..", "fixtures", f);
let pass = 0, echec = 0;
const ok = (b, m) => { console.log(`  [${b ? "PASS" : "FAIL"}] ${m}`); b ? pass++ : echec++; };
const lance = (oracle, cible) => {
  try { return { exit: 0, r: JSON.parse(execFileSync(process.execPath, [path.join(ici, oracle), cible, "--json-only"], { encoding: "utf8" })) }; }
  catch (e) { return { exit: e.status, r: JSON.parse(String(e.stdout || "{}")) }; }
};
const lanceScript = (script, args) => {
  try { return { exit: 0, r: JSON.parse(execFileSync(process.execPath, [path.join(ici, "..", "scripts", script), ...args, "--json-only"], { encoding: "utf8" })) }; }
  catch (e) { return { exit: e.status, r: JSON.parse(String(e.stdout || "{}")) }; }
};

const CAS = [
  { oracle: "oracle-profiler.mjs", verte: "assertions-verte.json", rouge: "assertions-rouge.json", regles: ["P2", "P3"] },
  { oracle: "oracle-profiler.mjs", verte: "assertions-pont-verte.json", rouge: "assertions-pont-rouge.json", regles: ["P4"] },
  { oracle: "oracle-tracer.mjs", verte: "lineage-verte.json", rouge: "lineage-rouge.json", regles: ["T2", "T3", "T4", "T5"] },
  { oracle: "oracle-tracer.mjs", verte: "lineage-colonne-verte.json", rouge: "lineage-colonne-rouge.json", regles: ["T6"] },
  // TF-0595 (24/08) : T7 — l'environnement de chaque dataset. Fixtures DÉDIÉES, et dédiées pour
  // une raison mécanique : les deux paires ci-dessus portent un horodatage du 11/08, sous la borne
  // d'antériorité de T7, où la règle ne rend qu'un `info`. Sans ces fixtures-là, la branche PASS
  // de T7 ne serait jouée par personne — et sa branche FAIL non plus.
  { oracle: "oracle-tracer.mjs", verte: "lineage-environnement-verte.json", rouge: "lineage-environnement-rouge.json", regles: ["T7"] },
  // T8 (TF-0974, 14/09/2026) : cibles structurées du périmètre servi. La rouge porte une cible
  // sans colonne ni `entier: true`, et une cible `entier: true` au motif trop court (2 mots).
  { oracle: "oracle-tracer.mjs", verte: "lineage-cibles-verte.json", rouge: "lineage-cibles-rouge.json", regles: ["T8"] },
  { oracle: "oracle-restituer.mjs", verte: "rapport-verte.md", rouge: "rapport-rouge.md", regles: ["R2", "R3", "R4"] },
  { oracle: "oracle-contractualiser.mjs", verte: "contrat-verte.json", rouge: "contrat-rouge.json", regles: ["C2", "C3", "C4", "C5"] },
  // Lots L3, L4, L7 de l'étude d'opportunité du pilot (07/09/2026, mandat D-5 puis GO A-24 à A-26).
  // modéliser (TF-0860) : la rouge porte un fait sans granularité, une mesure d'agrégation inconnue, une
  // dimension définie deux fois, une clé de substitution égale à la clé naturelle, un type de
  // changement hors jeu, aucune dimension temps, un processus absent de la matrice en bus.
  // M7 (TF-1170, 17/09) s'ajoute : la rouge porte un fait sans « pourquoi » ni `decision_ref`, un
  // fait dont le « pourquoi » tient en 4 mots et dont le `decision_ref` ne résout à rien, et une
  // décision sans QUI, sans date ISO et au QUOI de 2 mots.
  { oracle: "oracle-modeliser.mjs", verte: "modele-dimensionnel-verte.json", rouge: "modele-dimensionnel-rouge.json", regles: ["M2", "M3", "M4", "M5", "M6", "M7"] },
  // transformer (TF-0861) : cible = dossier des artefacts de l'outil (manifest, run_results, catalog).
  { oracle: "oracle-transformer.mjs", verte: "transformation-verte", rouge: "transformation-rouge", regles: ["TR2", "TR3", "TR4", "TR5", "TR6"] },
  // réconcilier (TF-0864) : tolérance absente, cible sans namespace, mesure sans homologue, écart.
  { oracle: "oracle-reconcilier.mjs", verte: "reconciliation-verte.json", rouge: "reconciliation-rouge.json", regles: ["RC2", "RC3", "RC4", "RC5"] },
  // restituer R6 : un rapport qui pointe un lot de réconciliation existant PASSE, un rapport qui
  // prétend une réconciliation vers un fichier absent ÉCHOUE sur R6 — et sur R6 seulement.
  { oracle: "oracle-restituer.mjs", verte: "rapport-reconciliation-verte.md", rouge: "rapport-reconciliation-rouge.md", regles: ["R6"] },
  // couvrir (TF-0911, 08/09) : la rouge porte un objet inventorié deux fois, un type d'objet hors
  // jeu, une exclusion sans motif, un type de règle inconnu, un objet cité par le mapping et
  // absent de l'inventaire, quatre orphelins, et un taux déclaré à 100 % qui en vaut 63,6.
  { oracle: "oracle-couvrir.mjs", verte: "couverture-verte.json", rouge: "couverture-rouge.json", regles: ["CV2", "CV3", "CV4", "CV5", "CV6"] },
  // évoluer (TF-0937, 08/09) : la rouge porte une évolution hors jeu, un couple table+colonne
  // projeté deux fois, une provenance de type inconnu, une table annoncée dont aucune colonne
  // n'est projetée, une ligne citant une table hors du bloc « tables », une indétermination sans
  // motif, et des cartes de comptage qui annoncent 8 colonnes là où on en recompte 6. EV6 (TF-0942)
  // s'ajoute le 08/09 : son arbre porte un statut de table recopié du niveau du dessous, un agrégat
  // de schéma incohérent avec ses enfants, un parent qui pointe dans le vide, et deux colonnes
  // projetées en ligne qu'aucun nœud ne porte. EV7 (TF-0943) aussi : un objet de provenance sans
  // couche, sans rôle du champ employé et de source hors jeu, un « objets_resolus » sans aucun
  // objet, et un objet expliqué par un dictionnaire que le document ne déclare pas.
  { oracle: "oracle-evoluer.mjs", verte: "evolutions-verte.json", rouge: "evolutions-rouge.json", regles: ["EV2", "EV3", "EV4", "EV5", "EV6", "EV7"] },
  // restituer R7 : un rapport de mapping qui pointe une mesure de couverture existante PASSE ;
  // celui qui se dit exhaustif en pointant le vide ÉCHOUE — sur R7 et sur R7 seulement.
  { oracle: "oracle-restituer.mjs", verte: "rapport-couverture-verte.md", rouge: "rapport-couverture-rouge.md", regles: ["R7"] },
  // restituer R9 (TF-1170, 17/09) : un rapport de modélisation qui cite les décisions déclarées par
  // le modèle qu'il pointe PASSE ; celui qui en laisse une au seul ledger ÉCHOUE — sur R9 et sur R9
  // seulement. C'est le défaut exact de RF-18 : la décision était lisible d'une machine (le modèle
  // jugé conforme) et invisible du lecteur, qui l'a dénoncée comme un défaut neuf jours plus tard.
  { oracle: "oracle-restituer.mjs", verte: "rapport-modele-verte.md", rouge: "rapport-modele-rouge.md", regles: ["R9"] },
  // rapprocher (TF-0975, 14/09) : la rouge porte un intitulé d'extrait ni apparié ni déclaré en
  // écart (RA2), un concept de dictionnaire qui cite un intitulé absent des deux sources (RA3),
  // et une absence sans motif écrit ni visuel (RA4, deux findings).
  { oracle: "oracle-rapprocher.mjs", verte: "rapprochement-verte.json", rouge: "rapprochement-rouge.json", regles: ["RA2", "RA3", "RA4"] },
  // reconstruire (TF-1176, 17/09) : la rouge EST le défaut mesuré — une page en 1600 × 900 contre
  // 1280 × 720 à l'origine (RS3), trois visuels réalignés en haut de page (RS4), le titre et le
  // bouton de réinitialisation disparus sans un mot (RS5), un écart « assumé » en deux mots (RS5),
  // le thème copié mais jamais référencé et deux ressources perdues (RS6).
  { oracle: "oracle-reconstruire.mjs", verte: "reconstruction-verte.json", rouge: "reconstruction-rouge.json", regles: ["RS3", "RS4", "RS5", "RS6"] },
  // rendre (TF-1175, 17/09) : la rouge porte un champ projeté absent de l'inventaire du modèle
  // (RN2), une projection écrite en mesure mais inventoriée en colonne (RN3), un visuel porteur
  // de données sans aucune projection affichée (RN4), et un geste de vérification du rendu en
  // deux mots, sans date (RN5) — c'est-à-dire un livrable déclaré rendu sur la seule lecture de
  // son fichier, le défaut exact de RF-21.
  { oracle: "oracle-rendre.mjs", verte: "rendu-verte.json", rouge: "rendu-rouge.json", regles: ["RN2", "RN3", "RN4", "RN5"] },
  // délimiter (TF-1180, 17/09) : la rouge EST le défaut mesuré, en petit — le périmètre pris au
  // MODÈLE et non aux visuels. Relevé sans auteur (DL2), un champ que le lecteur voyait absent du
  // périmètre livré (DL3), une table entière et trois colonnes que personne ne lit plus une
  // exclusion en deux mots (DL4), une correspondance et une lecture déclarée qui pointent hors du
  // modèle publié (DL5), et un taux de 100 % là où il en vaut 50 (DL6).
  { oracle: "oracle-delimiter.mjs", verte: "perimetre-verte.json", rouge: "perimetre-rouge.json", regles: ["DL2", "DL3", "DL4", "DL5", "DL6"] },
  // enchaîner (TF-1179, 17/09) : la rouge est la chaîne telle qu'elle s'écrit quand personne ne la
  // vérifie — une étape dont on ne sait pas ce qu'elle rend (CH1), deux étapes au même rang (CH2),
  // un oracle qui n'existe pas (CH3), une règle qui a survécu à sa règle (CH4), un geste humain en
  // cinq mots dont la trace n'atterrit nulle part (CH5), et trois étapes que le document lu par
  // les humains ne cite pas (CH6).
  { oracle: "oracle-enchainer.mjs", verte: "chaine-verte.json", rouge: "chaine-rouge.json", regles: ["CH1", "CH2", "CH3", "CH4", "CH5", "CH6"] },
];

console.log("SELF-TEST forge-data — discipline aux niveaux des 4 barres (fixtures synthétiques)\n");
for (const cas of CAS) {
  const v = lance(cas.oracle, fx(cas.verte));
  ok(v.exit === 0 && v.r.verdict === "PASS", `${cas.oracle} · verte PASS (exit 0)`);
  const r = lance(cas.oracle, fx(cas.rouge));
  ok(r.exit === 1 && r.r.verdict === "FAIL", `${cas.oracle} · rouge FAIL (exit 1)`);
  const durs = new Set((r.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle));
  const manquantes = cas.regles.filter(x => !durs.has(x));
  ok(!manquantes.length, `${cas.oracle} · règles déclenchées ${cas.regles.join(",")}${manquantes.length ? " — manquantes : " + manquantes.join(",") : ""}`);
  ok((r.r.findings || []).every(f => f.where && f.msg), `${cas.oracle} · findings localisants`);
  ok(Array.isArray(r.r.non_juge) && r.r.non_juge.length > 0, `${cas.oracle} · non_juge déclaré`);
}

// ---- R5 : couverture des nombres de prose, DEUX SENS (TF-0378) ----
// R5 avertit par défaut, donc elle n'apparaît pas dans les règles bloquantes de la boucle
// ci-dessus : sans cette branche, elle serait jouée par personne dans son sens qui compte.
// Les deux moitiés sont exigées — le nombre nu constaté ET le silence sur ce qui est légitime.
console.log(String.fromCharCode(10) + "R5 (TF-0378) — nombres de prose ancrés, échappés, ou constatés nus" + String.fromCharCode(10));
{
  const lanceAvec = (cible, ...flags) => {
    try { return { exit: 0, r: JSON.parse(execFileSync(process.execPath, [path.join(ici, "oracle-restituer.mjs"), cible, "--json-only", ...flags], { encoding: "utf8" })) }; }
    catch (e) { return { exit: e.status, r: JSON.parse(String(e.stdout || "{}")) }; }
  };
  const r5de = rap => (rap.findings || []).filter(f => f.regle === "R5");

  // Sens 1 — la verte porte volontairement une date, un millésime, une unité CSS, un numéro
  // de version, un tableau et un nombre ÉCHAPPÉ par [c:-]. R5 doit rester muette : sans cette
  // moitié, une R5 qui hurlerait sur tout passerait le self-test.
  const v = lanceAvec(fx("rapport-verte.md"));
  const vr5 = r5de(v.r);
  ok(v.exit === 0 && vr5.length === 1 && vr5[0].sev === "info",
    `R5 · verte : aucun nombre nu (échappement [c:-], dates, millésimes, unités, tableau) — obtenu ${vr5.map(f => f.sev).join(",") || "rien"}`);

  // Sens 1 bis — et elle reste muette MÊME en strict : un mode strict qui échouerait sur un
  // document propre serait inutilisable, donc jamais utilisé.
  const vs = lanceAvec(fx("rapport-verte.md"), "--strict");
  ok(vs.exit === 0, "R5 · verte --strict : toujours exit 0 (un strict qui échoue sur du propre ne sera jamais activé)");

  // Sens 2 — la rouge porte la phrase RÉELLE du rapport mesuré : « sur les 122 cibles à
  // source », nombre posé en dur avant exécution et faux. R5 avertit, et NOMME le nombre.
  const r = lanceAvec(fx("rapport-rouge.md"));
  const rr5 = r5de(r.r);
  ok(rr5.length === 1 && rr5[0].sev === "avertissement" && /\b3 nombre/.test(rr5[0].msg),
    `R5 · rouge : 3 nombres nus constatés en avertissement — obtenu ${rr5.map(f => f.sev + ":" + f.msg.slice(0, 24)).join(",") || "rien"}`);
  ok(rr5.length === 1 && rr5[0].msg.includes("122"),
    "R5 · rouge : le nombre nu est NOMMÉ, pas seulement compté (un total anonyme ne se corrige pas)");

  // Sens 2 bis — sous --strict le même constat BLOQUE. Le défaut n'est pas une indulgence :
  // 788 constats bloquants d'un coup sur un corpus existant feraient désactiver l'oracle.
  const rs = lanceAvec(fx("rapport-rouge.md"), "--strict");
  const rsr5 = r5de(rs.r);
  ok(rsr5.length === 1 && rsr5[0].sev === "bloquant",
    `R5 · rouge --strict : le même constat devient bloquant — obtenu ${rsr5.map(f => f.sev).join(",") || "rien"}`);
}

// ---- R8 : le vocabulaire du DESTINATAIRE, deux sens (TF-0936) ----
// Le retour tient en une phrase : « utilise le mot granularité plutôt que grain ». Le terme
// machine avait fuité du format vers la page lue — 33 emplois sur une seule page, dont 8
// recopiés des commentaires DDL. R8 avertit, donc elle n'apparaît dans aucune liste de règles
// bloquantes : sans cette branche, elle serait jouée par personne. Et le sens VERT compte
// autant : une règle de vocabulaire qui hurlerait sur le mot cité en code rendrait tout
// document technique rouge, et se ferait désactiver le jour même.
console.log(String.fromCharCode(10) + "R8 (TF-0936) — terme machine du glossaire dans un livrable humain" + String.fromCharCode(10));
{
  const r8de = rap => (rap.findings || []).filter(f => f.regle === "R8");
  const v = lance("oracle-restituer.mjs", fx("rapport-verte.md"));
  ok(v.exit === 0 && r8de(v.r).length === 0,
    `R8 · verte : « granularité » en prose et « grain » cité en SPAN DE CODE — aucun constat (obtenu ${r8de(v.r).map(f => f.sev).join(",") || "rien"})`);
  const r = lance("oracle-restituer.mjs", fx("rapport-rouge.md"));
  const rr8 = r8de(r.r);
  ok(rr8.length === 1 && rr8[0].sev === "avertissement" && /2 emploi/.test(rr8[0].msg),
    `R8 · rouge : le terme machine employé en prose est constaté et COMPTÉ (« grain », « grains ») — obtenu ${rr8.map(f => f.sev + ":" + f.msg.slice(0, 30)).join(",") || "rien"}`);
  ok(rr8.length === 1 && /granularité/.test(rr8[0].msg) && /grain/.test(rr8[0].msg),
    "R8 · rouge : le constat NOMME le terme trouvé et le terme de rendu — un avertissement qui ne dit pas par quoi remplacer ne se corrige pas");
  ok(rr8.length === 1 && rr8[0].sev !== "bloquant",
    "R8 · un mot est un arbitrage de rédaction : jamais bloquant — une règle de vocabulaire qui refuse une livraison se fait désactiver");
  // Le glossaire est une DONNÉE (loi n° 4), datée et sourcée : sans lui, R8 ne juge pas et le
  // DIT. Un oracle qui se tairait sur son propre référentiel manquant mentirait par omission.
  const g = JSON.parse(fs.readFileSync(path.join(ici, "..", "references", "glossaire-restitution.json"), "utf8"));
  ok(g.format === "forge-data/glossaire-restitution@1" && /^\d{4}-\d{2}-\d{2}$/.test(g.date) && g.source &&
     g.termes.some(t => t.machine === "grain" && t.rendu === "granularité" && t.motif),
    "R8 · le glossaire est une donnée éditable, DATÉE et SOURCÉE, dont chaque terme porte son motif (loi n° 4)");
  // TF-1044 (14/09/2026) — la portée_machine est resserrée à la seule clé JSON `grain`, et R8
  // devient BLOQUANT quand le PRODUIT déclare son propre lexique (--glossaire) avec
  // "bloquant": true sur un terme précis. Le glossaire de la forge, lui, reste à false.
  ok(g.termes.some(t => t.machine === "grain" && t.bloquant === false) &&
     /la seule clé JSON `grain`/.test(g.termes[0].portee_machine || ""),
    "R8 · portée_machine resserrée à la seule clé JSON `grain` (TF-1044) ; `bloquant` explicite à false côté forge");
  const lanceGlossaire = (cible, glossaire) => {
    try { return { exit: 0, r: JSON.parse(execFileSync(process.execPath, [path.join(ici, "oracle-restituer.mjs"), cible, "--json-only", "--glossaire", glossaire], { encoding: "utf8" })) }; }
    catch (e) { return { exit: e.status, r: JSON.parse(String(e.stdout || "{}")) }; }
  };
  const rBloquant = lanceGlossaire(fx("rapport-rouge.md"), fx("glossaire-restitution-bloquant.json"));
  const rb8 = r8de(rBloquant.r);
  ok(rBloquant.exit === 1 && rBloquant.r.verdict === "FAIL" && rb8.length === 1 && rb8[0].sev === "bloquant",
    `R8 · TF-1044 : le MÊME rapport, avec le glossaire d'un produit qui déclare "bloquant": true, ÉCHOUE sur R8 — obtenu exit=${rBloquant.exit} verdict=${rBloquant.r.verdict} sev=${rb8[0]?.sev}`);
}

// ---- M2/M5 : `granularite` alias de `grain`, clé nominale de modele-dimensionnel@2 (TF-1044) ----
// Le second retour (10/09) a montré que « grain » fuyait aussi hors des rapports (DDL, mapping,
// chargement). Le format lui-même reste sur `grain` (@1, rétro-compatibilité), mais `granularite`
// devient un alias accepté partout, et la clé NOMINALE d'un @2 — jamais un renommage qui casserait
// les artefacts existants.
console.log(String.fromCharCode(10) + "M2/M5 (TF-1044) — `granularite` alias de `grain`, clé nominale de modele-dimensionnel@2" + String.fromCharCode(10));
{
  const g2 = lance("oracle-modeliser.mjs", fx("modele-dimensionnel-granularite-verte.json"));
  ok(g2.exit === 0 && g2.r.verdict === "PASS",
    `M2/M5 · un modele-dimensionnel@2 écrit entièrement en \`granularite\` (fait ET dimension temps) PASSE — obtenu ${g2.r.verdict}`);
  const gDiv = lance("oracle-modeliser.mjs", fx("modele-dimensionnel-granularite-divergence.json"));
  const m2div = (gDiv.r.findings || []).filter(f => f.regle === "M2");
  ok(gDiv.exit === 0 && gDiv.r.verdict === "PASS" && m2div.length === 1 && m2div[0].sev === "avertissement" && /granularite \(clé nominale/.test(m2div[0].msg),
    `M2/M5 · \`grain\` et \`granularite\` déclarés avec des valeurs DIFFÉRENTES sur le même fait : avertissement nommé, \`granularite\` fait foi, jamais un FAIL — obtenu verdict=${gDiv.r.verdict} findings=${m2div.map(f => f.sev).join(",") || "aucun"}`);
  // Le format @1 historique (clé `grain` seule) continue de PASSER sans aucune retouche —
  // c'est la rétro-compatibilité que TF-1044 s'interdit de casser.
  const v1 = lance("oracle-modeliser.mjs", fx("modele-dimensionnel-verte.json"));
  ok(v1.exit === 0 && v1.r.verdict === "PASS", "M2/M5 · le format @1 historique (clé `grain` seule) continue de PASSER sans retouche");
}

// ---- Garde de non-régression : « grain » (prose) ne doit pas revenir dans les registres
// machine hors citation (TF-1044, 16/09/2026) ----
// Deux fois le même défaut, sur deux registres différents : TF-0936 avait clos une correction
// que TF-1044 a dû rejouer six jours plus tard sur un DDL, un mapping et un chargement — la
// correction n'était descendue nulle part, faute de juge qui la rejoue. Celui-ci scanne les
// COMMENTAIRES et messages des fichiers listés ci-dessous : un « grain » NU (hors citation entre
// accents graves ou guillemets, hors identifiant de code tel que `const grain`, `obj.grain` ou
// `["grain", …]`) y est une régression de prose. Portée volontairement ÉTROITE : elle ne lit que
// les COMMENTAIRES `//`, jamais le CODE — c'est la frontière la plus sûre entre prose et
// identifiant, et la seule qu'un script simple puisse tracer sans reproduire l'incident TF-0927
// (un anonymiseur qui avait remplacé un nom À L'INTÉRIEUR d'un identifiant, rendant une suite de
// tests non collectable dix-huit jours). Ce que cette garde NE couvre PAS : un « grain » nu logé
// dans un MESSAGE de chaîne au milieu d'une ligne de code (hors commentaire) — c'est le manque
// que l'étude d'opportunité TF-0155 doit outiller (oracle-vocabulaire.mjs, esquissé au rapport de
// campagne du 16/09/2026).
console.log(String.fromCharCode(10) + "Garde de non-régression — « grain » hors citation dans les registres machine (TF-1044)" + String.fromCharCode(10));
{
  const FICHIERS_MACHINE = [
    "oracles/oracle-modeliser.mjs", "oracles/oracle-tracer.mjs", "oracles/oracle-rapprocher.mjs",
    "oracles/oracle-restituer.mjs", "oracles/self-test.mjs",
    "scripts/traduire-modele-semantique.mjs", "scripts/traduire-unity-catalog.mjs",
    "references/STANDARDS-DATA.md", "references/profils-moteur/LISEZMOI.md", "references/profils-moteur/databricks.md",
  ];
  // La prose d'un fichier : commentaires `//` pour les .mjs (jamais le code — c'est la frontière
  // qui évite TF-0927), tout le texte hors blocs de code pour les .md. Puis on retire les
  // citations — accents graves, guillemets français, ET double quotes JSON (un commentaire qui
  // montre un extrait de schéma, ex. `"grain": "une ligne par …"`, cite la clé, il ne l'emploie
  // pas) — admises comme MENTION du terme, jamais comme intention de l'auteur, avant de chercher
  // le mot.
  const proseDe = (chemin, texte) => {
    const lignes = [];
    if (chemin.endsWith(".mjs")) {
      for (const l of texte.split(/\r?\n/)) {
        const t = l.trim();
        if (t.startsWith("//")) lignes.push(t.slice(2));
      }
    } else {
      let dansBloc = false;
      for (const l of texte.split(/\r?\n/)) {
        if (/^\s*(```|~~~)/.test(l)) { dansBloc = !dansBloc; continue; }
        if (!dansBloc) lignes.push(l);
      }
    }
    return lignes.join(String.fromCharCode(10))
      .replace(/`[^`]*`/g, " ")     // citation en accents graves
      .replace(/«[^»]*»/g, " ")     // mention entre guillemets français
      .replace(/"[^"]*"/g, " ");    // citation JSON (clé ou valeur d'un extrait de schéma)
  };
  const grainNu = (prose) => [...prose.matchAll(/(?<![\p{L}\p{N}_])grains?(?![\p{L}\p{N}_])/giu)];

  const casses = [];
  for (const rel of FICHIERS_MACHINE) {
    const texte = fs.readFileSync(path.join(ici, "..", rel), "utf8");
    const trouves = grainNu(proseDe(rel, texte));
    if (trouves.length) casses.push(`${rel} (${trouves.length})`);
  }
  ok(casses.length === 0,
    casses.length
      ? `garde vocabulaire · RÉGRESSION sur ${casses.length} fichier(s) : ${casses.join(" · ")} — « grain » nu doit se lire « granularité » hors citation`
      : `garde vocabulaire · 0 « grain » nu hors citation sur ${FICHIERS_MACHINE.length} fichiers des registres machine`);

  // Sens rouge : une prose synthétique qui PORTE « grain » nu doit être détectée — sans ce sens,
  // la garde pourrait ne plus rien détecter en silence (la leçon R8/EC-7 : une règle qui ne PEUT
  // jamais échouer n'a jamais prouvé qu'elle savait échouer).
  const rougeMjs = grainNu(proseDe("x.mjs", "// le fait declare son grain en une phrase" + String.fromCharCode(10) + "const grain = 1;"));
  ok(rougeMjs.length === 1,
    `garde vocabulaire · sens rouge (commentaire .mjs) : « grain » nu DÉTECTÉ dans le commentaire, le CODE ignoré — obtenu ${rougeMjs.length}`);
  const rougeMd = grainNu(proseDe("x.md", "Le grain de la table est declare ici." + String.fromCharCode(10) + "```js" + String.fromCharCode(10) + "const grain = 1;" + String.fromCharCode(10) + "```"));
  ok(rougeMd.length === 1,
    `garde vocabulaire · sens rouge (.md) : « grain » nu détecté en prose, le bloc de code ignoré — obtenu ${rougeMd.length}`);
  const verteCitation = grainNu(proseDe("x.mjs", "// la cle JSON `grain` et le terme « grain » machine restent admis en citation"));
  ok(verteCitation.length === 0,
    `garde vocabulaire · sens vert : citation en accents graves ET en guillemets épargnée — obtenu ${verteCitation.length} (attendu 0)`);
}

// ---- CV5/CV6 : le CHIFFRE de la couverture, deux sens (TF-0911) ----
// La boucle ci-dessus prouve que les règles se déclenchent. Elle ne prouve pas que le NOMBRE
// rendu est juste — et c'est le nombre qui sert : « 38 colonnes et 22 mesures orphelines » est
// ce qui a déclenché le retour, pas un verdict FAIL. Un oracle de couverture dont le taux serait
// faux serait pire que pas d'oracle : il donnerait à un mapping troué la caution d'un chiffre.
console.log(String.fromCharCode(10) + "CV5/CV6 (TF-0911) — le taux de couverture et les orphelins sont COMPTÉS juste" + String.fromCharCode(10));
{
  const v = lance("oracle-couvrir.mjs", fx("couverture-verte.json")).r;
  ok(v.couverture && v.couverture.inventorie === 15 && v.couverture.couverts === 14 && v.couverture.exclus === 1 && v.couverture.orphelins === 0,
    `CV5 · verte : 15 inventoriés, 14 couverts (dont 4 par une règle table_entiere qui ne les nomme pas), 1 exclu motivé, 0 orphelin — obtenu ${JSON.stringify(v.couverture && { i: v.couverture.inventorie, c: v.couverture.couverts, e: v.couverture.exclus, o: v.couverture.orphelins })}`);
  ok(v.couverture && v.couverture.taux.retenu === 100 && v.couverture.taux.brut === 93.3,
    `CV5 · verte : les deux taux sont distincts et nommés — retenu 100 % (hors exclusions motivées), brut 93,3 % (sur tout l'inventaire) ; les confondre ferait lire une exclusion comme un trou (obtenu ${JSON.stringify(v.couverture && v.couverture.taux)})`);
  const r = lance("oracle-couvrir.mjs", fx("couverture-rouge.json")).r;
  ok(r.couverture && r.couverture.orphelins === 4 && r.couverture.orphelins_par_type.colonne === 2 && r.couverture.orphelins_par_type.mesure === 1,
    `CV5 · rouge : les orphelins sont comptés PAR TYPE (2 colonnes, 1 mesure, 1 de type hors jeu) — c'est cette ventilation qui a fait le retour, pas le total (obtenu ${JSON.stringify(r.couverture && r.couverture.orphelins_par_type)})`);
  const cv5 = (r.findings || []).filter(f => f.regle === "CV5");
  ok(cv5.length === 1 && /Ventes\.remise_ht/.test(cv5[0].msg) && /Ventes\[Marge\]/.test(cv5[0].msg),
    "CV5 · rouge : chaque orphelin est NOMMÉ, pas seulement compté — un total anonyme ne se corrige pas");
  const cv6 = (r.findings || []).filter(f => f.regle === "CV6");
  ok(cv6.length === 1 && /100/.test(cv6[0].msg) && /63\.6/.test(cv6[0].msg),
    "CV6 · rouge : le taux DÉCLARÉ à 100 % est confronté au taux RECALCULÉ à 63,6 % — un taux recopié est ce qui a laissé passer trois PASS");
  const morte = (r.findings || []).filter(f => f.regle === "CV4" && f.sev === "avertissement");
  ok(morte.length === 1 && /Fournisseur/.test(morte[0].msg),
    "CV4 · rouge : une règle de rattachement qui ne touche RIEN est signalée — une portée mal écrite laisse ses objets orphelins sans le dire");
  // Sens inverse, celui qui compte le plus : une règle `table_entiere` doit RÉELLEMENT couvrir
  // ses objets. Si elle ne couvrait rien, la verte porterait 4 orphelins et non 0 — donc le PASS
  // ci-dessus prouve déjà la couverture par préfixe, et cette assertion le dit à voix haute.
  const vFind = (v.findings || []).filter(f => f.regle === "CV5");
  ok(vFind.length === 1 && vFind[0].sev === "info" && /14\/14/.test(vFind[0].msg),
    "CV5 · verte : les 4 colonnes de la dimension reprise en entier sont couvertes SANS être nommées une à une (règle table_entiere effective)");
}

// ---- TF-0379 : un non_juge nomme un outil RÉSOLVABLE, jamais un nom à chercher ----
// Le fait : un retour a cherché « oracle-calculs » dans trois dépôts puis par nom sous C:\dev,
// ne l'a pas trouvé, et en a conclu que la famille n'était couverte nulle part — après cinq
// jours de run passés à croire l'inverse. L'outil EXISTE, sous un dossier `.claude` qu'aucune
// recherche ne descend par défaut. Un non_juge est une PROMESSE DE PÉRIMÈTRE : le lire, c'est
// cesser de chercher. Il doit donc porter un chemin qui se vérifie, pas un nom qui se cherche.
console.log(String.fromCharCode(10) + "TF-0379 — tout oracle cité en non_juge est RÉSOLVABLE" + String.fromCharCode(10));
{
  // Les racines où un chemin de non_juge peut être résolu : ce dépôt, et les dépôts frères.
  const racines = [path.join(ici, ".."), path.join(ici, "..", "..")];
  const resolvable = chemin => racines.some(r => fs.existsSync(path.join(r, chemin)));
  const CITATION = /`([^`]*oracle-[\w.-]+\.(?:mjs|py))`/g;
  const NOM_NU = /\boracle-[\w-]+\b(?![\w.-]*\.(?:mjs|py))/g;
  const fantomesDe = texte => [...texte.matchAll(CITATION)].map(m => m[1]).filter(c => !resolvable(c));

  // TF-0916 — le PÉRIMÈTRE se LIT sur le disque, il ne s'écrit plus à la main. Une liste manuelle
  // se périme au premier oracle ajouté : modéliser, transformer et réconcilier sont nés en deux
  // jours sans que la boucle les couvre, et un chemin cité faux y serait resté invisible. La
  // cible verte de chaque oracle est celle déjà déclarée en tête (CAS) — donc un oracle nouveau
  // sans cas de double sens fait échouer ce contrôle-ci, ce qui est exactement le rappel voulu.
  const surDisque = fs.readdirSync(ici).filter(f => /^oracle-.+\.mjs$/.test(f)).sort();
  const verteDe = new Map();
  for (const cas of CAS) if (!verteDe.has(cas.oracle)) verteDe.set(cas.oracle, fx(cas.verte));
  const sansCas = surDisque.filter(o => !verteDe.has(o));
  ok(!sansCas.length, `périmètre lu dans oracles/ : ${surDisque.length} oracle(s), tous pourvus d'une fixture verte${sansCas.length ? " — sans cas déclaré : " + sansCas.join(", ") : ""}`);

  for (const oracle of surDisque.filter(o => verteDe.has(o))) {
    const rap = lance(oracle, verteDe.get(oracle)).r;
    const texte = (rap.non_juge || []).join(" ");
    // Un chemin cité en span de code doit EXISTER.
    const chemins = [...texte.matchAll(CITATION)].map(m => m[1]);
    const fantomes = fantomesDe(texte);
    ok(!fantomes.length, `${oracle} · chemins cités au non_juge tous résolvables${fantomes.length ? " — fantôme(s) : " + fantomes.join(", ") : ` (${chemins.length} vérifié(s))`}`);
    // Et aucun oracle ne doit être cité par son SEUL nom : c'est ce qui a coûté la recherche.
    const nus = [...texte.matchAll(NOM_NU)].map(m => m[0]);
    ok(!nus.length, `${oracle} · aucun oracle cité par son seul nom au non_juge${nus.length ? " — " + [...new Set(nus)].join(", ") + " (donner le chemin, ou dire « aucun oracle du parc »)" : ""}`);
  }

  // TF-0916 · la règle elle-même, dans les DEUX sens. La boucle ci-dessus est verte par
  // construction tant que le parc est propre : sans ces deux assertions, rien ne prouverait
  // qu'elle SAIT échouer, et un contrôle qui ne sait pas échouer ne contrôle rien.
  ok(!fantomesDe("le lineage se juge avec `oracles/oracle-tracer.mjs` de ce dépôt").length,
    "TF-0916 · sens vert : un chemin cité qui existe sur disque n'est pas signalé fantôme");
  const fantomeTemoin = fantomesDe("la couverture se juge avec `oracles/oracle-fantome.mjs` de ce dépôt");
  ok(fantomeTemoin.length === 1 && fantomeTemoin[0] === "oracles/oracle-fantome.mjs",
    `TF-0916 · sens rouge : un chemin cité INEXISTANT est signalé fantôme et fait échouer le self-test — obtenu ${JSON.stringify(fantomeTemoin)}`);
}

// ---- verbe importer (TF-0139) : round-trip verte + rejet propre rouge ----
console.log("\nimporter.mjs (verbe, TF-0139) — round-trip vers oracle-profiler / oracle-contractualiser\n");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-importer-"));
try {
  const iv = lanceScript("importer.mjs", [fx("schema-postgres-verte.sql"), "--sortie-dir", tmp]);
  ok(iv.exit === 0 && iv.r.sortie === "OK", "importer · fixture verte produit un brouillon (exit 0)");
  const pAssert = iv.r.fichiers_produits && iv.r.fichiers_produits.assertions;
  const pContrat = iv.r.fichiers_produits && iv.r.fichiers_produits.contrat;
  ok(!!pAssert && !!pContrat, "importer · assertions.json et contrat.json écrits");
  if (pAssert) {
    const rp = lance("oracle-profiler.mjs", pAssert);
    ok(rp.exit === 0 && rp.r.verdict === "PASS", "importer → oracle-profiler.mjs sur le brouillon : PASS (round-trip)");
  }
  if (pContrat) {
    const rc = lance("oracle-contractualiser.mjs", pContrat);
    ok(rc.exit === 0 && rc.r.verdict === "PASS", "importer → oracle-contractualiser.mjs sur le brouillon : PASS (round-trip)");
  }
  const ir = lanceScript("importer.mjs", [fx("schema-postgres-rouge.sql"), "--sortie-dir", tmp]);
  ok(ir.exit === 2 && ir.r.sortie === "ECHEC", "importer · fixture rouge (illisible) refusée proprement (exit 2, pas de brouillon inventé)");
  ok(!ir.r.fichiers_produits, "importer · rouge : aucun fichier produit");
  // TF-0600 — les COMMENTAIRES, dans les DEUX sens. Le second sens est celui qui a servi tout de
  // suite : au premier passage, le controle s'est accuse lui-meme sur un objet qui EXISTAIT, faute
  // de normaliser la citation comme les noms du schema (lecon N-23 du pilot).
  const iCom = lanceScript("importer.mjs", [fx("schema-commentaires.sql"), "--sortie-dir", tmp]);
  ok(iCom.exit === 0 && iCom.r.sortie === "OK", "importer · schema commente produit un brouillon (exit 0)");
  const pCom = iCom.r.fichiers_produits && iCom.r.fichiers_produits.contrat;
  ok(!!pCom, "importer · contrat produit depuis le schema commente");
  if (pCom) {
    const doc = JSON.parse(fs.readFileSync(pCom, "utf8"));
    const act = (doc.schema || []).find(o => o.objet === "activite");
    ok(!!act && /Referentiel des activites/.test(act.description || ""),
      "importer · COMMENT ON TABLE rattache a l'objet (la source de verite n'est plus jetee)");
    const col = act && (act.proprietes || []).find(p => p.nom === "cod_activite");
    ok(!!col && /systeme tiers/.test(col.description || ""),
      "importer · COMMENT ON COLUMN rattache a la propriete — c'est CE commentaire qui a tranche un sujet reste ouvert trois tours");
    const rc2 = lance("oracle-contractualiser.mjs", pCom);
    ok(rc2.exit === 0 && rc2.r.verdict === "PASS",
      "importer → oracle-contractualiser.mjs : les descriptions n'ont pas casse le contrat (round-trip)");
  }
  // TF-0599 — la CLE ETRANGERE ORPHELINE, les deux sens. La fixture porte une FK vers la table au
  // PLURIEL qui n'existe pas ; la table `activite`, elle, n'est referencee par rien d'absent.
  const orphelines = (iCom.r.avertissements || []).filter(a => /ORPHELINE/.test(a));
  ok(orphelines.length === 1, `importer · UNE SEULE cle etrangere orpheline denoncee (obtenu : ${orphelines.length})`);
  ok(orphelines.some(a => /ref\.activites/.test(a)),
    "importer · l'orpheline nommee est bien la reference vers la table absente");
  ok(orphelines.some(a => /CONSTAT A LIVRER|CONSTAT À LIVRER/.test(a)),
    "importer · le message dit QUOI FAIRE — un objet encore reference n'est pas un objet hors perimetre");
  const iVerte = lanceScript("importer.mjs", [fx("schema-postgres-verte.sql"), "--sortie-dir", tmp]);
  ok(!(iVerte.r.avertissements || []).some(a => /ORPHELINE/.test(a)),
    "importer · aucune orpheline inventee sur un schema dont les references se resolvent");
  const alertes = (iCom.r.avertissements || []).filter(a => /NOMME/.test(a));
  ok(alertes.length === 1, `importer · UN SEUL objet cite et inexistant denonce (obtenu : ${alertes.length}) — ni le silence, ni le bruit`);
  ok(alertes.some(a => /ref\.activites\.cod_activite/.test(a)),
    "importer · l'objet denonce est bien la table au PLURIEL qui n'existe pas — un commentaire faux se lit avec l'autorite du schema");
  ok(!alertes.some(a => /ref\.activite\.cod_activite\b/.test(a.replace(/ref\.activites/g, ""))),
    "importer · un objet cite QUI EXISTE n'est pas denonce — le faux positif du premier passage reste corrige");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---- verbe importer, dialecte Databricks (TF-0858, lot L1 du 07/09) : round-trip verte + rejet propre rouge ----
console.log("\nimporter.mjs (dialecte Databricks, TF-0858) — round-trip vers oracle-profiler / oracle-contractualiser\n");
const tmpDbx = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-importer-dbx-"));
try {
  const dv = lanceScript("importer.mjs", [fx("schema-databricks-verte.sql"), "--sortie-dir", tmpDbx]);
  ok(dv.exit === 0 && dv.r.sortie === "OK", "importer/databricks · fixture verte (SHOW CREATE TABLE) produit un brouillon (exit 0)");
  ok(dv.r.dialecte === "databricks", "importer/databricks · le dialecte est DÉTECTÉ et déclaré au manifeste (jamais deviné en silence)");
  const dAssert = dv.r.fichiers_produits && dv.r.fichiers_produits.assertions;
  const dContrat = dv.r.fichiers_produits && dv.r.fichiers_produits.contrat;
  ok(!!dAssert && !!dContrat, "importer/databricks · assertions.json et contrat.json écrits");
  if (dAssert) {
    const rp = lance("oracle-profiler.mjs", dAssert);
    ok(rp.exit === 0 && rp.r.verdict === "PASS", "importer/databricks → oracle-profiler.mjs sur le brouillon : PASS (round-trip)");
    const a = JSON.parse(fs.readFileSync(dAssert, "utf8")).assertions;
    ok(a.some(x => x.type === "bornes" && x.objet === "ventes.montant" && x.min === 0 && x.max === 100000), "importer/databricks · CHECK bornes Delta (montant >= 0 AND montant <= 100000) → assertion bornes");
    ok(a.some(x => x.type === "ensemble" && x.objet === "clients.statut"), "importer/databricks · CHECK IN Delta → assertion ensemble");
  }
  if (dContrat) {
    const rc = lance("oracle-contractualiser.mjs", dContrat);
    ok(rc.exit === 0 && rc.r.verdict === "PASS", "importer/databricks → oracle-contractualiser.mjs sur le brouillon : PASS (round-trip)");
    const c = JSON.parse(fs.readFileSync(dContrat, "utf8"));
    const ventes = c.schema.find(s => s.objet === "ventes");
    ok(!!ventes && ventes.description === "Ventes conformées de la couche Silver", "importer/databricks · COMMENT de TABLE en queue d'instruction rattaché (TBLPROPERTIES ignoré)");
    ok(!!ventes && (ventes.proprietes.find(p => p.nom === "id_commande") || {}).description === "Identifiant de commande, repris du système amont de caisse",
      "importer/databricks · COMMENT en ligne de colonne rattaché — même source de vérité que COMMENT ON (TF-0600)");
    ok(!!ventes && (ventes.proprietes.find(p => p.nom === "date_maj") || {}).type === "timestamp", "importer/databricks · TIMESTAMP_NTZ → timestamp (mapping du profil §2)");
    ok(!!ventes && (ventes.proprietes.find(p => p.nom === "tags") || {}).type === "string", "importer/databricks · ARRAY<STRING> → repli string");
  }
  const av = dv.r.avertissements || [];
  ok(av.some(x => /INFORMATIONNELLE/.test(x) && /PRIMARY KEY/.test(x)), "importer/databricks · clé primaire déclarée INFORMATIONNELLE — l'assertion unique est avertie de fiabilité inférieure (profil §1)");
  ok(av.some(x => /type imbriqué/.test(x) && /tags/.test(x)), "importer/databricks · type imbriqué nommé dans l'avertissement (profil §2)");
  ok(!av.some(x => /ORPHELINE/.test(x)), "importer/databricks · la FOREIGN KEY vers une table présente (nom à trois segments) n'est pas dénoncée orpheline");
  const pg = lanceScript("importer.mjs", [fx("schema-postgres-verte.sql"), "--sortie-dir", tmpDbx]);
  ok(pg.r.dialecte === "postgres" && !(pg.r.avertissements || []).some(x => /INFORMATIONNELLE/.test(x)), "importer/databricks · le dialecte Postgres reste détecté Postgres, sans avertissement Databricks (non-régression)");
  const dr = lanceScript("importer.mjs", [fx("schema-databricks-rouge.sql"), "--sortie-dir", tmpDbx]);
  ok(dr.exit === 2 && dr.r.sortie === "ECHEC", "importer/databricks · fixture rouge (vue seule, aucune table) refusée proprement (exit 2)");
  ok(!dr.r.fichiers_produits, "importer/databricks · rouge : aucun fichier produit");
  const dInc = lanceScript("importer.mjs", [fx("schema-databricks-verte.sql"), "--sortie-dir", tmpDbx, "--dialecte", "oracle"]);
  ok(dInc.exit === 2, "importer/databricks · un dialecte déclaré inconnu est refusé (exit 2), jamais interprété");
} finally {
  fs.rmSync(tmpDbx, { recursive: true, force: true });
}

// ---- verbe traduire-unity-catalog (TF-0141) : round-trip verte + rejet propre rouge ----
console.log("\ntraduire-unity-catalog.mjs (verbe, TF-0141) — round-trip vers oracle-tracer\n");
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-uc-"));
try {
  const pLineage = path.join(tmp2, "uc.lineage.json");
  const tv = lanceScript("traduire-unity-catalog.mjs", [fx("unity-catalog-verte.json"), "--sortie", pLineage]);
  ok(tv.exit === 0 && tv.r.sortie === "OK", "traduire-unity-catalog · fixture verte produit un lineage@1 (exit 0)");
  ok(fs.existsSync(pLineage), "traduire-unity-catalog · fichier lineage écrit");
  if (fs.existsSync(pLineage)) {
    const rt = lance("oracle-tracer.mjs", pLineage);
    ok(rt.exit === 0 && rt.r.verdict === "PASS", "traduire-unity-catalog → oracle-tracer.mjs sur le lineage produit : PASS (round-trip)");
  }
  const tr = lanceScript("traduire-unity-catalog.mjs", [fx("unity-catalog-rouge.json")]);
  ok(tr.exit === 2 && tr.r.sortie === "ECHEC", "traduire-unity-catalog · export incohérent (sortie sans dataset déclaré) refusé proprement (exit 2)");
  ok(!tr.r.fichier_produit, "traduire-unity-catalog · rouge : aucun fichier produit");
  // TF-0595 : le namespace est la seule donnée du lineage produit qui ne se lit dans AUCUNE ligne
  // de l'export. Le verbe doit donc REFUSER, jamais inventer — c'est la branche qui compte, car
  // inventer ici produirait un lineage qui PASSE T7 en désignant la mauvaise instance.
  const sansNs = JSON.parse(fs.readFileSync(fx("unity-catalog-verte.json"), "utf8"));
  delete sansNs.namespace;
  const pSansNs = path.join(tmp2, "uc-sans-namespace.json");
  fs.writeFileSync(pSansNs, JSON.stringify(sansNs));
  const tn = lanceScript("traduire-unity-catalog.mjs", [pSansNs, "--sortie-dir", tmp2]);
  ok(tn.exit === 2 && tn.r.sortie === "ECHEC", "traduire-unity-catalog · export sans `namespace` refusé proprement (exit 2, T7)");
  ok(!tn.r.fichier_produit, "traduire-unity-catalog · sans namespace : aucun lineage inventé");
  ok(tv.r.voie === "system-tables", "traduire-unity-catalog · la voie system-tables est DÉTECTÉE et déclarée au manifeste (jamais devinée en silence)");

  // ---- TF-0893 : seconde voie d'entrée — API REST lineage-tracking, granularité TABLE ----
  // Le fait mesuré : sur un workspace réel, `SELECT … FROM system.access.table_lineage` rend
  // INSUFFICIENT_PERMISSIONS (SQLSTATE 42501) tandis que l'API répond avec les droits ordinaires
  // du jeton. Le verbe n'avait que l'entrée qui ne répond pas — 30 objets transcrits à la main.
  const pApi = path.join(tmp2, "api.lineage.json");
  const av = lanceScript("traduire-unity-catalog.mjs", [fx("unity-catalog-api-verte.json"), "--sortie", pApi]);
  ok(av.exit === 0 && av.r.sortie === "OK", "traduire-unity-catalog/api · fixture verte (réponses lineage-tracking) produit un lineage@1 (exit 0)");
  ok(av.r.voie === "api-lineage-tracking", "traduire-unity-catalog/api · la voie est DÉTECTÉE sur le champ `reponses` et déclarée au manifeste");
  ok(fs.existsSync(pApi), "traduire-unity-catalog/api · fichier lineage écrit");
  if (fs.existsSync(pApi)) {
    const rt = lance("oracle-tracer.mjs", pApi);
    ok(rt.exit === 0 && rt.r.verdict === "PASS", "traduire-unity-catalog/api → oracle-tracer.mjs sur le lineage produit : PASS (round-trip)");
    const lg = JSON.parse(fs.readFileSync(pApi, "utf8"));
    // Le sens des arêtes est la seule chose que ce format porte et que rien ne rattraperait en
    // aval : un upstream alimente la table interrogée, un downstream en descend. Inverser les
    // deux produirait un lineage@1 qui PASSE T1-T7 en racontant le flux à l'envers.
    ok(lg.entrees.some(e => e.dataset === "main.brut.exports_pgi") && lg.sorties.some(s => s.dataset === "main.servi.ventes_mensuelles"),
      "traduire-unity-catalog/api · un upstream devient une ENTRÉE et la table interrogée une SORTIE (sens de l'arête)");
    ok(lg.entrees.some(e => e.dataset === "main.servi.ventes_mensuelles") && lg.sorties.some(s => s.dataset === "main.servi.ventes_mensuelles_agregees"),
      "traduire-unity-catalog/api · un downstream devient une SORTIE et la table interrogée une entrée (sens inverse de l'arête)");
    ok(lg.confiance.niveau === 0 && lg.transformations.every(t => t.type === "runtime"),
      `traduire-unity-catalog/api · granularité table → confiance.niveau 0 (REX X6 : 1-2-3 sont des granularités colonne), transformations runtime — obtenu niveau ${lg.confiance.niveau}`);
    ok(lg.colonnes === undefined, "traduire-unity-catalog/api · aucun champ `colonnes` inventé — cette voie ne voit pas la colonne");
    ok(lg.transformations.some(t => t.etape === "notebook_4210") && lg.transformations.some(t => t.etape === "job_77012"),
      "traduire-unity-catalog/api · les entités d'exécution (notebook, job) deviennent les étapes déclarées");
  }
  ok((av.r.avertissements || []).some(x => /fileInfo/.test(x)),
    "traduire-unity-catalog/api · une entrée sans tableInfo (emplacement externe) est ÉCARTÉE en le DISANT — un silence ferait croire le relevé complet");
  ok((av.r.avertissements || []).some(x => /niveau. = 0|niveau` = 0/.test(x)),
    "traduire-unity-catalog/api · le niveau de maturité 0 est justifié dans les avertissements, jamais posé en silence");
  const ar = lanceScript("traduire-unity-catalog.mjs", [fx("unity-catalog-api-rouge.json"), "--sortie-dir", tmp2]);
  ok(ar.exit === 2 && ar.r.sortie === "ECHEC", "traduire-unity-catalog/api · tableInfo incomplet (schema_name absent) refusé proprement (exit 2)");
  ok(!ar.r.fichier_produit, "traduire-unity-catalog/api · rouge : aucun lineage produit sur un nom qualifié impossible à reconstruire");
  ok((ar.r.details || []).some(x => /schema_name/.test(x) && /reponses #1/.test(x)),
    "traduire-unity-catalog/api · le refus LOCALISE la réponse et nomme le segment manquant");
  const aVoie = lanceScript("traduire-unity-catalog.mjs", [fx("unity-catalog-api-verte.json"), "--voie", "tableau", "--sortie-dir", tmp2]);
  ok(aVoie.exit === 2, "traduire-unity-catalog/api · une voie déclarée inconnue est refusée (exit 2), jamais interprétée");
  const aContre = lanceScript("traduire-unity-catalog.mjs", [fx("unity-catalog-api-verte.json"), "--voie", "system-tables", "--sortie-dir", tmp2]);
  ok(aContre.exit === 2, "traduire-unity-catalog/api · voie déclarée qui contredit le contenu : refusée, jamais arbitrée en silence");
  // Ambiguïté : les deux champs à la fois. Traduire l'un en taisant l'autre perdrait la moitié
  // du relevé sans qu'aucune ligne de la sortie ne le dise.
  const mixte = JSON.parse(fs.readFileSync(fx("unity-catalog-api-verte.json"), "utf8"));
  mixte.lignes = JSON.parse(fs.readFileSync(fx("unity-catalog-verte.json"), "utf8")).lignes;
  const pMixte = path.join(tmp2, "uc-mixte.json");
  fs.writeFileSync(pMixte, JSON.stringify(mixte));
  const am = lanceScript("traduire-unity-catalog.mjs", [pMixte, "--sortie-dir", tmp2]);
  ok(am.exit === 2 && /ambigu/.test(am.r.erreur || ""), "traduire-unity-catalog/api · export portant les DEUX voies : refusé comme ambigu (aucune moitié traduite en silence)");
} finally {
  fs.rmSync(tmp2, { recursive: true, force: true });
}

// ---- verbe traduire-modele-semantique (TF-0894) : le brouillon dit ce qu'il ne sait pas ----
// L'enjeu de ce verbe n'est pas de produire un modèle : c'est de produire un modèle qui ne
// MENT PAS sur ce que TMDL ne porte pas. Un brouillon qui aurait rempli la granularité, la clé
// naturelle et la matrice en bus de valeurs vraisemblables PASSERAIT oracle-modeliser — et
// c'est très exactement le défaut que TF-0911 vient de coûter (trois PASS sur un livrable
// incomplet). Les deux sens sont donc : sans complément, l'oracle réclame EXACTEMENT les
// champs que le verbe a déclarés manquants (ni plus, ni moins) ; avec le complément humain,
// le round-trip PASSE sans retouche.
console.log("\ntraduire-modele-semantique.mjs (verbe, TF-0894) — TMDL → brouillon modele-dimensionnel@1\n");
const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-tmdl-"));
try {
  const pBrouillon = path.join(tmp3, "brouillon.json");
  const b = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--sortie", pBrouillon]);
  ok(b.exit === 0 && b.r.sortie === "OK", "traduire-modele-semantique · fixture verte (dossier TMDL) produit un brouillon (exit 0)");
  ok(b.r.statut === "brouillon" && (b.r.a_completer || []).length > 0,
    "traduire-modele-semantique · sans complément, le statut est « brouillon » et les manques sont ÉNUMÉRÉS — jamais un modèle qui se présente comme fini");
  ok(b.r.compte && b.r.compte.faits === 1 && b.r.compte.dimensions === 3,
    `traduire-modele-semantique · fait et dimensions déduits de l'ORIENTATION des relations (1 fait, 3 dimensions attendus) — obtenu ${JSON.stringify(b.r.compte)}`);
  if (fs.existsSync(pBrouillon)) {
    const m = JSON.parse(fs.readFileSync(pBrouillon, "utf8"));
    const dimCal = m.dimensions.find(d => d.nom === "Calendrier");
    ok(!!dimCal && dimCal.role === "temps" && dimCal.cle_substitution === "date_sk",
      "traduire-modele-semantique · `dataCategory: Time` → rôle temps, et la colonne visée par la relation → clé de SUBSTITUTION (les deux sont LUS)");
    const mes = (m.faits[0].mesures || []);
    ok(mes.find(x => x.nom === "Montant HT").agregation === "somme" && mes.find(x => x.nom === "Commandes").agregation === "compte_distinct",
      "traduire-modele-semantique · l'agrégation se lit à la tête du DAX (SUM → somme, DISTINCTCOUNT → compte_distinct, jamais l'inverse)");
    ok(mes.find(x => x.nom === "Panier moyen").agregation === undefined,
      "traduire-modele-semantique · une mesure dont le DAX ne commence pas par une agrégation reste SANS agrégation — deviner « somme » sur un DIVIDE serait faux et invérifiable");
    ok(dimCal.cle_naturelle === undefined && m.matrice_bus === undefined && m.faits[0].grain === undefined
       && m.decisions === undefined && m.faits[0].pourquoi === undefined,
      "traduire-modele-semantique · clé naturelle, granularité, matrice en bus, décisions et « pourquoi » du fait restent ABSENTS — TMDL ne les porte pas, et un placeholder vraisemblable ferait PASSER l'oracle en mentant (M7, TF-1170)");
    // Le point qui compte : l'oracle réclame EXACTEMENT ce que le verbe a annoncé manquant.
    const r = lance("oracle-modeliser.mjs", pBrouillon);
    const durs = [...new Set((r.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))].sort();
    ok(r.exit === 1 && JSON.stringify(durs) === JSON.stringify(["M2", "M4", "M5", "M6", "M7"]),
      `traduire-modele-semantique → oracle-modeliser : FAIL sur M2, M4, M5, M6, M7 et RIEN d'autre — la liste des règles rouges est celle des champs déclarés « à compléter » (obtenu ${JSON.stringify(durs)})`);
    const annonces = (b.r.a_completer || []).join(" ");
    ok(["M2", "M4", "M5", "M6", "M7"].every(x => annonces.includes(`(${x})`)),
      "traduire-modele-semantique · chaque règle rouge est nommée dans `a_completer` — le lecteur du brouillon sait quoi faire sans exécuter l'oracle");
  }
  // Sens 2 — avec le complément humain, le round-trip PASSE sans retouche (patron d'importer).
  const pComplet = path.join(tmp3, "complet.json");
  const c = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--complement", fx("complement-modele-verte.json"), "--sortie", pComplet]);
  ok(c.exit === 0 && c.r.statut === "complete" && !(c.r.a_completer || []).length,
    "traduire-modele-semantique · avec le complément humain, plus rien à compléter (statut « complete »)");
  if (fs.existsSync(pComplet)) {
    const rc = lance("oracle-modeliser.mjs", pComplet);
    ok(rc.exit === 0 && rc.r.verdict === "PASS", "traduire-modele-semantique + complément → oracle-modeliser.mjs : PASS (round-trip)");
    const m = JSON.parse(fs.readFileSync(pComplet, "utf8"));
    ok((m.faits[0].mesures || []).find(x => x.nom === "Panier moyen").agregation === "non_additive",
      "traduire-modele-semantique · le complément fournit l'agrégation que le DAX ne donnait pas, et le verbe le DIT en avertissement");
  }
  // Un complément qui prétend redéfinir une valeur LUE est ignoré : le modèle livré fait foi.
  const compDerive = JSON.parse(fs.readFileSync(fx("complement-modele-verte.json"), "utf8"));
  compDerive.dimensions.Client.cle_substitution = "id_client_technique";
  const pDerive = path.join(tmp3, "complement-derive.json");
  fs.writeFileSync(pDerive, JSON.stringify(compDerive));
  const pSortieDerive = path.join(tmp3, "derive.json");
  const cd = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--complement", pDerive, "--sortie", pSortieDerive]);
  ok(cd.exit === 0 && (cd.r.avertissements || []).some(x => /redéfinir une valeur LUE/.test(x)),
    "traduire-modele-semantique · un complément qui contredit le modèle livré est AVERTI (une dérive silencieuse ferait diverger le brouillon de sa source)");
  ok(JSON.parse(fs.readFileSync(pSortieDerive, "utf8")).dimensions.find(d => d.nom === "Client").cle_substitution === "client_sk",
    "traduire-modele-semantique · et la valeur LUE l'emporte — le modèle livré fait foi sur ce qu'il porte");
  // Rouge : un modèle sans relation. L'orientation fait/dimension ne se devine pas, et un modèle
  // dimensionnel deviné serait faux SANS ÊTRE DÉTECTABLE (il passerait M1-M6 de bout en bout).
  const rge = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-rouge"), "--sortie-dir", tmp3]);
  ok(rge.exit === 2 && rge.r.sortie === "ECHEC", "traduire-modele-semantique · modèle sans relation active : refus propre (exit 2)");
  ok(!rge.r.fichier_produit && /orientation|relation active/.test(rge.r.erreur || ""),
    "traduire-modele-semantique · rouge : aucun modèle inventé, et le refus dit POURQUOI (l'orientation fait/dimension vient des relations)");
  const abs = lanceScript("traduire-modele-semantique.mjs", ["--modele", path.join(tmp3, "dossier-absent"), "--sortie-dir", tmp3]);
  ok(abs.exit === 2, "traduire-modele-semantique · dossier de modèle introuvable : refus propre (exit 2)");
  const cFaux = path.join(tmp3, "complement-faux-format.json");
  fs.writeFileSync(cFaux, JSON.stringify({ format: "quelque-chose@9" }));
  const cf = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--complement", cFaux, "--sortie-dir", tmp3]);
  ok(cf.exit === 2, "traduire-modele-semantique · complément au mauvais format : refusé, jamais interprété au jugé");
} finally {
  fs.rmSync(tmp3, { recursive: true, force: true });
}

// ---- verbe projeter-evolutions (TF-0937) : la première question d'une équipe data ----
// `lineage@1` porte les sorties proposées et les transformations, jamais la vue colonne par
// colonne de ce qui change dans une couche et d'où ça vient. Elle se reconstituait à la main :
// 397 lignes de provenance chez le produit demandeur. Ce qui se prouve ici : les quatre
// évolutions se DÉDUISENT de la comparaison de deux DDL (jamais d'une heuristique de nom), la
// provenance vient des artefacts fournis ou reste indéterminée EN LE DISANT, et le rendu de
// restitution porte exactement les mêmes lignes que le JSON jugé.
console.log(String.fromCharCode(10) + "projeter-evolutions.mjs (verbe, TF-0937) — DDL × DDL × lineage → evolutions@1" + String.fromCharCode(10));
const tmp5 = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-evolutions-"));
try {
  const pJson = path.join(tmp5, "silver.json");
  const p = lanceScript("projeter-evolutions.mjs", ["--couche", "silver", "--cible", fx("evolutions-cible.sql"),
    "--existant", fx("evolutions-existant.sql"), "--lineage", fx("lineage-verte.json"), "--date", "2026-09-08", "--sortie", pJson]);
  ok(p.exit === 0 && p.r.sortie === "OK", "projeter-evolutions · deux DDL et un lineage produisent une projection (exit 0)");
  ok(p.r.comptes && p.r.comptes.colonnes === 12 && p.r.comptes.tables === 3 &&
     JSON.stringify(p.r.comptes.tables_par_evolution) === JSON.stringify({ table_completee: 1, table_deplacee: 1, table_creee: 1 }),
    `projeter-evolutions · les trois évolutions de TABLE se déduisent de la comparaison des deux DDL, jamais d'un nom : complétée, DÉPLACÉE (même nom court, autre catalogue) et créée — obtenu ${JSON.stringify(p.r.comptes && p.r.comptes.tables_par_evolution)}`);
  const doc = JSON.parse(fs.readFileSync(pJson, "utf8"));
  const ligne = (t, c) => doc.lignes.find(l => l.table.endsWith(t) && l.colonne === c);
  ok(ligne("ventes.ventes", "montant").evolution === "colonne_corrigee" && ligne("ventes.ventes", "montant").type === "DECIMAL(10,2)",
    "projeter-evolutions · un TYPE qui change est lu comme corrigé — c'est ce que l'équipe data cherche en premier, et une lecture par nom seul le raterait");
  // TF-0943 : la provenance n'est plus une CHAÎNE DE TEXTE. Chaque objet cité est RÉSOLU — sa
  // couche, son chemin catalogue.schéma.table.colonne, le RÔLE du champ employé et d'où vient
  // cette explication. « clients Date_Debut, DUREE » ne disait rien de tout cela.
  const objet1 = (t, c) => ligne(t, c).provenance.objets[0];
  ok(ligne("ventes.clients", "id_client").provenance.type === "objets_resolus" &&
     objet1("ventes.clients", "id_client").catalogue === "catalog_any_bronze_d1" &&
     objet1("ventes.clients", "id_client").schema === "brut" &&
     objet1("ventes.clients", "id_client").table === "clients" &&
     objet1("ventes.clients", "id_client").colonne === "id_client" &&
     objet1("ventes.clients", "id_client").source_de_l_explication === "couche_existante",
    `projeter-evolutions · la provenance d'une colonne déplacée RÉSOUT son objet d'origine en catalogue, schéma, table et colonne — obtenu ${JSON.stringify(objet1("ventes.clients", "id_client"))}`);
  ok(ligne("servi.ventes_mensuelles", "total_ht").provenance.type === "objets_resolus" &&
     ligne("servi.ventes_mensuelles", "total_ht").provenance.objets.some(o => o.table === "exports_pgi" && o.schema === "brut" && o.source_de_l_explication === "mapping"),
    "projeter-evolutions · une table déclarée en sortie du lineage RÉSOUT ses ENTRÉES déclarées en objets (granularité table : la colonne reste null, jamais inventée)");
  ok(objet1("ventes.ventes", "id_commande").source_de_l_explication === "commentaire_ddl" &&
     /caisse/.test(objet1("ventes.ventes", "id_commande").explication),
    "projeter-evolutions · le commentaire DDL reste la source la plus proche du producteur : il EXPLIQUE le rôle de l'objet résolu (8 des 33 emplois du retour venaient de là)");
  ok(objet1("ventes.clients", "id_client").couche === "amont" &&
     (p.r.avertissements || []).some(x => /--couche-amont/.test(x)),
    "projeter-evolutions · sans --couche-amont déclarée, la couche d'origine porte la RELATION « amont » et le verbe le DIT — écrire « bronze » serait une affirmation qu'aucun DDL ne porte");

  // TF-0955 : le jeu fermé ne prévoyait que le cas heureux — 255 colonnes sur 396 ne citaient
  // aucun objet résolu et n'avaient rien à dire d'autre que leur propre cellule. Une colonne sans
  // objet nommable dit désormais LEQUEL des quatre cas s'applique, avec sa phrase.
  const nonDoc = doc.lignes.filter(l => l.provenance.type === "non_documentee");
  ok(nonDoc.length === 2 && nonDoc.every(l => (l.provenance.explication || "").split(/\s+/).filter(Boolean).length >= 4),
    `projeter-evolutions · sans commentaire, sans existant et sans lineage, la provenance est NON DOCUMENTÉE avec sa phrase — comptée comme dette, jamais comblée par une provenance vraisemblable (obtenu ${nonDoc.length})`);
  const re = lance("oracle-evoluer.mjs", pJson);
  ok(re.exit === 0 && re.r.verdict === "PASS", "projeter-evolutions → oracle-evoluer.mjs sur la projection produite : PASS (round-trip)");
  ok(JSON.stringify(p.r.comptes.par_provenance) === JSON.stringify({ objets_resolus: 10, non_documentee: 2 }) &&
     re.r.projection.dette.non_documentee === 2 && re.r.projection.dette.part === 16.7,
    `projeter-evolutions → oracle-evoluer · les non_documentee sont comptées et REMONTÉES COMME DETTE (2 sur 12, soit 16,7 %) au lieu d'être laissées passer — obtenu ${JSON.stringify(re.r.projection.dette)}`);

  // Sans --existant, l'état antérieur n'existe pas : tout est lu comme créé, et le verbe le DIT.
  // Un verbe qui se tairait ferait lire une reprise entière comme une construction neuve.
  const pSansExistant = path.join(tmp5, "sans-existant.json");
  const se = lanceScript("projeter-evolutions.mjs", ["--couche", "silver", "--cible", fx("evolutions-cible.sql"), "--date", "2026-09-08", "--sortie", pSansExistant]);
  ok(se.exit === 0 && se.r.comptes.tables_par_evolution.table_creee === 3 && (se.r.avertissements || []).some(x => /état existant/.test(x)),
    "projeter-evolutions · sans --existant, toute table est lue comme CRÉÉE et le verbe l'avertit — vrai d'une couche neuve, faux d'une reprise");
  // Et sans existant ni lineage, un commentaire DDL n'est plus un objet à résoudre : c'est une
  // RÈGLE EN CLAIR, et le type le dit au lieu de la faire passer pour une provenance résolue.
  const docSE = JSON.parse(fs.readFileSync(pSansExistant, "utf8"));
  const rc = docSE.lignes.find(l => l.colonne === "id_commande");
  ok(rc.provenance.type === "regle_en_clair" && rc.provenance.source_de_l_explication === "commentaire_ddl" &&
     docSE.comptes.par_provenance.regle_en_clair > 0 && !docSE.comptes.par_provenance.objets_resolus,
    `projeter-evolutions · sans objet nommable, un commentaire DDL devient une « regle_en_clair » — pas un objet_resolu sans objet (obtenu ${JSON.stringify(docSE.comptes.par_provenance)})`);
  // La couche d'origine DÉCLARÉE remplace la relation « amont », et l'avertissement se tait.
  const pAmont = path.join(tmp5, "amont.json");
  const am = lanceScript("projeter-evolutions.mjs", ["--couche", "silver", "--cible", fx("evolutions-cible.sql"),
    "--existant", fx("evolutions-existant.sql"), "--couche-amont", "bronze", "--date", "2026-09-08", "--sortie", pAmont]);
  const docAmont = JSON.parse(fs.readFileSync(pAmont, "utf8"));
  ok(am.exit === 0 && docAmont.lignes.find(l => l.colonne === "remise").provenance.objets[0].couche === "bronze" &&
     !(am.r.avertissements || []).some(x => /--couche-amont/.test(x)),
    "projeter-evolutions · --couche-amont déclarée : les objets d'origine portent la couche NOMMÉE et l'avertissement se tait — le verbe ne réclame que ce qu'il ne peut pas lire");

  // Le rendu de restitution porte les MÊMES lignes que le JSON jugé : un rendu qui recompterait
  // serait une seconde source de vérité, donc une divergence en attente.
  const pMd = path.join(tmp5, "silver.md");
  const md = lanceScript("projeter-evolutions.mjs", ["--couche", "silver", "--cible", fx("evolutions-cible.sql"),
    "--existant", fx("evolutions-existant.sql"), "--lineage", fx("lineage-verte.json"), "--date", "2026-09-08", "--format", "md", "--sortie", pMd]);
  const texteMd = fs.readFileSync(pMd, "utf8");
  ok(md.exit === 0 && texteMd.split(/\r?\n/).filter(l => /^\| catalog|^\| servi/.test(l)).length === doc.lignes.length &&
     /\| Table \| Colonne \| Type \| Évolution \| Provenance \|/.test(texteMd),
    `projeter-evolutions · le rendu Markdown du chapitre porte les cinq colonnes attendues et AUTANT de lignes que le JSON jugé (${doc.lignes.length})`);
  const pCsv = path.join(tmp5, "silver.csv");
  lanceScript("projeter-evolutions.mjs", ["--couche", "silver", "--cible", fx("evolutions-cible.sql"),
    "--existant", fx("evolutions-existant.sql"), "--lineage", fx("lineage-verte.json"), "--date", "2026-09-08", "--format", "csv", "--sortie", pCsv]);
  const lignesCsv = fs.readFileSync(pCsv, "utf8").trim().split(/\r?\n/);
  ok(lignesCsv[0] === "table;colonne;type;evolution;provenance" && lignesCsv.length === doc.lignes.length + 1,
    `projeter-evolutions · le rendu CSV aussi — même en-tête, mêmes lignes (${lignesCsv.length - 1})`);

  // TF-0942 (retour du 08/09) — la projection n'est plus une liste PLATE : elle porte un ARBRE
  // schéma › table › colonne, statut à CHAQUE niveau et agrégat des enfants chez le parent. Sur la
  // version livrée, 119 lignes Silver et 278 lignes Gold ne portaient de statut qu'à la ligne la
  // plus fine, et aucun schéma n'y apparaissait comme objet.
  ok(JSON.stringify(p.r.comptes.arbre_par_niveau) === JSON.stringify({ schema: 2, table: 3, colonne: 12 }),
    `projeter-evolutions · l'arbre porte les TROIS niveaux, le schéma compris — obtenu ${JSON.stringify(p.r.comptes.arbre_par_niveau)}`);
  const noeud = o => doc.arbre.find(n => n.objet === o);
  ok(noeud("catalog_any_silver_d1.ventes").niveau === "schema" &&
     noeud("catalog_any_silver_d1.ventes").statut === "schema_complete" &&
     JSON.stringify(noeud("catalog_any_silver_d1.ventes").statut_agrege) === JSON.stringify({ table_completee: 1, table_deplacee: 1 }),
    `projeter-evolutions · un SCHÉMA est un OBJET, avec son statut propre et l'agrégat « 2 tables dont 1 déplacée » que le lecteur cherche avant le détail — obtenu ${JSON.stringify(noeud("catalog_any_silver_d1.ventes"))}`);
  ok(noeud("catalog_any_silver_d1.ventes.ventes").parent === "catalog_any_silver_d1.ventes" &&
     noeud("catalog_any_silver_d1.ventes.ventes.montant").parent === "catalog_any_silver_d1.ventes.ventes" &&
     noeud("catalog_any_silver_d1.ventes.ventes.montant").statut === "colonne_corrigee",
    "projeter-evolutions · chaque nœud se rattache au niveau du dessus — la hiérarchie se LIT dans le document, elle ne se reconstitue plus par découpage du nom");
  ok(/\| Niveau \| Objet \| Parent \| Statut \| Statuts des enfants \|/.test(texteMd) &&
     texteMd.split(/\r?\n/).filter(l => /^\| (schema|table|colonne) \|/.test(l)).length === doc.arbre.length,
    `projeter-evolutions · le rendu Markdown porte le tableau à trois niveaux et sa colonne « Niveau » filtrable (${doc.arbre.length} nœuds)`);

  // Deux sens sur EV6. Sens vert : l'arbre produit ci-dessus PASSE (round-trip plus haut) — sans
  // cette moitié, une EV6 qui hurlerait sur tout passerait le self-test. Sens rouge : un arbre qui
  // MENT échoue, et sur EV6 SEULEMENT — une règle qui ferait tomber ses voisines ne prouve rien.
  const plat = JSON.parse(JSON.stringify(doc));
  plat.arbre = plat.arbre.filter(n => n.niveau === "colonne");
  const pPlat = path.join(tmp5, "arbre-plat.json");
  fs.writeFileSync(pPlat, JSON.stringify(plat));
  const rPlat = lance("oracle-evoluer.mjs", pPlat);
  const reglesPlat = [...new Set((rPlat.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(rPlat.exit === 1 && JSON.stringify(reglesPlat) === JSON.stringify(["EV6"]),
    `projeter-evolutions · rouge EV6 : une projection redevenue PLATE (plus que des feuilles) échoue — ni schéma ni table n'y est un objet ; sur EV6 seulement, obtenu ${JSON.stringify(reglesPlat)}`);

  const menteur = JSON.parse(JSON.stringify(doc));
  menteur.arbre.find(n => n.niveau === "schema").statut_agrege = { table_creee: 9 };
  const pMenteur = path.join(tmp5, "arbre-menteur.json");
  fs.writeFileSync(pMenteur, JSON.stringify(menteur));
  const rMenteur = lance("oracle-evoluer.mjs", pMenteur);
  const reglesMenteur = [...new Set((rMenteur.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(rMenteur.exit === 1 && JSON.stringify(reglesMenteur) === JSON.stringify(["EV6"]) &&
     (rMenteur.r.findings || []).some(f => /recompté/.test(f.msg)),
    `projeter-evolutions · rouge EV6 : un agrégat de parent qui annonce 9 tables créées là où ses enfants n'en portent aucune est RECOMPTÉ et refusé — obtenu ${JSON.stringify(reglesMenteur)}`);

  // Rouge : un DDL sans aucune table. Aucune projection inventée — une projection vide se lirait
  // « aucune évolution », ce qui est le contraire de « rien n'a été relevé ».
  const vide = path.join(tmp5, "vide.sql");
  fs.writeFileSync(vide, "-- aucun CREATE TABLE ici\n");
  const rg = lanceScript("projeter-evolutions.mjs", ["--couche", "silver", "--cible", vide, "--sortie-dir", tmp5]);
  ok(rg.exit === 2 && rg.r.sortie === "ECHEC" && !rg.r.fichier_produit,
    "projeter-evolutions · rouge : DDL sans table → refus propre (exit 2), aucune projection inventée");
  const sansCouche = lanceScript("projeter-evolutions.mjs", ["--cible", fx("evolutions-cible.sql"), "--sortie-dir", tmp5]);
  ok(sansCouche.exit === 2, "projeter-evolutions · rouge : sans --couche, refus — deux projections sans couche nommée se confondent");
} finally {
  fs.rmSync(tmp5, { recursive: true, force: true });
}

// ---- EV4 / EV7 : les CINQ types de provenance, et l'existence des objets cités ----
// TF-0955 : le jeu fermé ne prévoyait que le cas heureux. Sur 396 colonnes mesurées, 255 ne
// citaient AUCUN objet résolu — colonne technique de convention, clé construite sur la table
// elle-même, règle en clair, ou rien du tout — et n'avaient rien à dire d'autre que leur propre
// cellule. TF-0943 : quand des objets sont citables, ils sont RÉSOLUS, pas recopiés en prose.
// Le verbe ne produit que trois des cinq types (il ne devine pas une colonne technique à la forme
// de son nom) : sans cette fixture dédiée, `colonne_technique` et `cle_de_la_table` ne seraient
// jamais joués, ni dans leur sens vert ni dans leur sens rouge.
console.log(String.fromCharCode(10) + "provenance typée et résolue (TF-0955 + TF-0943) — cinq types, objets résolus, catalogue joint" + String.fromCharCode(10));
const tmp6 = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-provenance-"));
try {
  const pv = fx("evolutions-provenance-verte.json");
  const docP = JSON.parse(fs.readFileSync(pv, "utf8"));
  const v = lance("oracle-evoluer.mjs", pv);
  ok(v.exit === 0 && v.r.verdict === "PASS",
    "provenance · verte : les CINQ types cohabitent dans un même document et PASSENT — une règle qui mordrait sur les quatre cas sans objet serait désactivée le jour même");
  ok(JSON.stringify(v.r.projection.par_provenance) === JSON.stringify({ cle_de_la_table: 1, colonne_technique: 1, objets_resolus: 2, regle_en_clair: 1, non_documentee: 1 }),
    `provenance · les cinq types sont comptés séparément — obtenu ${JSON.stringify(v.r.projection.par_provenance)}`);
  ok(v.r.projection.dette.non_documentee === 1 && (v.r.findings || []).some(f => f.regle === "EV4" && /DETTE/.test(f.msg)),
    "provenance · la seule `non_documentee` est remontée comme DETTE nommée, pas laissée passer en silence");

  // Rouge EV4 : la phrase déclarée est ce qui distingue « aucun objet nommable, et voici pourquoi »
  // de « rien à signaler ». Sans elle, les quatre types sans objet redeviennent une case vide.
  const sansPhrase = JSON.parse(JSON.stringify(docP));
  sansPhrase.lignes.find(l => l.provenance.type === "colonne_technique").explication = undefined;
  delete sansPhrase.lignes.find(l => l.provenance.type === "colonne_technique").provenance.explication;
  const pSansPhrase = path.join(tmp6, "sans-phrase.json");
  fs.writeFileSync(pSansPhrase, JSON.stringify(sansPhrase));
  const rSansPhrase = lance("oracle-evoluer.mjs", pSansPhrase);
  const reglesSansPhrase = [...new Set((rSansPhrase.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(rSansPhrase.exit === 1 && JSON.stringify(reglesSansPhrase) === JSON.stringify(["EV4"]),
    `provenance · rouge EV4 : une « colonne_technique » sans phrase déclarée échoue, et sur EV4 seulement — obtenu ${JSON.stringify(reglesSansPhrase)}`);

  // Rouge EV7 : un objet cité qui ne dit pas le RÔLE du champ employé est une chaîne de texte
  // déguisée en objet — c'est exactement la provenance que le retour du 08/09 refusait.
  const sansRole = JSON.parse(JSON.stringify(docP));
  delete sansRole.lignes.find(l => l.provenance.type === "objets_resolus").provenance.objets[0].explication;
  const pSansRole = path.join(tmp6, "sans-role.json");
  fs.writeFileSync(pSansRole, JSON.stringify(sansRole));
  const rSansRole = lance("oracle-evoluer.mjs", pSansRole);
  const reglesSansRole = [...new Set((rSansRole.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(rSansRole.exit === 1 && JSON.stringify(reglesSansRole) === JSON.stringify(["EV7"]),
    `provenance · rouge EV7 : un objet cité sans l'explication du RÔLE du champ employé échoue, et sur EV7 seulement — obtenu ${JSON.stringify(reglesSansRole)}`);

  // Rouge EV7 : un dictionnaire cité mais NON DÉCLARÉ au document n'est pas opposable — le
  // lecteur ne peut pas remonter à la définition, et l'explication redevient une affirmation.
  const sansDico = JSON.parse(JSON.stringify(docP));
  delete sansDico.dictionnaires;
  const pSansDico = path.join(tmp6, "sans-dictionnaire.json");
  fs.writeFileSync(pSansDico, JSON.stringify(sansDico));
  const rSansDico = lance("oracle-evoluer.mjs", pSansDico);
  ok(rSansDico.exit === 1 && (rSansDico.r.findings || []).some(f => f.regle === "EV7" && /pas déclaré/.test(f.msg)),
    "provenance · rouge EV7 : un objet expliqué par un dictionnaire que le document ne DÉCLARE pas est refusé — un dictionnaire non déclaré n'est pas opposable");

  // Catalogue joint, deux sens. Vert : tous les objets cités y existent, EV7 se tait sur
  // l'existence. Rouge : un objet absent du catalogue — soit la provenance nomme un objet qui
  // n'existe pas, soit le catalogue est périmé ; dans les deux cas la provenance ment.
  const cat = path.join(tmp6, "catalogue.json");
  fs.writeFileSync(cat, JSON.stringify({ objets: ["catalog_any_silver_d1.gestion_contrats.contrat.montant_mensuel"] }));
  const lanceCat = (cible, catalogue) => {
    try { return { exit: 0, r: JSON.parse(execFileSync(process.execPath, [path.join(ici, "oracle-evoluer.mjs"), cible, "--catalogue", catalogue, "--json-only"], { encoding: "utf8" })) }; }
    catch (e) { return { exit: e.status, r: JSON.parse(String(e.stdout || "{}")) }; }
  };
  const vCat = lanceCat(pv, cat);
  ok(vCat.exit === 0 && vCat.r.verdict === "PASS" && !(vCat.r.findings || []).some(f => f.regle === "EV7" && f.sev === "bloquant"),
    "provenance · vert EV7 : catalogue joint où tous les objets cités existent — PASS, et l'objet expliqué par un dictionnaire déclaré n'est pas réclamé au catalogue");
  const catFaux = path.join(tmp6, "catalogue-perime.json");
  fs.writeFileSync(catFaux, JSON.stringify({ objets: ["catalog_any_silver_d1.gestion_contrats.contrat.autre_colonne"] }));
  const rCat = lanceCat(pv, catFaux);
  const reglesCat = [...new Set((rCat.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(rCat.exit === 1 && JSON.stringify(reglesCat) === JSON.stringify(["EV7"]) &&
     (rCat.r.findings || []).some(f => /absent du catalogue joint/.test(f.msg)),
    `provenance · rouge EV7 : le MÊME document échoue dès que le catalogue joint ne porte pas l'objet cité — obtenu ${JSON.stringify(reglesCat)}`);
  ok((v.r.findings || []).some(f => f.regle === "EV7" && f.sev === "info" && /non jugée/.test(f.msg)),
    "provenance · sans catalogue joint, l'EXISTENCE des objets reste non jugée et l'oracle le DIT — une existence supposée est ce qui a laissé passer trois PASS (TF-0911)");
} finally {
  fs.rmSync(tmp6, { recursive: true, force: true });
}

// ---- TF-0917 : la chaîne TMDL → couverture@1 se ferme SANS transcription ----
// `oracle-couvrir` attendait un inventaire déjà relevé, et le verbe lisait déjà la source qui le
// contient : entre les deux, une recopie à la main (25 requêtes, 160 mesures, 17 relations sur le
// cas réel). Une recopie est l'endroit exact où la couverture ment sans que personne le voie — un
// objet oublié à la transcription n'est orphelin pour personne. Ce qui se prouve ici : l'inventaire
// produit est CONSOMMÉ tel quel par l'oracle, et ce qui reste absent est NOMMÉ, jamais inventé.
console.log(String.fromCharCode(10) + "traduire-modele-semantique --inventaire (TF-0917) — TMDL → couverture@1, chaîne fermée" + String.fromCharCode(10));
const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-inventaire-"));
try {
  const NS = "powerbi://app.powerbi.com/groups/00000000-0000-0000-0000-000000000000/datasets/11111111-1111-1111-1111-111111111111";
  const pCouv = path.join(tmp4, "couverture.json");
  const i = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--inventaire", "--namespace", NS, "--date", "2026-09-08", "--sortie", pCouv]);
  ok(i.exit === 0 && i.r.sortie === "OK", "--inventaire · fixture verte TMDL produit un bloc source.inventaire (exit 0)");
  ok(i.r.compte && i.r.compte.objets === 26 && i.r.compte.par_type.table === 4 && i.r.compte.par_type.colonne === 19 && i.r.compte.par_type.mesure === 3,
    `--inventaire · les objets sont TYPÉS et comptés (4 tables, 19 colonnes, 3 mesures = 26) — obtenu ${JSON.stringify(i.r.compte)}`);
  const doc = JSON.parse(fs.readFileSync(pCouv, "utf8"));
  ok(doc.format === "forge-data/couverture@1" && doc.source.namespace === NS && /^\d{4}-\d{2}-\d{2}$/.test(doc.source.date) && /traduire-modele-semantique/.test(doc.source.releve_par),
    "--inventaire · le document est un couverture@1 daté, dont `releve_par` dit COMMENT l'inventaire a été relevé (CV2 : un inventaire sans provenance n'est pas opposable)");
  ok(doc.source.inventaire.some(o => o.objet === "Ventes[Montant HT]" && o.type === "mesure") &&
     doc.source.inventaire.some(o => o.objet === "Calendrier.trimestre" && o.type === "colonne"),
    "--inventaire · mesures en `Table[Mesure]` et colonnes en `Table.colonne` — la nomenclature que le mapping cite déjà");

  // Sens 1 — ce qui MANQUE est nommé et l'oracle le réclame : le mapping (le livrable jugé) est
  // produit ailleurs, et un bloc vraisemblable posé ici ferait PASSER CV1 en mentant.
  const sansMap = lance("oracle-couvrir.mjs", pCouv).r;
  const durs = [...new Set((sansMap.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))].sort();
  ok(JSON.stringify(durs) === JSON.stringify(["CV1", "CV5"]),
    `--inventaire → oracle-couvrir : FAIL sur CV1 (mapping absent) et CV5 (tout orphelin) et RIEN d'autre — obtenu ${JSON.stringify(durs)}`);
  ok((i.r.a_completer || []).some(x => /mapping/.test(x)),
    "--inventaire · le mapping manquant est nommé dans `a_completer` — le lecteur du brouillon sait quoi faire sans exécuter l'oracle");

  // Sens 2 — la chaîne FERMÉE : le mapping arrive, l'inventaire produit est consommé TEL QUEL,
  // et le verdict est PASS à 26/26. C'est la transcription qui disparaît, pas le jugement.
  doc.mapping = { nom: "mapping-gold-modele-semantique", artefact: "forge/etapes/data/mapping.md", date: "2026-09-08",
    objets_source: ["Ventes[Montant HT]", "Ventes[Commandes]", "Ventes[Panier moyen]"] };
  doc.regles_rattachement = ["Ventes", "Client", "Produit", "Calendrier"].map(t => ({ type: "table_entiere", portee: t,
    motif: `table ${t} reprise intégralement depuis la couche Gold, colonne à colonne` }));
  doc.taux_declare = 100;
  const pFerme = path.join(tmp4, "couverture-fermee.json");
  fs.writeFileSync(pFerme, JSON.stringify(doc, null, 2));
  const ferme = lance("oracle-couvrir.mjs", pFerme);
  ok(ferme.exit === 0 && ferme.r.verdict === "PASS" && ferme.r.couverture.inventorie === 26 && ferme.r.couverture.orphelins === 0 && ferme.r.couverture.taux.retenu === 100,
    `--inventaire + mapping → oracle-couvrir : PASS, 26 inventoriés, 0 orphelin, 100 % (chaîne fermée) — obtenu ${JSON.stringify(ferme.r.couverture)}`);

  // Le `namespace` n'est pas dans TMDL : sans --namespace il reste ABSENT et l'oracle le réclame
  // (CV2). Un namespace vraisemblable posé au jugé mesurerait la couverture d'une autre instance.
  const pSansNs = path.join(tmp4, "sans-namespace.json");
  const sansNs = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--inventaire", "--sortie", pSansNs]);
  ok(sansNs.exit === 0 && (sansNs.r.a_completer || []).some(x => /namespace/.test(x)) && !JSON.parse(fs.readFileSync(pSansNs, "utf8")).source.namespace,
    "--inventaire · sans --namespace, l'INSTANCE reste absente et nommée à compléter — TMDL ne la porte pas, et l'inventer mesurerait autre chose (CV2)");
  const cv2 = (lance("oracle-couvrir.mjs", pSansNs).r.findings || []).filter(f => f.regle === "CV2" && f.sev === "bloquant");
  ok(cv2.length === 1 && /namespace/.test(cv2[0].msg),
    "--inventaire · et l'oracle le RÉCLAME — l'absence n'est pas un silence commode");

  // Rouge : un dossier sans aucun fichier TMDL. Aucun inventaire inventé, refus propre — un
  // inventaire vide rendrait 100 % de couverture sur rien.
  const vide = path.join(tmp4, "modele-vide");
  fs.mkdirSync(vide, { recursive: true });
  const rge = lanceScript("traduire-modele-semantique.mjs", ["--modele", vide, "--inventaire", "--sortie-dir", tmp4]);
  ok(rge.exit === 2 && rge.r.sortie === "ECHEC" && !rge.r.fichier_produit,
    "--inventaire · rouge : dossier sans fichier TMDL → refus propre (exit 2), aucun inventaire inventé");
} finally {
  fs.rmSync(tmp4, { recursive: true, force: true });
}

// ---- isoler-lignes-non-donnees (TF-0976, 14/09/2026) : le pied « Filtres appliqués » est une
// DONNÉE, pas un déchet — deux sorties (lignes, contexte_de_l_extrait), jamais une seule ----
// Mesure réelle : lecture naïve 21 559 lignes contre 21 557 réelles (une ligne vide et un pied
// par feuille), et le pied porte les prédicats qui disent que l'extrait est un instantané FILTRÉ.
console.log(String.fromCharCode(10) + "isoler-lignes-non-donnees (TF-0976) — pied « Filtres appliqués » lu comme donnée, deux sorties" + String.fromCharCode(10));
{
  const v = lanceScript("isoler-lignes-non-donnees.mjs", [fx("extrait-pied-verte.csv")]);
  ok(v.exit === 0 && v.r.sortie === "OK" && v.r.compte.lignes_lues === 4 && v.r.compte.lignes_donnees === 2,
    `isoler-lignes-non-donnees · verte : 4 lignes lues, 2 lignes de DONNÉES (la ligne vide et le pied sont exclus) — obtenu ${JSON.stringify(v.r.compte)}`);
  ok(v.r.compte.par_type.ligne_vide_terminale === 1 && v.r.compte.par_type.pied_filtres_appliques === 1,
    "isoler-lignes-non-donnees · les DEUX lignes non-données sont typées (ligne_vide_terminale, pied_filtres_appliques), jamais confondues");
  ok(!!v.r.contexte_de_l_extrait && v.r.contexte_de_l_extrait.predicats.length === 2 &&
     v.r.contexte_de_l_extrait.predicats.some(p => p.champ === "Period" && p.predicat === "n'est pas nul") &&
     v.r.contexte_de_l_extrait.predicats.some(p => p.champ === "Country_" && p.predicat === "n'est pas vide"),
    `isoler-lignes-non-donnees · contexte_de_l_extrait NOMME les prédicats du pied (le champ ET la condition), pas seulement leur texte brut — obtenu ${JSON.stringify(v.r.contexte_de_l_extrait?.predicats)}`);
  ok(v.r.document.lignes.length === 2 && v.r.document.lignes[0].Period === "202606" && v.r.document.lignes[0].Country_ === "FR",
    "isoler-lignes-non-donnees · les lignes de données rendues sont bien celles d'AVANT le pied, avec l'en-tête pour clé");

  const tmp5 = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-isoler-"));
  const totauxCsv = path.join(tmp5, "totaux.csv");
  fs.writeFileSync(totauxCsv, "Period,Montant" + String.fromCharCode(10) + "202606,1000" + String.fromCharCode(10) + "202606,2000" + String.fromCharCode(10) + "Total,3000" + String.fromCharCode(10));
  const t = lanceScript("isoler-lignes-non-donnees.mjs", [totauxCsv]);
  ok(t.exit === 0 && t.r.compte.lignes_donnees === 2 && t.r.compte.par_type.ligne_totaux === 1 && t.r.contexte_de_l_extrait === null,
    `isoler-lignes-non-donnees · une ligne « Total » est exclue et TYPÉE ligne_totaux ; sans pied « Filtres appliqués », contexte_de_l_extrait reste null (jamais inventé) — obtenu ${JSON.stringify(t.r.compte)}`);
  fs.rmSync(tmp5, { recursive: true, force: true });

  // Rouge : un fichier réduit à son en-tête, sans aucune ligne de donnée. Refus propre — un
  // fichier vide isolé rendrait 100 % de rien, exactement le silence que ce verbe corrige ailleurs.
  const r = lanceScript("isoler-lignes-non-donnees.mjs", [fx("extrait-pied-rouge.csv")]);
  ok(r.exit === 2 && r.r.sortie === "ECHEC" && !r.r.document,
    `isoler-lignes-non-donnees · rouge (en-tête seul) : refus propre (exit 2), aucun extrait inventé — obtenu sortie=${r.r.sortie}`);
}

// ---- traduire-modele-semantique --resolution-references (TF-0972, 14/09/2026) : une resolution
// NOMMEE, insensible a la casse, table porteuse puis modele entier, fermeture transitive ----
// Mesure reelle (Produit-62, RD-10) : une comparaison sensible a la casse perdait une reference
// de colonne d'indice ; une recherche limitee a la table porteuse ne remontait que 2 colonnes
// sur 8 pour une mesure qui en referencait une autre, VIVANT DANS UNE AUTRE TABLE.
console.log(String.fromCharCode(10) + "traduire-modele-semantique --resolution-references (TF-0972) — casse, ordre de recherche, fermeture transitive" + String.fromCharCode(10));
{
  const r = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-resolution-verte"), "--resolution-references"]);
  ok(r.exit === 0 && r.r.sortie === "OK", "--resolution-references · fixture verte produit un relevé (exit 0)");
  ok(r.r.compte.references === 5 && r.r.compte.resolues === 3 && r.r.compte.non_resolues === 1 && r.r.compte.ambigues === 1,
    `--resolution-references · les 5 références du modèle sont classées SANS reste (3 résolues, 1 ambiguë, 1 non résolue) — obtenu ${JSON.stringify(r.r.compte)}`);
  const doc = r.r.document;
  const mesure = cle => doc.mesures.find(m => m.mesure === cle);
  ok(mesure("Indexation[Indexation Indice]").references[0].resolution.statut === "resolue" &&
     mesure("Indexation[Indexation Indice]").references[0].resolution.objet === "Val_indice_indexation",
    "--resolution-references · CASSE : « Indexation[VAL_INDICE_INDEXATION] » se résout sur la colonne « Val_indice_indexation » — un index sensible à la casse perdait cette référence (RD-10)");
  ok(mesure("Certified_Turnover[AR1]").references[0].resolution.statut === "resolue" &&
     mesure("Certified_Turnover[AR1]").references[0].resolution.table === "Invoiced_Rent" &&
     mesure("Certified_Turnover[AR1]").references[0].resolution.type === "mesure",
    "--resolution-references · RÉFÉRENCE NON QUALIFIÉE : « [Invoiced Rent N_] », absente de sa table porteuse, est résolue dans le RESTE DU MODÈLE (mesure d'une autre table) — l'ordre de résolution qui manquait au calcul manuel");
  ok(JSON.stringify(mesure("Certified_Turnover[AR1]").colonnes_atteintes) === JSON.stringify(["Invoiced_Rent.Montant"]),
    `--resolution-references · FERMETURE TRANSITIVE : AR1 ne référence qu'une MESURE, et atteint pourtant sa colonne de base (Invoiced_Rent.Montant) — obtenu ${JSON.stringify(mesure("Certified_Turnover[AR1]").colonnes_atteintes)}`);
  ok(mesure("Certified_Turnover[Mesure Ambigue]").references[0].resolution.statut === "ambigue" &&
     mesure("Certified_Turnover[Mesure Ambigue]").references[0].resolution.candidats.length === 2,
    "--resolution-references · AMBIGUÏTÉ : « [Devise] », absente de sa table porteuse et présente dans DEUX autres tables, est déclarée AMBIGUË avec ses candidats nommés — jamais résolue au hasard");
  ok(doc.journal.non_resolues.length === 1 && doc.journal.non_resolues[0].reference === "[Champ_Inexistant]" &&
     doc.journal.ambigues.length === 1,
    "--resolution-references · le JOURNAL porte les non-résolues ET les ambiguës, nommées, à côté du résultat — jamais un compte seul");

  const videResol = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-resolution-vide-"));
  const rr = lanceScript("traduire-modele-semantique.mjs", ["--modele", videResol, "--resolution-references"]);
  ok(rr.exit === 2 && rr.r.sortie === "ECHEC" && !rr.r.document,
    "--resolution-references · rouge : dossier sans fichier TMDL → refus propre (exit 2), aucune résolution inventée");
  fs.rmSync(videResol, { recursive: true, force: true });
}

// ---- traduire-modele-semantique --usage-restitution (TF-0971, 14/09/2026) : trois populations,
// jamais une seule mesure — la couverture se mesure D'ABORD sur ce qui est mobilisé ----
// Mesure réelle (Produit-62, RD-9) : 66 colonnes seulement mobilisées sur 342 (21 projetées,
// 45 lues par mesure), 276 jamais lues, 10 tables sur 27 inutilisées. Des 38 orphelines du
// mapping, 20 sont réellement mobilisées et 18 ne le sont pas — la dette réelle est deux fois
// plus petite que celle qu'`oracle-couvrir` seul annonce.
console.log(String.fromCharCode(10) + "traduire-modele-semantique --usage-restitution (TF-0971) — trois populations + croisement couverture" + String.fromCharCode(10));
{
  const u = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--usage-restitution", "--mise-en-page", fx("mise-en-page-verte.json"), "--orphelins", fx("orphelins-usage-verte.json")]);
  ok(u.exit === 0 && u.r.sortie === "OK", "--usage-restitution · fixture verte produit un relevé (exit 0)");
  ok(u.r.compte.colonnes_modele === 19 && u.r.compte.affichee === 4 && u.r.compte.lue_par_mesure === 2 && u.r.compte.jamais_lue === 13,
    `--usage-restitution · les 19 colonnes du modèle se répartissent en TROIS populations sans reste (4 affichées, 2 lues par mesure, 13 jamais lues) — obtenu ${JSON.stringify(u.r.compte)}`);
  const pop = u.r.document.populations;
  ok(pop.affichee.includes("Calendrier.annee") && pop.affichee.includes("Client.segment"),
    "--usage-restitution · AFFICHEE : une colonne projetée telle quelle par un visuel (Calendrier.annee, Client.segment) — nommée, pas seulement comptée");
  ok(pop.lue_par_mesure.includes("Ventes.montant_ht") && pop.lue_par_mesure.includes("Ventes.id_commande") && !pop.affichee.includes("Ventes.montant_ht"),
    "--usage-restitution · LUE_PAR_MESURE : « Ventes[Panier moyen] » n'est JAMAIS projetée en colonne, et pourtant ses DEUX colonnes de base (via DIVIDE sur deux autres mesures, fermeture transitive TF-0972) sont comptées lues");
  ok(!pop.jamais_lue.includes("Ventes.montant_ht") && pop.jamais_lue.includes("Ventes.quantite"),
    "--usage-restitution · JAMAIS_LUE : une colonne ni projetée ni atteinte par une mesure affichée (Ventes.quantite) — trois populations disjointes, jamais confondues");
  ok(u.r.champs_inconnus.length === 1 && u.r.champs_inconnus[0].champ === "Ventes.champ_invente" && u.r.champs_inconnus[0].visuel === "Widget casse",
    `--usage-restitution · un champ projeté qui ne résout à RIEN du modèle est nommé « champ_inconnu », jamais silencieusement ignoré — obtenu ${JSON.stringify(u.r.champs_inconnus)}`);
  ok(!u.r.champs_inconnus.some(c => c.visuel === "Logo"),
    "--usage-restitution · un visuel déclaré `porte_donnees: false` (Logo) ne projette RIEN — sa projection invalide n'est même pas signalée, elle est ignorée par construction");
  const cc = u.r.document.croisement_couverture;
  ok(cc.orphelins_declares === 3 && cc.orphelins_mobilises === 1 && cc.orphelins_non_mobilises === 2 && cc.detail.mobilises[0] === "Ventes.montant_ht",
    `--usage-restitution · CROISEMENT COUVERTURE (règle opposable, TF-0971) : sur 3 orphelines déclarées par oracle-couvrir, 1 est réellement MOBILISÉE (lue_par_mesure) et 2 ne le sont pas — la dette bloquante n'est pas la dette annoncée — obtenu ${JSON.stringify(cc)}`);

  // Rouge : une mise en page dans un format non reconnu → refus propre, aucun usage inventé.
  const ur = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--usage-restitution", "--mise-en-page", fx("mise-en-page-rouge.json")]);
  ok(ur.exit === 2 && ur.r.sortie === "ECHEC" && !ur.r.document,
    `--usage-restitution · rouge : mise en page au format non reconnu → refus propre (exit 2), aucun usage inventé — obtenu ${ur.r.erreur}`);
}

// ---- RS2 : la doctrine du repli, deux sens (TF-1176, 17/09/2026) ----
// Une mise en page GÉNÉRÉE alors que le rapport d'origine est fourni n'est pas interdite : elle
// est un REPLI, et un repli se déclare avec son motif. Les deux sens comptent également. Sens
// vert : le repli motivé PASSE, et les écarts sont tout de même COMPTÉS et NOMMÉS — un repli qui
// tairait ce qu'il coûte serait la même cécité, déplacée d'un cran. Sens rouge : le même document
// sans motif ÉCHOUE sur RS2, et sur RS2 seulement — c'est le défaut d'origine, une mise en page
// réinventée que personne n'a décidée, sous 23 contrôles PASS.
console.log(String.fromCharCode(10) + "RS2 (TF-1176) — mise en page générée : un repli motivé, jamais un défaut par omission" + String.fromCharCode(10));
{
  const v = lance("oracle-reconstruire.mjs", fx("reconstruction-repli-verte.json"));
  const av = (v.r.findings || []).filter(f => f.sev === "avertissement");
  ok(v.exit === 0 && v.r.verdict === "PASS" && av.length > 0,
    `RS2 · repli MOTIVÉ : PASS, et les ${av.length} écart(s) de mise en page restent comptés et nommés en avertissement — obtenu ${v.r.verdict}`);
  ok(v.r.compte && v.r.compte.ecarts_geometrie === 8,
    `RS2 · repli motivé : le COÛT du repli est chiffré (8 écarts de géométrie attendus) — obtenu ${JSON.stringify(v.r.compte && v.r.compte.ecarts_geometrie)}`);
  const r = lance("oracle-reconstruire.mjs", fx("reconstruction-repli-rouge.json"));
  const durs = [...new Set((r.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(r.exit === 1 && r.r.verdict === "FAIL" && JSON.stringify(durs) === JSON.stringify(["RS2"]),
    `RS2 · repli SANS motif : FAIL sur RS2 et sur RS2 seulement — obtenu ${r.r.verdict} ${JSON.stringify(durs)}`);
  ok((r.r.findings || []).some(f => f.regle === "RS2" && f.sev === "info" && /personne ne l'a décidé/.test(f.msg)),
    "RS2 · le verdict DIT que le repli n'a pas été décidé — un message qui féliciterait un repli non motivé serait pire que pas de message");
}

// ---- RN1/RN2 : la chaîne TMDL → inventaire → rendu se ferme SANS transcription (TF-1175) ----
// L'inventaire du modèle est la SECONDE source sans laquelle RN2 ne peut rien dire — et une
// seconde source recopiée à la main est l'endroit exact où le contrôle ment (leçon TF-0911,
// mécanisée par TF-0917). `inventaire_ref` reprend donc le `couverture@1` que
// `traduire-modele-semantique --inventaire` produit déjà, sans une ligne retapée. Le cas joué
// ici est celui de la mise en page de fixture : un visuel projette un champ qui n'existe nulle
// part dans le modèle, et un visuel SANS données en projette un autre — le premier est bloqué,
// le second ignoré par construction.
console.log(String.fromCharCode(10) + "RN1/RN2 (TF-1175) — inventaire repris du modèle, jamais retapé" + String.fromCharCode(10));
const tmpRendu = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-rendu-"));
try {
  const pCouverture = path.join(tmpRendu, "couverture.json");
  const inv = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--inventaire",
    "--namespace", "powerbi://fixture/instance-de-test", "--sortie", pCouverture]);
  ok(inv.exit === 0 && fs.existsSync(pCouverture), "RN1 · l'inventaire du modèle est produit par le verbe (aucune transcription à la main)");
  const pRendu = path.join(tmpRendu, "rendu.json");
  fs.writeFileSync(pRendu, JSON.stringify({
    format: "forge-data/rendu@1", id: "rendu_chaine_fermee",
    mise_en_page: JSON.parse(fs.readFileSync(fx("mise-en-page-verte.json"), "utf8")),
    inventaire_ref: "couverture.json",
    gestes_de_verification: [{ geste: "export PDF depuis le service puis lecture de l'image du fichier exporté",
      fait_le: "2026-09-17", resultat: "2 pages avec données, aucun libellé d'erreur du service" }],
  }));
  const r = lance("oracle-rendre.mjs", pRendu);
  const durs = [...new Set((r.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(r.exit === 1 && JSON.stringify(durs) === JSON.stringify(["RN2"]),
    `RN1/RN2 · inventaire repris par \`inventaire_ref\` : FAIL sur RN2 et RIEN d'autre — obtenu ${JSON.stringify(durs)}`);
  const rn2 = (r.r.findings || []).filter(f => f.regle === "RN2");
  ok(rn2.length === 1 && rn2[0].msg.includes("Ventes.champ_invente") && /Widget casse/.test(rn2[0].where),
    `RN1/RN2 · le champ fantôme est NOMMÉ avec son visuel — un compte anonyme ne se corrige pas (obtenu ${rn2.map(f => f.where).join(",") || "rien"})`);
  ok(!rn2.some(f => /Logo/.test(f.where)),
    "RN1/RN2 · le visuel déclaré `porte_donnees: false` (Logo) n'est jugé sur aucune liaison — juger un logo sur ses champs serait un faux positif, et un oracle à faux positifs se désactive");
} finally {
  fs.rmSync(tmpRendu, { recursive: true, force: true });
}

// ---- DL4 : servir tout le modèle est l'excédent, et la chaîne le mesure sans transcription ----
// (TF-1180, 17/09/2026) Le défaut mesuré tient en une phrase : le périmètre du rapport migré a été
// pris au MODÈLE d'origine (342 colonnes) et non aux VISUELS (66 colonnes lues par 83 champs).
// Le cas est rejoué ici à l'échelle de la fixture, et par la CHAÎNE, sans une ligne retapée :
// `--inventaire` produit le périmètre qu'on publierait en servant tout le modèle, et
// `--usage-restitution` produit ce que les visuels lisent vraiment. L'oracle soustrait.
console.log(String.fromCharCode(10) + "DL4 (TF-1180) — servir tout le modèle : l'excédent se mesure, il ne se discute pas" + String.fromCharCode(10));
const tmpPerim = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-perimetre-"));
try {
  const pCouv = path.join(tmpPerim, "couverture.json");
  const inv = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--inventaire",
    "--namespace", "powerbi://fixture/instance-de-test", "--sortie", pCouv]);
  const pUsage = path.join(tmpPerim, "usage.json");
  const us = lanceScript("traduire-modele-semantique.mjs", ["--modele", fx("modele-semantique-verte"), "--usage-restitution",
    "--mise-en-page", fx("mise-en-page-verte.json"), "--sortie", pUsage]);
  ok(inv.exit === 0 && us.exit === 0 && fs.existsSync(pCouv) && fs.existsSync(pUsage),
    "DL1 · le périmètre livré et l'usage relevé sont PRODUITS par le verbe (aucune transcription à la main, leçon TF-0911)");

  const pPerim = path.join(tmpPerim, "perimetre.json");
  fs.writeFileSync(pPerim, JSON.stringify({
    format: "forge-data/perimetre@1", id: "perimetre_tout_le_modele",
    releve: { par: "traduire-modele-semantique --usage-restitution", date: "2026-09-17", source: "modèle d'origine de la fixture" },
    mise_en_page: JSON.parse(fs.readFileSync(fx("mise-en-page-verte.json"), "utf8")),
    usage_ref: "usage.json", livre_ref: "couverture.json",
  }));
  const r = lance("oracle-delimiter.mjs", pPerim);
  const durs = [...new Set((r.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))].sort();
  ok(r.exit === 1 && JSON.stringify(durs) === JSON.stringify(["DL3", "DL4"]),
    `DL4 · périmètre pris au MODÈLE : FAIL sur DL4 (excédent) et DL3 (champ affiché absent), et rien d'autre — obtenu ${JSON.stringify(durs)}`);
  const p = r.r.perimetre;
  ok(p && p.livres === 26 && p.lus === 11 && p.excedent === 15 && p.exclus === 0 && p.taux.lu === 42.3,
    `DL4 · les comptes sont RECALCULÉS depuis les deux sources : 26 objets publiés, 11 lus, 15 en excédent, 42,3 % — obtenu ${JSON.stringify(p && { livres: p.livres, lus: p.lus, excedent: p.excedent, taux: p.taux.lu })}`);
  const dl4 = (r.r.findings || []).filter(f => f.regle === "DL4" && f.sev === "bloquant");
  ok(dl4.length === 1 && /13 colonne\(s\), 2 mesure\(s\)/.test(dl4[0].msg) && /Calendrier\.date_sk/.test(dl4[0].msg),
    `DL4 · l'excédent est compté PAR TYPE et ses objets sont NOMMÉS — un total anonyme ne se retire pas (obtenu ${dl4.map(f => f.msg.slice(0, 80)).join(" | ") || "rien"})`);
  // Ce que l'excédent contient ici dit la règle mieux qu'une phrase : trois clés de substitution
  // et deux mesures intermédiaires, c'est-à-dire des objets NÉCESSAIRES que rien n'affiche. Ils ne
  // se taisent pas et ne se devinent pas : ils se DÉCLARENT (`lectures_declarees`), et c'est ce
  // que le périmètre réduit ci-dessous fait pour les mesures.
  ok(/Client\.client_sk/.test(dl4[0].msg) && p.excedent_par_type.mesure === 2,
    "DL4 · clés de substitution et mesures intermédiaires tombent en excédent tant que leur lecture n'est pas DÉCLARÉE — l'oracle ne devine aucune nécessité structurelle");

  // Le sens qui compte autant : le MÊME périmètre, réduit à ce que les visuels lisent et aux
  // objets structurellement nécessaires, PASSE. Un oracle qui refuserait aussi le périmètre juste
  // serait inapplicable, et se ferait désactiver le jour de sa première migration.
  const couv = JSON.parse(fs.readFileSync(pCouv, "utf8"));
  const usage = JSON.parse(fs.readFileSync(pUsage, "utf8"));
  const lus = new Set([...usage.populations.affichee, ...usage.populations.lue_par_mesure].map(x => x.toLowerCase()));
  const restreint = couv.source.inventaire.filter(o => {
    const c = o.objet.toLowerCase();
    return lus.has(c) || o.type === "mesure" || (o.type === "table" && [...lus].some(x => x.startsWith(c + ".")));
  });
  const pReduit = path.join(tmpPerim, "perimetre-reduit.json");
  fs.writeFileSync(pReduit, JSON.stringify({
    format: "forge-data/perimetre@1", id: "perimetre_reduit_a_ce_qui_est_lu",
    releve: { par: "traduire-modele-semantique --usage-restitution", date: "2026-09-17", source: "modèle d'origine de la fixture" },
    mise_en_page: {
      format: "forge-data/mise-en-page@1", rapport: "mise en page de l'origine, visuels cassés écartés",
      pages: JSON.parse(fs.readFileSync(fx("mise-en-page-verte.json"), "utf8")).pages
        .map(pg => ({ ...pg, visuels: pg.visuels.filter(v => v.visuel !== "Widget casse") })),
    },
    usage_ref: "usage.json", livre: restreint,
    lectures_declarees: restreint.filter(o => o.type === "mesure" && !lus.has(o.objet.toLowerCase()))
      .map(o => ({ objet: o.objet, type: "mesure_intermediaire", par: "Ventes[Panier moyen]" })),
  }));
  const rv = lance("oracle-delimiter.mjs", pReduit);
  ok(rv.exit === 0 && rv.r.verdict === "PASS" && rv.r.perimetre.excedent === 0,
    `DL4 · le périmètre RÉDUIT à ce que les visuels lisent PASSE, zéro excédent — obtenu ${rv.r.verdict} ${JSON.stringify(rv.r.perimetre && rv.r.perimetre.excedent)}`);
} finally {
  fs.rmSync(tmpPerim, { recursive: true, force: true });
}

// ---- CH3/CH6 : la procédure de la forge passe SON PROPRE contrôle (TF-1179, 17/09/2026) ----
// Un contrôle qui ne juge que ses fixtures ne prouve rien de l'artefact qu'il est censé tenir : la
// procédure de migration écrite dans `references/` est donc JOUÉE ici, et sa déclaration machine
// doit rester alignée sur le document que les humains lisent. Le sens rouge est joué sur cette
// même procédure, mutée en mémoire : un porteur qui disparaît doit la faire échouer — sans quoi
// la garde serait verte pour toujours, y compris le jour où un oracle est renommé.
console.log(String.fromCharCode(10) + "CH3/CH6 (TF-1179) — la procédure de migration passe son propre contrôle" + String.fromCharCode(10));
{
  const pChaine = path.join(ici, "..", "references", "migration-rapport-powerbi.chaine.json");
  const v = lance("oracle-enchainer.mjs", pChaine);
  ok(v.exit === 0 && v.r.verdict === "PASS" && v.r.chaine.etapes === 10 && v.r.chaine.etapes_absentes_du_document === 0,
    `CH6 · la procédure de migration : 10 étapes déclarées, toutes citées par le document lu par les humains — obtenu ${v.r.verdict} ${JSON.stringify(v.r.chaine && { etapes: v.r.chaine.etapes, absentes: v.r.chaine.etapes_absentes_du_document })}`);
  ok(v.r.chaine.porteurs.geste_humain === 3 && v.r.chaine.regles_verifiees === 39,
    `CH4/CH5 · les 39 règles citées par les étapes EXISTENT dans leur porteur, et les 3 gestes qui ne se mécanisent pas déclarent leur enregistreur — obtenu ${JSON.stringify(v.r.chaine && { gestes: v.r.chaine.porteurs.geste_humain, regles: v.r.chaine.regles_verifiees })}`);

  const tmpCh = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-chaine-"));
  try {
    const mut = JSON.parse(fs.readFileSync(pChaine, "utf8"));
    mut.racine = path.join(ici, "..");   // la copie vit hors du dépôt : la racine reste celle de la forge
    mut.document = path.join(ici, "..", "references", "MIGRATION-RAPPORT-POWERBI.md");
    const cible = mut.etapes.find(e => e.porteur.type === "oracle");
    cible.porteur.chemin = "oracles/oracle-qui-a-ete-renomme.mjs";
    const pMut = path.join(tmpCh, "chaine-mutee.json");
    fs.writeFileSync(pMut, JSON.stringify(mut));
    const r = lance("oracle-enchainer.mjs", pMut);
    const durs = [...new Set((r.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
    ok(r.exit === 1 && JSON.stringify(durs) === JSON.stringify(["CH3"]),
      `CH3 · la MÊME procédure dont un porteur a été renommé ÉCHOUE, sur CH3 et sur CH3 seulement — obtenu ${r.r.verdict} ${JSON.stringify(durs)}`);
    ok((r.r.findings || []).some(f => f.regle === "CH3" && /oracle-qui-a-ete-renomme/.test(f.msg) && /E\d/.test(f.where)),
      "CH3 · le porteur manquant est nommé AVEC son étape — une chaîne qui dirait seulement « un porteur manque » ne se répare pas");
  } finally {
    fs.rmSync(tmpCh, { recursive: true, force: true });
  }
}

console.log(`\nSelf-test forge-data : ${pass} PASS, ${echec} FAIL`);
process.exit(echec ? 1 : 0);
