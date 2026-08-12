---
moteur: azure-sql
version: 1.0.0
challenge_date: 2026-08-12
sources:
  - "Try Azure SQL Database for free — learn.microsoft.com, ms.date 2026-03-10"
  - "sys.check_constraints (Transact-SQL) — learn.microsoft.com, mise à jour 2026-07-20"
  - "INFORMATION_SCHEMA.CHECK_CONSTRAINTS (Transact-SQL) — learn.microsoft.com"
  - "sqlpackage / DACPAC — learn.microsoft.com (SQL Server Data Tools)"
  - "étude d'opportunité forge-data — output\\20260812-etude-forge-data-moteurs.md (12/08/2026)"
---

# Profil-moteur — Azure SQL

Référentiel versionné (pas une forge ni un verbe — R-28, loi transverse n° 4). **Créé par
anticipation sur mandat humain du 12/08/2026** (dérogation à la doctrine « au premier run
réel », cf. `LISEZMOI.md` de ce dossier). Azure SQL Database est **SQL Server managé
(PaaS)** — le dialecte est T-SQL. Dialecte **non encore consommé** par
`scripts/importer.mjs` (v0 = Postgres seul).

## 1. Dialecte de contraintes

| Contrainte | Forme DDL (T-SQL) | Où elle se lit à l'export |
|---|---|---|
| Non-nullité | `col type NOT NULL` | `sys.columns.is_nullable = 0` ; portable : `INFORMATION_SCHEMA.COLUMNS.IS_NULLABLE` |
| Bornes / ensemble | `CHECK (condition)` — SQL libre, pas de forme dédiée | propriétaire : `sys.check_constraints.definition` ; portable : `INFORMATION_SCHEMA.CHECK_CONSTRAINTS` (jointe à `CONSTRAINT_COLUMN_USAGE` pour retrouver la colonne) |
| Unicité | `UNIQUE (col[, …])` | `sys.indexes` (`is_unique_constraint = 1`) + `sys.index_columns` |
| Clé primaire | `PRIMARY KEY (col[, …])` | `sys.indexes` (`is_primary_key = 1`) |
| Clé étrangère | `FOREIGN KEY … REFERENCES` | `sys.foreign_keys` |

Deux voies catalogue **coexistent** : `sys.*` (propriétaire T-SQL, expose directement le
texte de la `CHECK` via `definition`) et `INFORMATION_SCHEMA.*` (portable ISO, plus pauvre
mais stable si un jour un moteur ISO alternatif devait être couvert par le même parseur).

## 2. Mapping de types (→ `forge-data/contrat@1`, jeu fermé)

| Types Azure SQL / T-SQL | Type `contrat@1` |
|---|---|
| `TINYINT`, `SMALLINT`, `INT`, `BIGINT` | `entier` |
| `DECIMAL`/`NUMERIC`, `FLOAT`, `REAL`, `MONEY`, `SMALLMONEY` | `decimal` |
| `BIT` | `booleen` |
| `DATE` | `date` |
| `DATETIME`, `DATETIME2`, `SMALLDATETIME`, `DATETIMEOFFSET` | `timestamp` |
| `NVARCHAR`, `VARCHAR`, `NCHAR`, `CHAR`, `TEXT`, `NTEXT`, `UNIQUEIDENTIFIER` | `string` |
| tout type hors de cette liste | repli `string` avec avertissement explicite |

## 3. Vues catalogue

- Propriétaire : `sys.check_constraints`, `sys.columns`, `sys.indexes`/`sys.index_columns`,
  `sys.foreign_keys`, `sys.types`.
- Portable (ISO, plus limité) : `INFORMATION_SCHEMA.TABLES`, `.COLUMNS`,
  `.TABLE_CONSTRAINTS`, `.CHECK_CONSTRAINTS`, `.KEY_COLUMN_USAGE`.

## 4. Commande d'export

Deux voies documentées :
- **Scripts DDL texte** : SSMS → « Generate Scripts » (schéma seul).
- **DACPAC** (paquet binaire de schéma) : `sqlpackage /Action:Extract
  /SourceConnectionString:"<connexion>" /TargetFile:schema.dacpac`.

Un **tier gratuit permanent** existe pour Azure SQL Database, mais requiert un compte
Azure : l'artefact (script DDL ou DACPAC) est **fourni par le client**, jamais obtenu par
une connexion de la forge (loi n° 4). Un DACPAC est un format binaire (paquet), pas du texte
SQL — un parseur DACPAC est un chantier distinct d'un parseur DDL texte.

## 5. Consommation par le verbe importer

Non couvert par `scripts/importer.mjs` v0 (dialecte Postgres seul, format texte DDL). Deux
extensions possibles à ouvrir séparément (R-28, au premier run réel) :
1. un parseur T-SQL texte (proche du parseur Postgres actuel — CHECK en SQL libre sans les
   réécritures `pg_dump`, guillemets `[...]` au lieu de `"..."` pour les identifiants) ;
2. un parseur DACPAC (format binaire distinct, hors de portée d'un parseur de texte DDL).
