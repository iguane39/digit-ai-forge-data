# digit-ai-forge-data

Forge **discipline de la donnée** de l'écosystème Digit-AI — trois verbes : **profiler**
(qualité en assertions exécutables), **tracer** (lineage déclaré, niveau OpenLineage),
**restituer** (chiffres ancrés, doctrine déclaré→généré). Elle vérifie la **forme de la
discipline** ; le profiling lui-même est composé (`data-quality-auditor`), jamais réécrit.

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
