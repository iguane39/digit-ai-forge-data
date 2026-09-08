---
role: rapport de mapping restituant sa couverture mesurée (fixture R7, TF-0911)
lineage_ref: lineage-verte.json
couverture_ref: couverture-verte.json
chiffres:
  - id: taux-couverture
    valeur: "100 %"
    source: oracle-couvrir sur couverture-verte.json (14 objets retenus sur 14)
    date: 2026-09-08
  - id: exclusions
    valeur: "1"
    source: couverture-verte.json, règles de rattachement de type exclusion
    date: 2026-09-08
---

# Couverture du mapping — restituée depuis sa mesure

Le mapping couvre [c:taux-couverture] des objets retenus de l'inventaire de la source, avec
[c:exclusions] exclusion motivée. La mesure elle-même est déclarée à côté de ce rapport et
jugée par l'oracle de couverture ; ce rapport ne la recopie pas, il la pointe.
