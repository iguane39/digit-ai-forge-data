---
moteur: postgres
version: 1.1.0
challenge_date: 2026-10-29
sources:
  - "PostgreSQL 18.0 Release Notes — postgresql.org, 25/09/2025"
  - "pg_dump — PostgreSQL Documentation (option --schema-only, export local/hors-ligne)"
  - "information_schema — PostgreSQL Documentation (vues portables ISO/IEC 9075-11)"
  - "pg_catalog (pg_constraint, pg_attribute, pg_type) — PostgreSQL Documentation (vues propriétaires, plus riches)"
  - "étude d'opportunité forge-data — output\\20260812-etude-forge-data-moteurs.md (12/08/2026)"
  - "COPY — PostgreSQL 18.6 Documentation, postgresql.org/docs/current/sql-copy.html (forme CSV, NULL non cité, colonnes d'identité), lu le 29/10/2026"
  - "psql — PostgreSQL 18.6 Documentation, postgresql.org/docs/current/app-psql.html (\\copy côté client, ON_ERROR_STOP), lu le 29/10/2026"
  - "pg_dump — PostgreSQL 18.6 Documentation, postgresql.org/docs/current/app-pgdump.html (--section pre-data, data, post-data), lu le 29/10/2026"
  - "System Information Functions — PostgreSQL 18.6 Documentation §9.27 (pg_get_serial_sequence), lu le 29/10/2026"
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

## 6. Extraire et recharger un extrait de données (verbe anonymiser, TF-2011)

Ajout du 29/10/2026, version 1.1.0. La décision D-91 (a) du porteur admet un extrait de production
dans une base de développement ou de qualification, une fois anonymisé par `scripts/anonymiser.mjs`
et jugé PASS par `oracles/oracle-anonymiser.mjs`. Les commandes ci-dessous se jouent CHEZ LE PRODUIT,
par l'humain ou par sa chaîne : la forge ne se connecte à aucune base (point 4 du `LISEZMOI.md`).
Leurs faits viennent des pages COPY, psql et pg_dump de la documentation PostgreSQL 18.6, lues le
29/10/2026.

### Extraire : une table, un fichier CSV

```bash
psql -X -v ON_ERROR_STOP=1 -d "<connexion-source>" \
  -c "\copy (SELECT * FROM <schéma>.<table>) TO '<dossier-source>/<table>.csv' WITH (FORMAT csv, HEADER true)"
```

- `\copy` copie côté client : « file accessibility and privileges are those of the local user, not
  the server, and no SQL superuser privileges are required » (page psql). Le fichier arrive sur le
  poste qui lance psql.
- Toute la fin de la ligne appartient à `\copy` : une table par appel `-c`.
- En CSV, COPY écrit un NULL en champ vide non cité et une chaîne vide en `""` (page COPY) : le verbe
  lit et réécrit cette distinction.
- Avec `ON_ERROR_STOP`, psql s'arrête à la première erreur et rend le code 3 (page psql).
- Le dossier source porte de la donnée personnelle. Il vit hors de tout dépôt, et il se détruit après
  le verdict de l'oracle, qui en a besoin pour mesurer.

Forme JSONL possible, non exercée sur le moteur :
`psql -X -A -t -c "SELECT row_to_json(t) FROM <schéma>.<table> t" > <table>.jsonl`. Le CSV reste
préféré : `JSON.parse` lit faux un entier au-delà de 2^53, et le verbe refuse alors la ligne.

### Masquer, juger

```bash
node scripts/anonymiser.mjs --masquage masquage.json --source <dossier-source> --sortie <dossier-masqué>
node oracles/oracle-anonymiser.mjs <dossier-masqué>     # PASS exigé, AVANT de détruire la source
```

### Recharger dans la base de développement

Par sections, quand la base se crée depuis le schéma de la source : clés et index arrivent après les
données et se valident à leur création, donc l'ordre des tables est libre.

```bash
pg_dump --section=pre-data  -d "<connexion-source>" > pre.sql
pg_dump --section=post-data -d "<connexion-source>" > post.sql
psql -X -v ON_ERROR_STOP=1 -d "<connexion-dev>" -f pre.sql
psql -X -v ON_ERROR_STOP=1 -d "<connexion-dev>" \
  -c "\copy <schéma>.<table> (<colonnes de l'en-tête>) FROM '<dossier-masqué>/<table>.csv' WITH (FORMAT csv, HEADER true)"
psql -X -v ON_ERROR_STOP=1 -d "<connexion-dev>" -f post.sql
```

La page pg_dump dit : « Post-data items include definitions of indexes, triggers, rules, statistics
for indexes, and constraints other than validated check and not-null constraints. Pre-data items
include all other data definition items. » Les `CHECK` validés et les `NOT NULL` s'appliquent donc
dès le chargement : une colonne `NOT NULL` ne se déclare pas `supprimer`, elle se remplace par une
`constante`. La liste de colonnes de `\copy` reprend l'en-tête du fichier masqué, sans les colonnes
supprimées.

Quand le schéma est déjà posé avec ses contraintes (migrations), les tables se chargent dans
l'`ordre_chargement` du rapport `anonymisation.json`, parents d'abord. Il vaut `null` quand un cycle
de clés étrangères l'interdit : on recharge alors par sections.

Pour une colonne d'identité, COPY FROM écrit la valeur fournie, « like the INSERT option OVERRIDING
SYSTEM VALUE » (page COPY). La séquence, elle, ne suit pas : mesuré le 29/10/2026 sur un PostgreSQL
16.14 éphémère, après le chargement des clés 500 et 900, `nextval` rendait 1 pour une colonne
d'identité comme pour une colonne `serial`. La première insertion de l'application finirait donc par
heurter une clé chargée. `pg_get_serial_sequence` rend la séquence d'une colonne `serial` ou
d'identité (§9.27), et `setval` la recale ; mesuré au même passage, `nextval` rendait ensuite 901 :

```sql
SELECT setval(pg_get_serial_sequence('<schéma>.<table>', '<colonne>'), max(<colonne>)) FROM <schéma>.<table>;
```

### Exercé sur un moteur réel, synthétique et éphémère

`node scripts/exercer-anonymiser-postgres.mjs [--image postgres:16-alpine]` monte un PostgreSQL en
Docker local, sans port publié, et charge la source SYNTHÉTIQUE de la forge
(`fixtures/anonymisation-source/`). Il l'extrait par la commande ci-dessus, la masque et la fait
juger. Il la recharge des deux façons, vérifie qu'une clé étrangère rendue orpheline fait échouer
post-data (code psql 3, violation de clé étrangère), puis détruit le conteneur. Joué le 29/10/2026 :
PostgreSQL 16.14 et 17.10, PASS, aucun conteneur restant. C'est une recette, pas une source : les faits
de ce profil restent ceux de la documentation (point 8 du `LISEZMOI.md`).
