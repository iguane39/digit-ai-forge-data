---
moteur: supabase
version: 1.0.0
challenge_date: 2026-10-16
herite_de: postgres.md
sources:
  - "Supabase CLI reference (supabase db dump --linked, -f, -s, --data-only) — supabase.com/docs/reference/cli/introduction, lu le 16/10/2026"
  - "Row Level Security (rôles anon, authenticated, service_role) — supabase.com/docs/guides/database/postgres/row-level-security, lu le 16/10/2026"
  - "Storage access control (politiques RLS sur storage.objects) — supabase.com/docs/guides/storage/security/access-control, lu le 16/10/2026"
  - "Gabarit config.toml du CLI ([api] schemas, [db] major_version = 17) — github.com/supabase/cli, branche develop, apps/cli-go/pkg/config/templates/config.toml, lu le 16/10/2026"
  - "profil-moteur PostgreSQL de ce dossier — postgres.md 1.0.0 (challenge_date 2026-08-12)"
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
