# Migrer un rapport Power BI vers un nouveau modèle — procédure de la forge

**Statut** : référence de `digit-ai-forge-data`, née de TF-1179 (retour Produit-62 RF-24, 17/09/2026).
**Portée** : générique — un rapport de restitution existant doit servir un nouveau modèle de données,
sans que le lecteur perde ce qu'il voyait. Instanciée ici sur Power BI (PBIP/PBIR + TMDL) ; les
étapes et leurs contrôles valent pour tout outil qui sépare le modèle sémantique de la mise en page.
**Provenance des chiffres** : tous les nombres de ce document sont **rapportés** par le lot de retours
`Produit-62 - RETOURS - 20260917d` (RF-20 à RF-25) et par le ledger du chantier 15→17/09/2026 ; ils
ne sont pas remesurés ici. Aucun nom d'engagement, aucune donnée client.

## Pourquoi cette procédure existe

Trois jours de chantier, **3 défauts vus par l'humain avant tout oracle** : un rapport qui ne rend
rien pendant 2 jours sous 29 contrôles PASS, un périmètre pris au modèle (342 colonnes servies pour
66 lues), une mise en page réinventée pendant 2 jours sous 23 contrôles PASS. Avant la cause,
**3 fausses pistes mesurées** : le coût d'un croisement de 12 entités, la capacité de l'espace de
travail, le nombre de tables de faits. **6 exports de 9 minutes**, **5 projets publiés ou branchés**,
**4 lots de retours** avant que la procédure existe.

Chaque étape a fini par avoir son geste et son contrôle — mais après. Une chaîne de travail dont
les étapes ne sont écrites nulle part se réinvente à chaque produit, et se réinvente d'abord fausse.
C'est la classe de défaut `chaine-declaree-etapes-non-ecrites`, et c'est celle que ce document ferme.

La déclaration machine de cette procédure vit à côté : `references/migration-rapport-powerbi.chaine.json`,
jugée par `node oracles/oracle-enchainer.mjs` — chaque étape ci-dessous y nomme un porteur qui
existe, et le contrôle refuse une étape dont le porteur n'existe pas.

## Les onze étapes, et le contrôle qui juge chacune

| # | Étape | Entrée | Sortie | Le contrôle qui la juge |
|---|---|---|---|---|
| **E1** | Relever ce que les visuels affichent | le fichier d'origine (mise en page + modèle) | `mise-en-page@1` et `usage-restitution@1` | `scripts/traduire-modele-semantique.mjs --usage-restitution` — trois populations (affichée, lue par mesure, jamais lue), champs inconnus nommés |
| **E2** | Délimiter le périmètre | E1 + l'inventaire du modèle cible | `perimetre@1` | `oracles/oracle-delimiter.mjs` — DL1-DL6 : l'excédent non motivé bloque (TF-1180) |
| **E3** | Concevoir le modèle cible | le périmètre de E2 | `modele-dimensionnel@1` | `oracles/oracle-modeliser.mjs` — M1-M7, dont M7 : les décisions d'architecture portées par le livrable |
| **E4** | Transposer la mise en page d'origine | le fichier d'origine + le modèle de E3 | `reconstruction@1` | `oracles/oracle-reconstruire.mjs` — RS1-RS6 : pages, visuels, géométrie au pixel, ressources ; une mise en page générée est un repli motivé |
| **E5** | Recetter les liaisons | le rapport construit + l'inventaire du modèle | `rendu@1` | `oracles/oracle-rendre.mjs` — RN1-RN4 : toute projection résout, aucun visuel vide |
| **E6** | Publier, puis reposer les identifiants de source | le rapport recetté | le rapport publié, identifiants reposés | geste humain (R-38 : publier est une décision humaine), consigné en `gestes_de_verification` — `oracle-rendre` RN5 |
| **E7** | Prouver le rendu par l'export téléchargé et LU | le rapport publié | le verdict de rendu (durée, octets, texte extrait) | geste humain, consigné et daté — `oracle-rendre` RN5 |
| **E8** | Réconcilier les chiffres | les mesures du modèle et celles de la couche amont | `reconciliation@1` | `oracles/oracle-reconcilier.mjs` — RC1-RC6, sous tolérance déclarée |
| **E9** | Diagnostiquer par banc et bissection | un symptôme de rendu | la cause nommée, ou l'hypothèse écartée avec sa mesure | geste humain, consigné — `oracle-rendre` RN5 |
| **E11** | Qualifier la bascule | E1 à E9, dimension par dimension | `qualification-rapport@1` : six dimensions, leur angle mort, un verdict de remplacement | `oracles/oracle-qualifier.mjs` — QR1-QR6 : le verdict se compose des dimensions, il ne se pose pas au-dessus (TF-1186) |
| **E10** | Restituer | tout ce qui précède, verdict de bascule compris | le rapport remis au commanditaire | `oracles/oracle-restituer.mjs` — R1-R5, R7, R9 |

L'ordre n'est pas décoratif. **E1 et E2 précèdent E3** : le périmètre relevé après la conception est
le périmètre du modèle, c'est-à-dire tout ce qui existe. **E7 suit E6 et ne se déduit pas de E5** :
un contrôle qui lit le fichier prouve la forme du fichier, jamais ce que le lecteur voit. **E11
précède E10** : la restitution rapporte un verdict de bascule, elle ne le fabrique pas en chemin.

La question du commanditaire — puis-je remplacer l'ancien par le nouveau — est celle que E11 tranche,
et elle n'avait ni format, ni contrat, ni juge tant que la chaîne s'arrêtait à la réconciliation.
Cinq mesures dispersées ne composent rien : 22 contrôles de recette PASS et 7 d'audit verts ont
coexisté avec un rapport qui n'affichait rien. E11 exige donc que chaque dimension dise à quoi elle
tient, qu'elle écrive son **angle mort**, et que le verdict de bascule — remplaçable / remplaçable
sous conditions énumérées / non remplaçable — se déduise des six. Conséquence assumée : tant que la
dimension « interactions » reste non jugeable par construction, « remplaçable » tout court est
inatteignable, et le meilleur verdict possible nomme les gestes qu'un humain doit jouer côte à côte.

## Les quatorze règles

**Ce que le mandat fournit ne se réinvente pas**

1. **R1 — le rendu se prouve par l'export téléchargé et lu.** Publier, exporter la page depuis le
   service, lire l'IMAGE du fichier exporté, verdict : durée sous borne, octets au-dessus du
   plancher, texte extrait non vide par page, aucun libellé d'erreur du service. Un statut
   `Succeeded` n'est pas une preuve : les exports mesurés rendaient `Succeeded` en 557 à 569 s pour
   943 à 1 415 octets et **zéro caractère**.
2. **R11 — la mise en page fournie en entrée est conservée et transposée.** Pages, dimensions,
   visuels, géométrie, fonds, signets, boutons, largeurs de colonnes. Une mise en page générée est
   un **repli** déclaré avec son motif, jamais un défaut par omission.
3. **R12 — transposer, c'est ne changer que les liaisons.** Tout le reste du fichier d'origine est
   recopié. Le jour où l'on redessine, on a quitté la transposition sans l'avoir décidé.
4. **R13 — la donnée et le dessin sont deux choses.** Le modèle porte la donnée, la mise en page
   porte le dessin ; un changement de modèle ne justifie aucun changement de dessin.
5. **R14 — les ressources se portent sous des noms courts, et référencées.** Une ressource copiée
   que rien ne référence est un fond que le lecteur ne verra jamais (RS6).

**Le périmètre**

6. **R7 — le périmètre se relève sur les visuels du fichier d'origine**, avant toute conception.
7. **R8 — le modèle publié est limité à ce qui est lu.** 342 colonnes servies pour 66 lues, et
   3 tables qu'aucun visuel ni aucune mesure ne lit publiées pendant un jour : personne ne l'avait
   demandé. Ce qui n'est pas lu reste dans la couche de données, pas dans le modèle publié.
8. **R10 — les mesures vivent dans une table dédiée**, pas dispersées dans les tables de faits.

**La forme, et ce qu'elle ne prouve pas**

9. **R2 — la forme native des expressions du rapport se respecte à la lettre.** La référence de
   source des expressions PBIR s'écrit `{Entity, Name}` ; une forme voisine publie sans erreur et
   ne rend rien. C'est la cause des deux jours de rapport vide.
10. **R4 — les littéraux sont typés.** Un littéral non typé passe la publication et casse au rendu.
11. **R5 — les identifiants de source se reposent après `updateDefinition`.** L'appel remplace la
    définition et perd les identifiants : sans repose, le rapport publié pointe l'ancienne source.
12. **R9 — la résolution des champs et la reprise des en-têtes sont nécessaires, jamais
    suffisantes.** « En-têtes repris au caractère près, 70/70 » a rendu PASS sur des en-têtes que
    personne ne voyait.
13. **R3 — une table par visuel de détail, des mesures pour l'agrégé.** Un visuel de détail lit une
    table à plat ; un visuel agrégé lit des mesures. Mélanger les deux rend le coût imprévisible.

**La méthode**

14. **R6 — le banc avant l'accusation.** Avant d'incriminer la capacité de l'espace de travail, le
    coût d'un croisement ou le nombre de tables de faits, on bissecte le rapport jusqu'au plus petit
    cas qui reproduit le symptôme. Les trois fausses pistes du chantier ont toutes été des
    accusations portées sans banc.

## Arbre de diagnostic — du symptôme à la cause

| Symptôme observé | Cause à chercher d'abord | Ce qui l'aurait pris |
|---|---|---|
| « Chargement de votre rapport… » sans fin | forme de la référence de source dans les expressions (R2) | E5, puis E7 |
| Export `Succeeded`, PDF de quelques centaines d'octets, zéro caractère | idem — le service exporte une page vide sans se plaindre | E7 (R1) |
| Un visuel vide au milieu d'une page correcte | une projection qui ne résout à aucun objet du modèle | E5 (RN2/RN3) |
| Une page entière vide | un visuel porteur de données sans projection affichée, ou `active: false` | E5 (RN4) |
| Le rapport rend, mais le lecteur ne le reconnaît pas | mise en page générée au lieu d'être transposée (R11/R12) | E4 (RS3/RS4) |
| Un fond, un bouton ou un signet disparu | objet écarté sans motif, ou ressource non référencée (R14) | E4 (RS5/RS6) |
| Le rapport publié affiche les données d'avant | identifiants de source non reposés après `updateDefinition` (R5) | E6 |
| Le modèle est lourd à actualiser et personne ne sait pourquoi | périmètre pris au modèle et non aux visuels (R7/R8) | E2 (DL4) |
| Les chiffres ne correspondent pas à ceux du commanditaire | mesures redéfinies, ou extrait de référence filtré sans que ce soit dit | E8 (RC), et `scripts/isoler-lignes-non-donnees.mjs` |

Un symptôme dont la cause n'est pas dans cette table se traite par E9 : banc, bissection, et la
cause écrite — jamais une quatrième hypothèse plausible substituée à une mesure.

## Ce que chaque contrôle prouve, et ce qu'il ne prouve pas

| Contrôle | Prouve | Ne prouve PAS |
|---|---|---|
| `oracle-delimiter` (DL) | que le modèle publié ne porte que ce que les visuels lisent | que le relevé d'usage est complet — un visuel oublié au relevé fausse les deux sens |
| `oracle-modeliser` (M) | que le modèle est bien formé et porte ses décisions | que le modèle correspond au besoin |
| `oracle-reconstruire` (RS) | que la mise en page d'origine est conservée au pixel près, plan compris, et que chaque en-tête affiché est repris autant de FOIS qu'à l'origine (RS7) | que le rapport rend |
| `oracle-rendre` (RN1-RN4) | que toute projection résout et qu'aucun visuel n'est vide | **que le lecteur voit quelque chose** — c'est RN5, et c'est un geste |
| `oracle-rendre` (RN5) | que le geste de vérification du rendu a été joué, daté, résulté | rien d'autre : il enregistre, il ne rend pas le verdict à la place de l'humain |
| `oracle-rendre` (RN6) | que la mesure de l'export tient ses bornes : fichier téléchargé, durée, octets, texte par page, libellés d'erreur cherchés et trouvés | que le geste a été joué sur la bonne version — c'est la date de RN5 qui le dit ; et l'oracle ne JOUE aucun export, il confronte des nombres rapportés |
| `oracle-reconcilier` (RC) | que deux lots de mesures concordent sous tolérance déclarée | que les deux lots portent sur le même périmètre filtré |
| `oracle-restituer` (R) | que les chiffres du rapport sont ancrés et les décisions citées | que les chiffres sont justes |
| `oracle-enchainer` (CH) | que chaque étape de cette procédure nomme un porteur qui existe | que la procédure a été suivie — un contrôle ne remplace pas un geste |
| `oracle-qualifier` (QR) | que les six dimensions sont qualifiées, que chacune écrit son angle mort, et que le verdict de bascule se déduit d'elles | que ce que chaque dimension affirme est VRAI aujourd'hui : il vérifie qu'un porteur existe et porte la règle citée, jamais que ce porteur rendrait le même verdict maintenant |

## Ce qui reste hors de cette forge

La construction du rapport (générateur, transposeur, publication) appartient au produit et à
forge-development ; le jugement du modèle sémantique aval à forge-audit ; la publication elle-même
est une décision humaine (R-38). Cette procédure dit l'ordre, les sorties et les contrôles — elle
n'exécute rien.
