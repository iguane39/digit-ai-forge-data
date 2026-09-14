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

> Section proposée par la campagne « catalogues » du pilot (2026-08-13) — générée depuis
> la source unique `catalogues/catalogue.jsonl` du pilot (v1.6.0, challengée état de
> l'art le 12/08/2026). **prouvé** = preuve exécutée ; *déclaré* = méthode documentée seulement.

| Service | Intention (« je veux… ») | Point d'entrée | Statut |
|---|---|---|---|
| **Profiler (qualité en assertions)** | exprimer et vérifier la qualité de mes données en assertions exécutables | `node oracles\oracle-profiler.mjs <assertions.json>` | prouvé (experimental) |
| **Tracer (lineage exigible)** | déclarer et vérifier le lineage complet de mes données | `node oracles\oracle-tracer.mjs <lineage.json>` | prouvé (experimental) |
| **Restituer (chiffres sourcés)** | garantir que tout chiffre restitué est ancré à sa source — **y compris les nombres écrits en prose** (R5, TF-0378) | `node oracles\oracle-restituer.mjs <rapport.md> [--strict]` | prouvé (experimental) |
| **Fonds de savoir data** | réutiliser les patterns éprouvés de rétro-ingénierie et de lineage | `references\ du dépôt data (lecture)` | déclaré (experimental) |
| **Contractualiser (data contract)** | sceller l'accord producteur↔consommateur en contrat vérifiable machine | `node oracles\oracle-contractualiser.mjs <contrat.json>` | prouvé (experimental) |
| **Importer un schéma exporté** | dériver un brouillon d'assertions et de contrat depuis le schéma exporté de ma base | `node scripts\importer.mjs <schema.sql>` | prouvé (experimental) |
| **Traduire un lineage Unity Catalog** | convertir le lineage colonne natif de Databricks en lineage exigible par la forge | `node scripts	raduire-unity-catalog.mjs <export.json>` | prouvé (experimental) |

Le catalogue consolidé des dix forges vit chez le pilot :
[digit-ai-factory/catalogues/CATALOGUES.md](https://github.com/iguane39/digit-ai-factory/blob/main/catalogues/CATALOGUES.md).

## Quick start

```bash
node oracles/oracle-profiler.mjs fixtures/assertions-verte.json
node oracles/oracle-tracer.mjs fixtures/lineage-verte.json
node oracles/oracle-restituer.mjs fixtures/rapport-verte.md
node oracles/oracle-contractualiser.mjs fixtures/contrat-verte.json
node oracles/oracle-modeliser.mjs fixtures/modele-dimensionnel-verte.json      # M1-M6, couche Gold déclarée (TF-0860)
node oracles/oracle-transformer.mjs fixtures/transformation-verte             # TR1-TR6, artefacts de l'outil de transformation (TF-0861)
node oracles/oracle-reconcilier.mjs fixtures/reconciliation-verte.json        # RC1-RC6, Gold ↔ modèle sémantique (TF-0864)
node oracles/oracle-couvrir.mjs fixtures/couverture-verte.json                # CV1-CV6, mapping mesuré contre l'inventaire de sa source (TF-0911)
node oracles/oracle-rapprocher.mjs fixtures/rapprochement-verte.json          # RP1-RP7, modèle rapproché d'un extrait du rapport client (TF-0975)
node scripts/importer.mjs fixtures/schema-postgres-verte.sql --sortie-dir <dossier>
node scripts/importer.mjs fixtures/schema-databricks-verte.sql --sortie-dir <dossier>   # dialecte Databricks (SHOW CREATE TABLE), TF-0858
node scripts/traduire-unity-catalog.mjs fixtures/unity-catalog-verte.json --sortie <fichier.json>
node scripts/traduire-unity-catalog.mjs fixtures/unity-catalog-api-verte.json --sortie <fichier.json>  # voie API lineage-tracking, grain table (TF-0893)
node scripts/traduire-modele-semantique.mjs --modele fixtures/modele-semantique-verte \
     --complement fixtures/complement-modele-verte.json --sortie <fichier.json>   # TMDL Power BI → modele-dimensionnel@1 (TF-0894)
node scripts/isoler-contexte-extrait.mjs fixtures/contexte-extrait-verte.csv --sortie <fichier.json>  # pied « Filtres appliqués », totaux, ligne vide (TF-0976)
node oracles/self-test.mjs   # double sens : vertes PASS, rouges FAIL localisants + round-trips importer/traducteur
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
