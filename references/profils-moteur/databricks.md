---
moteur: databricks
version: 1.2.0
challenge_date: 2026-09-08
sources:
  - "Delta Lake — Constraints clause (CONSTRAINT ... CHECK / NOT NULL) — docs.delta.io"
  - "Databricks Unity Catalog — Data lineage (system.access.column_lineage) — learn.microsoft.com, mise à jour 2026-08-06"
  - "Databricks — Data lineage REST API (GET /api/2.0/lineage-tracking/table-lineage) — docs.databricks.com"
  - "constat de terrain Produit-10 du 07/09/2026 : system.access refusé (SQLSTATE 42501), API lineage-tracking répondante — TF-0893"
  - "Databricks Unity Catalog — INFORMATION_SCHEMA — docs.databricks.com"
  - "étude d'opportunité forge-data — output\\20260812-etude-forge-data-moteurs.md (12/08/2026)"
---

# Profil-moteur — Databricks (lakehouse, à part)

Référentiel versionné (pas une forge ni un verbe — R-28, loi transverse n° 4). **Créé par
anticipation sur mandat humain du 12/08/2026** (dérogation à la doctrine « au premier run
réel », cf. `LISEZMOI.md` de ce dossier). **Databricks n'est PAS un RDBMS ligne-à-ligne** :
c'est un lakehouse (Spark + format de table Delta + gouvernance Unity Catalog). Ce profil
documente son dialecte de contraintes (pour un futur parseur analogue à `importer`, hors
v0) **et** son atout distinctif — le lineage colonne natif d'Unity Catalog, couvert par un
verbe séparé (`scripts/traduire-unity-catalog.mjs`, TF-0141), pas par `scripts/importer.mjs`.

## 1. Dialecte de contraintes

| Contrainte | Forme DDL (clause `CONSTRAINT` Delta) | Statut réel |
|---|---|---|
| Non-nullité | `col type NOT NULL` | **appliquée** (rejet d'écriture en violation) |
| Bornes / ensemble | `CONSTRAINT nom CHECK (condition)` — SQL libre, pas de forme dédiée | **appliquée** |
| Unicité | *(aucune syntaxe native)* | non applicable — Delta ne porte pas de contrainte d'unicité imposée |
| Clé primaire / étrangère | `PRIMARY KEY` / `FOREIGN KEY` (Unity Catalog, depuis Delta récent) | **informationnelles seulement** — déclarées au catalogue mais **jamais appliquées** par le moteur ; ne pas les traiter comme une garantie d'unicité réelle |

Différence structurante avec un RDBMS : seules `NOT NULL` et `CHECK` protègent réellement
la donnée à l'écriture ; `PRIMARY KEY`/`FOREIGN KEY` sont de la **documentation de schéma**,
pas une contrainte — un brouillon d'assertions dérivé d'une PK Databricks doit porter un
avertissement de fiabilité inférieure à l'équivalent Postgres/Oracle/Azure SQL.

## 2. Mapping de types (→ `forge-data/contrat@1`, jeu fermé)

| Types Delta / Spark SQL | Type `contrat@1` |
|---|---|
| `TINYINT`, `SMALLINT`, `INT`, `BIGINT` | `entier` |
| `DECIMAL(p,s)`, `FLOAT`, `DOUBLE` | `decimal` |
| `BOOLEAN` | `booleen` |
| `DATE` | `date` |
| `TIMESTAMP`, `TIMESTAMP_NTZ` | `timestamp` |
| `STRING`, `VARCHAR`, `CHAR`, `BINARY` | `string` |
| `ARRAY<…>`, `MAP<…,…>`, `STRUCT<…>` (types imbriqués, sans équivalent RDBMS plat) | repli `string` avec avertissement explicite — un type imbriqué n'est pas une colonne scalaire |

## 3. Vues catalogue

- Unity Catalog expose un `INFORMATION_SCHEMA` de style ANSI (`TABLES`, `COLUMNS`,
  `TABLE_CONSTRAINTS`) — plus proche d'un RDBMS que l'ancien Hive metastore.
- **Lineage colonne natif** : table système `system.access.column_lineage`
  (`source_table_full_name`, `source_column_name`, `target_table_full_name`,
  `target_column_name`, `entity_type`, …) — capacité **sans équivalent** dans les trois
  autres profils de ce lot (aucun des trois n'a de lineage colonne natif au catalogue).

## 4. Commande d'export

- Schéma de table : `SHOW CREATE TABLE <table>` ou `DESCRIBE TABLE EXTENDED <table>`.
- Lineage colonne : lecture de `system.access.column_lineage` — **réservée aux workspaces
  Unity Catalog Premium/Enterprise (payant)** ; aucun mode libre équivalent à `pg_dump`.
  L'artefact (export de ces system tables) est **fourni par le client**, jamais obtenu par
  une connexion de la forge (loi n° 4).
- **Et ce n'est pas seulement une question d'édition : c'est une question de DROIT** (constat
  de terrain du 07/09/2026, retour Produit-10, TF-0893). Sur un workspace où les system tables
  existent, `SELECT … FROM system.access.table_lineage` rend
  `[INSUFFICIENT_PERMISSIONS] User does not have USE SCHEMA on Schema 'system.access'`
  (SQLSTATE 42501) : `USE SCHEMA` sur `system.access` est un droit de **gouvernance**, accordé
  par un administrateur de métastore, pas par le propriétaire des données de la mission. Un
  compte de mission ne l'a pas et ne l'obtient pas dans la journée.
- **Lineage table par l'API REST — la voie qui répond avec les droits ordinaires du jeton** :
  `GET /api/2.0/lineage-tracking/table-lineage?table_name=<catalogue.schéma.table>&include_entity_lineage=true`.
  Réponse : `upstreams[]` / `downstreams[]`, chaque entrée portant un `tableInfo`
  (`catalog_name`, `schema_name`, `name`, `lineage_timestamp`) et, avec
  `include_entity_lineage=true`, les entités d'exécution (`notebookInfos`, `jobInfos`,
  `pipelineInfos`, `queryInfos`). Grain **table**, jamais colonne. C'est une API **par table** :
  un relevé de 30 objets est 30 appels, donc 30 réponses à archiver dans un même export.
  Comme pour les system tables, l'artefact est **fourni par le client** (l'humain appelle,
  archive le JSON, transmet) — la forge ne se connecte jamais.

  | | `system.access.column_lineage` | API `lineage-tracking/table-lineage` |
  |---|---|---|
  | Grain | colonne | table |
  | Droit requis | `USE SCHEMA` sur `system.access` (gouvernance) | droits ordinaires du jeton sur les objets |
  | Édition | Premium/Enterprise | disponible avec Unity Catalog |
  | Confiance rendue (REX X6) | 3 | 0 (grain table ; capture runtime dite dans la méthode) |
  | Voie du verbe | `system-tables` (champ `lignes`) | `api-lineage-tracking` (champ `reponses`) |

## 5. Consommation

- **Schéma de table** (`CONSTRAINT` Delta) : **couvert par `scripts/importer.mjs` depuis la
  version 1.1.0 de ce profil (TF-0858, 07/09/2026)** — ouvert parce qu'un run réel l'exige
  (temps T1 d'une mission Silver/Gold sur Databricks, décision humaine D-2 a du 07/09 ; lot L1
  de `output\03-etudes\20260907-etude-opportunite-mission-data-silver-gold-powerbi.md` du
  pilot). Entrée : la sortie de `SHOW CREATE TABLE`, une instruction par table. Le dialecte se
  détecte (`USING delta`, nom à trois segments, type imbriqué) ou se déclare
  (`--dialecte databricks`) et figure au manifeste. Conséquences du §1 : les assertions
  dérivées d'une `PRIMARY KEY` ou d'une `UNIQUE` portent un **avertissement de fiabilité
  inférieure** (clé informationnelle) ; `NOT NULL` et `CHECK` se dérivent comme en Postgres.
  Conséquence du §2 : `ARRAY` / `MAP` / `STRUCT` → repli `string` averti. Le `COMMENT` en ligne
  (colonne) ou en queue (table) est rattaché au contrat et contrôlé comme un `COMMENT ON`
  (TF-0600). Preuve en boucle : `oracles/self-test.mjs` sur
  `fixtures/schema-databricks-{verte,rouge}.sql`.
- **Lineage colonne Unity Catalog** : couvert par `scripts/traduire-unity-catalog.mjs`
  (TF-0141) — traducteur dédié `system.access.column_lineage` → `forge-data/lineage@1`,
  validé sur fixture **synthétique** uniquement (aucun export UC réel disponible sans
  workspace payant — cf. l'en-tête de ce script).
- **Lineage table par l'API REST** : couvert par la seconde voie du MÊME verbe depuis la
  version 1.2.0 de ce profil (TF-0893, 08/09/2026) — `--voie api-lineage-tracking`, détectée
  sur le champ `reponses`. Ouverte parce que la première voie est **refusée en droit** sur un
  workspace réel (§4) : le verbe n'avait qu'une entrée, et c'était celle qui ne répond pas.
  Le lineage produit est au grain table, transformations `runtime`, `confiance.niveau` **0** —
  et ce 0 est un arbitrage assumé contre la proposition du retour (qui demandait 2) : sur
  l'échelle REX X6, les niveaux 1 à 3 sont tous des grains colonne, et `oracle-tracer` T5 ne
  juge que la présence du niveau, jamais sa justesse. Preuve en boucle :
  `oracles/self-test.mjs` sur `fixtures/unity-catalog-api-{verte,rouge}.json`.
