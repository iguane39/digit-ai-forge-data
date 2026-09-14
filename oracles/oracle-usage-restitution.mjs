#!/usr/bin/env node
// oracle-usage-restitution — Domaine « Un relevé d'usage d'un rapport de restitution est
// STRUCTURELLEMENT COHÉRENT : partition des colonnes, mesures nommées, comptes recalculés »
// (déterministe). TF-0971, 14/09/2026.
//
// LE FAIT MESURÉ. `oracle-couvrir` mesure la couverture d'un mapping contre l'INVENTAIRE d'une
// source — jamais contre ce qui est effectivement à l'écran. Sur un modèle de 342 colonnes, 66
// seulement étaient mobilisées par les visuels d'un rapport réel (21 projetées telles quelles, 45
// lues par des mesures affichées) ; 276 ne l'étaient JAMAIS. La dette bloquante que `oracle-couvrir`
// annonçait était deux fois plus grande que la dette RÉELLEMENT mobilisée, et cet oracle ne peut
// structurellement pas le dire. `scripts/mesurer-usage-restitution.mjs` produit le relevé qui
// répond à cette question précise (format `forge-data/usage-restitution@1`) ; cet oracle en juge
// la COHÉRENCE STRUCTURELLE — jamais la justesse de la lecture de mise en page elle-même.
//
//   U1  format + id ; les trois populations `affichee`, `lue_par_mesure`, `jamais_lue` sont des
//       listes (vides admises — un rapport peut, en théorie, n'utiliser aucune colonne du modèle
//       fourni, et c'est alors le fait le plus grave que l'oracle puisse rendre) ;
//   U2  PARTITION : aucune colonne ne figure dans plus d'une population — une colonne à la fois
//       « affichée » et « jamais lue » romprait la mesure elle-même, pas seulement son affichage ;
//   U3  chaque entrée de population et chaque mesure affichée est de la forme « Table.membre »
//       (ou « Table[Mesure] » pour les mesures) — une chaîne vide ou sans séparateur n'identifie
//       aucun objet ;
//   U4  `compte` est RECALCULÉ contre les tableaux qu'il prétend résumer — un total recopié qui
//       diverge de la liste qu'il annonce est exactement le défaut qui a laissé passer un chiffre
//       faux ailleurs dans cette forge (même famille que CV6 d'`oracle-couvrir`, RP7
//       d'`oracle-rapprocher`).
//
// non_juge : la JUSTESSE de la lecture de mise en page (queryRef bien résolu, visuel bien
// classé) — cet oracle juge un DOCUMENT déjà produit, pas le rapport PBIR source ; la
// pertinence de désigner une colonne « jamais lue » comme candidate à la suppression (une
// décision produit, pas une mesure) ; le croisement avec `oracle-couvrir` (orphelins ∩
// jamais_lue), volontairement laissé à une intersection ensembliste hors de cet oracle.
// Usage : node oracle-usage-restitution.mjs <usage-restitution.json> [--json-only]
import fs from "node:fs";

const DOM = "Cohérence structurelle d'un relevé d'usage de restitution : partition, formes, comptes recalculés (U1-U4)";
const NON_JUGE = [
  "la JUSTESSE de la lecture de mise en page — cet oracle juge un DOCUMENT déjà produit par `scripts/mesurer-usage-restitution.mjs` de ce dépôt, jamais le rapport PBIR source lui-même",
  "la pertinence de désigner une colonne « jamais lue » comme candidate à la suppression — c'est une décision produit, l'oracle ne fait que constater la population",
  "le croisement avec la couverture (orphelins ∩ jamais_lue) — intersection ensembliste laissée hors de cet oracle, contre `oracles/oracle-couvrir.mjs` de ce dépôt",
];
const FORME_OBJET = /^[^.[\]]+(?:\.[^.[\]]+|\[[^\]]+\])$/;

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-usage-restitution", domaine: DOM, artefact: file || null,
    verdict, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "U1-U4 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "U1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "U1", "JSON invalide", file); out("FAIL", 1); }

// ---- U1 · squelette -----------------------------------------------------------------------
if (d.format !== "forge-data/usage-restitution@1") add("bloquant", "U1", `format « ${d.format} » (attendu forge-data/usage-restitution@1)`, file);
if (!d.id) add("bloquant", "U1", "id du relevé non nommé", file);
const pop = d.populations && typeof d.populations === "object" ? d.populations : null;
if (!pop) add("bloquant", "U1", "bloc « populations » absent", file);
const listes = { affichee: [], lue_par_mesure: [], jamais_lue: [] };
for (const k of Object.keys(listes)) {
  if (pop && !Array.isArray(pop[k])) add("bloquant", "U1", `populations.${k} absente ou n'est pas une liste`, "populations");
  else if (pop) listes[k] = pop[k];
}
const mesures = Array.isArray(d.mesures_affichees) ? d.mesures_affichees : [];
if (d.mesures_affichees !== undefined && !Array.isArray(d.mesures_affichees)) add("bloquant", "U1", "mesures_affichees déclaré mais n'est pas une liste", file);

// ---- U3 · forme « Table.membre » ou « Table[Mesure] » --------------------------------------
for (const k of Object.keys(listes)) listes[k].forEach((o, i) => {
  if (typeof o !== "string" || !FORME_OBJET.test(o.trim()))
    add("bloquant", "U3", `populations.${k} #${i + 1} : « ${o} » n'est pas de la forme « Table.membre » ou « Table[Mesure] »`, `populations.${k}`);
});
mesures.forEach((m, i) => {
  if (typeof m !== "string" || !FORME_OBJET.test(m.trim()))
    add("bloquant", "U3", `mesures_affichees #${i + 1} : « ${m} » n'est pas de la forme « Table[Mesure] »`, "mesures_affichees");
});

// ---- U2 · partition : aucune colonne dans plus d'une population -----------------------------
const vueDans = new Map(); // objet normalisé -> [populations]
for (const k of Object.keys(listes)) for (const o of listes[k]) {
  if (typeof o !== "string") continue;
  const norm = o.trim().toLowerCase();
  const vues = vueDans.get(norm) || [];
  vues.push(k);
  vueDans.set(norm, vues);
}
for (const [norm, vues] of vueDans) if (vues.length > 1)
  add("bloquant", "U2", `« ${norm} » figure dans PLUSIEURS populations (${vues.join(", ")}) — une colonne à la fois affichée et jamais lue romprait la mesure elle-même`, "populations");

// ---- U4 · compte RECALCULÉ, jamais recopié ---------------------------------------------------
const compte = d.compte && typeof d.compte === "object" ? d.compte : null;
if (!compte) add("bloquant", "U4", "bloc « compte » absent — un relevé sans total vérifiable ne se recalcule pas", file);
else {
  const attendu = {
    affichee: listes.affichee.length, lue_par_mesure: listes.lue_par_mesure.length, jamais_lue: listes.jamais_lue.length,
    mesures_affichees: mesures.length,
  };
  for (const [k, n] of Object.entries(attendu)) {
    if (compte[k] === undefined) add("bloquant", "U4", `compte.${k} absent`, "compte");
    else if (Number(compte[k]) !== n) add("bloquant", "U4", `compte.${k} = ${compte[k]}, recalculé à ${n} — un total recopié qui diverge de sa liste est exactement le défaut que cette règle existe pour bloquer`, "compte");
  }
}

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
