# digit-ai-forge-data — discipline de la donnée (profiler · tracer · restituer · contractualiser)

Forge **transverse** née de TF-0083 (révision tracée de l'écartement du 08/08, sur preuve
REX réelle). Elle outille la **discipline data des runs** : la qualité s'exprime en
assertions exécutables, toute donnée servie déclare son lineage, tout chiffre restitué
porte sa source et sa fraîcheur.

## Frontières (non négociables)

- **Composition, jamais duplication.** Le profiling de datasets appartient au skill
  `data-quality-auditor` (appelé, pas réécrit) ; la police des montants dans les documents
  commerciaux appartient à `oracle-claims` (quality-oracles) ; la couverture de test du pan
  data d'un produit appartient à forge-tests ; la gouvernance d'architecture à forge-audit.
  forge-data vérifie la **forme de la discipline**, pas le contenu des données.
- **Jamais de données client.** Fixtures synthétiques uniquement ; le REX
  (`references\REX-DATA.md`) est anonymisé et généralisé — zéro nom d'engagement.
- Invocation par le pilot dans les runs ; retours par lots vers `input\` du pilot.

## Les quatre verbes et leurs barres (registre la-barre 11/08, contractualiser 12/08)

| Verbe | Discipline exigée | Barre de niveau |
|---|---|---|
| **profiler** | la qualité = **assertions déclaratives unitaires** (objet + condition + paramètres typés), à verdict machine — jamais « données propres » en prose ; pont optionnel vers un lineage@1 (P4, cf. dataQualityAssertions OpenLineage) | Great Expectations |
| **tracer** | toute donnée servie **déclare son lineage** : entrées (datasets datés) → transformations (typées statique/runtime/déclaratif) → sorties + horodatage + niveau de maturité 0-3 et méthode ; grain colonne optionnel (T6) | OpenLineage (object model : run · job · inputs · outputs · facets) |
| **restituer** | tout chiffre d'un rapport **référence une entrée déclarée** (id → valeur + source + date) et le rapport pointe sa déclaration de lineage — le document se génère des déclarations, jamais l'inverse | dbt-core (déclaré → généré) |
| **contractualiser** | l'accord producteur↔consommateur est **inspectable** : schéma typé + SLA mesurable + propriétaire joignable + versionnage à statut de cycle de vie — jamais un accord oral ou en prose | ODCS v3.1.0 (Bitol / Linux Foundation) |

## Oracles (contrat JSON, exit 0/1/2, `non_juge`, fixtures rouge/verte)

```bash
node oracles/oracle-profiler.mjs <assertions.json>        # P1-P3 (+P4 optionnel) : forme exécutable + pont lineage
node oracles/oracle-tracer.mjs <lineage.json>             # T1-T5 (+T6 optionnel) : lineage complet + grain colonne
node oracles/oracle-restituer.mjs <rapport.md>            # R1-R4 : chiffres ancrés + lineage_ref
node oracles/oracle-contractualiser.mjs <contrat.json>    # C1-C5 : schéma + SLA + propriétaire + version
node oracles/self-test.mjs                                 # double sens — à rejouer après toute modification
```

Formats maison : `forge-data/assertions@1`, `forge-data/lineage@1`, `forge-data/contrat@1`
(spécifiés en tête des oracles ; exemples = fixtures vertes). Un rapport porte un
frontmatter `chiffres:` + `lineage_ref:` et des marqueurs `[c:<id>]` dans le corps.

## Le verbe importer (TF-0139) — un générateur, pas un oracle

`scripts/importer.mjs <schema.sql>` PRODUIT (il ne juge pas) un **brouillon** de
`assertions@1` + `contrat@1` à partir d'un schéma déjà **exporté en texte** (jamais de
connexion — loi n° 4). Dialecte v0 : Postgres, DDL au format `pg_dump --schema-only`
(inline ou `ALTER TABLE … ADD CONSTRAINT`) — cf. `references/profils-moteur/postgres.md`.
Correspondances : `NOT NULL`/`PRIMARY KEY`→`non_nul` ; `CHECK` bornes (`>=`/`<=`,
`BETWEEN`)→`bornes` ; `CHECK … IN (...)` ou sa réécriture pg_dump `= ANY (ARRAY[...])`
→`ensemble` ; `UNIQUE`/`PRIMARY KEY` (colonne seule)→`unique` ; colonnes+types→
`contrat@1.schema`. Clés composites, CHECK multi-colonnes, FOREIGN KEY et types non
mappés : jamais convertis à l'aveugle, toujours signalés en `avertissements`. Le
`contrat@1` produit pose des placeholders explicites pour sla/propriétaire/version
(statut `"brouillon"`) — complétion humaine obligatoire. Preuve en boucle : le brouillon
doit PASSER `oracle-profiler`/`oracle-contractualiser` sans retouche (vérifié par
`oracles/self-test.mjs` sur `fixtures/schema-postgres-{verte,rouge}.sql`).

```bash
node scripts/importer.mjs fixtures/schema-postgres-verte.sql --sortie-dir <dossier>
```

## Doctrine issue du REX (l'essentiel — détail : references\REX-DATA.md)

1. **Agnosticisme** : décrire par capacités/rôles ; les produits n'apparaissent qu'en
   « instanciation (exemple) ».
2. **Fiabilité épistémique** : tout constat de rétro-ingénierie porte `[FAIT]`,
   `[HYPOTHÈSE]` ou `[INCONNU]` — jamais de déduction présentée en observation.
3. **Pierre de Rosette** : chercher d'abord l'artefact pivot qui relie source ↔ cible.
4. **La topologie se dérive des artefacts, jamais du discours** — l'existant corrige
   toujours la description initiale.
5. **Bifurcation structurante** : table-level vs column-level ; statique vs runtime — les
   transformations opaques ne sont accessibles qu'en runtime ; choisir par la valeur.
6. **Validation de justesse AVANT publication** au catalogue ; puis **méta-lineage** : la
   provenance du lineage lui-même (qui a déduit quoi, par quelle méthode, avec quelle
   confiance).

## Langue

Tout livrable et toute interaction en **français**.
