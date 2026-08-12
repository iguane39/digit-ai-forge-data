# digit-ai-forge-data

Forge **discipline de la donnée** de l'écosystème Digit-AI — quatre verbes jugés par
oracle : **profiler** (qualité en assertions exécutables), **tracer** (lineage déclaré,
niveau OpenLineage, grain colonne optionnel), **restituer** (chiffres ancrés, doctrine
déclaré→généré), **contractualiser** (data contract inspectable, niveau ODCS v3.1). Elle
vérifie la **forme de la discipline** ; le profiling lui-même est composé
(`data-quality-auditor`), jamais réécrit. Un cinquième verbe, **importer** (TF-0139), est
un **générateur** (pas un oracle) : il dérive un brouillon d'assertions@1/contrat@1 depuis
un schéma exporté (DDL Postgres en v0).

## Catalogue de services

> Section proposée par la campagne « catalogues » du pilot (2026-08-12) — générée depuis
> la source unique `catalogues/catalogue.jsonl` du pilot (v1.4.0, challengée état de
> l'art le 12/08/2026). **prouvé** = preuve exécutée ; *déclaré* = méthode documentée seulement.

| Service | Intention (« je veux… ») | Point d'entrée | Statut |
|---|---|---|---|
| **Profiler (qualité en assertions)** | exprimer et vérifier la qualité de mes données en assertions exécutables | `node oracles\oracle-profiler.mjs <assertions.json>` | prouvé (experimental) |
| **Tracer (lineage exigible)** | déclarer et vérifier le lineage complet de mes données | `node oracles\oracle-tracer.mjs <lineage.json>` | prouvé (experimental) |
| **Restituer (chiffres sourcés)** | garantir que tout chiffre restitué est ancré à sa source | `node oracles\oracle-restituer.mjs <rapport.md>` | prouvé (experimental) |
| **Fonds de savoir data** | réutiliser les patterns éprouvés de rétro-ingénierie et de lineage | `references\ du dépôt data (lecture)` | déclaré (experimental) |
| **Contractualiser (data contract)** | sceller l'accord producteur↔consommateur en contrat vérifiable machine | `node oracles\oracle-contractualiser.mjs <contrat.json>` | prouvé (experimental) |
| **Importer (brouillon depuis un schéma exporté)** | dériver un brouillon d'assertions/contrat depuis un DDL déjà exporté (jamais de connexion) | `node scripts\importer.mjs <schema.sql>` | prouvé (experimental, dialecte Postgres v0) |

Le catalogue consolidé des dix forges vit chez le pilot :
[digit-ai-forge-pilot/catalogues/CATALOGUES.md](https://github.com/iguane39/digit-ai-forge-pilot/blob/main/catalogues/CATALOGUES.md).

## Quick start

```bash
node oracles/oracle-profiler.mjs fixtures/assertions-verte.json
node oracles/oracle-tracer.mjs fixtures/lineage-verte.json
node oracles/oracle-restituer.mjs fixtures/rapport-verte.md
node oracles/oracle-contractualiser.mjs fixtures/contrat-verte.json
node scripts/importer.mjs fixtures/schema-postgres-verte.sql --sortie-dir <dossier>
node oracles/self-test.mjs   # double sens : vertes PASS, rouges FAIL localisants + round-trip importer
```

## Références

- `references/REX-DATA.md` — patterns de rétro-ingénierie et de lineage issus d'un
  chantier réel, anonymisés, avec portée (générique / contingente).
- `references/STANDARDS-DATA.md` — standards retenus/écartés, sources primaires, confiance.
- `references/profils-moteur/` — référentiels versionnés par moteur de base de données
  (Postgres, Oracle, Azure SQL, Databricks) : dialecte de contraintes, mapping de types,
  vues catalogue, commande d'export — alimentent le verbe `importer` (voir `LISEZMOI.md`).
- Barres de niveau (registre la-barre) : OpenLineage · Great Expectations · dbt-core · ODCS v3.1.0.

## Prérequis

Node.js ≥ 18. Aucune dépendance externe. Fixtures synthétiques uniquement.
