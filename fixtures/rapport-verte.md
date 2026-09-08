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

## 2. Ce que R5 laisse passer, et pourquoi (TF-0378)

Le comité du 11 août 2026 a retenu 3 options — chiffre de séance, sans source de données :
il porte donc l'échappement explicite [c:-] et non un marqueur inventé.

Sont écartés par nature : la date 2026-08-11, le millésime 2026, la numérotation de ce
titre, l'unité 24px du gabarit et la version v1.4 du schéma. Aucun n'est un chiffre
restitué.

Les nombres de TABLEAU sont hors champ — générés, leur ancrage est porté par le chapeau du
chapitre :

| Périmètre | Commandes | Part |
|---|---|---|
| FR | 769 | 62 % |
| Autres | 471 | 38 % |

## Vocabulaire de restitution (R8 — la fixture verte prouve les DEUX usages légitimes)

La granularité de chaque fait est dite en toutes lettres, comme le destinataire la lit. Le
champ machine `grain` du format `forge-data/modele-dimensionnel@1` reste écrit tel quel dans
les schémas — cité ici en span de code, il n'est pas un mot de restitution et R8 ne le compte
pas : c'est exactement la frontière entre les deux registres.
