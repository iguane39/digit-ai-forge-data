# digit-ai-forge-data

Forge **discipline de la donnée** de l'écosystème Digit-AI — trois verbes : **profiler**
(qualité en assertions exécutables), **tracer** (lineage déclaré, niveau OpenLineage),
**restituer** (chiffres ancrés, doctrine déclaré→généré). Elle vérifie la **forme de la
discipline** ; le profiling lui-même est composé (`data-quality-auditor`), jamais réécrit.

## Catalogue de services

> Section proposée par la campagne « catalogues » du pilot (2026-08-12) — générée depuis
> la source unique `catalogues/catalogue.jsonl` du pilot (v1.0.0, challengée état de
> l'art le 12/08/2026). **prouvé** = preuve exécutée ; *déclaré* = méthode documentée seulement.

| Service | Intention (« je veux… ») | Point d'entrée | Statut |
|---|---|---|---|
| **Profiler (qualité en assertions)** | exprimer et vérifier la qualité de mes données en assertions exécutables | `node oracles\oracle-profiler.mjs <assertions.json>` | prouvé (experimental) |
| **Tracer (lineage exigible)** | déclarer et vérifier le lineage complet de mes données | `node oracles\oracle-tracer.mjs <lineage.json>` | prouvé (experimental) |
| **Restituer (chiffres sourcés)** | garantir que tout chiffre restitué est ancré à sa source | `node oracles\oracle-restituer.mjs <rapport.md>` | prouvé (experimental) |
| **Fonds de savoir data** | réutiliser les patterns éprouvés de rétro-ingénierie et de lineage | `references\ du dépôt data (lecture)` | déclaré (experimental) |

Le catalogue consolidé des dix forges vit chez le pilot :
[digit-ai-forge-pilot/catalogues/CATALOGUES.md](https://github.com/iguane39/digit-ai-forge-pilot/blob/main/catalogues/CATALOGUES.md).

## Quick start

```bash
node oracles/oracle-profiler.mjs fixtures/assertions-verte.json
node oracles/oracle-tracer.mjs fixtures/lineage-verte.json
node oracles/oracle-restituer.mjs fixtures/rapport-verte.md
node oracles/self-test.mjs   # double sens : vertes PASS, rouges FAIL localisants
```

## Références

- `references/REX-DATA.md` — patterns de rétro-ingénierie et de lineage issus d'un
  chantier réel, anonymisés, avec portée (générique / contingente).
- `references/STANDARDS-DATA.md` — standards retenus/écartés, sources primaires, confiance.
- Barres de niveau (registre la-barre) : OpenLineage · Great Expectations · dbt-core.

## Prérequis

Node.js ≥ 18. Aucune dépendance externe. Fixtures synthétiques uniquement.
