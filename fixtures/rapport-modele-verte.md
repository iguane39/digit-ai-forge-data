---
role: rapport de modélisation qui porte les décisions ayant façonné son modèle (fixture R9, TF-1170)
lineage_ref: lineage-verte.json
modele_ref: modele-dimensionnel-verte.json
chiffres:
  - id: faits
    valeur: "2"
    source: modele-dimensionnel-verte.json, bloc faits
    date: 2026-09-17
  - id: dimensions
    valeur: "4"
    source: modele-dimensionnel-verte.json, bloc dimensions
    date: 2026-09-17
---

# Modèle de la couche Gold — et les choix qui l'ont façonné

Le modèle sert [c:faits] processus métier distincts par [c:dimensions] dimensions conformes.

## Choix d'architecture et décisions qui les fondent

Un fait par processus servi, jamais un fait unique : c'est la décision D-3 [c:-], tranchée par le
commanditaire le 2026-09-07. Le lecteur qui compte les tables de faits trouve donc ici le choix
qui les a créées, au lieu de le redécouvrir comme un défaut.

Les retours restent séparés des ventes : décision D-22 [c:-] du commanditaire, le 2026-09-09 —
mélanger les deux fausserait le chiffre d'affaires livré.
