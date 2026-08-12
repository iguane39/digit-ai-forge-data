# Profils-moteur — doctrine en 8 lignes

1. Un profil-moteur est un **référentiel versionné** (frontmatter `moteur` + `version` +
   `challenge_date` + `sources` datées), **jamais une forge ni un verbe outillé** — loi
   transverse n° 4, R-28 (`REGLES-PROJET.md` §H du pilot).
2. Il ne porte aucun code : il **documente** le dialecte de contraintes, le mapping de
   types, les vues catalogue et la commande d'export d'un moteur de base de données, pour
   **alimenter le verbe `importer`** (`scripts/importer.mjs`, TF-0139) et pour guider un
   humain qui profile/trace *ce* moteur avec les formats existants (assertions@1,
   lineage@1, contrat@1).
3. Quatre profils à ce jour : `postgres.md`, `oracle.md`, `azure-sql.md`, `databricks.md`.
   **Postgres a été créé avec le verbe** (seul moteur dont l'artefact — `pg_dump
   --schema-only` — est 100 % libre et local, donc seul à porter la fixture double sens du
   round-trip). **Les trois autres sont créés par anticipation, sur mandat humain explicite
   du 12/08/2026** — dérogation documentée à la doctrine générale des profils (« au premier
   run réel », cf. `output\20260812-etude-forge-data-moteurs.md` §4 du pilot) : le mandat
   couvre nommément les quatre moteurs, pas seulement Postgres.
4. Un profil-moteur ne rend PAS son moteur consommable par une **connexion live** : la
   forge juge des artefacts déjà exportés (DDL, DACPAC, JSON de catalogue), jamais une base
   vivante — garde-fou fondateur (§0-C de l'étude référencée ci-dessus).
5. Seul le dialecte Postgres est aujourd'hui **consommé** par `scripts/importer.mjs` (v0).
   Les profils Oracle / Azure SQL / Databricks documentent leur dialecte pour une extension
   future du verbe, prouvée par non-recouvrement (R-28) le jour où un artefact réel de ce
   moteur doit être importé — jamais ajoutée par anticipation dans le code.
6. Databricks est **à part** : ce n'est pas un RDBMS ligne-à-ligne (lakehouse Spark +
   Delta + Unity Catalog) — son apport distinctif est le lineage colonne natif d'Unity
   Catalog, couvert par un verbe séparé (`scripts/traduire-unity-catalog.mjs`, TF-0141),
   pas par `importer`.
7. Fraîcheur = les `sources` datées en frontmatter ; une mise à jour de profil exige une
   nouvelle `version` (SemVer) + `challenge_date` rafraîchie — jamais une édition silencieuse
   d'un fait daté.
8. Aucun profil ne suppose ni n'installe d'instance du moteur qu'il décrit : les faits sont
   sourcés depuis la documentation officielle du moteur, jamais observés sur une base vivante
   que la forge opérerait.

## Inventaire des profils actifs (4)

`postgres.md` (porte la fixture du verbe importer) · `oracle.md` · `azure-sql.md` ·
`databricks.md` (à part — RDBMS non applicable, cf. point 6).

## Liste d'attente (candidats non créés)

Vide à ce jour (12/08/2026). Un cinquième profil-moteur naîtrait au premier run réel citant
un moteur hors de ces quatre (ex. MySQL, SQL Server on-prem, Snowflake) — jamais anticipé
sans produit à exercer, retour à la doctrine générale des profils une fois ce lot de quatre
clos.
