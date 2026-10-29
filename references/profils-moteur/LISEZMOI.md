# Profils-moteur — doctrine en 8 lignes

1. Un profil-moteur est un **référentiel versionné** (frontmatter `moteur` + `version` +
   `challenge_date` + `sources` datées), **jamais une forge ni un verbe outillé** — loi
   transverse n° 4, R-28 (`REGLES-PROJET.md` §H du pilot).
2. Il ne porte aucun code : il **documente** le dialecte de contraintes, le mapping de
   types, les vues catalogue et la commande d'export d'un moteur de base de données, pour
   **alimenter le verbe `importer`** (`scripts/importer.mjs`, TF-0139) et pour guider un
   humain qui profile/trace *ce* moteur avec les formats existants (assertions@1,
   lineage@1, contrat@1). Depuis le 29/10/2026 (TF-2011), `postgres.md` et `supabase.md`
   documentent aussi, en leur §6, l'extraction et le rechargement d'un extrait de données
   pour le verbe `anonymiser` (`scripts/anonymiser.mjs`).
3. Cinq profils à ce jour : `postgres.md`, `oracle.md`, `azure-sql.md`, `databricks.md`,
   `supabase.md` (16/10/2026, un Postgres : il hérite de `postgres.md` et n'en porte que
   l'écart, décision et motif en tête du fichier ; né du premier run qui le cite).
   **Postgres a été créé avec le verbe** (seul moteur dont l'artefact — `pg_dump
   --schema-only` — est 100 % libre et local, donc seul à porter la fixture double sens du
   round-trip). **Les trois autres sont créés par anticipation, sur mandat humain explicite
   du 12/08/2026** — dérogation documentée à la doctrine générale des profils (« au premier
   run réel », cf. `output\20260812-etude-forge-data-moteurs.md` §4 du pilot) : le mandat
   couvre nommément les quatre moteurs, pas seulement Postgres.
4. Un profil-moteur ne rend PAS son moteur consommable par une **connexion live** : la
   forge juge des artefacts déjà exportés (DDL, DACPAC, JSON de catalogue), jamais une base
   vivante — garde-fou fondateur (§0-C de l'étude référencée ci-dessus).
5. Deux dialectes sont aujourd'hui **consommés** par `scripts/importer.mjs` : Postgres (v0)
   et **Databricks** (profil 1.2.0, TF-0858 du 07/09/2026 — ouvert le jour où un artefact
   réel de ce moteur a dû être importé, temps T1 d'une mission Silver/Gold, exactement la
   condition que ce point posait). Les profils Oracle / Azure SQL documentent leur dialecte
   pour une extension future du verbe, prouvée par non-recouvrement (R-28) le jour où un
   artefact réel de ce moteur doit être importé — jamais ajoutée par anticipation dans le code.
6. Databricks est **à part** : ce n'est pas un RDBMS ligne-à-ligne (lakehouse Spark +
   Delta + Unity Catalog) — son apport distinctif est le lineage colonne natif d'Unity
   Catalog, couvert par un verbe séparé (`scripts/traduire-unity-catalog.mjs`, TF-0141), qui
   porte depuis TF-0893 (08/09/2026) une **seconde voie d'entrée** — l'API REST
   `lineage-tracking/table-lineage`, granularité table, ouverte parce que la première est refusée en
   DROIT sur un workspace réel (§4 du profil) et non seulement par l'édition ;
   son schéma de table (`SHOW CREATE TABLE`) est couvert par `importer` depuis TF-0858,
   avec les clés déclarées informationnelles (§1 du profil) averties comme telles.
7. Fraîcheur = les `sources` datées en frontmatter ; une mise à jour de profil exige une
   nouvelle `version` (SemVer) + `challenge_date` rafraîchie — jamais une édition silencieuse
   d'un fait daté.
8. Aucun profil ne suppose ni n'installe d'instance du moteur qu'il décrit : les faits sont
   sourcés depuis la documentation officielle du moteur, jamais observés sur une base vivante
   que la forge opérerait. Seule exception, de recette : `scripts/exercer-anonymiser-postgres.mjs`
   (TF-2011) monte un PostgreSQL éphémère en Docker local, y joue les commandes documentées sur la
   source SYNTHÉTIQUE de la forge, puis le détruit. Ce qu'il mesure confirme un fait sourcé ou en
   montre la limite, et le profil le dit daté ; il n'opère jamais une base existante.

## Inventaire des profils actifs (5)

`postgres.md` (porte la fixture du verbe importer) · `oracle.md` · `azure-sql.md` ·
`databricks.md` (à part — RDBMS non applicable, cf. point 6) · `supabase.md` (hérite de
`postgres.md` ; `importer` non étendu, cf. son §5).

Garde exécutée : `oracles/self-test.mjs`, règles PM1 (frontmatter `moteur`, `version`,
`challenge_date`, `sources`), PM2 (chaque profil du disque cité ici, compte égal) et PM3 (chaque
entrée des deux sections suivantes porte sa date de décision, une source datée et son déclencheur
ou son motif ; aucun moteur n'y figure s'il a un profil sur le disque).

## Liste d'attente (candidats non créés)

Le cinquième profil, `supabase.md`, est né du premier run réel qui le cite. Un sixième naît de
même, au premier run réel citant un moteur hors de ces cinq, jamais par anticipation sans produit
à exercer. Un moteur déjà étudié attend ici avec ce que son profil devra vérifier.

- **d1** — Cloudflare D1, base SQLite gérée, liée à un Worker. Décidé le 29/10/2026 (TF-1999,
  étude du pilot du 28/10/2026, ligne C7) : pas de profil, attente. Motif : le 28/10/2026, aucun
  dépôt du parc ne citait D1, et le point « jamais anticipé sans produit à exercer » s'applique.
  Aucun `wrangler` n'était installé sur le poste le 29/10/2026 : rien n'a pu être exercé.
  Déclencheur : le premier run d'un produit dont la configuration Wrangler déclare
  `d1_databases`. Ce que le profil devra vérifier, d'après les pages lues le 29/10/2026 :
  - dialecte : « D1 is compatible with most SQLite's SQL convention », avec FTS5, JSON et les
    fonctions mathématiques ; l'import refuse un export MySQL ou PostgreSQL (« the types and SQL
    syntax are not directly compatible ») ;
  - contraintes : les clés étrangères sont appliquées par défaut, comme `PRAGMA foreign_keys =
    on` à chaque transaction ; `PRAGMA defer_foreign_keys = on` les diffère jusqu'à la fin de la
    transaction ;
  - artefact à importer : `wrangler d1 export <base> --remote --output=./schema.sql --no-data`
    (schéma seul) ; l'export refuse les tables virtuelles FTS5, et une valeur `int64` relue perd
    sa précision au-delà de 52 bits ;
  - migrations : fichiers `.sql` numérotés dans `migrations/`, appliquées par
    `wrangler d1 migrations apply`, suivies dans la table `d1_migrations` ;
  - limites : 10 Go par base (offre payante), 100 colonnes par table, 2 Mo par ligne ou valeur,
    100 paramètres liés par requête.
  Sources : « SQL statements » (developers.cloudflare.com/d1/sql-api/sql-statements/, mise à jour
  du 21/04/2026, lu le 29/10/2026) ; « Define foreign keys » (d1/sql-api/foreign-keys/, lu le
  29/10/2026) ; « Import and export data » (d1/best-practices/import-export-data/, lu le
  29/10/2026) ; « Migrations » (d1/reference/migrations/, mise à jour du 08/06/2026, lu le
  29/10/2026) ; « Limits » (d1/platform/limits/, mise à jour du 24/10/2026, lu le 29/10/2026).

## Écarts motivés (hors du champ des profils)

Un écart nomme un service de données qu'un produit peut employer et qui n'aura pas de profil,
avec le motif. Il ne se rouvre que si son motif tombe.

- **r2** — Cloudflare R2, stockage d'objets. Décidé le 29/10/2026 (TF-1999). Motif : R2 stocke
  des objets (« Object storage for all your data »), sans schéma, contrainte ni vue catalogue : il
  n'a ni dialecte ni artefact pour le verbe `importer`. Un fichier de données déposé dans R2
  (CSV, Parquet) se juge comme un fichier, par les verbes qui lisent un fichier, sans profil de
  moteur. Source : « Cloudflare R2 » (developers.cloudflare.com/r2/, mise à jour du 01/10/2026,
  lu le 29/10/2026).
- **hyperdrive** — Cloudflare Hyperdrive, réserve de connexions et cache de requêtes devant un
  PostgreSQL ou un MySQL existant. Décidé le 29/10/2026 (TF-1999). Motif : Hyperdrive n'est pas
  un moteur ; le moteur qu'il dessert garde son profil (`postgres.md`, `supabase.md`), et la forge
  ne se connecte jamais à une base (point 4). Deux faits datés pour qui trace ou restitue une
  application qui lit par Hyperdrive. D'abord, « Query caching is enabled by default » : une
  lecture peut venir du cache, et un chiffre restitué depuis elle doit dire sa fraîcheur. Ensuite,
  pour Supabase, Hyperdrive prend « the Direct connection connection string rather than the
  pooled connection strings ». Sources : « Query caching »
  (developers.cloudflare.com/hyperdrive/concepts/query-caching/, mise à jour du 05/07/2026, lu le
  29/10/2026) ; « Supabase » (hyperdrive/examples/connect-to-postgres/postgres-database-providers/
  supabase/, mise à jour du 21/04/2026, lu le 29/10/2026).
