#!/usr/bin/env node
// self-test.mjs — double sens des quatre oracles de discipline (fixtures synthétiques) :
// chaque verte PASSE (exit 0), chaque rouge ÉCHOUE (exit 1) en déclenchant les règles
// attendues, avec findings localisants. Inclut aussi le round-trip du verbe importer
// (TF-0139) : brouillon produit → doit PASSER oracle-profiler/oracle-contractualiser.
// À rejouer après toute modification.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const ici = path.dirname(fileURLToPath(import.meta.url));
const fx = f => path.join(ici, "..", "fixtures", f);
// TF-1196 — le périmètre des oracles « registres machine » se LIT sur le disque, comme le fait
// déjà la boucle voisine TF-0916 (plus bas) pour le non_juge : un oracle neuf n'entre plus par
// une liste écrite à la main qui se périme au premier ajout (oracle-qualifier.mjs, livré le
// 19/09, en était absent sans que rien le dise — même classe de dérive que TF-1044).
const oraclesMachineSurDisque = (dir) => fs.readdirSync(dir).filter(f => /^oracle-.+\.mjs$/.test(f)).sort();
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
  // RS7 (TF-1188, 18/09) s'y ajoute : « Loyer annuel » affiché DEUX fois à l'origine et une seule au
  // produit — une occurrence perdue qu'un décompte d'en-têtes DISTINCTS ne voit pas (défaut RF-29).
  { oracle: "oracle-reconstruire.mjs", verte: "reconstruction-verte.json", rouge: "reconstruction-rouge.json", regles: ["RS3", "RS4", "RS5", "RS6", "RS7"] },
  // rendre (TF-1175, 17/09) : la rouge porte un champ projeté absent de l'inventaire du modèle
  // (RN2), une projection écrite en mesure mais inventoriée en colonne (RN3), un visuel porteur
  // de données sans aucune projection affichée (RN4), et un geste de vérification du rendu en
  // deux mots, sans date (RN5) — c'est-à-dire un livrable déclaré rendu sur la seule lecture de
  // son fichier, le défaut exact de RF-21.
  // RN6 (TF-1188, 18/09) s'y ajoute : la rouge porte AUSSI le geste d'export du 15/09 tel qu'il a été
  // rendu — `Succeeded` en 569 s, 1 415 octets, une page à ZÉRO caractère, aucun libellé d'erreur
  // cherché, et le fichier jamais téléchargé. Sans RN6, ce geste-là passait RN5 sans un mot.
  { oracle: "oracle-rendre.mjs", verte: "rendu-verte.json", rouge: "rendu-rouge.json", regles: ["RN2", "RN3", "RN4", "RN5", "RN6"] },
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
  // qualifier (TF-1186, 19/09) : la rouge EST le défaut mesuré — cinq dimensions déclarées vertes,
  // la sixième absente du document (QR1, avec une ancre sans auteur), un angle mort en un mot (QR2),
  // une preuve qui cite une règle que son porteur ne porte pas et une autre dont le porteur n'existe
  // pas (QR3), les interactions déclarées conformes sur la foi d'un export PDF et outillées de trois
  // gestes seulement (QR4), un écart « assumé » que nulle décision n'a tranché et une dimension
  // conforme qui porte un écart non assumé (QR5), et par-dessus « remplaçable » (QR6).
  { oracle: "oracle-qualifier.mjs", verte: "qualification-rapport-verte.json", rouge: "qualification-rapport-rouge.json", regles: ["QR1", "QR2", "QR3", "QR4", "QR5", "QR6"] },
  // qualifier, classe « définition changée » (TF-1190, 19/09) : la rouge EST le défaut mesuré, les
  // quatre écarts partis au même bac — un recalcul de la couche cible rangé « assumé » sans la
  // définition d'aucun des deux côtés, une définition changée dont la cible et la question manquent,
  // une autre déclarée tranchée sans l'accord du commanditaire (QR7), et un test de fractions dont
  // la part est recopiée (100 % contre 1,6 % recalculés) et dont la conclusion contredit sa propre
  // mesure (QR8). Paire dédiée : sans elle, ces deux règles ne seraient jouées par personne.
  { oracle: "oracle-qualifier.mjs", verte: "qualification-definition-verte.json", rouge: "qualification-definition-rouge.json", regles: ["QR7", "QR8"] },
  // anonymiser (TF-2011, 29/10/2026, décision D-91 (a)) : une verte produite PAR LE VERBE sur une
  // source synthétique canonisée par PostgreSQL, et quatre rouges, un défaut chacune — le courriel
  // source gardé (AN3), des empreintes SHA-256 de noms déclarées « remplacées » plus un prénom déclaré
  // « hacher » (AN4), deux personnes isolées dans une classe de 2 (AN5), une classe entière portant
  // la même pathologie (AN7). Le bloc « anonymiser (TF-2011) » plus bas prouve que chacune échoue sur
  // SA règle seule, et joue une rouge générée pour chacune des autres règles.
  { oracle: "oracle-anonymiser.mjs", verte: "anonymisation-verte", rouge: "anonymisation-identifiant-rouge", regles: ["AN3"] },
  { oracle: "oracle-anonymiser.mjs", verte: "anonymisation-verte", rouge: "anonymisation-hachage-rouge", regles: ["AN4"] },
  { oracle: "oracle-anonymiser.mjs", verte: "anonymisation-verte", rouge: "anonymisation-k-rouge", regles: ["AN5"] },
  { oracle: "oracle-anonymiser.mjs", verte: "anonymisation-verte", rouge: "anonymisation-inference-rouge", regles: ["AN7"] },
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

// ---- RC7 (TF-1195, retour RF-31 (4) « Produit-62 - RETOURS - 20260918d ») : le COMPTE des
// entités identiques et en écart, DEUX SENS ----
// La boucle ci-dessus prouve que RC5 se déclenche sur l'écart hors tolérance. Elle ne prouve
// pas que le CONTEXTE du défaut est rendu : sans lui, « 2 écarts hors tolérance » se lit comme
// un défaut général au lieu de 2 entités sur un total donné, identiques pour le reste — même
// lacune que celle qui a coûté CV5/CV6 (TF-0911) et R5 (TF-0378) avant elle.
console.log(String.fromCharCode(10) + "RC7 (TF-1195) — le compte des entités identiques et en écart, DEUX SENS" + String.fromCharCode(10));
{
  // Sens vert : reconciliation-verte.json PASSE (l'écart de 0,02 sur ca_ht_2026_08 entre dans
  // la tolérance déclarée) et porte quand même son compte — un compte qui n'apparaîtrait que
  // sur échec serait aussi trompeur qu'un compte toujours à zéro.
  const v = lance("oracle-reconcilier.mjs", fx("reconciliation-verte.json")).r;
  ok(v.verdict === "PASS" && v.compte && v.compte.comparees === 3 && v.compte.identiques === 2 && v.compte.en_ecart === 1,
    `RC7 · verte : PASS avec 1 entité en écart (tolérée) contre 2 identiques sur 3 comparées — obtenu ${JSON.stringify(v.compte)}`);
  const rc7v = (v.findings || []).filter(f => f.regle === "RC7");
  ok(rc7v.length === 1 && rc7v[0].sev === "info" && /1 entité\(s\) en écart contre 2 identique\(s\) sur 3/.test(rc7v[0].msg),
    `RC7 · verte : le compte est LISIBLE dans les findings, pas seulement dans un champ machine — obtenu ${rc7v[0] && rc7v[0].msg}`);

  // Sens rouge : reconciliation-rouge.json ÉCHOUE (RC2 tolérance absente, RC4 mesure sans
  // homologue, RC5 écart hors tolérance) et le compte reste JUSTE malgré l'échec : 1 entité
  // identique (commandes_2026_08), 1 en écart (ca_ht_2026_08) — clients_actifs_2026_08, sans
  // homologue, n'est PAS une comparaison et ne doit compter ni pour l'un ni pour l'autre.
  const r = lance("oracle-reconcilier.mjs", fx("reconciliation-rouge.json")).r;
  ok(r.verdict === "FAIL" && r.compte && r.compte.comparees === 2 && r.compte.identiques === 1 && r.compte.en_ecart === 1,
    `RC7 · rouge : FAIL, et le compte ne mélange pas une mesure SANS homologue (clients_actifs_2026_08) avec une comparaison réelle — obtenu ${JSON.stringify(r.compte)}`);
  const rc7r = (r.findings || []).filter(f => f.regle === "RC7");
  ok(rc7r.length === 1 && rc7r[0].sev === "info",
    "RC7 · rouge : le compte est rendu même quand la réconciliation ÉCHOUE — un défaut ne doit pas faire taire le contexte qui le relativise");
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
  // TF-1196 : la part « oracles » de la liste se DÉRIVE du disque (tous les oracle-*.mjs du
  // dépôt) au lieu de se choisir à la main — un oracle neuf y entre sans édition de cette liste.
  // La part hors oracle (self-test.mjs lui-même, scripts et références où « grain » peut aussi
  // fuiter en prose) reste déclarée : ni un oracle, ni couverte par le motif ci-dessus.
  const FICHIERS_MACHINE = [
    ...oraclesMachineSurDisque(ici).map(f => `oracles/${f}`),
    "oracles/self-test.mjs",
    "scripts/traduire-modele-semantique.mjs", "scripts/traduire-unity-catalog.mjs",
    "references/STANDARDS-DATA.md", "references/profils-moteur/LISEZMOI.md", "references/profils-moteur/databricks.md",
    "references/profils-moteur/supabase.md",
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

  // TF-1196 · cas de banc, deux sens : un oracle NEUF posé sur le disque est pris par la garde
  // sans qu'aucune liste soit éditée à la main, et un fichier posé qui n'est PAS un oracle
  // n'y entre pas à tort.
  const bancDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-fichiers-machine-"));
  try {
    fs.writeFileSync(path.join(bancDir, "self-test.mjs"), "// pas un oracle, ne doit pas etre pris pour un oracle");
    fs.writeFileSync(path.join(bancDir, "oracle-neuf-du-banc.mjs"), "// oracle neuf pose sur le disque au moment du banc, jamais ajoute a une liste");
    const trouve = oraclesMachineSurDisque(bancDir);
    ok(trouve.includes("oracle-neuf-du-banc.mjs"),
      `TF-1196 · sens vert : un oracle neuf posé sur le disque entre dans le périmètre de la garde sans édition de liste — obtenu ${JSON.stringify(trouve)}`);
    ok(!trouve.includes("self-test.mjs"),
      `TF-1196 · sens rouge : un fichier posé qui n'est pas un oracle-*.mjs n'entre pas dans le périmètre — obtenu ${JSON.stringify(trouve)}`);
  } finally {
    fs.rmSync(bancDir, { recursive: true, force: true });
  }
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

// ---- QR6 : le verdict de bascule se COMPOSE, il ne se pose pas (TF-1186, 19/09/2026) ----
// C'est la règle qui porte tout l'item, et la boucle des CAS ne la prouve qu'à moitié : elle montre
// que QR6 se déclenche, pas qu'elle se déclenche POUR LA BONNE RAISON. Les mutations ci-dessous
// partent de la fixture VERTE — un document honnête, cinq dimensions renseignées, une sixième non
// jugeable — et changent UN champ. Le fait qu'elles protègent : cinq mesures vertes et une
// dimension muette produisent exactement la même illusion qu'un rapport recetté qui n'affiche rien.
console.log(String.fromCharCode(10) + "QR6 (TF-1186) — cinq dimensions vertes et une muette ne valent pas une garantie" + String.fromCharCode(10));
const tmpQual = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-qualif-"));
try {
  const base = () => JSON.parse(fs.readFileSync(fx("qualification-rapport-verte.json"), "utf8"));
  // La copie mutée vit hors du dépôt : sa racine reste celle de la forge, sinon les porteurs
  // deviendraient introuvables et chaque mutation échouerait sur QR3 au lieu de sa propre règle.
  const ecrire = (nom, doc) => {
    doc.racine = path.join(ici, "..");
    const p = path.join(tmpQual, nom); fs.writeFileSync(p, JSON.stringify(doc)); return p;
  };

  // Le verdict seul est relevé à « remplaçable » : rien d'autre ne change, et le document devient
  // faux. C'est le geste exact qu'aucun contrôle ne rattrapait — la question du commanditaire était
  // tranchée par une phrase posée au-dessus de mesures qui ne la portaient pas.
  const m1 = base(); m1.bascule.verdict = "remplacable"; delete m1.bascule.conditions;
  const r1 = lance("oracle-qualifier.mjs", ecrire("bascule-posee.json", m1));
  const d1 = [...new Set((r1.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(r1.exit === 1 && JSON.stringify(d1) === JSON.stringify(["QR6"]) &&
     (r1.r.findings || []).some(f => f.regle === "QR6" && /non jugeable ici/.test(f.msg)),
    `QR6 · « remplaçable » posé sur un document dont trois dimensions ne sont pas prouvées : FAIL sur QR6 seul, et le message dit pourquoi le verdict est INATTEIGNABLE — obtenu ${JSON.stringify(d1)}`);

  // Une réserve qu'aucune condition ne lève : « sous conditions » avec une liste incomplète se lit
  // comme un oui pour la réserve manquante — la dimension muette, de nouveau, d'un cran plus loin.
  const m2 = base(); m2.bascule.conditions = m2.bascule.conditions.filter(c => c.id !== "C-2");
  const r2 = lance("oracle-qualifier.mjs", ecrire("reserve-orpheline.json", m2));
  const q2 = (r2.r.findings || []).filter(f => f.regle === "QR6" && f.sev === "bloquant");
  ok(r2.exit === 1 && q2.length === 1 && /interactions/.test(q2[0].msg),
    `QR6 · une réserve qu'aucune condition ne lève est NOMMÉE (« interactions ») — une liste incomplète de conditions est un oui déguisé (obtenu ${q2.map(f => f.msg.slice(0, 30)).join(",") || "rien"})`);

  // Et le sens inverse, celui qui garde la règle utilisable : une condition qui pointe une réserve
  // inexistante est refusée aussi — sinon il suffirait d'allonger la liste pour tout couvrir.
  const m3 = base(); m3.bascule.conditions[0].leve = ["rendu"];
  const r3 = lance("oracle-qualifier.mjs", ecrire("condition-dans-le-vide.json", m3));
  ok(r3.exit === 1 && (r3.r.findings || []).some(f => f.regle === "QR6" && /pointe dans le vide/.test(f.msg)),
    "QR6 · une condition qui prétend lever une dimension déjà conforme est refusée — sinon la liste se remplit de conditions qui ne lèvent rien");

  // QR2 · l'angle mort d'une dimension PROUVÉE CONFORME. C'est là qu'il compte le plus et c'est là
  // qu'on le supprime en premier : un contrôle vert donne l'impression de n'avoir rien à taire.
  const m4 = base(); m4.dimensions.find(x => x.dimension === "rendu").angle_mort = "aucun";
  const r4 = lance("oracle-qualifier.mjs", ecrire("angle-mort-efface.json", m4));
  const d4 = [...new Set((r4.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(r4.exit === 1 && JSON.stringify(d4) === JSON.stringify(["QR2"]),
    `QR2 · l'angle mort effacé d'une dimension conforme fait échouer le document, sur QR2 et rien d'autre — obtenu ${JSON.stringify(d4)}`);

  // QR3 · la preuve cite son porteur ET ses règles, et l'oracle les retrouve DANS le fichier. Une
  // règle renommée laisse la dimension s'en réclamer pour toujours (convention CH4, TF-1179).
  const m5 = base(); m5.dimensions.find(x => x.dimension === "perimetre").preuve.regles = ["DL3", "DL9"];
  const r5 = lance("oracle-qualifier.mjs", ecrire("regle-survivante.json", m5));
  ok(r5.exit === 1 && (r5.r.findings || []).some(f => f.regle === "QR3" && /DL9/.test(f.msg) && /oracle-delimiter/.test(f.msg)),
    "QR3 · une règle citée que son porteur ne porte pas est nommée AVEC son porteur — un identifiant de règle survit à sa règle");
  ok((lance("oracle-qualifier.mjs", fx("qualification-rapport-verte.json")).r.qualification || {}).regles_verifiees === 11,
    "QR3 · verte : les 11 règles citées par les dimensions sont RETROUVÉES dans les fichiers de leurs porteurs, jamais crues sur parole");
} finally {
  fs.rmSync(tmpQual, { recursive: true, force: true });
}

// ---- QR7 : « pas chargé » et « pas la même définition » ne vont pas au même bac (TF-1190) ----
// Sur 4 écarts de chiffres remontés comme défauts, 2 n'en étaient pas : la couche cible RECALCULE ce
// que la source STOCKAIT, et le chiffre publié n'est pas faux — il répond à une autre question. Les
// ranger en défaut aurait envoyé une équipe corriger ce qui n'est pas cassé, et une liste de défauts
// dont la moitié n'en sont pas perd sa crédibilité entière. Ce bloc prouve les deux moitiés : le
// mauvais bac est REFUSÉ, et la définition tranchée puis ACCEPTÉE cesse de peser sur la bascule.
console.log(String.fromCharCode(10) + "QR7/QR8 (TF-1190) — la définition changée n'est ni un écart assumé ni un défaut" + String.fromCharCode(10));
const tmpDef = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-definition-"));
try {
  const base = () => JSON.parse(fs.readFileSync(fx("qualification-definition-verte.json"), "utf8"));
  const ecrire = (nom, doc) => {
    doc.racine = path.join(ici, "..");
    const p = path.join(tmpDef, nom); fs.writeFileSync(p, JSON.stringify(doc)); return p;
  };
  const ecartsDe = doc => doc.dimensions.find(x => x.dimension === "chiffres").ecarts;

  // Le geste exact qui a coûté le retour : le même écart, reclassé « assumé », définitions
  // retirées. Une décision est citée, tout a l'air en ordre — et deux écarts sur quatre partent
  // chercher un bug là où il n'y a qu'une question à poser.
  const m1 = base();
  const e1 = ecartsDe(m1).find(e => e.id === "EC-1");
  e1.classe = "assume"; e1.decision_ref = "D-43";
  delete e1.definition_origine; delete e1.definition_cible; delete e1.question_a_trancher;
  delete e1.statut; delete e1.accord;
  const r1 = lance("oracle-qualifier.mjs", ecrire("ecart-au-mauvais-bac.json", m1));
  const d1 = [...new Set((r1.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(r1.exit === 1 && JSON.stringify(d1) === JSON.stringify(["QR7"]) &&
     (r1.r.findings || []).some(f => f.regle === "QR7" && /corriger ce qui n'est pas cassé/.test(f.msg)),
    `QR7 · un recalcul de la couche cible rangé « assumé », sans la définition d'aucun des deux côtés : FAIL sur QR7 seul — obtenu ${JSON.stringify(d1)}`);

  // Sens vert, et c'est le gain : une définition changée TRANCHÉE et acceptée par le commanditaire,
  // à la date écrite, ne pèse plus sur le verdict de bascule — elle ne demandait aucune correction.
  const v = lance("oracle-qualifier.mjs", fx("qualification-definition-verte.json"));
  ok(v.exit === 0 && v.r.qualification.definitions_changees === 2 && v.r.qualification.definitions_tranchees === 1 &&
     v.r.qualification.reserves === 2,
    `QR7 · verte : 2 définitions changées dont 1 TRANCHÉE et datée ; celle-là n'est plus une réserve, et 2 réserves subsistent sur 4 écarts — obtenu ${JSON.stringify({ d: v.r.qualification.definitions_changees, t: v.r.qualification.definitions_tranchees, r: v.r.qualification.reserves })}`);
  const m2 = base();
  delete ecartsDe(m2).find(e => e.id === "EC-1").accord;
  const r2 = lance("oracle-qualifier.mjs", ecrire("tranchee-sans-accord.json", m2));
  ok(r2.exit === 1 && (r2.r.findings || []).some(f => f.regle === "QR7" && /n'est pas tranchée, elle est oubliée/.test(f.msg)),
    "QR7 · la même définition déclarée tranchée SANS l'accord daté du commanditaire est refusée — c'est l'accord qui la fait cesser de peser, pas le mot");

  // QR8 · la part se RECALCULE. Le test des fractions régulières est ce qui a séparé les deux causes
  // sur le cas réel (122/122 contre 5/316) ; une part recopiée le rendrait muet dans les deux sens.
  const m3 = base();
  ecartsDe(m3).find(e => e.id === "EC-2").test_fractions.entites_fractions_entieres = 300;
  const r3 = lance("oracle-qualifier.mjs", ecrire("part-recopiee.json", m3));
  const q3 = (r3.r.findings || []).filter(f => f.regle === "QR8" && f.sev === "bloquant");
  ok(r3.exit === 1 && q3.some(f => /1\.6 %/.test(f.msg) && /94\.9/.test(f.msg)),
    `QR8 · la part déclarée (1,6 %) est confrontée à la part RECALCULÉE (300/316 = 94,9 %) — un taux recopié d'une analyse précédente fait ranger l'écart dans le mauvais bac (obtenu ${q3.map(f => f.msg.slice(0, 40)).join(" | ") || "rien"})`);
  ok(r3.exit === 1 && q3.some(f => /contredit sa propre mesure/.test(f.msg)),
    "QR8 · et le diagnostic qui contredit sa propre mesure est refusé : au-dessus du seuil déclaré, la mesure dit « fenêtre incomplète », quoi qu'en conclue le rédacteur");
} finally {
  fs.rmSync(tmpDef, { recursive: true, force: true });
}

// ---- RN6 / RS4-plan / RS7 : les trois contrôles rapportés par RF-29 (TF-1188, 18/09/2026) ----
// Le retour dit trois choses mesurées chez un produit, et deux d'entre elles n'étaient couvertes par
// aucune règle d'ici. La boucle des CAS prouve que les règles se DÉCLENCHENT ; ce bloc prouve ce
// qu'elles MESURENT, sur des mutations chirurgicales de la fixture VERTE — un seul champ change à
// la fois, donc le FAIL obtenu ne peut venir que de lui.
console.log(String.fromCharCode(10) + "RN6 / RS4-plan / RS7 (TF-1188) — l'export mesuré, le plan, et le périmètre à l'OCCURRENCE" + String.fromCharCode(10));
const tmpQ = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-rf29-"));
try {
  // --- RN6 · le geste d'export rend ses NOMBRES, et ils sont confrontés à leurs bornes ----------
  const v = lance("oracle-rendre.mjs", fx("rendu-verte.json"));
  ok(v.exit === 0 && v.r.compte.mesures_d_export === 1 &&
     (v.r.findings || []).some(f => f.regle === "RN6" && f.sev === "info" && /449|101376|octets/.test(f.msg)),
    `RN6 · verte : l'export est prouvé sur le fichier TÉLÉCHARGÉ, et l'oracle rend ses nombres — obtenu ${v.r.compte.mesures_d_export} mesure(s)`);
  const rn6Rouge = (lance("oracle-rendre.mjs", fx("rendu-rouge.json")).r.findings || []).filter(f => f.regle === "RN6" && f.sev === "bloquant");
  ok(rn6Rouge.length === 5,
    `RN6 · rouge : les CINQ défauts du geste du 15/09 sont nommés un à un (statut pris pour le fichier, 569 s, 1 415 octets, page à zéro caractère, aucun libellé cherché) — obtenu ${rn6Rouge.length}`);
  ok(rn6Rouge.some(f => /1415|1 415/.test(f.msg)) && rn6Rouge.some(f => /zéro caractère|aucun caractère/.test(f.msg)),
    "RN6 · rouge : le poids et la page vide sont CHIFFRÉS, pas seulement dénoncés — c'est le couple 1 415 octets / 0 caractère qui a coûté deux jours");
  // Un geste qui se déclare « export_rendu » et ne rend aucun nombre est refusé : c'est la porte
  // par laquelle « export Succeeded » rentrerait à nouveau, en une phrase bien écrite.
  const sansMesure = JSON.parse(fs.readFileSync(fx("rendu-verte.json"), "utf8"));
  delete sansMesure.gestes_de_verification[0].mesure_export;
  const pSansMesure = path.join(tmpQ, "rendu-sans-mesure.json");
  fs.writeFileSync(pSansMesure, JSON.stringify(sansMesure));
  const sm = lance("oracle-rendre.mjs", pSansMesure);
  const dursSm = [...new Set((sm.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(sm.exit === 1 && JSON.stringify(dursSm) === JSON.stringify(["RN6"]),
    `RN6 · un geste déclaré « export_rendu » SANS mesure échoue, sur RN6 et sur RN6 seulement — obtenu ${JSON.stringify(dursSm)}`);
  // Sens inverse, celui qui garde la règle utilisable : un rendu dont AUCUN geste ne se déclare
  // export ne bloque pas — il est AVERTI. La doctrine dit qu'un rendu non joué se DIT ; une règle
  // qui refuserait ici toute livraison serait désactivée le jour même.
  const sansNature = JSON.parse(JSON.stringify(sansMesure));
  delete sansNature.gestes_de_verification[0].nature;
  const pSansNature = path.join(tmpQ, "rendu-sans-nature.json");
  fs.writeFileSync(pSansNature, JSON.stringify(sansNature));
  const sn = lance("oracle-rendre.mjs", pSansNature);
  const sn6 = (sn.r.findings || []).filter(f => f.regle === "RN6");
  ok(sn.exit === 0 && sn6.length === 1 && sn6[0].sev === "avertissement",
    `RN6 · aucun geste d'export déclaré : AVERTISSEMENT nommant la doctrine, jamais un blocage — obtenu exit=${sn.exit} ${sn6.map(f => f.sev).join(",") || "rien"}`);

  // --- RS4 · le PLAN, seul champ muté : deux visuels superposés et inversés ---------------------
  const planMute = JSON.parse(fs.readFileSync(fx("reconstruction-verte.json"), "utf8"));
  planMute.produit.pages[0].visuels.find(x => x.visuel === "tableau_baux").plan = 9;
  const pPlan = path.join(tmpQ, "reconstruction-plan.json");
  fs.writeFileSync(pPlan, JSON.stringify(planMute));
  const rp = lance("oracle-reconstruire.mjs", pPlan);
  const dursPlan = [...new Set((rp.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(rp.exit === 1 && JSON.stringify(dursPlan) === JSON.stringify(["RS4"]) && rp.r.compte.ecarts_geometrie === 1,
    `RS4 · le PLAN seul inversé, géométrie identique au pixel : FAIL sur RS4 et rien d'autre — obtenu ${JSON.stringify(dursPlan)} ${rp.r.compte.ecarts_geometrie} écart(s)`);

  // --- RS7 · une occurrence perdue dont l'en-tête existe ailleurs sur la même page ---------------
  // C'est le cas exact que la recette du produit ne voyait pas : « Loyer annuel » est affiché deux
  // fois, on en retire une, et le nombre d'en-têtes DISTINCTS de la page ne bouge pas d'un.
  const occMute = JSON.parse(fs.readFileSync(fx("reconstruction-verte.json"), "utf8"));
  const tbl = occMute.produit.pages[0].visuels.find(x => x.visuel === "tableau_baux");
  tbl.projections = tbl.projections.slice(0, 3);
  const distinctsAvant = new Set(occMute.source.pages[0].visuels.flatMap(x => (x.projections || []).map(p => p.entete))).size;
  const distinctsApres = new Set(occMute.produit.pages[0].visuels.flatMap(x => (x.projections || []).map(p => p.entete))).size;
  const pOcc = path.join(tmpQ, "reconstruction-occurrence.json");
  fs.writeFileSync(pOcc, JSON.stringify(occMute));
  const ro = lance("oracle-reconstruire.mjs", pOcc);
  const dursOcc = [...new Set((ro.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))];
  ok(distinctsAvant === distinctsApres,
    `RS7 · le décompte d'en-têtes DISTINCTS ne bouge PAS (${distinctsAvant} des deux côtés) — c'est pourquoi la recette du produit comptait 70 couples distincts pour 83 occurrences affichées`);
  ok(ro.exit === 1 && JSON.stringify(dursOcc) === JSON.stringify(["RS7"]) &&
     ro.r.compte.occurrences_entete_source === 8 && ro.r.compte.occurrences_entete_produit === 7,
    `RS7 · à l'OCCURRENCE, la perte se voit : 8 contre 7, FAIL sur RS7 et rien d'autre — obtenu ${JSON.stringify(dursOcc)} ${ro.r.compte.occurrences_entete_source}/${ro.r.compte.occurrences_entete_produit}`);
  // Et la porte de sortie reste la même que pour tout écart de ce dépôt : une occurrence retirée
  // EXPRÈS se déclare avec son motif, sinon écarté et OUBLIÉ sont indiscernables (convention RS5).
  occMute.ecarts_assumes.push({ objet: "page Etat locatif › en-tête Loyer annuel",
    motif: "la colonne de loyer était affichée deux fois dans le tableau d'origine, le doublon est retiré" });
  fs.writeFileSync(pOcc, JSON.stringify(occMute));
  const ra = lance("oracle-reconstruire.mjs", pOcc);
  ok(ra.exit === 0 && ra.r.verdict === "PASS",
    `RS7 · la même occurrence retirée AVEC son motif écrit PASSE — l'oracle exige une décision, pas la conservation (obtenu ${ra.r.verdict})`);
} finally {
  fs.rmSync(tmpQ, { recursive: true, force: true });
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
  ok(v.exit === 0 && v.r.verdict === "PASS" && v.r.chaine.etapes === 11 && v.r.chaine.etapes_absentes_du_document === 0,
    `CH6 · la procédure de migration : 11 étapes déclarées (E11, la qualification de bascule, s'insère avant la restitution — TF-1186), toutes citées par le document lu par les humains — obtenu ${v.r.verdict} ${JSON.stringify(v.r.chaine && { etapes: v.r.chaine.etapes, absentes: v.r.chaine.etapes_absentes_du_document })}`);
  ok(v.r.chaine.porteurs.geste_humain === 3 && v.r.chaine.regles_verifiees === 45,
    `CH4/CH5 · les 45 règles citées par les étapes EXISTENT dans leur porteur, et les 3 gestes qui ne se mécanisent pas déclarent leur enregistreur — obtenu ${JSON.stringify(v.r.chaine && { gestes: v.r.chaine.porteurs.geste_humain, regles: v.r.chaine.regles_verifiees })}`);

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

// ── TF-1319 · la découverte des oracles LIT LE DISQUE, dans les deux sens ─────────────────────
// Le juge du pilot (méta-oracle d'enclenchement) confronte ce que cette forge DÉCOUVRE aux
// verdicts consignés au ledger d'un run. Une découverte qui raterait un oracle le rendrait
// invisible au juge ; une découverte qui prendrait une recette ou une fixture pour un oracle
// ferait accuser un run de n'avoir pas joué ce qui n'est pas un oracle. Les deux sens se prouvent.
{
  const DECOUVRIR = path.join(ici, "decouvrir-oracles.mjs");
  const decouvre = (racine) => {
    const r = spawnSync(process.execPath, [DECOUVRIR, ...(racine ? ["--racine", racine] : [])], { encoding: "utf8" });
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* sortie illisible : les contrôles ci-dessous la disent */ }
    return { code: r.status, j };
  };
  const reel = decouvre(null);
  ok(reel.code === 0 && reel.j?.contrat === "digit-ai/decouverte-oracles@1" && reel.j?.forge === "digit-ai-forge-data"
    && reel.j.oracles.length > 0 && reel.j.oracles.every(o => fs.existsSync(path.join(ici, "..", o.chemin))),
    `TF-1319 · VERT — la forge découvre ${reel.j?.oracles?.length ?? "?"} oracle(s) sur son propre disque, contrat digit-ai/decouverte-oracles@1 tenu, chaque chemin rendu existe`);
  const tmpDec = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-decouverte-"));
  try {
    const poser = (rel) => {
      const p = path.join(tmpDec, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, "// fixture de découverte\n");
    };
    ["oracles/oracle-alpha.mjs", "scripts/oracle_beta.py"].forEach(poser);
    const leurres = ["oracles/oracle-alpha.test.mjs", "oracles/self-test.mjs", "oracles/lib-oracle.mjs",
      "fixtures/oracle-faux.mjs", "Old/oracle-vieux.mjs", "node_modules/paquet/oracle-dep.mjs", "input/oracle-entrant.mjs"];
    leurres.forEach(poser);
    const v = decouvre(tmpDec);
    const noms = (v.j?.oracles || []).map(o => o.nom).sort();
    ok(v.code === 0 && JSON.stringify(noms) === JSON.stringify(["oracle-alpha", "oracle_beta"]),
      `TF-1319 · VERT — un oracle posé sur le disque est découvert, où qu'il vive dans le dépôt (obtenu ${JSON.stringify(noms)})`);
    ok(v.code === 0 && !(v.j?.oracles || []).some(o => leurres.includes(o.chemin)),
      `TF-1319 · ROUGE — recette, lanceur, bibliothèque, fixture, archive, dépendance et entrant ne sont JAMAIS pris pour des oracles (${leurres.length} leurres refusés)`);
    poser("oracles/oracle-gamma.mjs");
    const apres = decouvre(tmpDec);
    ok((apres.j?.oracles || []).some(o => o.nom === "oracle-gamma" && o.chemin === "oracles/oracle-gamma.mjs"),
      "TF-1319 · un oracle AJOUTÉ est découvert au passage suivant sans qu'aucune liste soit tenue à jour : la liste vient du disque");
    poser("scripts/oracle-alpha.mjs");
    const doublon = decouvre(tmpDec);
    ok((doublon.j?.non_juge || []).some(n => /oracle-alpha/.test(n) && /2 fichiers/.test(n)),
      "TF-1319 · deux fichiers du même nom sont DITS : un verdict qui le nomme ne dit pas lequel a tourné");
  } finally {
    fs.rmSync(tmpDec, { recursive: true, force: true });
  }
  const absente = decouvre(path.join(os.tmpdir(), "forge-data-racine-qui-n-existe-pas"));
  ok(absente.code === 2 && absente.j?.oracles?.length === 0 && /introuvable/.test(absente.j?.motif || ""),
    `TF-1319 · ROUGE — une racine absente sort en 2 avec son motif, jamais en liste vide muette (obtenu exit ${absente.code})`);
}

// ---- lire-classeur-xlsx et lire-modele-pbix (TF-1226, 02/10/2026, option D-51 (a)) : les
// lecteurs du 14/09 lisaient du TEXTE (TMDL, CSV) ; aucun n'ouvrait les fichiers BINAIRES
// (.xlsx, .pbix) que les clients remettent réellement. Les deux sont des archives ZIP — lecteur
// ZIP maison (scripts/lib-zip-minimal.mjs, zéro dépendance externe, R-29). ----
// Les fixtures de ce bloc sont des ARCHIVES BINAIRES : jamais committées (même doctrine que
// verifier_unites_parquet.py — « fichiers générés à la volée, aucune donnée committée ») —
// construites ici par un ÉCRIVAIN ZIP minimal, indépendant du lecteur qu'il sert à prouver
// (sinon un bug symétrique dans les deux passerait inaperçu).
console.log(String.fromCharCode(10) + "lire-classeur-xlsx et lire-modele-pbix (TF-1226) — lecteurs ZIP maison, fixtures binaires réelles" + String.fromCharCode(10));
{
  // CRC32 maison (table bit à bit, polynôme standard 0xEDB88320) : l'écrivain de test ne dépend
  // pas de `zlib.crc32` (API Node récente) pour rester robuste à l'exécution sur un Node plus
  // ancien que celui de cette session — le LECTEUR, lui, ne vérifie aucun CRC (hors mandat).
  const crc32 = buf => {
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (~crc) >>> 0;
  };
  const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
  // Écrivain ZIP minimal — STORED (0) ou DEFLATE (8, zlib.deflateRawSync nativement porté) : les
  // deux méthodes que lib-zip-minimal.mjs sait LIRE, pour que la preuve en boucle joue les deux.
  const construireZip = entrees => {
    let offset = 0;
    const morceauxLocaux = [];
    const entreesCD = [];
    for (const e of entrees) {
      const methode = e.methode || 0;
      const brut = e.data;
      const ecrit = methode === 8 ? zlib.deflateRawSync(brut) : brut;
      const nomBuf = Buffer.from(e.nom, "utf8");
      const crc = crc32(brut);
      const lfh = Buffer.concat([
        u32(0x04034b50), u16(20), u16(0), u16(methode), u16(0), u16(0x21),
        u32(crc), u32(ecrit.length), u32(brut.length), u16(nomBuf.length), u16(0), nomBuf,
      ]);
      morceauxLocaux.push(lfh, ecrit);
      entreesCD.push({ nom: nomBuf, crc, methode, tailleCompressee: ecrit.length, tailleNonCompressee: brut.length, offset });
      offset += lfh.length + ecrit.length;
    }
    const debutCD = offset;
    const morceauxCD = entreesCD.map(e => Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(e.methode), u16(0), u16(0x21),
      u32(e.crc), u32(e.tailleCompressee), u32(e.tailleNonCompressee),
      u16(e.nom.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.offset), e.nom,
    ]));
    const tailleCD = morceauxCD.reduce((a, b) => a + b.length, 0);
    const eocd = Buffer.concat([
      u32(0x06054b50), u16(0), u16(0), u16(entreesCD.length), u16(entreesCD.length),
      u32(tailleCD), u32(debutCD), u16(0),
    ]);
    return Buffer.concat([...morceauxLocaux, ...morceauxCD, eocd]);
  };

  const tmpZip = fs.mkdtempSync(path.join(os.tmpdir(), "forge-data-zip-"));
  try {
    // ---- .xlsx RÉEL (TF-1226) : un classeur OOXML minimal mais complet (sept parties,
    // dont styles.xml) — ouvert et vérifié par openpyxl (bibliothèque tierce indépendante,
    // hors de ce dépôt) pendant l'instruction de l'item : feuilles=['Feuil1'], A1='Bonjour
    // TF-1226', B1=42. Preuve que ce N'EST PAS un double trafiqué pour son propre lecteur.
    const xmlDecl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const xlsxBuf = construireZip([
      { nom: "[Content_Types].xml", data: Buffer.from(xmlDecl +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '</Types>', "utf8") },
      { nom: "_rels/.rels", data: Buffer.from(xmlDecl +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>', "utf8") },
      { nom: "xl/workbook.xml", data: Buffer.from(xmlDecl +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + '<sheets><sheet name="Feuil1" sheetId="1" r:id="rId1"/></sheets></workbook>', "utf8") },
      { nom: "xl/_rels/workbook.xml.rels", data: Buffer.from(xmlDecl +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
        + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + '</Relationships>', "utf8") },
      // DEFLATE délibéré ici : la fixture exerce les DEUX méthodes que lib-zip-minimal.mjs lit.
      { nom: "xl/sharedStrings.xml", methode: 8, data: Buffer.from(xmlDecl +
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1">'
        + '<si><t>Bonjour TF-1226</t></si></sst>', "utf8") },
      { nom: "xl/worksheets/sheet1.xml", data: Buffer.from(xmlDecl +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>42</v></c></row></sheetData></worksheet>', "utf8") },
      { nom: "xl/styles.xml", data: Buffer.from(xmlDecl +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        + '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        + '<borders count="1"><border/></borders>'
        + '<cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf/></cellXfs></styleSheet>', "utf8") },
    ]);
    const pXlsx = path.join(tmpZip, "classeur-reel.xlsx");
    fs.writeFileSync(pXlsx, xlsxBuf);

    const x = lanceScript("lire-classeur-xlsx.mjs", [pXlsx]);
    ok(x.exit === 0 && x.r.sortie === "OK",
      `lire-classeur-xlsx · classeur .xlsx AUTHENTIQUE (archive ZIP OOXML réelle, ouverte et vérifiée par openpyxl hors de ce dépôt) : lecture réussie (exit 0) — obtenu exit ${x.exit}`);
    ok(x.r.document?.feuilles?.[0]?.nom === "Feuil1",
      `lire-classeur-xlsx · la feuille est nommée depuis xl/workbook.xml, pas depuis le nom du fichier physique — obtenu ${JSON.stringify(x.r.document?.feuilles?.map(f => f.nom))}`);
    ok(x.r.document?.feuilles?.[0]?.cellules?.A1 === "Bonjour TF-1226",
      `lire-classeur-xlsx · A1 résout par l'INDEX de chaîne partagée (xl/sharedStrings.xml, compressée DEFLATE dans cette fixture) vers son texte réel — obtenu ${JSON.stringify(x.r.document?.feuilles?.[0]?.cellules?.A1)}`);
    ok(x.r.document?.feuilles?.[0]?.cellules?.B1 === 42,
      `lire-classeur-xlsx · B1 (type « n » par défaut, sans attribut t) lu comme NOMBRE, pas comme texte — obtenu ${JSON.stringify(x.r.document?.feuilles?.[0]?.cellules?.B1)} (${typeof x.r.document?.feuilles?.[0]?.cellules?.B1})`);
    ok(x.r.compte?.feuilles === 1 && x.r.compte?.cellules === 2 && x.r.compte?.chaines_partagees === 1,
      `lire-classeur-xlsx · compte recalculé (1 feuille, 2 cellules, 1 chaîne partagée) — obtenu ${JSON.stringify(x.r.compte)}`);

    // ROUGE 1 : un fichier qui n'est PAS une archive ZIP (texte brut renommé .xlsx) — refus
    // propre, jamais une lecture qui invente un classeur vide.
    const pFaux = path.join(tmpZip, "pas-un-zip.xlsx");
    fs.writeFileSync(pFaux, "ceci n'est pas une archive ZIP\n");
    const xf = lanceScript("lire-classeur-xlsx.mjs", [pFaux]);
    ok(xf.exit === 2 && /archive ZIP illisible/.test(xf.r.erreur || ""),
      `lire-classeur-xlsx · ROUGE — un fichier qui n'est pas un ZIP est refusé (exit 2), jamais lu comme un classeur vide (obtenu exit ${xf.exit}, erreur=${xf.r.erreur})`);

    // ROUGE 2 : une archive ZIP valide, mais SANS xl/workbook.xml (donc pas un .xlsx) — même
    // discipline que le refus déjà en place pour un .pbix passé à traduire-modele-semantique.
    const pSansWorkbook = path.join(tmpZip, "zip-quelconque.xlsx");
    fs.writeFileSync(pSansWorkbook, construireZip([{ nom: "autre-chose.txt", data: Buffer.from("rien à voir") }]));
    const xs = lanceScript("lire-classeur-xlsx.mjs", [pSansWorkbook]);
    ok(xs.exit === 2 && /workbook\.xml absent/.test(xs.r.erreur || ""),
      `lire-classeur-xlsx · ROUGE — une archive ZIP sans xl/workbook.xml n'est pas un classeur .xlsx reconnaissable, refus propre (obtenu exit ${xs.exit})`);

    // ---- .pbix : PREUVE PARTIELLE, DITE — fixture STRUCTURELLEMENT CONFORME (ZIP + partie
    // DataModelSchema en JSON UTF-16LE avec BOM, comme documenté par la communauté de
    // rétro-ingénierie du format), PAS un fichier .pbix remis par un client réel. Aucun fichier
    // de ce type n'était disponible pour cette instruction de TF-1226 (dit, jamais caché).
    const modeleJson = JSON.stringify({
      name: "SemanticModel", compatibilityLevel: 1567,
      model: { culture: "fr-FR", tables: [
        { name: "Ventes", columns: [{ name: "Date" }, { name: "Montant" }], measures: [{ name: "Total Ventes", expression: "SUM(Ventes[Montant])" }] },
        { name: "Clients", columns: [{ name: "ClientId" }, { name: "Nom" }] },
      ] },
    });
    const bomUtf16le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(modeleJson, "utf16le")]);
    const pPbix = path.join(tmpZip, "modele-fixture.pbix");
    fs.writeFileSync(pPbix, construireZip([
      { nom: "DataModelSchema", methode: 8, data: bomUtf16le }, // DEFLATE ici, STORED pour Version
      { nom: "Version", data: Buffer.from("3.0", "utf8") },
    ]));

    const p = lanceScript("lire-modele-pbix.mjs", [pPbix]);
    ok(p.exit === 0 && p.r.sortie === "OK",
      `lire-modele-pbix · fixture structurelle (ZIP + DataModelSchema JSON UTF-16LE avec BOM, DEFLATE) : extraction réussie (exit 0) — obtenu exit ${p.exit}`);
    ok(p.r.document?.modele?.model?.tables?.length === 2,
      `lire-modele-pbix · deux tables lues depuis le JSON décodé (UTF-16LE → JSON.parse) — obtenu ${p.r.document?.modele?.model?.tables?.length}`);
    ok(p.r.compte?.tables === 2 && p.r.compte?.colonnes === 4 && p.r.compte?.mesures === 1,
      `lire-modele-pbix · compte recalculé depuis le modèle décodé (2 tables, 4 colonnes, 1 mesure) — obtenu ${JSON.stringify(p.r.compte)}`);

    // ROUGE 3 : une archive ZIP valide mais sans partie DataModelSchema (ex. un .pbix au format
    // PBIP, ou un ZIP quelconque) — refus propre, jamais un modèle vide inventé.
    const pSansModele = path.join(tmpZip, "sans-modele.pbix");
    fs.writeFileSync(pSansModele, construireZip([{ nom: "Report/Layout", data: Buffer.from("{}") }]));
    const pr = lanceScript("lire-modele-pbix.mjs", [pSansModele]);
    ok(pr.exit === 2 && /DataModelSchema.*absente/.test(pr.r.erreur || ""),
      `lire-modele-pbix · ROUGE — un .pbix sans partie DataModelSchema (ex. format PBIP) est refusé, jamais un modèle vide (obtenu exit ${pr.exit})`);

    // ROUGE 4 : DataModelSchema présente mais décodage → JSON invalide — refus propre.
    const pJsonCasse = path.join(tmpZip, "json-casse.pbix");
    const casseeUtf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("{ pas du json valide", "utf16le")]);
    fs.writeFileSync(pJsonCasse, construireZip([{ nom: "DataModelSchema", data: casseeUtf16 }]));
    const pj = lanceScript("lire-modele-pbix.mjs", [pJsonCasse]);
    ok(pj.exit === 2 && /JSON invalide/.test(pj.r.erreur || ""),
      `lire-modele-pbix · ROUGE — DataModelSchema décodée mais JSON invalide : refus propre, jamais un modèle deviné (obtenu exit ${pj.exit})`);
  } finally {
    fs.rmSync(tmpZip, { recursive: true, force: true });
  }
}

// ---- anonymiser (TF-2011, 29/10/2026, décision D-91 (a)) : le verbe produit, l'oracle MESURE ----
// La boucle CAS prouve que chaque rouge échoue sur sa règle. Ce bloc prouve le reste : qu'elle échoue
// sur cette règle SEULE (une rouge qui casserait trois règles ne dirait pas laquelle elle prouve),
// que la verte committée EST la sortie du verbe (régénérée octet pour octet : le déterminisme pour une
// graine se prouve, il ne se déclare pas), que la chaîne verbe → oracle se ferme en CSV et en JSONL,
// que le verbe refuse ce que l'oracle refuserait SANS rien écrire, et qu'une rouge générée existe pour
// chacune des règles que les fixtures committées ne portent pas (AN1, AN2, AN6, AN8, AN9, AN10, et les
// planchers de AN5 et AN7). Enfin, qu'aucun constat ne recopie une valeur de la source.
console.log(String.fromCharCode(10) + "anonymiser (TF-2011) — le verbe produit, l'oracle mesure : précision, déterminisme, chaîne, refus" + String.fromCharCode(10));
{
  const verbe = await import(pathToFileURL(path.join(ici, "..", "scripts", "anonymiser.mjs")).href);
  const SCRIPT = path.join(ici, "..", "scripts", "anonymiser.mjs");
  const ORACLE = path.join(ici, "oracle-anonymiser.mjs");
  const SOURCE = fx("anonymisation-source"), VERTE = fx("anonymisation-verte");
  const GRAINE = "recette-TF-2011", DATE = "2026-10-29T12:00:00.000Z";
  const lanceVerbe = (args) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args, "--json-only"], { encoding: "utf8" });
    let j = null; try { j = JSON.parse(r.stdout); } catch { /* sortie illisible : les contrôles la disent */ }
    return { code: r.status, j };
  };
  const juger = (cible, ...plus) => {
    const r = spawnSync(process.execPath, [ORACLE, cible, "--json-only", ...plus], { encoding: "utf8" });
    let j = {}; try { j = JSON.parse(r.stdout); } catch { /* idem */ }
    return { code: r.status, j };
  };
  const bloquantes = (j) => [...new Set((j.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))].sort();
  const lf = (t) => t.replace(/\r\n/g, "\n");
  const tmpAn = fs.mkdtempSync(path.join(os.tmpdir(), "fd-anon-"));
  // Les valeurs de la source qu'aucun constat ne doit recopier : courriels, noms, prénoms, textes libres.
  const srcClient = verbe.lireTable(path.join(SOURCE, "client.csv"), "csv");
  const sensibles = new Set();
  for (const c of ["email", "nom", "prenom", "commentaire"]) { const j = srcClient.colonnes.indexOf(c); for (const r of srcClient.lignes) if (r[j] && r[j].length >= 5) sensibles.add(r[j]); }
  const fuites = [];
  const surveiller = (nom, j) => { for (const f of j.findings || []) for (const v of sensibles) if (String(f.msg).includes(v) || String(f.where).includes(v)) fuites.push(`${nom} : ${f.regle}`); };
  try {
    // 1. Précision des rouges committées : leur règle, et AUCUNE autre règle bloquante.
    for (const [rouge, regle] of [["anonymisation-identifiant-rouge", "AN3"], ["anonymisation-hachage-rouge", "AN4"], ["anonymisation-k-rouge", "AN5"], ["anonymisation-inference-rouge", "AN7"]]) {
      const r = juger(fx(rouge)); surveiller(rouge, r.j);
      ok(r.code === 1 && JSON.stringify(bloquantes(r.j)) === JSON.stringify([regle]), `anonymiser · ${rouge} échoue sur ${regle} SEULE (obtenu ${bloquantes(r.j).join(",") || "rien"})`);
    }
    const ident = juger(fx("anonymisation-identifiant-rouge")).j.findings.filter(f => f.regle === "AN3");
    ok(ident.some(f => /déclaré « conserver »/.test(f.msg)) && ident.some(f => /151 valeur\(s\) masquée\(s\) ÉGALE/.test(f.msg)),
      "AN3 · rouge : l'identifiant gardé est refusé DEUX fois — par la déclaration, et par la mesure (151 courriels égaux à la source)");
    const hach = juger(fx("anonymisation-hachage-rouge")).j.findings.filter(f => f.regle === "AN4").map(f => f.msg);
    ok(hach.some(m => /stratégie « hacher »/.test(m)) && hach.some(m => /client\.nom : 151 valeur\(s\) sur 151 ont la forme d'une EMPREINTE/.test(m)) && hach.some(m => /client\.nom : le remplacement SUIT les répétitions/.test(m)),
      "AN4 · rouge : le prénom déclaré « hacher » est refusé par la déclaration ; le nom, déclaré « remplacer » mais haché, est vu par la MESURE (forme d'empreinte et profil de répétitions)");
    const kr = juger(fx("anonymisation-k-rouge")).j.findings.find(f => f.regle === "AN5" && f.sev === "bloquant");
    ok(kr && /plus petite : 2/.test(kr.msg) && /2 ligne\(s\)/.test(kr.msg), `AN5 · rouge : la classe de 2 personnes est mesurée et LOCALISÉE (${kr && kr.msg.slice(0, 90)})`);
    const inf = juger(fx("anonymisation-inference-rouge")).j.findings.filter(f => f.regle === "AN7" && f.sev === "bloquant");
    ok(inf.some(f => /moins de l = 2 valeurs distinctes/.test(f.msg)), "AN7 · rouge : la classe homogène est refusée par la l-diversité (inférence certaine)");

    // 2. La verte : PASS, mesures recalculées, planchers de l'oracle = ceux du verbe.
    const v = juger(VERTE);
    ok(v.code === 0 && v.j.verdict === "PASS" && v.j.mesures.client.k_mesure === 7 && v.j.mesures.commande.k_mesure === 5 && v.j.mesures.client.l_mesure.pathologie === 3,
      `anonymiser · verte PASS, k recalculé 7 (client, personnes distinctes) et 5 (commande), l = 3 — obtenu ${JSON.stringify({ k: v.j.mesures?.client?.k_mesure, kc: v.j.mesures?.commande?.k_mesure })}`);
    ok(v.j.seuils_forge && v.j.seuils_forge.k_min === verbe.PLANCHER_K && v.j.seuils_forge.l_min === verbe.PLANCHER_L && v.j.seuils_forge.jointure_max === verbe.PLAFOND_JOINTURE,
      `anonymiser · planchers de l'oracle = planchers du verbe (k ${verbe.PLANCHER_K}, l ${verbe.PLANCHER_L}, jointure ${verbe.PLAFOND_JOINTURE}) : le juge ne laisse pas passer ce que le producteur refuse`);

    // 3. Déterminisme : la verte committée se régénère OCTET POUR OCTET (tables et rapport hors chemin).
    const regen = path.join(tmpAn, "regen");
    const g = lanceVerbe(["--masquage", path.join(VERTE, "masquage.json"), "--source", SOURCE, "--sortie", regen, "--graine", GRAINE, "--date", DATE]);
    const tablesV = ["client.csv", "produit.csv", "commande.csv", "ligne_commande.csv"];
    const differentes = tablesV.filter(f => lf(fs.readFileSync(path.join(regen, f), "utf8")) !== lf(fs.readFileSync(path.join(VERTE, f), "utf8")));
    const sansChemin = (f) => { const o = JSON.parse(fs.readFileSync(f, "utf8")); delete o.source.dossier; return JSON.stringify(o); };
    ok(g.code === 0 && !differentes.length && sansChemin(path.join(regen, "anonymisation.json")) === sansChemin(path.join(VERTE, "anonymisation.json")),
      `anonymiser · DÉTERMINISME : la verte committée est la sortie du verbe, régénérée identique pour la même graine (4 tables + rapport)${differentes.length ? " — différentes : " + differentes.join(", ") : ""}`);
    const autre = path.join(tmpAn, "autre-graine");
    lanceVerbe(["--masquage", path.join(VERTE, "masquage.json"), "--source", SOURCE, "--sortie", autre, "--graine", "une-autre-graine", "--date", DATE]);
    const rA = JSON.parse(fs.readFileSync(path.join(autre, "anonymisation.json"), "utf8")), rV = JSON.parse(fs.readFileSync(path.join(VERTE, "anonymisation.json"), "utf8"));
    ok(fs.readFileSync(path.join(autre, "client.csv"), "utf8") !== fs.readFileSync(path.join(VERTE, "client.csv"), "utf8") && JSON.stringify(rA.tables) === JSON.stringify(rV.tables),
      "anonymiser · une autre graine change les valeurs tirées, pas les lignes retenues (mêmes comptes) : la sélection dépend des données, le tirage de la graine");
    const sans1 = path.join(tmpAn, "sans-graine-1"), sans2 = path.join(tmpAn, "sans-graine-2");
    lanceVerbe(["--masquage", path.join(VERTE, "masquage.json"), "--source", SOURCE, "--sortie", sans1]);
    lanceVerbe(["--masquage", path.join(VERTE, "masquage.json"), "--source", SOURCE, "--sortie", sans2]);
    const r1 = JSON.parse(fs.readFileSync(path.join(sans1, "anonymisation.json"), "utf8"));
    ok(r1.graine === "tiree_au_hasard_non_conservee" && fs.readFileSync(path.join(sans1, "client.csv"), "utf8") !== fs.readFileSync(path.join(sans2, "client.csv"), "utf8"),
      "anonymiser · sans graine : tirée au hasard, jamais écrite, deux passages diffèrent — le mode d'un extrait qui sort");
    const contientGraine = fs.readdirSync(regen).filter(f => fs.readFileSync(path.join(regen, f), "utf8").includes(GRAINE));
    ok(!contientGraine.length, `anonymiser · la graine fournie n'est écrite dans AUCUN fichier produit${contientGraine.length ? " — trouvée dans " + contientGraine.join(", ") : ""}`);
    const chaine = juger(regen);
    ok(chaine.code === 0 && chaine.j.verdict === "PASS", `anonymiser · CHAÎNE CSV : la sortie du verbe passe l'oracle sans retouche (obtenu ${chaine.j.verdict})`);

    // 4. Forme JSONL : la même source convertie, la même déclaration, la chaîne se ferme aussi.
    const srcJ = path.join(tmpAn, "source-jsonl"); fs.mkdirSync(srcJ);
    for (const f of tablesV) {
      const t = verbe.lireTable(path.join(SOURCE, f), "csv");
      const num = t.colonnes.map((_, j) => t.lignes.every(r => r[j] === null || /^-?\d+(\.\d+)?$/.test(r[j])) && !["code_postal"].includes(t.colonnes[j]));
      fs.writeFileSync(path.join(srcJ, f.replace(".csv", ".jsonl")), t.lignes.map(r => JSON.stringify(Object.fromEntries(t.colonnes.map((c, j) => [c, r[j] === null ? null : num[j] ? Number(r[j]) : r[j]])))).join("\n") + "\n");
    }
    const sortieJ = path.join(tmpAn, "masque-jsonl");
    const gj = lanceVerbe(["--masquage", path.join(VERTE, "masquage.json"), "--source", srcJ, "--sortie", sortieJ, "--graine", GRAINE]);
    const oj = juger(sortieJ);
    const premiere = gj.code === 0 ? JSON.parse(fs.readFileSync(path.join(sortieJ, "client.jsonl"), "utf8").split("\n")[0]) : {};
    ok(gj.code === 0 && oj.j.verdict === "PASS" && typeof premiere.id === "number" && typeof premiere.email === "string",
      `anonymiser · CHAÎNE JSONL : la forme JSONL se masque et passe l'oracle, les clés restent des nombres JSON (obtenu ${gj.j && gj.j.verdict} / ${oj.j.verdict})`);
    const grosJ = path.join(tmpAn, "source-bigint"); fs.mkdirSync(grosJ);
    for (const f of fs.readdirSync(srcJ)) fs.copyFileSync(path.join(srcJ, f), path.join(grosJ, f));
    fs.appendFileSync(path.join(grosJ, "produit.jsonl"), JSON.stringify({ id: 11, libelle: "x", prix: 1 }).replace("11", "12345678901234567") + "\n");
    const gb = lanceVerbe(["--masquage", path.join(VERTE, "masquage.json"), "--source", grosJ, "--sortie", path.join(tmpAn, "bigint")]);
    ok(gb.code === 2 && /16 chiffres/.test((gb.j.motifs || []).join(" ")) && !fs.existsSync(path.join(tmpAn, "bigint")),
      "anonymiser · ROUGE — un entier JSON de 17 chiffres est REFUSÉ (JSON.parse le lirait faux au-delà de 2^53), rien n'est écrit");

    // 5. Le verbe refuse ce que l'oracle refuserait, et n'écrit RIEN.
    const declV = JSON.parse(fs.readFileSync(path.join(VERTE, "masquage.json"), "utf8"));
    const refus = (nom, muter, code, motif) => {
      const d = JSON.parse(JSON.stringify(declV)); muter(d);
      const f = path.join(tmpAn, `${nom}.json`); fs.writeFileSync(f, JSON.stringify(d));
      const s = path.join(tmpAn, `sortie-${nom}`);
      const r = lanceVerbe(["--masquage", f, "--source", SOURCE, "--sortie", s, "--graine", GRAINE]);
      ok(r.code === code && (r.j.motifs || []).some(x => motif.test(x)) && !fs.existsSync(s),
        `anonymiser · REFUS du verbe (${nom}) : exit ${code}, motif dit, aucun fichier écrit (obtenu exit ${r.code} — ${(r.j.motifs || [""])[0].slice(0, 90)})`);
    };
    const client = (d) => d.tables.find(t => t.nom === "client").colonnes;
    refus("colonne-non-classee", d => { d.tables.find(t => t.nom === "client").colonnes = client(d).filter(c => c.nom !== "cree_le"); }, 2, /cree_le : colonne de la source NON CLASSÉE/);
    refus("hachage", d => { const c = client(d).find(x => x.nom === "nom"); c.strategie = "hacher"; delete c.synthetique; }, 2, /pseudonymisation/);
    refus("identifiant-conserve", d => { const c = client(d).find(x => x.nom === "email"); c.strategie = "conserver"; c.motif = "gardé pour les tests de messages"; }, 2, /identifiant direct se supprime ou se remplace/);
    refus("k-sous-plancher", d => { d.seuils.k = 3; }, 2, /seuils\.k = 3/);
    refus("domaine-non-reserve", d => { client(d).find(x => x.nom === "email").domaine = "exemple-reel.fr"; }, 2, /domaine « exemple-reel\.fr » non réservé/);
    refus("k-inatteignable", d => { client(d).find(x => x.nom === "date_naissance").niveau = "jour"; }, 1, /au-delà de suppression_max/);
    // 5 bis. Toutes les stratégies que la verte n'exerce pas, sur un petit jeu synthétique construit
    //   ici : tranche, regroupement, préfixe, bruit de dates, micro-agrégation, constante, clés UUID et
    //   textuelles, table exclue. Né d'un défaut trouvé à la sonde le 29/10/2026 : la micro-agrégation
    //   était calculée AVANT les retraits, des groupes tombaient sous k, et l'oracle l'a refusé (AN6).
    {
      const base = path.join(tmpAn, "strategies"), srcS = path.join(base, "source"); fs.mkdirSync(srcS, { recursive: true });
      const metiers = ["infirmier", "medecin", "comptable", "juriste", "boulanger"];
      const lignesS = ["id,badge,matricule,age,metier,bureau,arrivee,salaire,note,service_id"];
      for (let i = 0; i < 60; i++) lignesS.push([`0f${String(i).padStart(6, "0")}-1111-4222-8333-${String(100000000000 + i * 7919).slice(0, 12)}`, `BADGE-${String(i).padStart(3, "0")}`,
        `AB${String(1000 + i * 37).padStart(5, "0")}`, 20 + (i * 7) % 45, metiers[i % 5], `B${i % 4}-${100 + i}`, `2024-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i * 3) % 27).padStart(2, "0")}`,
        (2000 + i * 13.37).toFixed(2), i % 3 ? `note privée ${i}` : "", 1 + (i % 2)].join(","));
      fs.writeFileSync(path.join(srcS, "agent.csv"), lignesS.join("\n") + "\n");
      fs.writeFileSync(path.join(srcS, "service.csv"), "id,libelle\n1,Accueil\n2,Archives\n");
      fs.writeFileSync(path.join(srcS, "journal.csv"), "id,ligne\n1,connexion\n");
      const motif = "référentiel interne sans aucune personne";
      fs.writeFileSync(path.join(base, "masquage.json"), JSON.stringify({ format: "forge-data/masquage@1", id: "strategies", date: "2026-10-29", auteur: "self-test TF-2011",
        seuils: { k: 5, l: 2, suppression_max: 0.5 }, tables: [
          { nom: "service", colonnes: [{ nom: "id", classe: "non_personnelle", strategie: "conserver", motif }, { nom: "libelle", classe: "non_personnelle", strategie: "conserver", motif }] },
          { nom: "agent", personne: "id", colonnes: [
            { nom: "id", classe: "identifiant_direct", strategie: "remplacer", synthetique: "cle" },
            { nom: "badge", classe: "identifiant_direct", strategie: "remplacer", synthetique: "cle" },
            { nom: "matricule", classe: "identifiant_direct", strategie: "remplacer", synthetique: "constante", valeur: "MASQUE" },
            { nom: "age", classe: "quasi_identifiant", strategie: "generaliser", methode: "tranche", pas: 20, forme: "libelle" },
            { nom: "metier", classe: "quasi_identifiant", strategie: "generaliser", methode: "regroupement", groupes: { sante: ["infirmier", "medecin"], gestion: ["comptable", "juriste"] }, defaut: "autre" },
            { nom: "bureau", classe: "technique", strategie: "generaliser", methode: "prefixe", longueur: 2 },
            { nom: "arrivee", classe: "technique", strategie: "bruiter", amplitude_jours: 10 },
            { nom: "salaire", classe: "attribut_sensible", strategie: "agreger", methode: "micro_agregation", taille_groupe: 5 },
            { nom: "note", classe: "texte_libre", strategie: "remplacer", synthetique: "constante", valeur: "[texte retiré]" },
            { nom: "service_id", classe: "non_personnelle", strategie: "conserver", reference: "service.id", motif }] },
          { nom: "journal", exclue: true, motif: "journal technique inutile aux tests de recette" }] }));
      const masqueS = path.join(base, "masque");
      const gs = lanceVerbe(["--masquage", path.join(base, "masquage.json"), "--source", srcS, "--sortie", masqueS, "--graine", GRAINE]);
      const t = gs.code === 0 ? verbe.lireTable(path.join(masqueS, "agent.csv"), "csv") : { colonnes: [], lignes: [] };
      const colS = (c) => t.lignes.map(r => r[t.colonnes.indexOf(c)]);
      const sourceIds = new Set(lignesS.slice(1).map(l => l.split(",")[0]));
      const groupes = [...colS("salaire").reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map()).values()];
      const preuves = {
        uuid: colS("id").every(v => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v) && !sourceIds.has(v)),
        cle_textuelle: colS("badge").every(v => /^k[0-9a-z]{12}$/.test(v)),
        constante: colS("matricule").every(v => v === "MASQUE") && colS("note").every(v => v === null || v === "[texte retiré]"),
        tranche: colS("age").every(v => ["20-39", "40-59", "60-79"].includes(v)),
        regroupement: colS("metier").every(v => ["sante", "gestion", "autre"].includes(v)),
        prefixe: colS("bureau").every(v => /^B[0-3]0000$/.test(v)),
        bruit_dates: colS("arrivee").every(v => /^20(23|24|25)-\d{2}-\d{2}$/.test(v)),
        micro_agregation: groupes.length > 0 && groupes.every(n => n >= 5),
        table_exclue: gs.code === 0 && !fs.existsSync(path.join(masqueS, "journal.csv")),
      };
      const os_ = gs.code === 0 ? juger(masqueS) : { code: null, j: {} };
      ok(gs.code === 0 && Object.values(preuves).every(Boolean) && os_.code === 0,
        `anonymiser · TOUTES les stratégies exercées et jugées PASS — ${Object.entries(preuves).map(([k, v]) => `${k} ${v ? "ok" : "KO"}`).join(", ")} ; oracle ${os_.j.verdict}`);
    }
    const occupee = path.join(tmpAn, "occupee"); fs.mkdirSync(occupee); fs.writeFileSync(path.join(occupee, "deja.txt"), "x");
    const ro = lanceVerbe(["--masquage", path.join(VERTE, "masquage.json"), "--source", SOURCE, "--sortie", occupee]);
    ok(ro.code === 2 && /n'est pas vide/.test((ro.j.motifs || []).join(" ")), "anonymiser · REFUS du verbe : une sortie non vide n'est jamais complétée — un extrait masqué s'écrit dans un dossier neuf");

    // 6. Une rouge GÉNÉRÉE par règle que les fixtures committées ne portent pas : copie de la verte,
    //    un défaut, l'oracle joué avec --source. Chacune échoue sur SA règle seule.
    let n = 0;
    const rougeGeneree = (nom, regle, muter, attendu) => {
      const dir = path.join(tmpAn, `rouge-${++n}`); fs.mkdirSync(dir);
      for (const f of fs.readdirSync(VERTE)) fs.copyFileSync(path.join(VERTE, f), path.join(dir, f));
      const lireJ = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const ecrireJ = (f, o) => fs.writeFileSync(path.join(dir, f), JSON.stringify(o, null, 2));
      const lireT = (t) => verbe.lireTable(path.join(dir, `${t}.csv`), "csv");
      const ecrireT = (t, tab) => fs.writeFileSync(path.join(dir, `${t}.csv`), verbe.ecrireCsv(tab.colonnes, tab.lignes));
      muter({ dir, lireJ, ecrireJ, lireT, ecrireT });
      const r = juger(dir, "--source", SOURCE); surveiller(nom, r.j);
      const b = bloquantes(r.j);
      ok(r.code === 1 && JSON.stringify(b) === JSON.stringify([regle]) && (r.j.findings || []).some(f => f.regle === regle && attendu.test(f.msg)),
        `${regle} · ROUGE générée (${nom}) : FAIL sur ${regle} seule (obtenu ${b.join(",") || "rien"})`);
    };
    const sansMesures = (ctx) => { const r = ctx.lireJ("anonymisation.json"); delete r.mesures; ctx.ecrireJ("anonymisation.json", r); };
    const remettreSource = (ctx, table, colonne) => {
      const t = ctx.lireT(table), s = verbe.lireTable(path.join(SOURCE, `${table}.csv`), "csv");
      const j = t.colonnes.indexOf(colonne), js = s.colonnes.indexOf(colonne);
      t.lignes.forEach((r, i) => { r[j] = s.lignes[i][js]; }); ctx.ecrireT(table, t);
    };
    rougeGeneree("fichier égaré dans le dossier masqué", "AN1", ({ dir }) => fs.writeFileSync(path.join(dir, "client_source.csv"), "id\n1\n"), /client_source\.csv/);
    rougeGeneree("colonne de la source non classée", "AN2", (ctx) => {
      const d = ctx.lireJ("masquage.json"); const t = d.tables.find(x => x.nom === "client"); t.colonnes = t.colonnes.filter(c => c.nom !== "cree_le"); ctx.ecrireJ("masquage.json", d);
      const tab = ctx.lireT("client"); const j = tab.colonnes.indexOf("cree_le"); tab.colonnes.splice(j, 1); tab.lignes.forEach(r => r.splice(j, 1)); ctx.ecrireT("client", tab);
    }, /client\.cree_le : colonne de la source NON CLASSÉE/);
    rougeGeneree("courriel hors domaine réservé", "AN3", (ctx) => {
      const tab = ctx.lireT("client"); const j = tab.colonnes.indexOf("email"); tab.lignes.forEach((r, i) => { r[j] = `u${i}@exemple-reel.fr`; }); ctx.ecrireT("client", tab);
    }, /hors domaine réservé/);
    rougeGeneree("graine écrite au rapport", "AN4", (ctx) => { const r = ctx.lireJ("anonymisation.json"); r.graine = GRAINE; ctx.ecrireJ("anonymisation.json", r); }, /graine « valeur écrite »/);
    rougeGeneree("k déclaré sous le plancher", "AN5", (ctx) => { const d = ctx.lireJ("masquage.json"); d.seuils.k = 3; ctx.ecrireJ("masquage.json", d); }, /seuils\.k = 3/);
    rougeGeneree("montant conservé tel quel", "AN6", (ctx) => {
      sansMesures(ctx);
      const d = ctx.lireJ("masquage.json"); const c = d.tables.find(x => x.nom === "commande").colonnes.find(x => x.nom === "montant");
      for (const k of Object.keys(c)) if (!["nom", "classe"].includes(k)) delete c[k];
      Object.assign(c, { strategie: "conserver", motif: "montant exact utile aux tests de facturation" }); ctx.ecrireJ("masquage.json", d);
      remettreSource(ctx, "commande", "montant");
    }, /commande\.montant : \d+ ligne\(s\) masquée\(s\) sur 231/);
    rougeGeneree("date de naissance « généralisée » au jour, classée technique", "AN6", (ctx) => {
      sansMesures(ctx);
      const d = ctx.lireJ("masquage.json"); const c = d.tables.find(x => x.nom === "client").colonnes.find(x => x.nom === "date_naissance");
      c.classe = "technique"; c.niveau = "jour"; ctx.ecrireJ("masquage.json", d);
      remettreSource(ctx, "client", "date_naissance");
    }, /client\.date_naissance : \d+ ligne\(s\) masquée\(s\) sur 151/);
    rougeGeneree("l déclaré sous le plancher", "AN7", (ctx) => { const d = ctx.lireJ("masquage.json"); d.seuils.l = 1; ctx.ecrireJ("masquage.json", d); }, /seuils\.l = 1/);
    rougeGeneree("t déclaré à 0,05", "AN7", (ctx) => { sansMesures(ctx); const d = ctx.lireJ("masquage.json"); d.seuils.t = 0.05; ctx.ecrireJ("masquage.json", d); }, /plus de t = 0\.05/);
    rougeGeneree("texte libre conservé", "AN8", (ctx) => {
      const d = ctx.lireJ("masquage.json"); const c = d.tables.find(x => x.nom === "commande").colonnes.find(x => x.nom === "note_livraison");
      delete c.synthetique; Object.assign(c, { strategie: "conserver", motif: "consignes de livraison utiles au support" }); ctx.ecrireJ("masquage.json", d);
      remettreSource(ctx, "commande", "note_livraison");
    }, /texte\(s\) libre\(s\) masqué\(s\) identique\(s\)/);
    rougeGeneree("clé étrangère vers une ligne absente", "AN9", (ctx) => {
      const tab = ctx.lireT("commande"); tab.lignes[0][tab.colonnes.indexOf("client_id")] = "999999999"; ctx.ecrireT("commande", tab);
    }, /1 référence\(s\) vers une ligne ABSENTE de client\.id/);
    rougeGeneree("compte annoncé faux", "AN10", (ctx) => { const r = ctx.lireJ("anonymisation.json"); r.tables.client.lignes_masque = 150; ctx.ecrireJ("anonymisation.json", r); }, /annonce 150 ligne\(s\) masquée\(s\), l'extrait en compte 151/);
    const absente = juger(path.join(tmpAn, "nulle-part"));
    ok(absente.code === 2 && absente.j.verdict === "SKIP", `anonymiser · cible absente : SKIP, exit 2 (obtenu ${absente.code})`);
    const orpheline = path.join(tmpAn, "sans-source"); fs.mkdirSync(orpheline);
    for (const f of fs.readdirSync(VERTE)) fs.copyFileSync(path.join(VERTE, f), path.join(orpheline, f));
    const so = juger(orpheline);
    ok(so.code === 1 && bloquantes(so.j).includes("AN1") && (so.j.findings || []).some(f => /extrait SOURCE introuvable/.test(f.msg)),
      "AN1 · ROUGE — sans l'extrait source, l'oracle REFUSE : l'identité et la corrélation ne se mesurent pas, il ne rend jamais PASS faute de preuve");
    ok(!fuites.length, `anonymiser · aucun constat ne recopie une valeur de la source (courriel, nom, prénom, texte libre) sur ${4 + n} rouges${fuites.length ? " — FUITE : " + fuites.join(" · ") : ""}`);
  } finally {
    fs.rmSync(tmpAn, { recursive: true, force: true });
  }
}

// Profils-moteur (16/10/2026) — la doctrine de `references/profils-moteur/LISEZMOI.md` (points 1
// et 7) disait « frontmatter moteur + version + challenge_date + sources », mais aucun oracle du
// parc ne la jugeait : un profil sans sources, ou absent de l'inventaire, passait sans bruit.
// Garde en deux règles, jouée sur le dossier réel puis, sens rouge, sur une copie jetable.
//   PM1 : chaque profil (tout .md hors LISEZMOI.md) ouvre sur un frontmatter qui porte `moteur`,
//         une `version` SemVer, une `challenge_date` AAAA-MM-JJ et au moins une entrée `sources`.
//   PM2 : l'inventaire du LISEZMOI cite chaque profil en accents graves, et le compte annoncé
//         « Inventaire des profils actifs (N) » égale le nombre de profils sur le disque.
//   PM3 (TF-1999, 29/10/2026) : chaque entrée `- **<moteur>**` de « Liste d'attente » et
//         d'« Écarts motivés » porte « Décidé le JJ/MM/AAAA », au moins une source « lu le
//         JJ/MM/AAAA », et « Déclencheur : » (attente) ou « Motif : » (écart) ; aucun de ces
//         moteurs n'a de profil `<moteur>.md` sur le disque. Une décision non datée ou non
//         sourcée, ou un profil créé sans retirer son entrée, ne passe plus sans bruit.
const SECTIONS_DECISIONS = [
  { titre: "## Liste d'attente", exige: "Déclencheur :" },
  { titre: "## Écarts motivés", exige: "Motif :" },
];
const jugerDecisionsMoteur = (lis, profils) => {
  const defauts = [];
  const moteurs = [];
  for (const { titre, exige } of SECTIONS_DECISIONS) {
    const section = (lis.split(titre)[1] || "").split(/^## /m)[0];
    const entrees = section.split(/^(?=- \*\*)/m).filter(b => b.startsWith("- **"));
    for (const bloc of entrees) {
      const moteur = (bloc.match(/^- \*\*([a-z0-9-]+)\*\*/) || [])[1] || "?";
      moteurs.push(moteur);
      if (!/Décidé le \d{2}\/\d{2}\/\d{4}/.test(bloc)) defauts.push(`PM3 ${moteur} : date de décision absente`);
      if (!/lu le \d{2}\/\d{2}\/\d{4}/.test(bloc)) defauts.push(`PM3 ${moteur} : aucune source datée « lu le »`);
      if (!bloc.includes(exige)) defauts.push(`PM3 ${moteur} : « ${exige} » absent`);
      if (profils.includes(`${moteur}.md`)) defauts.push(`PM3 ${moteur} : un profil ${moteur}.md existe, l'entrée doit sortir de « ${titre.slice(3)} »`);
    }
  }
  return { moteurs, defauts };
};
const jugerProfilsMoteur = (dir) => {
  const defauts = [];
  const profils = fs.readdirSync(dir).filter(f => f.endsWith(".md") && f !== "LISEZMOI.md").sort();
  for (const f of profils) {
    const t = fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n");
    const m = t.match(/^---\n([\s\S]*?)\n---\n/);
    if (!m) { defauts.push(`PM1 ${f} : pas de frontmatter`); continue; }
    const fm = m[1];
    if (!/^moteur:\s*\S+/m.test(fm)) defauts.push(`PM1 ${f} : moteur absent`);
    if (!/^version:\s*\d+\.\d+\.\d+\s*$/m.test(fm)) defauts.push(`PM1 ${f} : version SemVer absente`);
    if (!/^challenge_date:\s*\d{4}-\d{2}-\d{2}\s*$/m.test(fm)) defauts.push(`PM1 ${f} : challenge_date AAAA-MM-JJ absente`);
    if (!/^sources:\s*\n(\s+-\s+\S.*\n?)+/m.test(fm)) defauts.push(`PM1 ${f} : sources vides ou absentes`);
    // PM4 (TF-2008, 29/10/2026) : une source lue APRÈS la challenge_date est un fait ajouté sans
    // rafraîchir la date du profil, l'« édition silencieuse » que le point 7 du LISEZMOI interdit.
    const challenge = (fm.match(/^challenge_date:\s*(\d{4}-\d{2}-\d{2})/m) || [])[1];
    for (const [, j, mo, a] of fm.matchAll(/lu le (\d{2})\/(\d{2})\/(\d{4})/g)) {
      if (challenge && `${a}-${mo}-${j}` > challenge) defauts.push(`PM4 ${f} : source lue le ${j}/${mo}/${a}, après la challenge_date ${challenge}`);
    }
  }
  const lis = fs.readFileSync(path.join(dir, "LISEZMOI.md"), "utf8");
  const inv = lis.split(/^## Inventaire des profils actifs/m)[1] || "";
  const annonce = Number((inv.match(/^\s*\((\d+)\)/) || [])[1]);
  if (annonce !== profils.length) defauts.push(`PM2 inventaire annonce ${annonce}, disque ${profils.length}`);
  const corps = inv.split(/^## /m)[0];
  for (const f of profils) if (!corps.includes("`" + f + "`")) defauts.push(`PM2 ${f} absent de l'inventaire`);
  const decisions = jugerDecisionsMoteur(lis.replace(/\r\n/g, "\n"), profils);
  defauts.push(...decisions.defauts);
  return { profils, defauts, decisions: decisions.moteurs };
};
{
  const dirProfils = path.join(ici, "..", "references", "profils-moteur");
  const reel = jugerProfilsMoteur(dirProfils);
  ok(reel.defauts.length === 0,
    `profils-moteur · PM1-PM4 sur ${reel.profils.length} profils (${reel.profils.join(", ")}) et ${reel.decisions.length} décision(s) hors inventaire (${reel.decisions.join(", ")}) — ${reel.defauts.length ? reel.defauts.join(" · ") : "0 défaut"}`);
  // PM3, sens rouge (TF-1999) : copie jetable où l'entrée « d1 » perd son déclencheur et ses
  // sources datées, et où un profil d1.md apparaît sans que l'entrée sorte de la liste d'attente.
  const tmpPm3 = fs.mkdtempSync(path.join(os.tmpdir(), "fd-decisions-"));
  try {
    for (const f of fs.readdirSync(dirProfils)) fs.copyFileSync(path.join(dirProfils, f), path.join(tmpPm3, f));
    const lis = fs.readFileSync(path.join(tmpPm3, "LISEZMOI.md"), "utf8").replace(/\r\n/g, "\n");
    const [avant, apres] = lis.split("- **d1**");
    const finD1 = apres.search(/^## /m);
    const d1Degradee = apres.slice(0, finD1).replace(/Déclencheur :/g, "Quand :").replace(/lu le \d{2}\/\d{2}\/\d{4}/g, "consulté");
    fs.writeFileSync(path.join(tmpPm3, "LISEZMOI.md"), avant + "- **d1**" + d1Degradee + apres.slice(finD1));
    fs.writeFileSync(path.join(tmpPm3, "d1.md"), "---\nmoteur: d1\nversion: 0.1.0\nchallenge_date: 2026-10-29\nsources:\n  - \"s\"\n---\n");
    const rouge3 = jugerProfilsMoteur(tmpPm3);
    const attendus3 = ["PM3 d1 : aucune source datée « lu le »", "PM3 d1 : « Déclencheur : » absent",
      "PM3 d1 : un profil d1.md existe, l'entrée doit sortir de « Liste d'attente »"];
    ok(attendus3.every(a => rouge3.defauts.includes(a)) && !rouge3.defauts.some(d => /^PM3 (r2|hyperdrive)/.test(d)),
      `profils-moteur · PM3 ROUGE — entrée d1 sans déclencheur ni source datée, profil d1.md créé sans la retirer : ${rouge3.defauts.filter(d => d.startsWith("PM3")).join(" · ")}`);
    // Remède que le message propose (TF-1013) : l'entrée sort de la liste quand le profil naît.
    fs.writeFileSync(path.join(tmpPm3, "LISEZMOI.md"), avant + apres.slice(finD1));
    const remede = jugerProfilsMoteur(tmpPm3);
    ok(!remede.defauts.some(d => d.startsWith("PM3")) && !remede.decisions.includes("d1"),
      `profils-moteur · PM3 remède joué — entrée d1 retirée au profit de d1.md : ${remede.defauts.filter(d => d.startsWith("PM3")).length} défaut PM3`);
  } finally {
    fs.rmSync(tmpPm3, { recursive: true, force: true });
  }
  // Sens rouge : copie jetable, un profil privé de ses sources et un profil hors inventaire.
  const tmpPm = fs.mkdtempSync(path.join(os.tmpdir(), "fd-profils-"));
  try {
    for (const f of fs.readdirSync(dirProfils)) fs.copyFileSync(path.join(dirProfils, f), path.join(tmpPm, f));
    const cible = reel.profils[0];
    const sansSources = fs.readFileSync(path.join(tmpPm, cible), "utf8").replace(/\r\n/g, "\n").replace(/^sources:\s*\n(\s+-\s+.*\n)+/m, "");
    fs.writeFileSync(path.join(tmpPm, cible), sansSources);
    fs.writeFileSync(path.join(tmpPm, "zz-hors-inventaire.md"), "---\nmoteur: x\nversion: 1.0.0\nchallenge_date: 2026-10-16\nsources:\n  - \"s\"\n---\n");
    const rouge = jugerProfilsMoteur(tmpPm);
    const attendus = [`PM1 ${cible} : sources vides ou absentes`, "PM2 zz-hors-inventaire.md absent de l'inventaire"];
    ok(attendus.every(a => rouge.defauts.includes(a)) && rouge.defauts.some(d => d.startsWith("PM2 inventaire annonce")),
      `profils-moteur · ROUGE — copie jetable sans sources et avec un profil hors inventaire : ${rouge.defauts.length} défaut(s) détecté(s) (${rouge.defauts.join(" · ")})`);
  } finally {
    fs.rmSync(tmpPm, { recursive: true, force: true });
  }
  // PM4, sens rouge puis remède (TF-2008) : supabase.md ramené à une challenge_date antérieure à
  // ses sources lues le 29/10/2026, puis rafraîchi à la date de la lecture la plus récente.
  const tmpPm4 = fs.mkdtempSync(path.join(os.tmpdir(), "fd-fraicheur-"));
  try {
    for (const f of fs.readdirSync(dirProfils)) fs.copyFileSync(path.join(dirProfils, f), path.join(tmpPm4, f));
    const cheminSb = path.join(tmpPm4, "supabase.md");
    const sb = fs.readFileSync(cheminSb, "utf8");
    fs.writeFileSync(cheminSb, sb.replace(/^challenge_date:.*$/m, "challenge_date: 2026-10-16"));
    const rouge4 = jugerProfilsMoteur(tmpPm4).defauts.filter(d => d.startsWith("PM4"));
    ok(rouge4.length > 0 && rouge4.every(d => d.startsWith("PM4 supabase.md")),
      `profils-moteur · PM4 ROUGE — challenge_date ramenée au 16/10/2026 sous des sources lues le 29/10/2026 : ${rouge4.length} défaut(s) (${rouge4[0] || "aucun"})`);
    fs.writeFileSync(cheminSb, sb.replace(/^challenge_date:.*$/m, "challenge_date: 2026-10-29"));
    const remede4 = jugerProfilsMoteur(tmpPm4).defauts.filter(d => d.startsWith("PM4"));
    ok(remede4.length === 0, `profils-moteur · PM4 remède joué — challenge_date rafraîchie au 29/10/2026 : ${remede4.length} défaut PM4`);
  } finally {
    fs.rmSync(tmpPm4, { recursive: true, force: true });
  }
}

// Profil supabase §7 (TF-2008) : l'affirmation MESURÉE du profil est rejouée. Le 29/10/2026, le
// verbe importer replie `extensions.vector(384)` sur "string" en le disant, et ne lit ni l'index
// HNSW ni `ENABLE ROW LEVEL SECURITY`. Si le verbe change, ce cas rougit et le profil se relit.
{
  const tmpVec = fs.mkdtempSync(path.join(os.tmpdir(), "fd-pgvector-"));
  try {
    const iv = lanceScript("importer.mjs", [fx("schema-supabase-pgvector.sql"), "--sortie-dir", tmpVec]);
    const avert = (iv.r.avertissements || []).filter(a => /extensions\.vector\(384\)/.test(a) && /non reconnu/.test(a));
    const pContrat = iv.r.fichiers_produits && iv.r.fichiers_produits.contrat;
    const props = pContrat ? (JSON.parse(fs.readFileSync(pContrat, "utf8")).schema || [])[0]?.proprietes || [] : [];
    const emb = props.find(p => p.nom === "embedding");
    ok(iv.exit === 0 && avert.length === 1 && emb && emb.type === "string" && iv.r.compte && iv.r.compte.assertions === 4,
      `profil supabase §7 · importer sur pgvector : exit ${iv.exit}, ${avert.length} avertissement « non reconnu » sur vector(384), type replié « ${emb && emb.type} », ${iv.r.compte && iv.r.compte.assertions} assertions (index HNSW et RLS sans effet)`);
  } finally {
    fs.rmSync(tmpVec, { recursive: true, force: true });
  }
}

console.log(`\nSelf-test forge-data : ${pass} PASS, ${echec} FAIL`);
process.exit(echec ? 1 : 0);
