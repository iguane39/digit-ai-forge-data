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
  { oracle: "oracle-restituer.mjs", verte: "rapport-verte.md", rouge: "rapport-rouge.md", regles: ["R2", "R3", "R4"] },
  { oracle: "oracle-contractualiser.mjs", verte: "contrat-verte.json", rouge: "contrat-rouge.json", regles: ["C2", "C3", "C4", "C5"] },
  // Lots L3, L4, L7 de l'étude d'opportunité du pilot (07/09/2026, mandat D-5 puis GO A-24 à A-26).
  // modéliser (TF-0860) : la rouge porte un fait sans grain, une mesure d'agrégation inconnue, une
  // dimension définie deux fois, une clé de substitution égale à la clé naturelle, un type de
  // changement hors jeu, aucune dimension temps, un processus absent de la matrice en bus.
  { oracle: "oracle-modeliser.mjs", verte: "modele-dimensionnel-verte.json", rouge: "modele-dimensionnel-rouge.json", regles: ["M2", "M3", "M4", "M5", "M6"] },
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
  // restituer R7 : un rapport de mapping qui pointe une mesure de couverture existante PASSE ;
  // celui qui se dit exhaustif en pointant le vide ÉCHOUE — sur R7 et sur R7 seulement.
  { oracle: "oracle-restituer.mjs", verte: "rapport-couverture-verte.md", rouge: "rapport-couverture-rouge.md", regles: ["R7"] },
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

  // ---- TF-0893 : seconde voie d'entrée — API REST lineage-tracking, grain TABLE ----
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
      `traduire-unity-catalog/api · grain table → confiance.niveau 0 (REX X6 : 1-2-3 sont des grains colonne), transformations runtime — obtenu niveau ${lg.confiance.niveau}`);
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
// MENT PAS sur ce que TMDL ne porte pas. Un brouillon qui aurait rempli le grain, la clé
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
    ok(dimCal.cle_naturelle === undefined && m.matrice_bus === undefined && m.faits[0].grain === undefined,
      "traduire-modele-semantique · clé naturelle, grain et matrice en bus restent ABSENTS — TMDL ne les porte pas, et un placeholder vraisemblable ferait PASSER l'oracle en mentant");
    // Le point qui compte : l'oracle réclame EXACTEMENT ce que le verbe a annoncé manquant.
    const r = lance("oracle-modeliser.mjs", pBrouillon);
    const durs = [...new Set((r.r.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle))].sort();
    ok(r.exit === 1 && JSON.stringify(durs) === JSON.stringify(["M2", "M4", "M5", "M6"]),
      `traduire-modele-semantique → oracle-modeliser : FAIL sur M2, M4, M5, M6 et RIEN d'autre — la liste des règles rouges est celle des champs déclarés « à compléter » (obtenu ${JSON.stringify(durs)})`);
    const annonces = (b.r.a_completer || []).join(" ");
    ok(["M2", "M4", "M5", "M6"].every(x => annonces.includes(`(${x})`)),
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

console.log(`\nSelf-test forge-data : ${pass} PASS, ${echec} FAIL`);
process.exit(echec ? 1 : 0);
