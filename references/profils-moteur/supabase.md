---
moteur: supabase
version: 1.2.1
challenge_date: 2026-10-29
herite_de: postgres.md
sources:
  - "Supabase CLI reference (supabase db dump --linked, -f, -s, --data-only) — supabase.com/docs/reference/cli/introduction, lu le 16/10/2026"
  - "Row Level Security (rôles anon, authenticated, service_role) — supabase.com/docs/guides/database/postgres/row-level-security, lu le 16/10/2026"
  - "Storage access control (politiques RLS sur storage.objects) — supabase.com/docs/guides/storage/security/access-control, lu le 16/10/2026"
  - "Gabarit config.toml du CLI ([api] schemas, [db] major_version = 17) — github.com/supabase/cli, branche develop, apps/cli-go/pkg/config/templates/config.toml, lu le 16/10/2026"
  - "profil-moteur PostgreSQL de ce dossier — postgres.md 1.1.0 (challenge_date 2026-10-29)"
  - "Connect to your database (connexion directe, pooler en mode session et transaction) — supabase.com/docs/guides/database/connecting-to-postgres, lu le 29/10/2026"
  - "Supabase CLI reference, supabase db dump (--data-only, --use-copy, schémas ignorés) — supabase.com/docs/reference/cli/supabase-db-dump, lu le 29/10/2026"
  - "Getting started, développement local (base locale sur le port 54322) — supabase.com/docs/guides/local-development/cli/getting-started, lu le 29/10/2026"
  - "Seeding your database (seed après les migrations, à supabase start et db reset) — supabase.com/docs/guides/local-development/seeding-your-database, lu le 29/10/2026"
  - "pgvector: Embeddings and vector similarity (extension vector créée dans le schéma extensions) — supabase.com/docs/guides/database/extensions/pgvector, lu le 29/10/2026"
  - "HNSW indexes (classes d'opérateurs, dimensions indexables, filtrage et iterative scan) — supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes, lu le 29/10/2026"
  - "Cron (pg_cron, schéma cron, tables cron.job et cron.job_run_details) — supabase.com/docs/guides/cron, lu le 29/10/2026"
  - "Cron, Quickstart et Install (cron.schedule ; désactiver pg_cron supprime les jobs) — supabase.com/docs/guides/cron/quickstart et /cron/install, lu le 29/10/2026"
  - "Realtime Authorization (RLS sur realtime.messages, erreur 42501 en migration) — supabase.com/docs/guides/realtime/authorization, lu le 29/10/2026"
  - "mesure de la forge, 29/10/2026 : scripts/importer.mjs sur fixtures/schema-supabase-pgvector.sql, rejouée par oracles/self-test.mjs"
---

# Profil-moteur — Supabase (un Postgres, avec ce qui s'y ajoute)

Référentiel versionné (pas une forge ni un verbe — R-28, loi transverse n° 4). Supabase est
une plateforme dont la base est un PostgreSQL : ce profil ne redit rien de `postgres.md`. Il
nomme seulement ce qu'un projet Supabase ajoute au moteur, et ce que cet ajout change pour qui
profile ou trace ce projet avec les formats de la forge (assertions@1, lineage@1, contrat@1).

## Décision : un fichier à part, pas une section de `postgres.md`

Décidé le 16/10/2026 : **fichier séparé**, qui hérite de `postgres.md` et ne porte que l'écart.
Motif, tiré de la doctrine du `LISEZMOI.md` de ce dossier :

1. La fraîcheur d'un profil tient à ses `sources` datées et à sa `challenge_date` (point 7).
   `postgres.md` est daté du 12/08/2026 sur la documentation PostgreSQL ; les faits Supabase
   viennent d'autres pages, lues le 16/10/2026. Les mêler dans un seul frontmatter rendrait la
   date de `postgres.md` fausse pour la moitié de son contenu, ou la rafraîchirait sans qu'aucun
   fait Postgres ait été revérifié.
2. `postgres.md` porte la fixture double sens du verbe `importer` (point 3) et décrit le
   dialecte consommé en v0 (point 5). Une section Supabase y ferait croire que ce dialecte est
   déjà prouvé sur un export Supabase, ce qui n'est pas le cas (§5 ci-dessous).
3. Un profil par moteur, versionné à part, est la forme de l'inventaire. Une mise à jour d'un
   fait Supabase montera la `version` de ce fichier seul, sans toucher au profil hérité.

## 1. Ce qui est hérité sans changement

Dialecte de contraintes (§1), mapping de types vers `contrat@1` (§2) et vues catalogue (§3) :
ceux de `postgres.md`. Une table d'un projet Supabase s'y lit comme une table PostgreSQL.

Version du moteur : le gabarit `config.toml` posé par le CLI pour le développement local
déclare `[db] major_version = 17`. Les nouveautés v18 listées dans `postgres.md` §1
(`NOT ENFORCED`, colonnes générées `VIRTUAL`, `WITHOUT OVERLAPS`) n'existent donc pas sur une
base locale créée par ce gabarit. Pour un projet hébergé, la version majeure se lit sur le
projet lui-même : elle n'est pas établie ici.

## 2. Schémas gérés par la plateforme

Un projet Supabase porte, à côté des schémas de l'application, des schémas gérés par la
plateforme, dont `auth` et `storage`. Ce profil n'en affirme que ce que ses sources citent :
la table `storage.objects`, sur laquelle s'ouvre l'accès au stockage par politiques RLS
(« Storage does not allow any uploads to buckets without RLS policies »). Le contenu de
`auth` n'est pas documenté ici.

Conséquence pour la forge : un contrat ou un lineage qui porterait sur ces schémas décrirait
un objet que le produit ne possède pas. Les exclure de l'export par `-s` (§4) est le défaut ;
les y inclure se motive.

## 3. Schémas exposés, RLS et rôles

Le gabarit `config.toml` déclare les schémas exposés par l'API : `[api] schemas = ["public",
"graphql_public"]`. La documentation RLS demande d'activer la sécurité au niveau ligne sur
chaque table d'un schéma exposé : sans elle, une table y est lisible et modifiable par tout
rôle qui a un grant. Forme SQL : `alter table public.<t> enable row level security;`.

Trois rôles de la plateforme portent ces politiques :

| Rôle | Sens (source RLS) |
|---|---|
| `anon` | utilisateur non connecté |
| `authenticated` | utilisateur connecté |
| `service_role` | accès complet ; contourne la RLS (attribut `bypassrls`), à garder côté serveur |

Conséquence pour la forge : `importer` ne lit ni `ENABLE ROW LEVEL SECURITY` ni
`CREATE POLICY` (couverture v0 de `postgres.md` §5). Une assertion dérivée d'un schéma
Supabase dit ce que la table accepte, jamais qui peut la lire : la règle d'accès se vérifie à
part, sur la liste des tables d'un schéma exposé.

## 4. Commande d'export (fournie par l'humain)

```bash
supabase db dump --linked -f schema.sql -s public          # schéma seul, schémas choisis
supabase db dump --linked -f donnees.sql --data-only        # données
```

Options relevées sur la référence CLI : `--linked`, `-f`/`--file`, `-s`/`--schema`,
`--data-only`, `--role-only`, `--db-url`. Comme pour `pg_dump`, le fichier est produit par
l'humain sur son projet lié puis remis à la forge, qui ne se connecte jamais (loi n° 4,
point 4 du `LISEZMOI.md`). Un export `--data-only` porte des données : il ne relève pas du
verbe `importer`, qui lit un schéma.

## 5. Consommation par le verbe importer

Non étendu. Aucun artefact réel produit par `supabase db dump` n'a été remis à la forge : la
forme exacte de son DDL n'est donc pas observée, et rien ne prouve qu'`importer` le lit comme
une sortie de `pg_dump --schema-only`. Extension possible, à ouvrir en item séparé, prouvée
par non-recouvrement (R-28), au premier run réel qui fournit un tel export : jouer
`scripts/importer.mjs` sur le fichier, mesurer ce qu'il lit et ce qu'il saute (politiques,
`ENABLE ROW LEVEL SECURITY`, objets des schémas gérés), puis décider entre la seule donnée de
ce profil et un ajout au parseur.

## 6. Extraire et recharger un extrait de données (verbe anonymiser, TF-2011)

Ajout du 29/10/2026, version 1.1.0. L'export `--data-only` du §4 ne sert pas au masquage : le CLI
le rend en instructions SQL, des `INSERT` par défaut ou des `COPY` avec `--use-copy` (« Use copy
statements in place of inserts »), jamais en un fichier par table. Pour le verbe `anonymiser`,
l'extrait se prend par la commande `\copy` de `postgres.md` §6, sur la chaîne de connexion du
projet. Le masquage, le jugement par l'oracle et le rechargement suivent ce même §6.

- **Connexion.** La page « Connect to your database » réserve la connexion directe aux
  « Migrations, `pg_dump`, backup and restore, or replication ». Cette connexion passe par IPv6,
  sauf module IPv4 ; le pooler partagé en mode session (port 5432) est l'alternative IPv4. Le mode
  transaction (port 6543) perd l'état de session entre transactions : il ne sert pas à extraire.
- **Schémas gérés.** `supabase db dump` ignore `auth`, `storage` et les schémas d'extensions
  (« The ignored schemas include auth, storage, and those created by extensions »). Une table du
  produit qui référence une table de ces schémas ne se recharge qu'avec la ligne référencée. Cette
  table entre alors dans l'extrait et dans la déclaration de masquage, colonne par colonne comme les
  autres, ou bien la référence se déclare `supprimer`.
- **Rechargement local.** `supabase start` expose la base locale sur
  `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (page « Getting started »). Les
  migrations y posent le schéma et ses contraintes : les tables se chargent donc dans
  l'`ordre_chargement` du rapport `anonymisation.json`.
- **Seed.** Les fichiers de seed s'exécutent « the first time you run `supabase start` and every
  time you run `supabase db reset` », après les migrations (page « Seeding your database »). Un
  extrait masqué versionné en `seed.sql` serait recopié à chaque clone du dépôt ; la forge le
  déconseille, l'avis WP216 (§2.2.2) tenant l'extrait pour personnel tant que la source existe. Il se
  recharge par la chaîne du produit, après le verdict de l'oracle.

La recette réelle `scripts/exercer-anonymiser-postgres.mjs --image postgres:17-alpine` exerce le
moteur PostgreSQL 17 que déclare le gabarit local (§1), jouée PASS le 29/10/2026 sur PostgreSQL
17.10. La plateforme elle-même (pooler, rôles, schémas gérés) reste non exercée.

## 7. Au-delà du moteur : pgvector, pg_cron, pooler, Realtime (TF-2008)

Ajout du 29/10/2026, version 1.2.0 (étude du pilot du 28/10/2026, lignes S3, S5 et S6). Quatre
briques qu'un projet Supabase ajoute au PostgreSQL de `postgres.md`, et ce que chacune change pour
les verbes de la forge. Aucune n'a été exercée sur une base. Mesuré le 29/10/2026 : les cinq images
PostgreSQL officielles du poste (15, 16, 16-alpine, 17, 17-alpine) ne portent aucun fichier
`vector`, `pg_cron` ou `pgtap` parmi leurs 45 à 61 extensions, et le CLI Supabase n'y était pas
installé.

**pgvector.** L'extension s'appelle `vector` et se crée dans le schéma `extensions` ; une colonne
s'écrit `embedding extensions.vector(384)`. Un index HNSW se pose par classe d'opérateurs
(`vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`) et n'indexe une colonne `vector` que
jusqu'à 2 000 dimensions (pgvector 0.7.0 et plus). Ce que cela change :

- `importer` : mesuré le 29/10/2026 sur `fixtures/schema-supabase-pgvector.sql`, le type
  `extensions.vector(384)` sort en `string`, avec l'avertissement « non reconnu ». L'index HNSW et
  la ligne `ENABLE ROW LEVEL SECURITY` ne produisent rien, sans avertissement. Le self-test rejoue
  cette mesure. Le jeu de types de `contrat@1` est fermé (six types, règle C2 de
  `oracle-contractualiser`) et n'a pas de vecteur : le brouillon se corrige à la main, la
  dimension dans la description de la propriété. Étendre `contrat@1` est une décision à part, au
  premier run qui en a besoin (R-28).
- `profiler` : une ligne sans embedding est invisible à la recherche par similarité. Si le
  produit exige que chaque ligne soit cherchable, l'assertion `non_nul` porte sur la colonne.
- `restituer` : un compte tiré d'une recherche vectorielle filtrée n'est pas le compte des lignes
  qui répondent au filtre. La page HNSW le dit : « you can end up with fewer rows than your
  LIMIT », et l'`iterative_scan` qui y remédie est à `off` par défaut.
- `anonymiser` : un embedding calculé sur un texte personnel porte l'information de ce texte. Il
  se déclare `texte_libre`, la classe que le verbe force à `supprimer` ou `remplacer`, et se
  recalcule chez le produit après le masquage.

**pg_cron (Supabase Cron).** « The extension creates a `cron` schema in your database and all
Jobs are stored on the `cron.job` table » ; chaque exécution s'inscrit dans
`cron.job_run_details`. Un job se crée par `select cron.schedule('nom', '30 seconds', 'CALL
f()')` ou depuis le tableau de bord, et désactiver l'extension « will permanently delete all
Jobs ». Ce que cela change pour `tracer` : un job qui écrit une table est une transformation. Le
§6 cite le dump, qui ignore « those created by extensions » ; le schéma `cron` en est un, donc ses
jobs manquent à un lineage tiré du seul schéma. Déduction tirée de ces 2 pages, non observée sur
un dump réel. Les jobs se lisent par `select jobname, schedule, command from cron.job`, et chacun se
déclare en `lineage@1` comme une transformation planifiée.

**Pooler (Supavisor) et connexions.** La page « Connect to your database » nomme le pooler partagé
Supavisor. En mode transaction (port 6543), il ne prend pas les instructions préparées, et l'état
de session tombe entre deux transactions : `set`, verrous consultatifs de session, `listen` et
`notify`, tables temporaires. Le pooler dédié (PgBouncer, offre Pro et plus) ne connaît que le
mode transaction ; il prend les instructions préparées à partir de PgBouncer 1.21. Ce que cela
change : un script d'extraction qui pose une table temporaire ou un `set` passe par la connexion
directe ou le mode session (§6). Un Worker qui lit par Hyperdrive prend la connexion directe :
voir l'écart `hyperdrive` du `LISEZMOI.md`.

**Realtime.** L'accès aux canaux Broadcast et Presence se règle par des politiques RLS sur
`realtime.messages`. La RLS y est déjà active : une migration qui ajoute `ALTER TABLE
realtime.messages ENABLE ROW LEVEL SECURITY` échoue sur `42501 must be owner of table messages`,
et la transaction s'arrête avec les `create policy` qui suivent. « Realtime does not store any
messages in your `realtime.messages` table » : il n'y a rien à profiler ni à extraire. Le schéma
`realtime` se traite comme `auth` et `storage` (§2), hors export par défaut. Les politiques de
canal ne se lisent pas par `importer` (§3).
