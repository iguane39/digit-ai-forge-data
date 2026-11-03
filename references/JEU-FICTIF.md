# Le jeu de données fictif — définition opposable et contrôle avant remise (TF-2085, RT-40)

Pour qui : le producteur d'un jeu de démonstration ou de qualification, et la session qui le
recette. Ce qui change : un jeu dit « fictif » se juge désormais avant d'être remis, contre une
définition écrite, par `oracles/oracle-jeu-fictif.mjs`.

## Le fait

Un jeu fictif a été livré en deux coquilles vides : des chantiers, et ni lot, ni budget, ni
facture. Le porteur l'a rejeté : « un jeu fictif qui n'a rien n'est pas un jeu fictif ». Aucune
définition n'existait, donc aucun contrôle ne pouvait la refuser.

## La définition

`references/definition-jeu-fictif.json` (format `forge-data/definition-jeu-fictif@1`, version 1.0.0,
datée du 03/11/2026, sourcée sur le retour RT-40) est la donnée de référence : l'oracle y lit ses
planchers, et un produit les relève sans jamais les abaisser. Un jeu fictif tient trois promesses.

1. **Chaque écran du produit est alimenté.** Pour chaque type d'enregistrement qu'un écran lit, avec
   son filtre, le jeu porte au moins une ligne. Un écran qui s'ouvre sur un état vide n'est pas
   alimenté (JF3).
2. **Chaque type d'enregistrement du produit est présent.** Un lot, un budget et une facture qui
   n'existent pas dans le jeu sont des types absents, quel que soit le nombre de chantiers (JF4).
3. **Chaque enregistrement qui progresse raconte son parcours.** Il porte une étape par stade franchi,
   dans l'ordre du cycle, sans trou, aux dates croissantes (JF5). Chaque stade du cycle est occupé
   par au moins un enregistrement. Les enregistrements liés se tiennent : chaque clé résout à un
   parent, la somme des factures d'un lot ne dépasse pas son budget, une facture ne précède pas le
   démarrage de son lot (JF6).

Deux règles referment la boucle : les totaux que le générateur déclare se recalculent sur le contenu
du jeu (JF7), et les totaux lus sur les écrans égalent ceux que le générateur déclare (JF8). C'est
JF8 qui voit « 0 lot affiché pour 5 déclarés ».

| Règle | Ce qu'elle refuse |
|---|---|
| JF1 | une déclaration incomplète : pas de produit, de générateur, de jeu, ou une exclusion qui pointe dans le vide |
| JF2 | une surface de produit relevée par personne, un jour inconnu, sur rien ; une origine autre que synthétique |
| JF3 | un écran dont les types lus n'ont pas assez de lignes |
| JF4 | un type d'enregistrement absent, un identifiant vide ou en double, un plancher abaissé |
| JF5 | un trou ou un désordre dans les étapes d'un enregistrement, un stade du cycle que personne n'occupe |
| JF6 | une référence orpheline, un total enfant au-dessus de la borne du parent, une date du mauvais côté de celle du parent |
| JF7 | un total que le générateur annonce et que le contenu ne porte pas |
| JF8 | un écran qui affiche un total différent de celui que le générateur déclare |

## La porte de sortie : l'exclusion motivée

Ce que le jeu n'a pas, il le déclare dans `exclusions`, avec une portée (`ecran:<id>`, `type:<id>`
ou `stade:<type>.<stade>`) et un motif d'au moins quatre mots. Sans motif, l'exclusion ne s'applique
pas. Une exclusion qui retire ce que le jeu porte déjà est avertie. Le remède que les messages
proposent (peupler ou exclure) est joué au self-test : les deux font repasser le jeu.

## Mode d'emploi

1. **Relever** la surface du produit lui-même, avant de générer : types d'enregistrement, écrans et
   les types qu'ils lisent, cycles de vie, liens montant et date entre types. Consigner qui, quand,
   sur quoi (`releve`).
2. **Générer** le jeu, en déclarant les totaux produits (`generateur.totaux`) et l'origine
   `synthetique`.
3. **Charger** le jeu dans le produit, **ouvrir chaque écran** et consigner les totaux qu'il affiche
   (`affichage`). Sans cette lecture, l'oracle passe mais le dit : l'affichage n'est pas jugé.
4. **Juger** : `node oracles/oracle-jeu-fictif.mjs <jeu-fictif.json>`. Exit 0 PASS, 1 FAIL, 2 SKIP
   (cible ou définition introuvable).

Format de la déclaration, `forge-data/jeu-fictif@1` : voir l'en-tête de l'oracle ; exemples = les
fixtures `fixtures/jeu-fictif-verte.json` (PASS), `fixtures/jeu-fictif-coquille-rouge.json` (le
défaut rejeté) et `fixtures/jeu-fictif-histoire-rouge.json` (jeu plein, histoire fausse).

## Ce que l'oracle ne juge pas

La liste des écrans et des types vient du relevé : un écran absent du relevé n'est jamais vu. La
vraisemblance métier, l'origine réellement synthétique, le rendu réel des écrans et les cas limites
restent hors de son champ. Ils sont dits au `non_juge` de chaque sortie.

## Ce que forge-tests doit appeler

forge-tests possède la couverture de test d'un produit ; cette forge ne réécrit pas la sienne.
Deux appels, à brancher chez forge-tests :

- **Avant de remettre un jeu fictif** (ou de lancer une recette qui en dépend), jouer
  `node oracles/oracle-jeu-fictif.mjs <jeu-fictif.json> --json-only` et prendre son verdict comme
  une porte : FAIL bloque la remise.
- **Fournir le relevé** que l'oracle ne peut pas faire : la liste des routes et des écrans du
  produit, rapprochée de `produit.ecrans`. Un écran du produit absent de la déclaration est le
  défaut que JF3 ne peut pas voir ; sa détection relève de l'audit de couverture de forge-tests.

Rien de cela n'est branché par cette forge : c'est une décision de câblage de forge-tests.

## Barre

Aucune norme externe n'est retenue à ce jour : la barre est le rejet du porteur (RT-40), mesuré par
les deux rouges. Une référence externe pour la donnée de test synthétique reste à qualifier ; elle
entrerait à `references/STANDARDS-DATA.md` par la règle d'admission de cette forge (source primaire
inspectable).
