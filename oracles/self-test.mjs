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
  { oracle: "oracle-restituer.mjs", verte: "rapport-verte.md", rouge: "rapport-rouge.md", regles: ["R2", "R3", "R4"] },
  { oracle: "oracle-contractualiser.mjs", verte: "contrat-verte.json", rouge: "contrat-rouge.json", regles: ["C2", "C3", "C4", "C5"] },
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

  for (const oracle of ["oracle-profiler.mjs", "oracle-tracer.mjs", "oracle-restituer.mjs", "oracle-contractualiser.mjs"]) {
    const cibles = { "oracle-restituer.mjs": fx("rapport-verte.md"), "oracle-tracer.mjs": fx("lineage-verte.json"),
                     "oracle-profiler.mjs": fx("assertions-verte.json"), "oracle-contractualiser.mjs": fx("contrat-verte.json") };
    const rap = lance(oracle, cibles[oracle]).r;
    const texte = (rap.non_juge || []).join(" ");
    // Un chemin cité en span de code doit EXISTER.
    const chemins = [...texte.matchAll(CITATION)].map(m => m[1]);
    const fantomes = chemins.filter(c => !resolvable(c));
    ok(!fantomes.length, `${oracle} · chemins cités au non_juge tous résolvables${fantomes.length ? " — fantôme(s) : " + fantomes.join(", ") : ` (${chemins.length} vérifié(s))`}`);
    // Et aucun oracle ne doit être cité par son SEUL nom : c'est ce qui a coûté la recherche.
    const nus = [...texte.matchAll(NOM_NU)].map(m => m[0]);
    ok(!nus.length, `${oracle} · aucun oracle cité par son seul nom au non_juge${nus.length ? " — " + [...new Set(nus)].join(", ") + " (donner le chemin, ou dire « aucun oracle du parc »)" : ""}`);
  }
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
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
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
} finally {
  fs.rmSync(tmp2, { recursive: true, force: true });
}

console.log(`\nSelf-test forge-data : ${pass} PASS, ${echec} FAIL`);
process.exit(echec ? 1 : 0);
