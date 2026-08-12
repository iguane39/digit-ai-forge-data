# Standards & Best Practices — sélection gouvernée (11/08/2026)

Liste **fermée** de sources primaires évaluées (méthode MODE-VEILLE du pilot : source
citée, **confiance 0-1**, verdict). Ce qui n'est pas retenu est écarté explicitement.

| Standard | Source primaire | Confiance | Verdict | Usage dans la forge |
|---|---|---|---|---|
| OpenLineage — object model | https://openlineage.io/docs/spec/object-model | 0.9 | **retenu (barre)** | niveau du verbe tracer : run · job · inputs · outputs · facets → T1-T5 |
| Great Expectations | https://github.com/great-expectations/great_expectations | 0.9 | **retenu (barre)** | niveau du verbe profiler : assertions déclaratives exécutables → P1-P3 |
| dbt — discipline ref/source, tests, docs générées | https://github.com/dbt-labs/dbt-core | 0.9 | **retenu (barre)** | niveau du verbe restituer : déclaré → généré → R1-R4 |
| Open Data Contract Standard (ODCS) v3.1.0 — Bitol / Linux Foundation | https://bitol-io.github.io/open-data-contract-standard/v3.1.0/ | 0.9 | **retenu (barre)** | niveau du verbe contractualiser : schéma + SLA + propriétaire + version → C1-C5 (transcription maison v0 sur 4 des 11 sections — pricing, infrastructure, rôles opérationnels hors v0) |
| Kimball — modélisation dimensionnelle (bus matrix, star schema) | https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/ | 0.8 | retenu (référence de modélisation) | vocabulaire des couches et du dimensionnel dans REX/playbooks — pas d'oracle |
| DAMA-DMBOK (gouvernance des données) | https://www.dama.org/cpages/body-of-knowledge | 0.6 | **écarté (v0)** | corpus encyclopédique payant, non inspectable en ligne — recouvre la gouvernance déjà portée par forge-audit |
| Data mesh (Z. Dehghani) | https://martinfowler.com/articles/data-monolith-to-mesh.html | 0.7 | **écarté (v0)** | paradigme d'organisation, pas une discipline de run — hors verbes ; réévaluable si un produit l'exige |

Règle d'admission (héritée de la veille pilot) : un standard n'entre que s'il sert un
verbe outillé ou un playbook, avec source primaire inspectable ; un standard écarté est
listé avec sa raison, jamais tu.
