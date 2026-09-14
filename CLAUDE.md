# digit-ai-forge-data — discipline de la donnée (profiler · tracer · restituer · contractualiser)

Forge **transverse** née de TF-0083 (révision tracée de l'écartement du 08/08, sur preuve
REX réelle). Elle outille la **discipline data des runs** : la qualité s'exprime en
assertions exécutables, toute donnée servie déclare son lineage, tout chiffre restitué
porte sa source et sa fraîcheur.

## Frontières (non négociables)

- **Composition, jamais duplication.** Le profiling de datasets appartient au skill
  `data-quality-auditor` (appelé, pas réécrit) ; la police des montants dans les documents
  commerciaux appartient à `oracle-claims` (quality-oracles) ; la couverture de test du pan
  data d'un produit appartient à forge-tests ; la gouvernance d'architecture à forge-audit.
  forge-data vérifie la **forme de la discipline**, pas le contenu des données.
- **Jamais de données client.** Fixtures synthétiques uniquement ; le REX
  (`references\REX-DATA.md`) est anonymisé et généralisé — zéro nom d'engagement.
- Invocation par le pilot dans les runs ; retours par lots vers `input\` du pilot.

## Les quatre verbes et leurs barres (registre la-barre 11/08, contractualiser 12/08)

| Verbe | Discipline exigée | Barre de niveau |
|---|---|---|
| **profiler** | la qualité = **assertions déclaratives unitaires** (objet + condition + paramètres typés), à verdict machine — jamais « données propres » en prose ; pont optionnel vers un lineage@1 (P4, cf. dataQualityAssertions OpenLineage) | Great Expectations |
| **tracer** | toute donnée servie **déclare son lineage** : entrées (datasets datés) → transformations (typées statique/runtime/déclaratif) → sorties + horodatage + niveau de maturité 0-3 et méthode ; grain colonne optionnel (T6) ; **environnement de chaque dataset** — `namespace` désignant l'INSTANCE, jugé à partir du 24/08 (T7, TF-0595 : deux catalogues homonymes sur deux workspaces sont la règle, cf. REX X13-X14) | OpenLineage (object model : run · job · inputs · outputs · facets — un dataset s'y identifie par le COUPLE namespace+nom) |
| **restituer** | tout chiffre d'un rapport **référence une entrée déclarée** (id → valeur + source + date) et le rapport pointe sa déclaration de lineage — le document se génère des déclarations, jamais l'inverse. **R5 (TF-0378)** : et tout NOMBRE du corps porte son marqueur, ou l'échappement explicite `[c:-]` — sans elle, un chiffre écrit en prose sans marqueur n'existait pas pour l'oracle, qui rendait PASS (mesuré : 788 nus contre 135 ancrés sur cinq rapports réels, tous PASS) | dbt-core (déclaré → généré) |
| **contractualiser** | l'accord producteur↔consommateur est **inspectable** : schéma typé + SLA mesurable + propriétaire joignable + versionnage à statut de cycle de vie — jamais un accord oral ou en prose | ODCS v3.1.0 (Bitol / Linux Foundation) |

## Oracles (contrat JSON, exit 0/1/2, `non_juge`, fixtures rouge/verte)

```bash
node oracles/oracle-profiler.mjs <assertions.json>        # P1-P3 (+P4 optionnel) : forme exécutable + pont lineage
node oracles/oracle-tracer.mjs <lineage.json>             # T1-T5 (+T6 optionnel, T7 environnement) : lineage complet, grain colonne, instance de chaque dataset
node oracles/oracle-restituer.mjs <rapport.md> [--strict]  # R1-R5 : chiffres ancrés, lineage_ref,
                                                          # et COUVERTURE des nombres de prose (R5,
                                                          # avertie par défaut, bloquante en strict) ;
                                                          # R6 reconciliation_ref, R7 couverture_ref,
                                                          # R8 vocabulaire du destinataire (glossaire)
node oracles/oracle-contractualiser.mjs <contrat.json>    # C1-C5 : schéma + SLA + propriétaire + version
node oracles/oracle-couvrir.mjs <couverture.json>         # CV1-CV6 : mapping mesuré contre l'inventaire de sa source
node oracles/oracle-evoluer.mjs <evolutions.json>         # EV1-EV7 : projection des évolutions d'une couche, provenance typée,
                                                          # comptes recalculés, arbre schéma › table › colonne
node oracles/oracle-rapprocher.mjs <rapprochement.json>   # RP1-RP7 : modèle rapproché d'un EXTRAIT du rapport client, deux sens, dictionnaire déclaré
node oracles/oracle-usage-restitution.mjs <usage.json>    # U1-U4 : cohérence structurelle d'un relevé d'usage (affichée/lue_par_mesure/jamais_lue)
node oracles/self-test.mjs                                 # double sens — à rejouer après toute modification
```

**Glossaire de restitution (TF-0936, 08/09/2026)** — `references/glossaire-restitution.json`,
donnée éditable, datée et sourcée (loi n° 4) : chaque terme y porte sa forme MACHINE (celle des
formats, des commentaires DDL et des sorties d'oracles, qui ne bouge pas) et sa forme de
RESTITUTION (celle que le destinataire lit). Premier terme : « grain » machine, rendu
« granularité ». `oracle-restituer` **R8** constate en avertissement tout terme machine employé
dans la prose d'un livrable humain ; le même terme cité en span ou bloc de code n'est jamais
compté, et c'est la frontière exacte entre les deux registres. Retour du 08/09 : 33 emplois sur
une seule page livrée, dont 8 recopiés des commentaires DDL.

Formats maison : `forge-data/assertions@1`, `forge-data/lineage@1`, `forge-data/contrat@1`
(spécifiés en tête des oracles ; exemples = fixtures vertes). Un rapport porte un
frontmatter `chiffres:` + `lineage_ref:` et des marqueurs `[c:<id>]` dans le corps.

## Le verbe importer (TF-0139) — un générateur, pas un oracle

`scripts/importer.mjs <schema.sql>` PRODUIT (il ne juge pas) un **brouillon** de
`assertions@1` + `contrat@1` à partir d'un schéma déjà **exporté en texte** (jamais de
connexion — loi n° 4). Dialecte v0 : Postgres, DDL au format `pg_dump --schema-only`
(inline ou `ALTER TABLE … ADD CONSTRAINT`) — cf. `references/profils-moteur/postgres.md`.
Correspondances : `NOT NULL`/`PRIMARY KEY`→`non_nul` ; `CHECK` bornes (`>=`/`<=`,
`BETWEEN`)→`bornes` ; `CHECK … IN (...)` ou sa réécriture pg_dump `= ANY (ARRAY[...])`
→`ensemble` ; `UNIQUE`/`PRIMARY KEY` (colonne seule)→`unique` ; colonnes+types→
`contrat@1.schema`. Clés composites, CHECK multi-colonnes, FOREIGN KEY et types non
mappés : jamais convertis à l'aveugle, toujours signalés en `avertissements`. Le
`contrat@1` produit pose des placeholders explicites pour sla/propriétaire/version
(statut `"brouillon"`) — complétion humaine obligatoire. Preuve en boucle : le brouillon
doit PASSER `oracle-profiler`/`oracle-contractualiser` sans retouche (vérifié par
`oracles/self-test.mjs` sur `fixtures/schema-postgres-{verte,rouge}.sql`).

**Dialecte Databricks (TF-0858, 07/09/2026 — lot L1 de l'étude d'opportunité du pilot, premier
artefact réel attendu au temps T1 d'une mission Silver/Gold)** : l'entrée est la sortie de
`SHOW CREATE TABLE` (nom `catalogue.schéma.table`, clauses `USING delta` / `COMMENT` /
`PARTITIONED BY` / `TBLPROPERTIES`). Le dialecte se détecte ou se déclare
(`--dialecte databricks`) et figure au manifeste (`dialecte`). Différences assumées, toutes
averties et jamais silencieuses : `PRIMARY KEY` / `UNIQUE` / `FOREIGN KEY` sont
**informationnelles** (profil §1) — l'assertion `unique` dérivée est produite comme brouillon
avec un avertissement de fiabilité inférieure, à confirmer par `mesurer_base.py` ; les types
imbriqués `ARRAY` / `MAP` / `STRUCT` se replient sur `string` en le disant ; le `COMMENT` en
ligne vaut `COMMENT ON` (rattaché, contrôlé). Preuve en boucle sur
`fixtures/schema-databricks-{verte,rouge}.sql` (`oracles/self-test.mjs`).

```bash
node scripts/importer.mjs fixtures/schema-postgres-verte.sql --sortie-dir <dossier>
node scripts/importer.mjs fixtures/schema-databricks-verte.sql --sortie-dir <dossier>   # dialecte détecté
```

## Le verbe traduire-unity-catalog (TF-0141) — un générateur, pas un oracle

`scripts/traduire-unity-catalog.mjs <export-uc.json>` traduit un **export synthétique** des
system tables Unity Catalog Databricks (`system.access.column_lineage` : colonnes
`source_table_full_name`, `source_column_name`, `target_table_full_name`,
`target_column_name`, `entity_type`, `entity_id`, `event_time`) en `forge-data/lineage@1`
grain colonne (T6). **Validé sur fixture synthétique uniquement** — aucun export réel
disponible sans workspace Unity Catalog Premium/Enterprise payant (jamais de connexion,
loi n° 4). Le lineage colonne d'Unity Catalog est par nature une capture runtime : type de
transformation toujours `"runtime"`, `confiance.niveau` toujours 3. Export incohérent
(colonne de sortie sans dataset déclaré, ou l'inverse) : refus propre (exit 2), jamais un
lineage inventé. Preuve en boucle : la sortie doit PASSER `oracle-tracer` (vérifié par
`oracles/self-test.mjs` sur `fixtures/unity-catalog-{verte,rouge}.json`).

**Seconde voie d'entrée : l'API REST lineage-tracking (TF-0893, 08/09/2026 — retour Produit-10 du
07/09)** — sur un workspace réel, la voie system tables est refusée AVANT d'exister :
`SELECT … FROM system.access.table_lineage` rend `[INSUFFICIENT_PERMISSIONS] … USE SCHEMA on
Schema 'system.access'` (SQLSTATE 42501), droit de gouvernance qu'un compte de mission n'obtient
pas dans la journée, tandis que `GET /api/2.0/lineage-tracking/table-lineage?…&include_entity_lineage=true`
répond avec les droits ordinaires du jeton. Le verbe n'avait donc qu'une entrée, et c'était celle
qui ne répond pas : un lineage de 30 objets a été relevé par l'API puis transcrit À LA MAIN. La
voie `api-lineage-tracking` prend le champ `reponses` (une réponse par table interrogée :
`upstreams` / `downstreams` avec `tableInfo` et les entités d'exécution) et rend un lineage@1 au
grain **table**, transformations `runtime`, **`confiance.niveau` = 0** — arbitrage délibéré contre
la proposition du retour (qui demandait 2) : sur l'échelle REX X6, les niveaux 1 à 3 sont TOUS des
grains colonne, et T5 ne juge que la présence du niveau, jamais sa justesse. La voie se détecte
(`lignes` → system tables, `reponses` → API) ou se déclare (`--voie`), figure au manifeste et dans
`origine.voie` du lineage produit ; une entrée portant les deux champs est **ambiguë** (refus), une
entrée `fileInfo` (emplacement externe) est écartée **en le disant**, un `tableInfo` dont un des
trois segments manque est un refus propre. Preuve en boucle sur
`fixtures/unity-catalog-api-{verte,rouge}.json`.

```bash
node scripts/traduire-unity-catalog.mjs fixtures/unity-catalog-verte.json --sortie <fichier.json>
node scripts/traduire-unity-catalog.mjs fixtures/unity-catalog-api-verte.json --sortie <fichier.json>   # voie détectée
```

## Trois verbes de plus pour la couche Gold et la restitution (07/09/2026 — lots L3, L4, L7)

Nés de l'étude d'opportunité du pilot du 07/09/2026 (mission data Silver/Gold sur Databricks
puis rapports Power BI), sur mandat humain, chacun contre une barre validée le même jour :

| Verbe | Discipline exigée | Barre | Oracle |
|---|---|---|---|
| **modéliser** (TF-0860) | la couche Gold EST le modèle dimensionnel, déclaré AVANT construction : grain en une phrase par fait, dimensions conformes définies une fois, clé de substitution distincte de la clé naturelle, type de changement lent 0-3, dimension temps unique au grain jour et contiguë, matrice en bus qui précède le modèle | Kimball — Dimensional Modeling Techniques | `oracle-modeliser.mjs <modele.json>` — M1-M6, format `forge-data/modele-dimensionnel@1` |
| **transformer** (TF-0861) | un projet de transformation déclare ses dépendances (ref/source), décrit et teste chaque modèle, rejoue ses tests, GÉNÈRE sa documentation ; l'oracle lit les artefacts de l'outil (`manifest.json`, `run_results.json`, `catalog.json`), jamais un YAML réinterprété | dbt-core | `oracle-transformer.mjs <dossier-target>` — TR1-TR6 |
| **réconcilier** (TF-0864) | toute mesure exposée par un modèle sémantique vaut ce que Gold dit : deux lots de mesures identifiées (Gold archivé par `mesurer_base.py`, export du modèle), chacun avec son instance (T7), sous tolérance DÉCLARÉE, chaque écart nommé | prolonge dbt-core (déclaré → généré) ; défaut n° 18 de l'analyse L99 | `oracle-reconcilier.mjs <reconciliation.json>` — RC1-RC6, format `forge-data/reconciliation@1` ; `oracle-restituer` **R6** : un rapport peut pointer un lot par `reconciliation_ref:` |

Frontière tenue : les trois jugent une FORME déclarée ou des artefacts archivés — jamais la
donnée vivante, jamais une connexion. La construction (transformer sous gates) appartient à
forge-development (profil `data-transformation`, manifeste `.forge/profile.toml`) ; le jugement
du modèle sémantique aval à forge-audit (`verifier-modele-semantique.mjs`).

```bash
node oracles/oracle-modeliser.mjs fixtures/modele-dimensionnel-verte.json
node oracles/oracle-transformer.mjs fixtures/transformation-verte
node oracles/oracle-reconcilier.mjs fixtures/reconciliation-verte.json
```

## Le verbe couvrir (TF-0911, 08/09/2026) — la complétude, que nulle règle de forme ne pose

Un mapping livré a été jugé PASS par TROIS oracles de cette forge — `oracle-tracer` (lineage
complet), `oracle-modeliser` (modèle bien formé), `oracle-restituer` (chiffres ancrés). Trois
synthèses PASS, deux jours. Puis le produit a écrit son propre contrôle et trouvé **38 colonnes
et 22 mesures orphelines**. Les trois oracles ne pouvaient pas les voir : ils jugent la forme de
ce qui est DÉCLARÉ, donc un mapping vide leur passerait aussi bien qu'un mapping exhaustif. La
complétude ne se déduit d'aucune règle de forme — elle exige une SECONDE source (l'inventaire de
la source) et une soustraction.

| Verbe | Discipline exigée | Barre | Oracle |
|---|---|---|---|
| **couvrir** (TF-0911) | un mapping se mesure contre l'INVENTAIRE de sa source : taux recalculé, orphelins nommés et comptés par type, exclusions **motivées** (une exclusion sans motif est un oubli déguisé en décision) ; PASS à zéro orphelin | prolonge dbt-core (déclaré → généré) ; contrôle maison du produit demandeur | `oracle-couvrir.mjs <couverture.json>` — CV1-CV6, format `forge-data/couverture@1` ; `oracle-restituer` **R7** : un rapport peut pointer sa mesure par `couverture_ref:` |

Deux taux rendus et nommés, jamais confondus : `taux.retenu` (couverts / inventaire − exclus) et
`taux.brut` (couverts / inventaire). Un `taux_declare` au document est RECALCULÉ et confronté
(CV6) — un taux recopié d'une synthèse précédente est exactement ce qui a laissé passer trois PASS.
Rattachement par règle déclarée : `nomme`, `table_entiere` (couvre par préfixe, sans citer chaque
colonne), `exclusion` (motif ≥ 4 mots). CV3 juge le défaut symétrique, celui que personne ne
cherche : un objet cité par le mapping et **absent de l'inventaire** — mapping faux ou inventaire
périmé, dans les deux cas le taux ment.

```bash
node oracles/oracle-couvrir.mjs fixtures/couverture-verte.json
```

## Le verbe rapprocher (TF-0975, 14/09/2026) — la seule preuve EXTERNE qu'une reconstruction visera juste

`oracle-couvrir` compare un mapping à l'inventaire de SA SOURCE (en amont) ; `oracle-reconcilier`
compare deux lots de VALEURS sous tolérance (sa structure est en non_juge). Ni l'un ni l'autre ne
rapproche un modèle de ce qu'un CLIENT remet quand on lui demande à quoi ressemble son rapport :
un export, des intitulés et des lignes. Sans ce rapprochement, la cible d'une reconstruction reste
une hypothèse argumentée ; avec lui, elle est prouvée contre une pièce du client (cas réel : 60/60
en-têtes appariés un pour un, 60/66 colonnes du modèle portées par l'extrait, les 6 restantes
chacune avec son motif).

| Verbe | Discipline exigée | Barre | Oracle |
|---|---|---|---|
| **rapprocher** (TF-0975) | le rapprochement se lit dans les DEUX sens : tout objet du modèle est rapproché (littéral ou par un **dictionnaire de concepts déclaré**, jamais une ressemblance calculée) ou déclaré **absent avec motif et visuel** (sinon absent et oublié sont indiscernables) ; tout intitulé de l'extrait sans équivalent est un écart de plein droit, toujours informationnel | prolonge dbt-core (déclaré → généré) ; contrôle maison du produit demandeur | `oracle-rapprocher.mjs <rapprochement.json>` — RP1-RP7, format `forge-data/rapprochement@1` |

Deux taux, même convention que `couvrir` : `taux.retenu` (rapprochés / objets − absences motivées)
et `taux.brut` (rapprochés / objets). Un `taux_declare` est RECALCULÉ (RP7). Le dictionnaire est la
SEULE voie pour une correspondance non littérale (RP3) : une entrée qui invente son intitulé ou son
objet (absent des deux sources déclarées) est refusée.

```bash
node oracles/oracle-rapprocher.mjs fixtures/rapprochement-verte.json
```

## Le verbe mesurer-usage-restitution (TF-0971, 14/09/2026) — la couverture se mesure aussi contre l'ÉCRAN

`oracle-couvrir` mesure une couverture contre l'INVENTAIRE de la source, jamais contre ce qui est
effectivement à l'écran. Cas réel : sur 342 colonnes, 66 seulement étaient mobilisées par les 16
visuels porteurs de données d'un rapport (21 projetées telles quelles, 45 lues par des mesures
affichées) ; 276 ne l'étaient JAMAIS. Des 38 colonnes sans ligne de mapping, 20 étaient réellement
mobilisées et 18 ne l'étaient pas — la dette bloquante était deux fois plus petite que celle que
`oracle-couvrir` annonçait, et cet oracle ne peut structurellement pas le dire.

| Verbe | Discipline exigée | Oracle |
|---|---|---|
| **mesurer-usage-restitution** (TF-0971) | trois populations de colonnes, jamais confondues : **affichée** (projetée telle quelle dans un visuel), **lue_par_mesure** (atteinte par la fermeture transitive d'une mesure affichée — compose avec `--resolution-dax`, TF-0972), **jamais_lue** ; le croisement avec `oracle-couvrir` (orphelins ∩ jamais_lue) est une intersection ensembliste laissée au consommateur, jamais dupliquée ici | `oracles/oracle-usage-restitution.mjs <usage.json>` — U1-U4, format `forge-data/usage-restitution@1` |

`scripts/mesurer-usage-restitution.mjs --modele <inventaire.json> --resolution <resolution-dax.json>
--rapport <dossier PBIR> --sortie <f.json>` COMPOSE deux artefacts déjà produits par cette forge —
jamais un modèle re-parsé. **Format de mise en page lu, et limite dite** : un projet PBIR (Power BI
Enhanced Report Format, JSON texte sous `definition/pages/**/visuals/**/visual.json`), scanné pour
le champ `queryRef` (convention stable : chaque champ projeté dans un visuel le porte). Le binaire
`.pbix` n'est **pas** lu (aucune dépendance externe dans ce dépôt, loi n° 4) ; un visuel qui
n'émettrait pas `queryRef` (visuel tiers, format antérieur) échappe à la mesure — nommé en
avertissement, jamais supposé absent. Une référence de mise en page inconnue du modèle fourni
(table ou colonne hors périmètre) est NOMMÉE, jamais silencieusement ignorée.

```bash
node scripts/mesurer-usage-restitution.mjs --modele fixtures/usage-modele-verte.json \
     --resolution fixtures/usage-resolution-dax-verte.json --rapport fixtures/rapport-pbir-verte --sortie <f.json>
node oracles/oracle-usage-restitution.mjs fixtures/usage-restitution-verte.json
```

## Le verbe traduire-modele-semantique (TF-0894, 08/09/2026) — la Pierre de Rosette se lit enfin

`scripts/traduire-modele-semantique.mjs --modele <dossier>` LIT un modèle sémantique Power BI au
format texte **TMDL** (projet PBIP) et le TRADUIT en brouillon de
`forge-data/modele-dimensionnel@1`. Générateur, pas un oracle. Le modèle sémantique est l'artefact
pivot d'un mandat de reconstruction de rapport (doctrine REX §3) et aucun verbe ne le lisait : coût
constaté sur un rapport réel — 25 requêtes embarquées, 160 mesures, 17 relations, extraction et
mapping de 47 lignes faits à la main.

**Format d'entrée réemployé, jamais réinventé** : le même `--modele <dossier definition/ ou
.SemanticModel/>` que `oracles/verifier-modele-semantique.mjs` de **forge-audit**. Un seul artefact
à produire côté client, deux usages, et la frontière tient : forge-audit **juge** le modèle
sémantique (MS1-MS6, contrôles AuditCore — cet oracle n'est PAS dupliqué ici), forge-data le
**traduit** vers son format, et le jugement du résultat appartient à `oracle-modeliser` (M1-M6).
Jamais de point de terminaison XMLA ni d'appel au service (loi n° 4).

**Ce que TMDL porte** : tables et colonnes ; mesures et leur DAX (agrégation dérivée quand
l'expression commence par `SUM`/`AVERAGE`/`COUNT`/`DISTINCTCOUNT`/`MIN`/`MAX`) ; relations — donc,
par leur **orientation**, quelle table est un fait (côté `fromColumn`) et laquelle une dimension
(côté `toColumn`), et la clé de **substitution** de chaque dimension ; la dimension temps
(`dataCategory: Time`).
**Ce que TMDL ne porte pas, et que le verbe REFUSE d'inventer** : le grain d'un fait en une phrase,
le processus métier, la clé **naturelle**, le type de changement lent, les bornes et la contiguïté
de la dimension temps (propriétés de la DONNÉE), la matrice en bus (elle PRÉCÈDE le modèle et ne
se relit pas dans le modèle construit). Ces champs restent **absents**, chacun nommé dans
`a_completer` avec sa règle (M2/M4/M5/M6), et le brouillon porte `statut: "brouillon"` — un
placeholder vraisemblable ferait PASSER `oracle-modeliser` en mentant, ce qui est exactement le
défaut que TF-0911 vient de coûter. La complétion humaine est donc **mécanique** : un fichier
`--complement` (format `forge-data/complement-modele@1`) les fournit, et alors — et alors
seulement — le round-trip PASSE `oracle-modeliser` sans retouche. Un complément qui prétend
redéfinir une valeur LUE est averti et ignoré : le modèle livré fait foi sur ce qu'il porte.
Modèle sans relation active : refus propre (exit 2) — l'orientation fait/dimension ne se devine
pas, et un modèle deviné serait faux sans être détectable. Preuve en boucle (deux sens) sur
`fixtures/modele-semantique-{verte,rouge}/` et `fixtures/complement-modele-verte.json`.

**Mode `--resolution-dax` (TF-0972, 14/09/2026)** — le même lecteur TMDL expose une résolution
NOMMÉE des références DAX d'une mesure vers ses colonnes, avec son contrat écrit et un journal
rendu AVEC le résultat (`forge-data/resolution-dax@1`). Deux défauts mesurés faisaient perdre des
colonnes en silence : la CASSE (DAX est insensible à la casse, une comparaison sensible la perd) et
les RÉFÉRENCES NON QUALIFIÉES (`[Mesure]` peut désigner une mesure d'une AUTRE table que la
porteuse). Contrat : index insensible à la casse ; une référence qualifiée `Table[Membre]` cherche
colonnes puis mesures de `Table` ; une référence non qualifiée `[Membre]` cherche d'abord la table
PORTEUSE puis le MODÈLE ENTIER ; deux candidats au même niveau rendent la référence **ambiguë**,
jamais tranchée ; une référence résolue vers une mesure est suivie par **fermeture transitive**
(détection de cycle) jusqu'à ses colonnes terminales. Limite dite : seule la tête d'une expression
DAX repliée sur plusieurs lignes est lue. Preuve en boucle (deux sens) sur
`fixtures/modele-semantique-dax-{verte,rouge}/`.

**Mode `--inventaire` (TF-0917, 08/09/2026)** — le même dossier TMDL traduit vers le bloc
`source.inventaire` de `forge-data/couverture@1`, celui qu'`oracle-couvrir` attendait DÉJÀ RELEVÉ.
Entre le verbe qui lit la source et l'oracle qui la juge, il n'y avait qu'une **transcription à la
main** (25 requêtes, 160 mesures, 17 relations sur le cas réel) — et une transcription est
l'endroit exact où la couverture ment sans que personne le voie : un objet oublié à la recopie
n'est orphelin pour personne. Objets **typés** `table` / `colonne` / `mesure` (`Table`,
`Table.colonne`, `Table[Mesure]`), `date` et `releve_par` posés. Restent absents et **nommés dans
`a_completer`**, jamais inventés : le `namespace` de l'instance (TMDL ne le porte pas — `--namespace`
le fournit ; sans lui `oracle-couvrir` réclame CV2) et le bloc `mapping` (le livrable JUGÉ, produit
ailleurs — CV1). Chaîne prouvée en boucle par `self-test.mjs` : verbe → `oracle-couvrir` rend FAIL
sur CV1 et CV5 seulement, puis PASS 26/26 dès que le mapping arrive.

```bash
node scripts/traduire-modele-semantique.mjs --modele fixtures/modele-semantique-verte --sortie <f.json>
node scripts/traduire-modele-semantique.mjs --modele fixtures/modele-semantique-verte \
     --complement fixtures/complement-modele-verte.json --sortie <f.json>   # PASSE oracle-modeliser
node scripts/traduire-modele-semantique.mjs --modele fixtures/modele-semantique-verte \
     --inventaire --namespace <uri de l'instance> --sortie <couverture.json>   # bloc source.inventaire
node scripts/traduire-modele-semantique.mjs --modele fixtures/modele-semantique-dax-verte \
     --resolution-dax --sortie <resolution.json>   # forge-data/resolution-dax@1, contrat de résolution nommé
```

## Le verbe projeter-evolutions (TF-0937, 08/09/2026) — la première question d'une équipe data

`lineage@1` porte les sorties proposées et les transformations. Il ne porte pas la vue **colonne
par colonne** de ce qui change dans chaque couche et d'où ça vient — la première question posée
devant une reprise, et celle qui se reconstituait à la main depuis les DDL, le mapping et le
catalogue : **397 lignes de provenance** relevées chez le produit demandeur (119 Silver, 278 Gold).

`scripts/projeter-evolutions.mjs --couche <nom> --cible <ddl.sql> [--existant <ddl.sql>]
[--lineage <lineage.json>] [--couche-amont <nom>] [--format json|md|csv]` PRODUIT (il ne juge pas) une projection
`forge-data/evolutions@1` : une ligne par colonne, **{ table, colonne, type, évolution, provenance }**,
plus les cartes de comptage. Les quatre évolutions de table (`table_creee`, `table_completee`,
`table_deplacee`, `inchangee`) se **déduisent de la comparaison des deux DDL**, jamais d'une
heuristique de nom : une table déplacée (même nom court, autre catalogue) lue comme créée ferait
croire à une construction là où il y a un transfert. Sans `--existant`, toute table est lue comme
créée et le verbe l'**avertit** : vrai d'une couche neuve, faux d'une reprise. Les rendus `md` et
`csv` portent **les mêmes lignes dans le même ordre** que le JSON jugé : le rendu `md` EST le
chapitre « Évolutions <couche> » de la restitution.

`oracles/oracle-evoluer.mjs` juge la **complétude interne** de la projection (EV1-EV7) : cinq champs
par ligne, jeux fermés d'évolution et de provenance, aucun couple table+colonne projeté deux fois,
bijection `tables` ⇄ `lignes` (une table annoncée sans colonne projetée est le trou exact que la
reconstitution à la main laissait), provenance expliquée, et **comptes recalculés** — jamais
recopiés. Frontière tenue : l'exhaustivité contre le DDL réel exige une SECONDE source et reste à
`oracle-couvrir` ; les confondre rendrait les deux fausses.

**Une provenance typée, et résolue quand elle peut l'être (TF-0955 + TF-0943, 08/09/2026)** — la
première version ne prévoyait que le cas heureux, et laissait la provenance en **chaîne de texte** :
« clients Date_Debut (Type_Avenant 0), Date_Entree, DUREE » ne disait ni où vivent ces objets ni
à quoi sert chaque champ. Mesure sur 396 colonnes : 141 citaient un objet résolu, **255 n'en
citaient aucun** et n'avaient rien à dire d'autre que leur propre cellule. Le champ `provenance`
porte donc un **type du jeu fermé** — `objets_resolus`, `colonne_technique`, `cle_de_la_table`,
`regle_en_clair`, `non_documentee` — où les **quatre derniers exigent une phrase déclarée** (EV4)
et où `objets_resolus` porte une **LISTE d'objets résolus** `{ couche, catalogue, schema, table,
colonne, explication, source_de_l_explication }` (EV7) : l'emplacement, le **rôle du champ employé**
et d'où vient cette explication. Le rendu **compose** son texte depuis la liste — une seule source
de vérité. Les `non_documentee` sont **comptées et remontées comme DETTE** (`dette.non_documentee`
et sa part), jamais laissées passer. Un objet expliqué par un **dictionnaire** exige que ce
dictionnaire soit déclaré au document ; avec `--catalogue <fichier>` joint (liste de noms,
`{ objets: [...] }` ou un `couverture@1`), chaque objet doit y **exister** — sans lui, l'existence
reste **non jugée et le dit**, jamais supposée. Le verbe ne produit que les trois types qu'il peut
LIRE dans les artefacts (`objets_resolus`, `regle_en_clair`, `non_documentee`) ; `colonne_technique`
et `cle_de_la_table` sont déclarés par un humain ou l'outil amont — les deviner à la forme d'un nom
de colonne serait l'heuristique que ce verbe refuse. `--couche-amont <nom>` nomme la couche
d'origine des objets repris ailleurs ; sans elle le verbe écrit la **relation** (« amont ») au lieu
d'inventer un nom de couche, et l'avertit. Fixture dédiée `evolutions-provenance-verte.json` : les
cinq types dans un même document, PASS — sans elle, `colonne_technique` et `cle_de_la_table` ne
seraient jamais joués.

**Trois niveaux, pas une liste plate (TF-0942, 08/09/2026 — retour du même lot)** — la première
version rendait 119 lignes Silver et 278 lignes Gold, une par colonne, répétant le nom de leur
table : aucun objet « schéma », aucun agrégat « 3 tables dont 2 créées », et un statut qui
n'existait qu'à la ligne la plus fine. La projection porte désormais un bloc **`arbre`** —
un nœud par schéma, par table et par colonne, `{ niveau, parent, objet, statut, statut_agrege }` —
où chaque niveau a son **propre jeu fermé** de statuts (`schema_cree`/`schema_complete`/`inchangee`
pour un schéma, les quatre évolutions de table, les trois de colonne : un `colonne_ajoutee` posé
sur une table dit que l'arbre a été rempli en recopiant la ligne du dessous) et où chaque parent
porte le **recompte** des statuts de ses enfants. Le statut d'un schéma se **dérive** de ses tables
par une règle déclarée, jamais par un vote. Le rendu `md` en fait un tableau à trois niveaux dont
la colonne « Niveau » est la clé de filtrage, placé avant le détail colonne par colonne.
**EV6** juge cet arbre : les trois niveaux peuplés, un statut du jeu fermé de son niveau à chaque
nœud, un parent qui existe au niveau au-dessus, l'agrégat **recompté** et confronté aux enfants, et
la **bijection** des feuilles avec les `lignes`. Preuve à deux sens : deux projections que
l'oracle de la veille rendait PASS — l'une redevenue plate, l'autre annonçant « 9 tables créées »
sous un schéma qui n'en porte aucune — échouent sur EV6 et sur EV6 seulement.

```bash
node scripts/projeter-evolutions.mjs --couche silver --cible fixtures/evolutions-cible.sql      --existant fixtures/evolutions-existant.sql --lineage fixtures/lineage-verte.json --sortie <f.json>
node scripts/projeter-evolutions.mjs --couche silver --cible fixtures/evolutions-cible.sql      --existant fixtures/evolutions-existant.sql --format md --sortie <chapitre.md>
node oracles/oracle-evoluer.mjs fixtures/evolutions-verte.json
node oracles/oracle-evoluer.mjs fixtures/evolutions-provenance-verte.json --catalogue <catalogue.json>
```

## Le verbe isoler-contexte-extrait (TF-0976, 14/09/2026) — le pied d'un export EST une donnée

Sur les trois feuilles d'un classeur Power BI exporté, la lecture naïve comptait 21 559, 21 719 et
14 121 lignes ; les données réelles sont 21 557, 21 716 et 14 117 — une ligne vide et une ligne de
pied (« Filtres appliqués ») par feuille. Le pied atterrit dans la PREMIÈRE colonne (modalité
fantôme), et il est en même temps la SEULE trace que l'extrait est un instantané filtré, pas
complet.

`scripts/isoler-contexte-extrait.mjs --fichier <export.csv> [--separateur <car>] [--sortie <f.json>]`
LIT un export tabulaire délimité et rend DEUX populations, jamais une : les lignes de données
(`forge-data/contexte-extrait@1`, champ `lignes`) et un objet `contexte_de_l_extrait` portant les
prédicats `{champ, operateur, valeur}` lus au pied (jeu fermé `est`/`n_est_pas`/`n_est_pas_vide`/
`n_est_pas_nul`/`non_reconnu` — une clause non reconnue est gardée avec son texte brut, jamais
tue). Détecte aussi la ligne de totaux et la ligne vide terminale. Règle de contrat : sans pied
détecté, `portee` vaut `"inconnue"` et le dit en avertissement — un extrait n'est jamais supposé
complet par défaut. **Écart déclaré** : lit le CSV/TSV, pas le binaire `.xlsx` (aucune dépendance
externe dans ce dépôt) — le même pied survit à l'export délimité du même rapport. Preuve en boucle
(deux sens) sur `fixtures/contexte-extrait-{verte,rouge}.csv`.

```bash
node scripts/isoler-contexte-extrait.mjs --fichier fixtures/contexte-extrait-verte.csv --sortie <f.json>
```

## Profils-moteur (TF-0140, `references\profils-moteur\`)

Référentiels versionnés (loi n° 4, jamais du code) : dialecte de contraintes, mapping de
types, vues catalogue, commande d'export — un par moteur, alimentant le verbe `importer`.
Quatre à ce jour : `postgres.md` (consommé par `importer` v0), `oracle.md`, `azure-sql.md`,
`databricks.md` (à part — lakehouse, pas un RDBMS ; son lineage colonne natif Unity Catalog
va au verbe `traduire-unity-catalog.mjs`, pas à `importer`). Doctrine complète et inventaire
à jour : `references\profils-moteur\LISEZMOI.md`.

## Doctrine issue du REX (l'essentiel — détail : references\REX-DATA.md)

1. **Agnosticisme** : décrire par capacités/rôles ; les produits n'apparaissent qu'en
   « instanciation (exemple) ».
2. **Fiabilité épistémique** : tout constat de rétro-ingénierie porte `[FAIT]`,
   `[HYPOTHÈSE]` ou `[INCONNU]` — jamais de déduction présentée en observation.
3. **Pierre de Rosette** : chercher d'abord l'artefact pivot qui relie source ↔ cible.
4. **La topologie se dérive des artefacts, jamais du discours** — l'existant corrige
   toujours la description initiale.
5. **Bifurcation structurante** : table-level vs column-level ; statique vs runtime — les
   transformations opaques ne sont accessibles qu'en runtime ; choisir par la valeur.
6. **Validation de justesse AVANT publication** au catalogue ; puis **méta-lineage** : la
   provenance du lineage lui-même (qui a déduit quoi, par quelle méthode, avec quelle
   confiance).

## Langue

Tout livrable et toute interaction en **français**.
