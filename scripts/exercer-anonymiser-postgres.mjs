#!/usr/bin/env node
// exercer-anonymiser-postgres — recette RÉELLE du verbe anonymiser (TF-2011, 29/10/2026) sur un
// PostgreSQL ÉPHÉMÈRE en Docker local, créé et détruit par ce script. Modèle : la sonde
// `forge_tests/sondes/charger_jeu.py` de forge-tests (base éphémère, constat écrit, base détruite).
//
// POURQUOI. Le self-test prouve la chaîne sur des fichiers. Il ne prouve pas que les commandes du
// profil-moteur (`references/profils-moteur/postgres.md` §6) produisent la forme que le verbe lit,
// ni qu'un extrait masqué se RECHARGE dans le schéma de la base avec ses contraintes : c'est le
// moteur qui applique les clés étrangères, pas l'oracle. Ce script joue les commandes documentées,
// sur la source SYNTHÉTIQUE de la forge (`fixtures/anonymisation-source/`), jamais sur une donnée réelle.
//
// CE QU'IL FAIT, dans l'ordre :
//   1. monte un conteneur `postgres` (aucun port publié : tout passe par `docker exec`), étiqueté
//      `forge-data.recette=anonymiser` ;
//   2. charge le schéma et la source synthétiques, puis EXTRAIT chaque table par la commande du
//      profil (`\copy (SELECT …) TO … WITH (FORMAT csv, HEADER true)`) — l'extrait doit être
//      identique octet pour octet à la fixture source : la forme portable est celle du moteur ;
//   3. masque l'extrait par le verbe (graine tirée au hasard, comme en usage réel) et le fait juger
//      par l'oracle — PASS attendu ;
//   4. recharge l'extrait masqué de deux façons : par sections (`pg_dump --section=pre-data`, données,
//      `--section=post-data` : les clés étrangères se valident à leur création), puis dans le schéma
//      complet, tables dans l'`ordre_chargement` du rapport — les comptes doivent être ceux du rapport ;
//   5. sens rouge, dans le moteur : une clé étrangère masquée rendue orpheline fait ÉCHOUER la
//      section post-data (SQLSTATE 23503), et l'oracle la refuse aussi (AN9) ;
//   6. détruit le conteneur et vérifie qu'aucun conteneur de l'étiquette ne reste.
//
// Il ne se connecte JAMAIS à une base existante, ne publie aucun port, ne lit aucun .env, et ne tire
// pas d'image sans `--tirer` (sans elle, une image absente rend SKIP avec la commande à jouer).
//
// Usage : node scripts/exercer-anonymiser-postgres.mjs [--image postgres:16-alpine] [--tirer] [--json-only]
// Codes : 0 PASS ; 1 FAIL (une étape a échoué, dite) ; 2 SKIP (Docker injoignable ou image absente).
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, "..");
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const jsonOnly = args.includes("--json-only");
const IMAGE = opt("--image") || "postgres:16-alpine";
const ETIQUETTE = "forge-data.recette=anonymiser";
const TABLES = ["client", "produit", "commande", "ligne_commande"];
const debut = Date.now();
const etapes = [];
let conteneur = null, versionPg = null;

const lancer = (cmd, a, entree) => {
  const r = spawnSync(cmd, a, { encoding: "utf8", input: entree, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, sortie: r.stdout || "", erreur: (r.stderr || "") + (r.error ? String(r.error.message) : "") };
};
const rendre = (verdict, code) => {
  const restants = lancer("docker", ["ps", "-a", "-q", "--filter", `label=${ETIQUETTE}`]);
  process.stdout.write(JSON.stringify({
    exercice: "exercer-anonymiser-postgres", image: IMAGE, postgres: versionPg, verdict,
    duree_s: Math.round((Date.now() - debut) / 100) / 10, etapes,
    conteneurs_restants: restants.code === 0 ? restants.sortie.split(/\s+/).filter(Boolean).length : null,
    non_juge: [
      "une base RÉELLE : l'exercice ne joue que la source synthétique de la forge, sur une base qu'il crée et détruit",
      "Supabase hébergé (pooler, rôles, schémas auth et storage) : seul le moteur PostgreSQL est exercé ici ; la version majeure locale du CLI Supabase (17) s'exerce avec --image postgres:17-alpine",
    ],
  }, null, jsonOnly ? 0 : 2) + "\n");
  process.exit(code);
};
const etape = (nom, ok, detail) => { etapes.push({ etape: nom, verdict: ok ? "PASS" : "FAIL", detail }); return ok; };

// ---- préalables : Docker joignable, image présente --------------------------------------------
const dk = lancer("docker", ["version", "--format", "{{.Server.Version}}"]);
if (dk.code !== 0) { etapes.push({ etape: "docker", verdict: "SKIP", detail: `démon Docker injoignable : ${dk.erreur.trim().slice(0, 200)}` }); rendre("SKIP", 2); }
if (lancer("docker", ["image", "inspect", IMAGE]).code !== 0) {
  if (!args.includes("--tirer")) { etapes.push({ etape: "image", verdict: "SKIP", detail: `image ${IMAGE} absente localement : docker pull ${IMAGE}, ou relancer avec --tirer` }); rendre("SKIP", 2); }
  const p = lancer("docker", ["pull", IMAGE]);
  if (p.code !== 0) { etapes.push({ etape: "image", verdict: "SKIP", detail: `docker pull ${IMAGE} refusé : ${p.erreur.trim().slice(0, 200)}` }); rendre("SKIP", 2); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fd-exercice-anon-"));
const motDePasse = crypto.randomBytes(12).toString("hex");
const psql = (base, entree, ...commande) => lancer("docker", ["exec", "-i", "-e", `PGPASSWORD=${motDePasse}`, conteneur,
  "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-U", "postgres", "-d", base, ...commande], entree);
const pgDump = (base, ...a) => lancer("docker", ["exec", "-e", `PGPASSWORD=${motDePasse}`, conteneur, "pg_dump", "-h", "127.0.0.1", "-U", "postgres", ...a, base]);
const compter = (base) => {
  const r = psql(base, undefined, "-At", "-c", TABLES.map(t => `SELECT '${t}', count(*) FROM public.${t}`).join(" UNION ALL "));
  return r.code === 0 ? Object.fromEntries(r.sortie.trim().split(/\r?\n/).map(l => l.split("|")).map(([t, n]) => [t, Number(n)])) : null;
};
const enteteDe = (fichier) => fs.readFileSync(fichier, "utf8").split(/\r?\n/)[0];

let verdict = "PASS";
try {
  // 1. le conteneur
  conteneur = `forge-data-anon-${process.pid}-${crypto.randomBytes(3).toString("hex")}`;
  const run = lancer("docker", ["run", "-d", "--rm", "--name", conteneur, "--label", ETIQUETTE,
    "-e", `POSTGRES_PASSWORD=${motDePasse}`, "-e", "POSTGRES_DB=source", IMAGE]);
  if (!etape("conteneur", run.code === 0, run.code === 0 ? `${conteneur} (aucun port publié)` : run.erreur.trim().slice(0, 300))) throw new Error("conteneur");
  let pret = false;
  for (let i = 0; i < 90 && !pret; i++) {
    pret = lancer("docker", ["exec", conteneur, "pg_isready", "-q", "-h", "127.0.0.1", "-U", "postgres", "-d", "source"]).code === 0;
    if (!pret) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  if (!etape("pret", pret, pret ? "pg_isready sur 127.0.0.1 (le serveur d'initialisation n'écoute pas en TCP)" : "le serveur n'a pas répondu en 90 s")) throw new Error("pret");
  versionPg = psql("source", undefined, "-At", "-c", "SELECT version()").sortie.trim().split(" on ")[0];

  // 2. source synthétique chargée, puis extraite par la commande du profil
  const schema = fs.readFileSync(path.join(racine, "fixtures", "anonymisation-schema.sql"), "utf8");
  const s1 = psql("source", schema);
  if (!etape("schema_source", s1.code === 0, s1.code === 0 ? "fixtures/anonymisation-schema.sql appliqué" : s1.erreur.trim().slice(0, 300))) throw new Error("schema");
  for (const t of TABLES) {
    const c = psql("source", fs.readFileSync(path.join(racine, "fixtures", "anonymisation-source", `${t}.csv`), "utf8"), "-c", `\\copy public.${t} FROM pstdin WITH (FORMAT csv, HEADER true)`);
    if (!etape(`charger_source_${t}`, c.code === 0, c.code === 0 ? "chargée" : c.erreur.trim().slice(0, 300))) throw new Error("charger");
  }
  const extrait = path.join(tmp, "extrait"); fs.mkdirSync(extrait);
  const ecarts = [];
  for (const t of TABLES) {
    const x = psql("source", undefined, "-c", `\\copy (SELECT * FROM public.${t} ORDER BY id) TO pstdout WITH (FORMAT csv, HEADER true)`);
    if (x.code !== 0) { etape(`extraire_${t}`, false, x.erreur.trim().slice(0, 300)); throw new Error("extraire"); }
    fs.writeFileSync(path.join(extrait, `${t}.csv`), x.sortie);
    const fixture = fs.readFileSync(path.join(racine, "fixtures", "anonymisation-source", `${t}.csv`), "utf8").replace(/\r\n/g, "\n");
    if (x.sortie.replace(/\r\n/g, "\n") !== fixture) ecarts.push(t);
  }
  etape("extraction_forme_canonique", !ecarts.length, ecarts.length ? `extrait différent de la fixture : ${ecarts.join(", ")}` : "les 4 tables extraites par \\copy … TO … (FORMAT csv, HEADER true) sont identiques octet pour octet à la fixture source");

  // 3. masquer, juger
  const masque = path.join(tmp, "masque");
  const v = lancer(process.execPath, [path.join(racine, "scripts", "anonymiser.mjs"), "--masquage", path.join(racine, "fixtures", "anonymisation-verte", "masquage.json"),
    "--source", extrait, "--sortie", masque, "--json-only"]);
  if (!etape("masquer", v.code === 0, v.code === 0 ? "verbe anonymiser, graine tirée au hasard et non conservée" : v.sortie.slice(0, 400))) throw new Error("masquer");
  const o = lancer(process.execPath, [path.join(racine, "oracles", "oracle-anonymiser.mjs"), masque, "--json-only"]);
  let oj = {}; try { oj = JSON.parse(o.sortie); } catch { /* dit ci-dessous */ }
  etape("juger", o.code === 0 && oj.verdict === "PASS", `oracle-anonymiser : ${oj.verdict} (${(oj.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle).join(",") || "aucun bloquant"})`);
  const rapport = JSON.parse(fs.readFileSync(path.join(masque, "anonymisation.json"), "utf8"));
  const attendus = Object.fromEntries(TABLES.map(t => [t, rapport.tables[t].lignes_masque]));

  // 4a. rechargement par sections : pre-data, données dans un ordre QUELCONQUE, post-data
  const creer = (base) => psql("source", undefined, "-c", `CREATE DATABASE ${base}`);
  const charger = (base, dossier, ordre) => {
    for (const t of ordre) {
      const f = path.join(dossier, `${t}.csv`);
      const r = psql(base, fs.readFileSync(f, "utf8"), "-c", `\\copy public.${t} (${enteteDe(f)}) FROM pstdin WITH (FORMAT csv, HEADER true)`);
      if (r.code !== 0) return `${t} : ${r.erreur.trim().slice(0, 300)}`;
    }
    return null;
  };
  creer("cible_sections");
  const pre = pgDump("source", "--section=pre-data");
  const a1 = psql("cible_sections", pre.sortie);
  const e1 = a1.code === 0 ? charger("cible_sections", masque, [...TABLES].sort().reverse()) : `pre-data : ${a1.erreur.trim().slice(0, 300)}`;
  const post = pgDump("source", "--section=post-data");
  const a2 = e1 ? null : psql("cible_sections", post.sortie);
  const n1 = compter("cible_sections");
  etape("recharger_par_sections", !e1 && a2 && a2.code === 0 && JSON.stringify(n1) === JSON.stringify(attendus),
    e1 || (a2 && a2.code !== 0 ? `post-data : ${a2.erreur.trim().slice(0, 300)}` : `post-data appliqué (clés primaires, étrangères, contraintes validées) ; comptes ${JSON.stringify(n1)} = rapport`));

  // 4b. rechargement dans le schéma complet, tables dans l'ordre_chargement du rapport
  creer("cible_ordre");
  const b1 = psql("cible_ordre", schema);
  const e2 = b1.code === 0 ? charger("cible_ordre", masque, rapport.ordre_chargement || []) : `schéma : ${b1.erreur.trim().slice(0, 300)}`;
  const n2 = compter("cible_ordre");
  etape("recharger_dans_l_ordre_du_rapport", !e2 && JSON.stringify(n2) === JSON.stringify(attendus),
    e2 || `contraintes présentes AVANT les données, ordre ${JSON.stringify(rapport.ordre_chargement)} ; comptes ${JSON.stringify(n2)} = rapport`);

  // 5. sens rouge dans le moteur : une clé étrangère orpheline casse la section post-data
  const rouge = path.join(tmp, "masque-rouge"); fs.mkdirSync(rouge);
  for (const f of fs.readdirSync(masque)) fs.copyFileSync(path.join(masque, f), path.join(rouge, f));
  const lignes = fs.readFileSync(path.join(rouge, "commande.csv"), "utf8").split("\n");
  const j = lignes[0].split(",").indexOf("client_id");
  const cellules = lignes[1].split(","); cellules[j] = "999999999"; lignes[1] = cellules.join(",");
  fs.writeFileSync(path.join(rouge, "commande.csv"), lignes.join("\n"));
  creer("cible_rouge");
  psql("cible_rouge", pre.sortie);
  const e3 = charger("cible_rouge", rouge, TABLES);
  const a3 = psql("cible_rouge", post.sortie);
  etape("rouge_moteur_cle_orpheline", !e3 && a3.code === 3 && /violates foreign key constraint/.test(a3.erreur),
    `post-data refusé par le moteur (code psql ${a3.code}) : ${a3.erreur.trim().split(/\r?\n/)[0].slice(0, 200)}`);
  const or = lancer(process.execPath, [path.join(racine, "oracles", "oracle-anonymiser.mjs"), rouge, "--json-only", "--source", extrait]);
  let orj = {}; try { orj = JSON.parse(or.sortie); } catch { /* dit ci-dessous */ }
  etape("rouge_oracle_cle_orpheline", or.code === 1 && (orj.findings || []).some(f => f.regle === "AN9" && f.sev === "bloquant"),
    `oracle-anonymiser sur le même extrait : ${orj.verdict} (${(orj.findings || []).filter(f => f.sev === "bloquant").map(f => f.regle).join(",")})`);
} catch (e) {
  if (!etapes.some(x => x.verdict === "FAIL")) etape("panne", false, String(e && e.stack || e).slice(0, 500));
} finally {
  if (conteneur) {
    const rm = lancer("docker", ["rm", "-f", conteneur]);
    etapes.push({ etape: "detruire", verdict: rm.code === 0 ? "PASS" : "FAIL", detail: rm.code === 0 ? `${conteneur} détruit` : rm.erreur.trim().slice(0, 200) });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
if (etapes.some(x => x.verdict === "FAIL")) verdict = "FAIL";
const restants = lancer("docker", ["ps", "-a", "-q", "--filter", `label=${ETIQUETTE}`]).sortie.split(/\s+/).filter(Boolean).length;
if (restants) { etapes.push({ etape: "aucun_conteneur_restant", verdict: "FAIL", detail: `${restants} conteneur(s) de l'étiquette ${ETIQUETTE} encore présent(s)` }); verdict = "FAIL"; }
else etapes.push({ etape: "aucun_conteneur_restant", verdict: "PASS", detail: `0 conteneur de l'étiquette ${ETIQUETTE}` });
rendre(verdict, verdict === "PASS" ? 0 : 1);
