---
role: rapport mensuel synthétique (fixture)
lineage_ref: lineage-verte.json
chiffres:
  - id: total-ventes
    valeur: "1 240"
    source: servi.ventes_mensuelles
    date: 2026-08-11
  - id: taux-fr
    valeur: "62 %"
    source: servi.ventes_mensuelles
    date: 2026-08-11
---

# Rapport des ventes — mensuel (synthétique)

Le total des commandes du mois s'établit à [c:total-ventes] unités, dont
[c:taux-fr] réalisées sur le périmètre FR.

## Méthode (RD-1 — la fixture verte prouve que décrire la convention ne casse rien)

Chaque nombre de ce rapport porte son marqueur `[c:id]`, déclaré au frontmatter — un
marqueur cité en span de code, comme ici, n'est pas une citation de chiffre. La forme
échappée [[c:exemple-jamais-declare]] reste affichable sans être comptée.

```
Exemple en bloc de code : [c:autre-id-jamais-declare] — ignoré aussi.
```
