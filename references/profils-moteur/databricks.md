---
moteur: databricks
version: 1.0.0
challenge_date: 2026-08-12
sources:
  - "Delta Lake — Constraints clause (CONSTRAINT ... CHECK / NOT NULL) — docs.delta.io"
  - "Databricks Unity Catalog — Data lineage (system.access.column_lineage) — learn.microsoft.com, mise à jour 2026-08-06"
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

## 5. Consommation

- **Schéma de table** (`CONSTRAINT` Delta) : non couvert par `scripts/importer.mjs` v0
  (dialecte Postgres seul). Un ajout Databricks est **de moindre valeur** que pour les RDBMS
  classiques, faute de contrainte d'unicité native — à ouvrir seulement si un run réel
  l'exige (R-28).
- **Lineage colonne Unity Catalog** : couvert par `scripts/traduire-unity-catalog.mjs`
  (TF-0141) — traducteur dédié `system.access.column_lineage` → `forge-data/lineage@1`,
  validé sur fixture **synthétique** uniquement (aucun export UC réel disponible sans
  workspace payant — cf. l'en-tête de ce script).
