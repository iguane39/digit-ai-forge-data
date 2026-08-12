---
moteur: postgres
version: 1.0.0
challenge_date: 2026-08-12
sources:
  - "PostgreSQL 18.0 Release Notes — postgresql.org, 25/09/2025"
  - "pg_dump — PostgreSQL Documentation (option --schema-only, export local/hors-ligne)"
  - "information_schema — PostgreSQL Documentation (vues portables ISO/IEC 9075-11)"
  - "pg_catalog (pg_constraint, pg_attribute, pg_type) — PostgreSQL Documentation (vues propriétaires, plus riches)"
  - "étude d'opportunité forge-data — output\\20260812-etude-forge-data-moteurs.md (12/08/2026)"
---

# Profil-moteur — PostgreSQL

Référentiel versionné (pas une forge ni un verbe — R-28, loi transverse n° 4). Seul moteur
de ce lot dont l'artefact d'export (`pg_dump --schema-only`) est **100 % libre et local** :
il porte donc la fixture double sens du verbe `importer` (TF-0139,
`fixtures/schema-postgres-{verte,rouge}.sql`). Dialecte **consommé en v0** par
`scripts/importer.mjs`.

## 1. Dialecte de contraintes

| Contrainte | Forme DDL (inline ou `ALTER TABLE … ADD CONSTRAINT`) | Rendu réel par `pg_dump` |
|---|---|---|
| Non-nullité | `col type NOT NULL` | inline, sans réécriture |
| Bornes | `CHECK (col >= a AND col <= b)` / `CHECK (col BETWEEN a AND b)` | réécrit avec parenthésage et cast : `CHECK (((col >= (a)::numeric) AND (col <= (b)::numeric)))` |
| Ensemble | `CHECK (col IN (v1, v2, …))` | réécrit en `CHECK (((col)::text = ANY (ARRAY[(v1)::character varying, …]::text[])))` — forme équivalente, **les deux sont reconnues** par `importer` |
| Unicité | `UNIQUE (col)` / `PRIMARY KEY (col)` | inline ou via `ALTER TABLE ONLY … ADD CONSTRAINT …_pkey/_key` |
| Clé composite | `PRIMARY KEY (a, b)` / `UNIQUE (a, b)` | idem, colonnes multiples |
| Nouveautés v18 (25/09/2025) | `CHECK`/`FOREIGN KEY … NOT ENFORCED` (contrainte déclarée mais non appliquée par le moteur), colonnes générées **virtuelles** (`GENERATED ALWAYS AS (expr) VIRTUAL`, en plus de `STORED`), `PRIMARY KEY`/`UNIQUE … WITHOUT OVERLAPS` (contraintes temporelles, index GiST) | — |

`NOT ENFORCED` (v18) change la portée d'une assertion dérivée : une contrainte non
appliquée par le moteur ne garantit rien en pratique — `importer` ne distingue pas encore
ce cas (limitation v0, à vérifier manuellement sur `pg_constraint.conenforced` avant de
faire confiance à un brouillon issu d'un schéma v18+ portant des contraintes non appliquées).

## 2. Mapping de types (→ `forge-data/contrat@1`, jeu fermé)

| Types PostgreSQL | Type `contrat@1` |
|---|---|
| `smallint`, `integer`/`int`/`int4`, `bigint`/`int8`, `smallserial`, `serial`, `bigserial` | `entier` |
| `numeric`/`decimal`, `real`/`float4`, `double precision`/`float8`, `money` | `decimal` |
| `boolean`/`bool` | `booleen` |
| `date` | `date` |
| `timestamp`/`timestamp without time zone`, `timestamp with time zone`/`timestamptz` | `timestamp` |
| `text`, `character varying`/`varchar`, `character`/`char`/`bpchar`, `uuid`, `json`, `jsonb`, `citext`, `bytea`, `inet`, `cidr` | `string` |
| `CREATE DOMAIN … CHECK (…)` (domaine avec contrainte) | type de base du domaine + la `CHECK` du domaine à reporter manuellement (non résolue par `importer` v0 : le DDL d'un domaine est une instruction séparée, non lue) |
| tout type hors de cette liste | repli `string` avec avertissement explicite (jamais silencieux) |

## 3. Vues catalogue (lecture directe si connexion — hors périmètre forge, pour mémoire)

- Portable (ISO) : `information_schema.tables`, `.columns`, `.table_constraints`,
  `.check_constraints`, `.key_column_usage`.
- Propriétaire (plus riche) : `pg_catalog.pg_constraint` (`consrc`/`conbin` pour l'expression
  CHECK, `conenforced` depuis v18), `pg_attribute`, `pg_type`, `pg_class`.

## 4. Commande d'export (libre, locale, hors-ligne)

```bash
pg_dump --schema-only -d <base> > schema.sql
```

Aucune donnée n'est exportée (`--schema-only`) ; aucune connexion n'est requise côté forge —
le fichier `schema.sql` est fourni par l'humain, jamais généré par une connexion de la forge
elle-même (loi n° 4 : la forge ne se connecte jamais à une base).

## 5. Consommation par le verbe importer

```bash
node scripts/importer.mjs schema.sql --sortie-dir <dossier>
```

Couverture v0 : `CREATE TABLE` (colonnes, types, `NOT NULL`, `CHECK` inline) et
`ALTER TABLE … ADD CONSTRAINT` (`PRIMARY KEY`, `UNIQUE`, `CHECK`) — cf. en-tête de
`scripts/importer.mjs` pour la liste exhaustive des correspondances et des limites
assumées (clés composites, `CHECK` multi-colonnes, `FOREIGN KEY`, domaines, `NOT ENFORCED`).
