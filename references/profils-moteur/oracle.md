---
moteur: oracle
version: 1.0.0
challenge_date: 2026-08-12
sources:
  - "Oracle AI Database 26ai / Oracle Database 19c — Oracle Database Documentation"
  - "DBMS_METADATA.GET_DDL — Oracle Database PL/SQL Packages and Types Reference"
  - "DBMS_DEVELOPER.GET_METADATA — Oracle Database 23ai, version 23.7 (02/2025)"
  - "ALL_CONSTRAINTS / ALL_CONS_COLUMNS — Oracle Database Reference (vues catalogue)"
  - "Oracle Autonomous Database Free / Oracle Database 23ai Free — Oracle.com, consulté 12/08/2026"
  - "étude d'opportunité forge-data — output\\20260812-etude-forge-data-moteurs.md (12/08/2026)"
---

# Profil-moteur — Oracle

Référentiel versionné (pas une forge ni un verbe — R-28, loi transverse n° 4). **Créé par
anticipation sur mandat humain du 12/08/2026** (dérogation à la doctrine « au premier run
réel », cf. `LISEZMOI.md` de ce dossier). Dialecte **non encore consommé** par
`scripts/importer.mjs` (v0 = Postgres seul) : ce profil documente le dialecte pour une
extension future du verbe, prouvée par non-recouvrement le jour d'un run réel.

## 1. Dialecte de contraintes

| Contrainte | Forme DDL | Où elle se lit à l'export |
|---|---|---|
| Non-nullité | `col type NOT NULL` (implémentée en interne comme un `CHECK (col IS NOT NULL)`) | `ALL_CONSTRAINTS` type `C`, `SEARCH_CONDITION` = `"COL" IS NOT NULL` |
| Bornes / ensemble | `CHECK (condition)` — syntaxe SQL libre (pas de forme `IN`/bornes dédiée distincte au catalogue) | `ALL_CONSTRAINTS.SEARCH_CONDITION` (type `C`) ; condition longue → `SEARCH_CONDITION_VC` (CLOB) |
| Unicité | `UNIQUE (col[, …])` | `ALL_CONSTRAINTS` type `U` + `ALL_CONS_COLUMNS` |
| Clé primaire | `PRIMARY KEY (col[, …])` | `ALL_CONSTRAINTS` type `P` + `ALL_CONS_COLUMNS` |
| Clé étrangère | `FOREIGN KEY … REFERENCES` | `ALL_CONSTRAINTS` type `R` |

Particularité structurante : Oracle **ne distingue pas** syntaxiquement au catalogue une
`CHECK` « bornes » d'une `CHECK` « ensemble » — les deux sont une même colonne
`SEARCH_CONDITION` en SQL libre (ex. `"MONTANT" BETWEEN 0 AND 100000` ou
`"PAYS" IN ('FR','BE','LU')`), à reconnaître par motif comme pour Postgres, mais sans les
réécritures de casts que pratique `pg_dump`.

## 2. Mapping de types (→ `forge-data/contrat@1`, jeu fermé)

| Types Oracle | Type `contrat@1` | Remarque |
|---|---|---|
| `NUMBER(p,0)`, `NUMBER` sans échelle déclarée utilisée comme compteur, `INTEGER`, `PLS_INTEGER` | `entier` | `NUMBER` sans précision/échelle est ambigu — à trancher par convention de nommage ou revue humaine |
| `NUMBER(p,s)` avec `s > 0` | `decimal` | |
| `VARCHAR2`, `NVARCHAR2`, `CHAR`, `NCHAR`, `CLOB` | `string` | |
| `DATE` | `date` | **piège** : le type `DATE` d'Oracle porte une composante heure (jusqu'à la seconde) — plus proche sémantiquement d'un `timestamp` que d'un `date` pur ; à documenter au cas par cas |
| `TIMESTAMP`, `TIMESTAMP WITH TIME ZONE`, `TIMESTAMP WITH LOCAL TIME ZONE` | `timestamp` | |
| `RAW`, `BLOB` | `string` | contenu binaire — le type `contrat@1` ne capture que la forme, pas le contenu |
| tout type hors de cette liste | repli `string` avec avertissement explicite | |

## 3. Vues catalogue

- `ALL_CONSTRAINTS` / `DBA_CONSTRAINTS` / `USER_CONSTRAINTS` (`CONSTRAINT_TYPE` : `C`
  check/non-nul, `U` unique, `P` primary key, `R` foreign key) + `SEARCH_CONDITION` /
  `SEARCH_CONDITION_VC`.
- `ALL_CONS_COLUMNS` (colonnes portées par une contrainte, ordre `POSITION`).
- `ALL_TAB_COLUMNS` (`DATA_TYPE`, `DATA_PRECISION`, `DATA_SCALE`, `NULLABLE`) pour les types.

## 4. Commande d'export

```sql
SELECT DBMS_METADATA.GET_DDL('TABLE', 'NOM_TABLE', 'SCHEMA') FROM dual;
```

Depuis Oracle 23ai (23.7, 02/2025), alternative : `DBMS_DEVELOPER.GET_METADATA`. Une édition
**Oracle Database 23ai Free** / **Autonomous Database Always Free** existe pour développer
en local sans coût — mais la **production cible reste Enterprise** dans l'usage attendu :
l'artefact DDL est **fourni par le client**, jamais obtenu par une connexion de la forge
(loi n° 4).

## 5. Consommation par le verbe importer

Non couvert par `scripts/importer.mjs` v0 (dialecte Postgres seul). Un ajout Oracle exige un
**second parseur de dialecte** (pas juste une donnée de mapping) car la forme `SEARCH_CONDITION`
issue de `DBMS_METADATA.GET_DDL` diffère syntaxiquement du DDL `pg_dump` (pas de cast `::type`,
guillemets doubles systématiques sur les identifiants, fonctions Oracle-spécifiques possibles
dans une `CHECK`). À ouvrir en item séparé, prouvé par non-recouvrement (R-28), au premier run
réel fournissant un artefact DDL Oracle.
