#!/usr/bin/env node
// self-test.mjs — double sens des trois oracles de discipline (fixtures synthétiques) :
// chaque verte PASSE (exit 0), chaque rouge ÉCHOUE (exit 1) en déclenchant les règles
// attendues, avec findings localisants. À rejouer après toute modification.
import { execFileSync } from "node:child_process";
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

const CAS = [
  { oracle: "oracle-profiler.mjs", verte: "assertions-verte.json", rouge: "assertions-rouge.json", regles: ["P2", "P3"] },
  { oracle: "oracle-tracer.mjs", verte: "lineage-verte.json", rouge: "lineage-rouge.json", regles: ["T2", "T3", "T4", "T5"] },
  { oracle: "oracle-tracer.mjs", verte: "lineage-colonne-verte.json", rouge: "lineage-colonne-rouge.json", regles: ["T6"] },
  { oracle: "oracle-restituer.mjs", verte: "rapport-verte.md", rouge: "rapport-rouge.md", regles: ["R2", "R3", "R4"] },
];

console.log("SELF-TEST forge-data — discipline aux niveaux des 3 barres (fixtures synthétiques)\n");
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
console.log(`\nSelf-test forge-data : ${pass} PASS, ${echec} FAIL`);
process.exit(echec ? 1 : 0);
