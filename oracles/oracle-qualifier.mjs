#!/usr/bin/env node
// oracle-qualifier — Domaine « Un rapport migré PEUT-IL REMPLACER l'original : les dimensions se
// composent en UN verdict de bascule, et chacune dit son angle mort » (déterministe). TF-1186,
// 17/09/2026, retour Produit-62 RF-27.
//
// LE FAIT MESURÉ. La chaîne de migration d'un rapport s'arrête à la réconciliation des chiffres.
// Le runbook du chantier écrit 10 étapes dont la dernière est « restituer » ; les contrôles
// existants couvrent le rendu, le périmètre, les chiffres, la mise en page et le comportement —
// cinq mesures DISPERSÉES, aucune composition, aucun verdict de bascule. Et une sixième dimension
// n'a aucun oracle possible : segments, signet, tri de colonne, largeurs, format conditionnel,
// info-bulles et mise en évidence croisée ne survivent pas à l'export PDF, seul chemin par lequel
// un agent voit un rapport publié. Le coût est déjà mesuré : 22 contrôles de recette PASS et 7
// d'audit verts coexistaient avec un rapport qui n'affichait RIEN. Cinq dimensions vertes et une
// muette produisent exactement la même illusion.
//
// CE QUE CET ORACLE JUGE, ET POURQUOI C'EST CELA. La question du commanditaire — puis-je remplacer
// l'ancien par le nouveau — n'avait ni format, ni contrat, ni juge. Trois choses la rendent
// opposable, et ce sont les trois que l'oracle exige. D'abord chaque dimension dit à QUOI elle
// tient : un contrôle exécuté avec son verdict et son chiffre, une décision qui assume un écart,
// ou un geste humain que rien ne mécanise. Ensuite chaque dimension porte son ANGLE MORT écrit —
// la seule pièce qui empêche cinq verdicts verts de valoir une garantie. Enfin le verdict de
// bascule se COMPOSE des dimensions au lieu de se poser : il est refusé dès qu'il promet plus que
// ce que les dimensions prouvent.
//
// CE QUI EN DÉCOULE, ET QUI EST VOULU : tant que la dimension « interactions » est non jugeable
// par construction (QR4), « remplaçable » tout court est INATTEIGNABLE. Le meilleur verdict
// possible est « remplaçable sous conditions énumérées », et les conditions nomment les gestes
// qu'un humain doit jouer côte à côte. Déclarer un angle mort coûte une ligne ; le taire a coûté
// une migration.
//
// Format `forge-data/qualification-rapport@1` :
//   { format, id, date, racine?,
//     ancre:    { origine, instantane, releve_par },   sur QUOI la comparaison est faite
//     candidat: "<le rapport migré, celui qui remplacerait>",
//     dimensions: [ { dimension: "rendu"|"perimetre"|"chiffres"|"mise_en_page"|"interactions"|
//                                "comportement",
//                     classe: "conforme_prouve"|"ecart_assume"|"non_jugeable_ici",
//                     angle_mort: "…",                 ≥ 6 mots, OBLIGATOIRE partout (QR2)
//                     preuve?:   { porteur, regles: [...], verdict, chiffre, date },
//                     geste_humain?: { geste, enregistre_par: { chemin, regle } },
//                     gestes?:   [ { numero, geste } ],  5 à 8 pour « interactions » (QR4)
//                     ecarts?:   [ { id, libelle, classe: "assume"|"non_assume", decision_ref? } ] } ],
//     bascule: { verdict: "remplacable"|"remplacable_sous_conditions"|"non_remplacable",
//                conditions?: [ { id, condition, porte_par, leve: [ … ] } ] } }
//
//   QR1  forme : format, id, date ISO ; l'ANCRE de la comparaison (le rapport d'origine, son
//        instantané daté, qui l'a relevé) et le CANDIDAT nommés — une qualification sans ancre
//        compare le candidat à lui-même ; les SIX dimensions du jeu fermé, chacune une seule fois ;
//   QR2  ANGLE MORT : chaque dimension porte le sien, écrit (≥ 6 mots). L'en-tête se NOMME — la
//        tournure « ce que l'oracle ne prouve pas » annonce au lieu de dire, et le plancher
//        d'écriture la refuse (RF-29) ; sa PRÉSENCE, elle, n'est pas négociable ;
//   QR3  CHAQUE CLASSE PORTE SA PIÈCE : `conforme_prouve` exige une preuve — le porteur EXISTE sur
//        le disque, chaque règle citée se retrouve DANS son fichier (convention CH4), le verdict
//        est rendu et le CHIFFRE écrit ; `ecart_assume` exige au moins un écart déclaré ;
//        `non_jugeable_ici` exige le geste humain qui le lèverait, nommé (≥ 6 mots) et avec son
//        ENREGISTREUR (doctrine RN5/CH5) — « à vérifier à la main » sans enregistreur ne se prouve
//        jamais joué ;
//   QR4  INTERACTIONS, NON JUGEABLE PAR CONSTRUCTION : segments, signet, tri au clic, largeurs,
//        format conditionnel, info-bulles et mise en évidence croisée ne survivent pas à l'export.
//        Cette dimension est donc classée `non_jugeable_ici` et rend de 5 à 8 GESTES NUMÉROTÉS à
//        jouer côte à côte, numéros contigus — une liste sans numéro ne se coche pas ;
//   QR5  ÉCARTS : id unique, libellé (≥ 4 mots), classe du jeu fermé ; un écart `assume` porte le
//        `decision_ref` de la décision qui l'a produit — assumé par qui, sinon ; et une dimension
//        déclarée `conforme_prouve` qui porte un écart NON assumé se contredit elle-même ;
//   QR6  BASCULE COMPOSÉE, JAMAIS POSÉE : `remplacable` est refusé dès qu'une dimension n'est pas
//        `conforme_prouve` ou qu'un écart reste non assumé ; `remplacable_sous_conditions` exige
//        des conditions ÉNUMÉRÉES (≥ 4 mots, avec qui la porte) qui couvrent CHAQUE dimension non
//        conforme et CHAQUE écart non assumé, et dont chaque cible résout (défaut symétrique
//        de DL5/CV3) ; `non_remplacable` exige qu'il y ait réellement de quoi refuser.
// non_juge : la JUSTESSE de ce que chaque dimension affirme — l'oracle vérifie qu'un porteur existe
// et qu'il porte la règle citée, jamais que le verdict rapporté est celui qu'il rendrait aujourd'hui ;
// rejouer les porteurs est le geste du qualificateur, et leur date est écrite pour ça ; la pertinence
// métier d'une décision qui assume un écart (l'oracle exige son identifiant, il ne l'arbitre pas) ;
// ce que chaque porteur juge de son côté — `oracles/oracle-rendre.mjs`, `oracles/oracle-delimiter.mjs`,
// `oracles/oracle-reconcilier.mjs`, `oracles/oracle-reconstruire.mjs` de ce dépôt ont leurs propres
// règles et leurs propres fixtures ; et la sixième dimension elle-même, les INTERACTIONS, qu'aucun
// contrôle de ce parc n'atteint — QR4 exige qu'elle soit déclarée et outillée de gestes, c'est tout
// ce qu'une machine peut en faire.
// Usage : node oracle-qualifier.mjs <qualification.json> [--json-only]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOM = "Bascule d'un rapport migré : six dimensions, leur angle mort, et un verdict de remplacement composé (QR1-QR6)";
const NON_JUGE = [
  "la JUSTESSE de ce que chaque dimension affirme : l'oracle vérifie qu'un porteur EXISTE et qu'il porte la règle citée, jamais que le verdict rapporté est celui qu'il rendrait aujourd'hui — rejouer les porteurs est le geste du qualificateur, et la date de chaque preuve est écrite pour ça",
  "la pertinence métier d'une décision qui assume un écart : l'oracle exige son identifiant, il ne l'arbitre pas (convention CV4)",
  "ce que chaque porteur juge de son côté — `oracles/oracle-rendre.mjs`, `oracles/oracle-delimiter.mjs`, `oracles/oracle-reconstruire.mjs` et `oracles/oracle-reconcilier.mjs` de ce dépôt ont leurs propres règles et leurs propres fixtures",
  "les INTERACTIONS elles-mêmes (segments, signet, tri au clic, largeurs, format conditionnel, info-bulles, mise en évidence croisée) : aucun contrôle de ce parc ne les atteint, elles ne survivent pas à l'export — QR4 exige qu'elles soient déclarées non jugeables et outillées de gestes numérotés, c'est tout ce qu'une machine peut en faire",
];
const DIMENSIONS = ["rendu", "perimetre", "chiffres", "mise_en_page", "interactions", "comportement"];
const CLASSES = ["conforme_prouve", "ecart_assume", "non_jugeable_ici"];
const CLASSES_ECART = ["assume", "non_assume"];
const BASCULES = ["remplacable", "remplacable_sous_conditions", "non_remplacable"];
const DATE_ISO = /^\d{4}-\d{2}-\d{2}/;
const ici = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const jsonOnly = args.includes("--json-only");
const F = [];
const add = (sev, regle, msg, where) => F.push({ sev, regle, msg, where });
let qualification = null;
const out = (verdict, code) => {
  process.stdout.write(JSON.stringify({ oracle: "oracle-qualifier", domaine: DOM, artefact: file || null,
    verdict, qualification, findings: F.length ? F : [{ sev: "info", regle: "—", msg: "QR1-QR6 sans écart", where: file }],
    non_juge: NON_JUGE }, null, jsonOnly ? 0 : 2));
  process.exit(code);
};
if (!file || !fs.existsSync(file)) { add("info", "QR1", "fichier introuvable", String(file)); out("SKIP", 2); }
let d = null;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch { add("bloquant", "QR1", "JSON invalide", file); out("FAIL", 1); }

const racine = d.racine ? path.resolve(path.dirname(path.resolve(file)), d.racine) : path.join(ici, "..");
const mots = s => String(s || "").trim().split(/\s+/).filter(Boolean).length;
// Convention CH4 : un identifiant de règle survit à sa règle. « R1-R5 » cite R1, « R10 » ne le cite pas.
const cite = (texte, id) => new RegExp(`\\b${String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m").test(texte);

// ---- QR1 · forme, ancre, candidat, et les six dimensions --------------------------------------
if (d.format !== "forge-data/qualification-rapport@1")
  add("bloquant", "QR1", `format « ${d.format} » (attendu forge-data/qualification-rapport@1)`, file);
if (!d.id) add("bloquant", "QR1", "id de la qualification non nommé", file);
if (!DATE_ISO.test(String(d.date || "")))
  add("bloquant", "QR1", "date de la qualification absente ou hors format ISO — un verdict de bascule non daté se relit un mois plus tard comme s'il valait encore", file);
const ancre = d.ancre && typeof d.ancre === "object" ? d.ancre : null;
if (!ancre) add("bloquant", "QR1", "bloc « ancre » absent — une qualification sans ancre compare le candidat à lui-même : le rapport d'ORIGINE, son instantané et qui l'a relevé se nomment", file);
else {
  if (!String(ancre.origine || "").trim()) add("bloquant", "QR1", "ancre.origine absente — le rapport d'origine auquel le candidat est comparé se nomme", "ancre");
  if (!DATE_ISO.test(String(ancre.instantane || ""))) add("bloquant", "QR1", "ancre.instantane absent ou hors format ISO — un original qui a bougé depuis fait mentir toutes les dimensions à la fois", "ancre");
  if (!String(ancre.releve_par || "").trim()) add("bloquant", "QR1", "ancre.releve_par absent — QUI a relevé l'origine (outil ou personne) : un relevé sans auteur ne se rejoue pas", "ancre");
}
if (!String(d.candidat || "").trim())
  add("bloquant", "QR1", "`candidat` absent — le rapport qui REMPLACERAIT l'original se nomme, sinon la question de bascule n'a pas de sujet", file);

const dims = Array.isArray(d.dimensions) ? d.dimensions : [];
const parDim = new Map();
dims.forEach((x, i) => {
  const nom = String(x?.dimension || "").trim();
  const ou = `dimensions #${i + 1}${nom ? ` (${nom})` : ""}`;
  if (!DIMENSIONS.includes(nom)) { add("bloquant", "QR1", `dimension « ${x?.dimension} » hors du jeu fermé {${DIMENSIONS.join(", ")}}`, ou); return; }
  if (parDim.has(nom)) { add("bloquant", "QR1", `dimension « ${nom} » déclarée deux fois — deux verdicts sous le même nom se contredisent en silence`, ou); return; }
  parDim.set(nom, { ...x, ou });
});
const absentes = DIMENSIONS.filter(x => !parDim.has(x));
if (absentes.length)
  add("bloquant", "QR1", `${absentes.length} dimension(s) non qualifiée(s) : ${absentes.map(x => `« ${x} »`).join(" · ")} — une dimension omise se lit comme une dimension verte, et c'est ainsi que cinq contrôles PASS ont accompagné un rapport qui n'affichait rien`, "dimensions");

// ---- QR2 à QR5 · dimension par dimension -------------------------------------------------------
const nonConformes = [], ecartsNonAssumes = [];
let preuvesVerifiees = 0, reglesVerifiees = 0, gestesNumerotes = 0, ecartsTotal = 0;
for (const [nom, x] of parDim) {
  const ou = x.ou;

  // QR2 — l'angle mort, partout, y compris (surtout) sur une dimension prouvée conforme.
  if (mots(x.angle_mort) < 6)
    add("bloquant", "QR2", `dimension « ${nom} » : angle mort en ${mots(x.angle_mort)} mot(s) — ce que le contrôle NE prouve PAS s'écrit (au moins 6 mots) ; c'est la seule pièce qui empêche cinq verdicts verts de valoir une garantie de remplacement`, ou);

  const classe = String(x.classe || "").trim();
  if (!CLASSES.includes(classe)) {
    add("bloquant", "QR3", `dimension « ${nom} » : classe « ${x.classe} » hors du jeu fermé {${CLASSES.join(", ")}}`, ou);
  }
  if (classe !== "conforme_prouve") nonConformes.push(nom);

  // QR3 — la pièce que la classe exige.
  if (classe === "conforme_prouve") {
    const p = x.preuve && typeof x.preuve === "object" ? x.preuve : null;
    if (!p) add("bloquant", "QR3", `dimension « ${nom} » déclarée conforme SANS preuve — le contrôle qui l'établit, son verdict et son chiffre se nomment, sinon « conforme » est une opinion`, ou);
    else {
      const chemin = String(p.porteur || "").trim();
      const abs = chemin ? path.resolve(racine, chemin) : null;
      if (!chemin) add("bloquant", "QR3", `dimension « ${nom} » : preuve sans porteur — un contrôle qui se cherche par son nom ne se trouve pas (leçon TF-0379)`, ou);
      else if (!fs.existsSync(abs)) add("bloquant", "QR3", `dimension « ${nom} » : porteur « ${chemin} » introuvable depuis la racine déclarée — la dimension se réclame d'un contrôle qui n'existe pas`, ou);
      else {
        preuvesVerifiees++;
        const src = fs.readFileSync(abs, "utf8");
        const regles = Array.isArray(p.regles) ? p.regles.filter(r => String(r || "").trim()) : [];
        if (!regles.length) add("bloquant", "QR3", `dimension « ${nom} » : porteur « ${chemin} » cité sans aucune règle — citer un contrôle sans dire ce qu'il fait jouer laisse croire qu'il juge tout`, ou);
        for (const r of regles) {
          if (cite(src, r)) { reglesVerifiees++; continue; }
          add("bloquant", "QR3", `dimension « ${nom} » : règle « ${r} » introuvable dans « ${chemin} » — un identifiant de règle survit à sa règle, et la dimension continue de s'en réclamer (convention CH4)`, ou);
        }
      }
      if (!String(p.verdict || "").trim()) add("bloquant", "QR3", `dimension « ${nom} » : preuve sans verdict rendu`, ou);
      if (!String(p.chiffre || "").trim()) add("bloquant", "QR3", `dimension « ${nom} » : preuve sans CHIFFRE — « 83 occurrences couvertes sur 83 » se corrige, « conforme » ne se corrige pas`, ou);
      if (!DATE_ISO.test(String(p.date || ""))) add("bloquant", "QR3", `dimension « ${nom} » : preuve sans date ISO — un verdict non daté a pu être rendu sur une version antérieure du candidat`, ou);
    }
  }
  if (classe === "non_jugeable_ici") {
    const g = x.geste_humain && typeof x.geste_humain === "object" ? x.geste_humain : null;
    if (!g) add("bloquant", "QR3", `dimension « ${nom} » déclarée non jugeable SANS le geste humain qui la lèverait — déclarer un angle mort coûte une ligne, le taire a coûté une migration`, ou);
    else {
      if (mots(g.geste) < 6) add("bloquant", "QR3", `dimension « ${nom} » : geste humain en ${mots(g.geste)} mot(s) — ce qu'on ouvre, ce qu'on lit, ce qu'on en conclut (au moins 6 mots), sinon il ne se rejoue pas`, ou);
      const en = g.enregistre_par && typeof g.enregistre_par === "object" ? g.enregistre_par : null;
      if (!en) add("bloquant", "QR3", `dimension « ${nom} » : geste humain sans \`enregistre_par\` — un geste dont la trace n'atterrit nulle part ne se prouve pas joué (doctrine RN5)`, ou);
      else {
        const chemin = String(en.chemin || "").trim();
        const abs = chemin ? path.resolve(racine, chemin) : null;
        if (!chemin || !fs.existsSync(abs)) add("bloquant", "QR3", `dimension « ${nom} » : enregistreur « ${chemin || "(vide)"} » introuvable — la trace du geste n'a nulle part où aller`, ou);
        else if (!String(en.regle || "").trim()) add("bloquant", "QR3", `dimension « ${nom} » : enregistreur cité sans la règle qui EXIGE la trace`, ou);
        else if (!cite(fs.readFileSync(abs, "utf8"), en.regle)) add("bloquant", "QR3", `dimension « ${nom} » : règle « ${en.regle} » introuvable dans « ${chemin} » — l'enregistreur cité ne porte pas la règle qu'on lui prête`, ou);
        else reglesVerifiees++;
      }
    }
  }

  // QR4 — la sixième dimension, celle qu'aucun oracle n'atteint.
  if (nom === "interactions") {
    if (classe && classe !== "non_jugeable_ici")
      add("bloquant", "QR4", `dimension « interactions » classée « ${classe} » — segments, signet, tri au clic, largeurs, format conditionnel, info-bulles et mise en évidence croisée NE SURVIVENT PAS à l'export, seul chemin par lequel un agent voit un rapport publié : elle est non jugeable ici, par construction`, ou);
    const gestes = Array.isArray(x.gestes) ? x.gestes : [];
    if (gestes.length < 5 || gestes.length > 8)
      add("bloquant", "QR4", `dimension « interactions » : ${gestes.length} geste(s) numéroté(s) — il en faut de 5 à 8, à jouer côte à côte par un humain ; moins ne couvre pas la surface, plus ne se joue pas`, ou);
    const numeros = [];
    gestes.forEach((g, i) => {
      if (mots(g?.geste) < 6) add("bloquant", "QR4", `geste d'interaction #${i + 1} en ${mots(g?.geste)} mot(s) — le geste se décrit, sinon deux personnes ne joueront pas le même`, ou);
      if (!Number.isInteger(g?.numero)) add("bloquant", "QR4", `geste d'interaction #${i + 1} sans numéro entier — une liste sans numéro ne se coche pas`, ou);
      else numeros.push(g.numero);
    });
    if (numeros.length) {
      const tri = [...numeros].sort((a, b) => a - b);
      if (JSON.stringify(tri) !== JSON.stringify(tri.map((_, i) => i + 1)))
        add("bloquant", "QR4", `numéros de gestes ${JSON.stringify(tri)} — attendus contigus de 1 à ${numeros.length} : un numéro manquant est un geste perdu, un numéro doublé est un geste joué deux fois et un autre jamais`, ou);
      gestesNumerotes = numeros.length;
    }
  }

  // QR5 — les écarts de cette dimension.
  const ecarts = Array.isArray(x.ecarts) ? x.ecarts : [];
  ecartsTotal += ecarts.length;
  const vus = new Set();
  ecarts.forEach((e, i) => {
    const oue = `${ou} › écart ${e?.id || `#${i + 1}`}`;
    const id = String(e?.id || "").trim();
    if (!id) add("bloquant", "QR5", "écart sans id — un écart qu'on ne peut pas citer ne se retrouve ni au ledger ni dans une condition de bascule", oue);
    else if (vus.has(id)) add("bloquant", "QR5", `écart « ${id} » déclaré deux fois sur la même dimension`, oue);
    else vus.add(id);
    if (mots(e?.libelle) < 4) add("bloquant", "QR5", `écart « ${id || i + 1} » : libellé en ${mots(e?.libelle)} mot(s) — un écart se NOMME (au moins 4 mots), sinon personne ne sait ce qui diffère`, oue);
    const ce = String(e?.classe || "").trim();
    if (!CLASSES_ECART.includes(ce)) { add("bloquant", "QR5", `écart « ${id || i + 1} » : classe « ${e?.classe} » hors du jeu fermé {${CLASSES_ECART.join(", ")}}`, oue); return; }
    if (ce === "assume" && !String(e?.decision_ref || "").trim())
      add("bloquant", "QR5", `écart « ${id} » déclaré ASSUMÉ sans \`decision_ref\` — assumé par qui, et quand ? Sans l'identifiant de la décision, « assumé » veut dire « personne ne l'a regardé »`, oue);
    if (ce === "non_assume") ecartsNonAssumes.push(`${nom}:${id || i + 1}`);
  });
  if (classe === "conforme_prouve" && ecarts.some(e => e?.classe === "non_assume"))
    add("bloquant", "QR5", `dimension « ${nom} » déclarée CONFORME alors qu'elle porte un écart non assumé — une dimension ne peut pas être à la fois prouvée conforme et en défaut`, ou);
  if (classe === "ecart_assume" && !ecarts.length)
    add("bloquant", "QR3", `dimension « ${nom} » classée « ecart_assume » sans aucun écart déclaré — un écart assumé qu'on ne nomme pas n'est pas assumé, il est perdu`, ou);
}

// ---- QR6 · le verdict de bascule se COMPOSE ----------------------------------------------------
const b = d.bascule && typeof d.bascule === "object" ? d.bascule : null;
const verdictBascule = String(b?.verdict || "").trim();
const conditions = Array.isArray(b?.conditions) ? b.conditions : [];
const aLever = [...nonConformes.map(x => x), ...ecartsNonAssumes];
if (!b) add("bloquant", "QR6", "bloc « bascule » absent — la migration se termine par une question de remplacement, et c'est la seule que ce document doit trancher", file);
else if (!BASCULES.includes(verdictBascule))
  add("bloquant", "QR6", `verdict de bascule « ${b.verdict} » hors du jeu fermé {${BASCULES.join(", ")}} — « globalement satisfaisant » n'est pas une réponse à « puis-je remplacer l'ancien par le nouveau »`, "bascule");
else {
  const couvertes = new Set();
  conditions.forEach((c, i) => {
    const ou = `bascule.conditions #${i + 1}${c?.id ? ` (${c.id})` : ""}`;
    if (!String(c?.id || "").trim()) add("bloquant", "QR6", "condition sans id — une condition qu'on ne peut pas citer ne se lève pas", ou);
    if (mots(c?.condition) < 4) add("bloquant", "QR6", `condition en ${mots(c?.condition)} mot(s) — ce qu'il faut faire pour lever la réserve s'écrit (au moins 4 mots)`, ou);
    if (!String(c?.porte_par || "").trim()) add("bloquant", "QR6", `condition « ${c?.id || i + 1} » sans \`porte_par\` — une condition que personne ne porte reste ouverte pour toujours`, ou);
    const leve = Array.isArray(c?.leve) ? c.leve.map(x => String(x).trim()).filter(Boolean) : [];
    if (!leve.length) add("bloquant", "QR6", `condition « ${c?.id || i + 1} » ne dit pas CE QU'ELLE LÈVE — une condition détachée des dimensions se coche sans rien changer au verdict`, ou);
    for (const cible of leve) {
      if (!aLever.includes(cible)) {
        add("bloquant", "QR6", `condition « ${c?.id || i + 1} » prétend lever « ${cible} », qui n'est ni une dimension non conforme ni un écart non assumé de ce document — une condition qui pointe dans le vide cache celle qui manque (défaut symétrique de DL5/CV3)`, ou);
        continue;
      }
      couvertes.add(cible);
    }
  });

  if (verdictBascule === "remplacable" && aLever.length)
    add("bloquant", "QR6",
      `bascule « remplaçable » alors que ${nonConformes.length} dimension(s) ne sont pas prouvées conformes (${nonConformes.map(x => `« ${x} »`).join(" · ") || "aucune"}) et ${ecartsNonAssumes.length} écart(s) restent non assumés — ` +
      `le verdict se COMPOSE des dimensions, il ne se pose pas au-dessus d'elles ; tant qu'une dimension est non jugeable ici, le meilleur verdict atteignable est « remplaçable sous conditions énumérées »`,
      "bascule");
  if (verdictBascule === "remplacable_sous_conditions") {
    if (!conditions.length)
      add("bloquant", "QR6", "bascule « sous conditions » sans aucune condition énumérée — « sous conditions » sans la liste est un « oui » qui se lira comme un oui", "bascule");
    const orphelines = aLever.filter(x => !couvertes.has(x));
    if (orphelines.length)
      add("bloquant", "QR6", `${orphelines.length} réserve(s) qu'aucune condition ne lève : ${orphelines.map(x => `« ${x} »`).join(" · ")} — une réserve hors de la liste des conditions est très exactement la dimension muette qui accompagne cinq verdicts verts`, "bascule");
  }
  if (verdictBascule === "non_remplacable" && !aLever.length)
    add("bloquant", "QR6", "bascule « non remplaçable » alors que toutes les dimensions sont prouvées conformes et qu'aucun écart n'est non assumé — un refus doit dire ce qu'il refuse", "bascule");
}

qualification = {
  dimensions: parDim.size, dimensions_attendues: DIMENSIONS.length,
  conformes_prouvees: parDim.size - nonConformes.length, non_conformes: nonConformes,
  preuves_verifiees: preuvesVerifiees, regles_verifiees: reglesVerifiees,
  gestes_d_interaction: gestesNumerotes,
  ecarts: ecartsTotal, ecarts_non_assumes: ecartsNonAssumes.length,
  bascule: verdictBascule || null, conditions: conditions.length,
};
if (!F.some(f => f.sev === "bloquant") && parDim.size === DIMENSIONS.length)
  add("info", "QR6", `${parDim.size} dimensions qualifiées, chacune avec son angle mort écrit ; ${preuvesVerifiees} preuve(s) dont le porteur existe et ${reglesVerifiees} règle(s) retrouvée(s) dans leur porteur ; bascule « ${verdictBascule} » avec ${conditions.length} condition(s) couvrant ${aLever.length} réserve(s)`, "bascule");

out(F.some(f => f.sev === "bloquant") ? "FAIL" : "PASS", F.some(f => f.sev === "bloquant") ? 1 : 0);
