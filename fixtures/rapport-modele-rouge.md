---
role: rapport qui pointe son modèle mais laisse une décision au seul ledger (fixture R9, TF-1170)
lineage_ref: lineage-verte.json
modele_ref: modele-dimensionnel-verte.json
chiffres:
  - id: faits
    valeur: "2"
    source: modele-dimensionnel-verte.json, bloc faits
    date: 2026-09-17
---

# Modèle de la couche Gold — décrit, jamais motivé

Le modèle sert [c:faits] processus métier distincts.

## Choix d'architecture

Un fait par processus servi : décision D-3 du commanditaire. La séparation des retours et des
ventes, elle, n'est motivée nulle part dans ce rapport — c'est la forme exacte du livrable dont
le commanditaire a dénoncé comme un défaut sa propre décision, neuf jours après l'avoir prise.
