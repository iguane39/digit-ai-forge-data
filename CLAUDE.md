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
| **tracer** | toute donnée servie **déclare son lineage** : entrées (datasets datés) → transformations (typées statique/runtime/déclaratif) → sorties + horodatage + niveau de maturité 0-3 et méthode ; granularité colonne optionnelle (T6) ; **environnement de chaque dataset** — `namespace` désignant l'INSTANCE, jugé à partir du 24/08 (T7, TF-0595 : deux catalogues homonymes sur deux workspaces sont la règle, cf. REX X13-X14) ; **cibles du périmètre servi NOMMÉES**, jamais décrites en prose — `table` + `colonnes`, ou `entier: true` motivé (T8 optionnel, TF-0974) | OpenLineage (object model : run · job · inputs · outputs · facets — un dataset s'y identifie par le COUPLE namespace+nom) |
| **restituer** | tout chiffre d'un rapport **référence une entrée déclarée** (id → valeur + source + date) et le rapport pointe sa déclaration de lineage — le document se génère des déclarations, jamais l'inverse. **R5 (TF-0378)** : et tout NOMBRE du corps porte son marqueur, ou l'échappement explicite `[c:-]` — sans elle, un chiffre écrit en prose sans marqueur n'existait pas pour l'oracle, qui rendait PASS (mesuré : 788 nus contre 135 ancrés sur cinq rapports réels, tous PASS) | dbt-core (déclaré → généré) |
| **contractualiser** | l'accord producteur↔consommateur est **inspectable** : schéma typé + SLA mesurable + propriétaire joignable + versionnage à statut de cycle de vie — jamais un accord oral ou en prose | ODCS v3.1.0 (Bitol / Linux Foundation) |

## Oracles (contrat JSON, exit 0/1/2, `non_juge`, fixtures rouge/verte)

```bash
node oracles/oracle-profiler.mjs <assertions.json>        # P1-P3 (+P4 optionnel) : forme exécutable + pont lineage
node oracles/oracle-tracer.mjs <lineage.json>             # T1-T5 (+T6 optionnel, T7 environnement,
                                                          # T8 optionnel cibles structurées) : lineage
                                                          # complet, granularité colonne, instance de chaque
                                                          # dataset, périmètre servi NOMMÉ (TF-0974)
node oracles/oracle-restituer.mjs <rapport.md> [--strict] [--glossaire <chemin>]
                                                          # R1-R5 : chiffres ancrés, lineage_ref,
                                                          # et COUVERTURE des nombres de prose (R5,
                                                          # avertie par défaut, bloquante en strict) ;
                                                          # R6 reconciliation_ref, R7 couverture_ref,
                                                          # R8 vocabulaire du destinataire (glossaire de la
                                                          # forge par défaut, ou celui du produit via
                                                          # --glossaire — bloquant si un terme y porte
                                                          # "bloquant": true, TF-1044) ; R9 modele_ref :
                                                          # le corps CITE les décisions d'architecture
                                                          # déclarées par le modèle pointé (TF-1170)
node oracles/oracle-contractualiser.mjs <contrat.json>    # C1-C5 : schéma + SLA + propriétaire + version
node oracles/oracle-rendre.mjs <rendu.json>               # RN1-RN6 : liaisons visuel → objet du modèle,
                                                          # mesures référencées existantes, visuels vides,
                                                          # geste de vérification du RENDU déclaré (RN5) et
                                                          # sa mesure d'export JUGÉE (RN6, TF-1188)
node oracles/oracle-reconstruire.mjs <reconstruction.json> # RS1-RS7 : la mise en page d'un rapport fourni
                                                          # en entrée est CONSERVÉE (pages, visuels, géométrie
                                                          # au pixel, plan, ressources) ; repli généré =
                                                          # déclaré ; RS7 : en-têtes comptés à l'OCCURRENCE
node oracles/oracle-delimiter.mjs <perimetre.json>        # DL1-DL6 : le périmètre livré est ce que les
                                                          # VISUELS LISENT ; l'excédent non motivé est refusé
node oracles/oracle-enchainer.mjs <chaine.json>           # CH1-CH6 : chaîne de travail déclarée — étapes
                                                          # ordonnées, chacune avec un porteur qui EXISTE
node oracles/oracle-qualifier.mjs <qualification.json>    # QR1-QR8 : un rapport migré peut-il REMPLACER
                                                          # l'original — six dimensions, leur angle mort,
                                                          # un verdict de bascule COMPOSÉ, et la
                                                          # DÉFINITION CHANGÉE distinguée du défaut
node oracles/oracle-couvrir.mjs <couverture.json>         # CV1-CV6 : mapping mesuré contre l'inventaire de sa source
node oracles/oracle-evoluer.mjs <evolutions.json>         # EV1-EV7 : projection des évolutions d'une couche, provenance typée,
                                                          # comptes recalculés, arbre schéma › table › colonne
node oracles/self-test.mjs                                 # double sens — à rejouer après toute modification
```

**Glossaire de restitution (TF-0936, 08/09/2026 — portée resserrée par TF-1044, 14/09/2026)** —
`references/glossaire-restitution.json`, donnée éditable, datée et sourcée (loi n° 4) : chaque
terme y porte sa forme MACHINE et sa forme de RESTITUTION (celle que le destinataire lit).
Premier terme : `grain` machine, rendu « granularité ». **Portée machine resserrée** à la
seule clé JSON `grain` de `forge-data/modele-dimensionnel@1` — alias `granularite`, clé
NOMINALE d'un `modele-dimensionnel@2`, les deux acceptées et jugées par `oracle-modeliser`
(M2, M5) — commentaires DDL et sorties d'oracles ne sont PLUS exemptés : un second retour du
10/09 (Produit-62, RD-14) a retrouvé le terme dans un DDL, un mapping et un chargement déjà
publiés, la première portée (trop large) les couvrant à tort. `oracle-restituer` **R8** constate
tout terme machine employé dans la prose d'un livrable humain — le même terme cité en span ou
bloc de code n'est jamais compté, frontière exacte entre les deux registres — en avertissement
par défaut, et en **bloquant** dès que le terme porte `"bloquant": true` au glossaire : le
produit qui déclare son propre lexique en durcit l'application ; celui de la forge reste à
`false`, un mot restant par défaut un arbitrage de rédaction. Retour du 08/09 : 33 emplois sur
une seule page livrée, dont 8 recopiés des commentaires DDL. **Reste à l'étude (TF-0155, R-31,
objet durable neuf)** : un contrôle `oracle-vocabulaire` jouable directement sur un DDL, un CSV
ou un Markdown hors rapport — R8 ne juge aujourd'hui que le corps d'un rapport passé à
`oracle-restituer`, jamais un DDL ou un CSV lus directement.

Formats maison : `forge-data/assertions@1`, `forge-data/lineage@1`, `forge-data/contrat@1`
(spécifiés en tête des oracles ; exemples = fixtures vertes). Un rapport porte un
frontmatter `chiffres:` + `lineage_ref:` et des marqueurs `[c:<id>]` dans le corps.

## Le contrôle verifier-unites-parquet (TF-1065, 14/09/2026) — le type ÉCRIT, jamais relu par le même moteur

Fait mesuré (Produit-62, 11/09/2026) : fastparquet transcrit `datetime64[ns]` en
`TIMESTAMP(NANOS)`, que Databricks refuse à la lecture (`[PARQUET_TYPE_ILLEGAL]`, SQLSTATE
42846) — 7/27 tables concernées. Une recette d'export qui relit son fichier avec le MÊME
moteur d'écriture le trouve toujours lisible et rend PASS : le défaut n'est visible qu'en
lisant le TYPE PHYSIQUE écrit, jamais par relecture croisée avec le même outil.
`scripts/verifier_unites_parquet.py <fichier.parquet>` MESURE le moteur disponible
(pyarrow sinon fastparquet — aucun n'est une dépendance nouvelle payante, R-29) et REFUSE
toute colonne temporelle en nanoseconde. Table des unités admises par destination :
`references/REX-DATA.md`, pattern X17 (une seule ligne mesurée à ce jour : Databricks).
Preuve en boucle, fichiers Parquet générés à la volée (aucune donnée committée) :

```bash
python scripts/verifier_unites_parquet.py --self-test
```

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
granularité colonne (T6). **Validé sur fixture synthétique uniquement** — aucun export réel
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
`upstreams` / `downstreams` avec `tableInfo` et les entités d'exécution) et rend un lineage@1 à la
granularité **table**, transformations `runtime`, **`confiance.niveau` = 0** — arbitrage délibéré contre
la proposition du retour (qui demandait 2) : sur l'échelle REX X6, les niveaux 1 à 3 sont TOUS des
granularités colonne, et T5 ne juge que la présence du niveau, jamais sa justesse. La voie se détecte
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
| **modéliser** (TF-0860) | la couche Gold EST le modèle dimensionnel, déclaré AVANT construction : granularité en une phrase par fait (clé `grain`, alias `granularite` — TF-1044), dimensions conformes définies une fois, clé de substitution distincte de la clé naturelle, type de changement lent 0-3, dimension temps unique à la granularité jour et contiguë, matrice en bus qui précède le modèle, **et les décisions d'architecture qui l'ont façonné, portées par lui** (M7, TF-1170) | Kimball — Dimensional Modeling Techniques | `oracle-modeliser.mjs <modele.json>` — M1-M7, format `forge-data/modele-dimensionnel@1` (ou `@2`, clé `granularite` nominale) |
| **transformer** (TF-0861) | un projet de transformation déclare ses dépendances (ref/source), décrit et teste chaque modèle, rejoue ses tests, GÉNÈRE sa documentation ; l'oracle lit les artefacts de l'outil (`manifest.json`, `run_results.json`, `catalog.json`), jamais un YAML réinterprété | dbt-core | `oracle-transformer.mjs <dossier-target>` — TR1-TR6 |
| **réconcilier** (TF-0864) | toute mesure exposée par un modèle sémantique vaut ce que Gold dit : deux lots de mesures identifiées (Gold archivé par `mesurer_base.py`, export du modèle), chacun avec son instance (T7), sous tolérance DÉCLARÉE, chaque écart nommé | prolonge dbt-core (déclaré → généré) ; défaut n° 18 de l'analyse L99 | `oracle-reconcilier.mjs <reconciliation.json>` — RC1-RC6, format `forge-data/reconciliation@1` ; `oracle-restituer` **R6** : un rapport peut pointer un lot par `reconciliation_ref:` |

Frontière tenue : les trois jugent une FORME déclarée ou des artefacts archivés — jamais la
donnée vivante, jamais une connexion. La construction (transformer sous gates) appartient à
forge-development (profil `data-transformation`, manifeste `.forge/profile.toml`) ; le jugement
du modèle sémantique aval à forge-audit (`verifier-modele-semantique.mjs`).

```bash
node oracles/oracle-modeliser.mjs fixtures/modele-dimensionnel-verte.json
node oracles/oracle-modeliser.mjs fixtures/modele-dimensionnel-granularite-verte.json   # @2, clé `granularite` (TF-1044)
node oracles/oracle-restituer.mjs fixtures/rapport-modele-verte.md   # R9 : le rapport cite les décisions du modèle (TF-1170)
node oracles/oracle-transformer.mjs fixtures/transformation-verte
node oracles/oracle-reconcilier.mjs fixtures/reconciliation-verte.json
```

## M7 et R9 (TF-1170, 17/09/2026) — une décision qui ne vit qu'au ledger n'est pas portée par le livrable

Le 16/09/2026, un commanditaire dénonce comme un défaut les quatre tables de faits qui appliquent
sa propre décision, tranchée neuf jours plus tôt : la déclaration machine était conforme, jugée
PASS par `oracle-modeliser`, et le mode d'emploi du livrable ne disait nulle part pourquoi quatre
faits. Coût : un tour d'analyse de 55 minutes pour établir que le défaut dénoncé était une décision.

**Règle de restitution de la forge** : un livrable de modélisation porte ses décisions d'architecture
tranchées — QUI a tranché, QUAND, QUOI, et POURQUOI — à l'endroit où le lecteur rencontre le choix,
jamais seulement au ledger. Deux contrôles exécutés la tiennent, chacun à son endroit :

- `oracle-modeliser` **M7** — le modèle déclare un bloc `decisions` (`id`, `qui`, `date` ISO, `quoi`
  ≥ 4 mots) et chaque fait porte son `pourquoi` en prose lecteur (≥ 8 mots : le processus servi, ce
  que le choix apporte) plus un `decision_ref` qui résout ; une décision que nul fait ne référence
  est une déclaration morte (avertissement). Fixtures : `modele-dimensionnel-{verte,rouge}.json`.
- `oracle-restituer` **R9** — un rapport qui pointe un modèle par `modele_ref:` CITE au corps chaque
  décision que ce modèle déclare ; optionnel comme R6 et R7, bloquant dès qu'il est présent.
  Fixtures : `rapport-modele-{verte,rouge}.md`.

TMDL ne porte ni le `pourquoi` ni les décisions : `traduire-modele-semantique` les laisse ABSENTS et
les nomme dans `a_completer` (M7), le complément humain les fournit — même mécanique que la
granularité et la matrice en bus. La reprise de ces mêmes décisions dans le mode d'emploi du
livrable-dossier (LISEZMOI) relève du gabarit du pilot, déclarée en `non_juge` ici.

## Le verbe rendre (TF-1175, 17/09/2026) — un contrôle qui lit le fichier ne prouve jamais le rendu

Un rapport Power BI généré a passé 22 contrôles de recette et 7 d'audit, a été publié sur GO
humain, et ne rendait AUCUN visuel : « Chargement de votre rapport… » sans fin, export PDF
`Succeeded` en 557 à 569 s sur 6 configurations, PDF de 943 à 1 415 octets et **zéro caractère**,
quand le rapport du client sur la même capacité s'exporte en 41 s et 137 506 octets. Le contrôle
« en-têtes repris au caractère près, 70/70 » rendait PASS sur des en-têtes que personne ne voyait.
Coût : deux jours de mandat, deux diagnostics faux, un GO de publication dépensé.

`oracle-rendre.mjs <rendu.json>`, format `forge-data/rendu@1` — **RN1** forme, l'inventaire du
modèle venant inline ou d'un `couverture@1` déjà relevé (`inventaire_ref` : la chaîne
`traduire-modele-semantique --inventaire` → oracle se ferme sans transcription) ; **RN2** toute
projection d'un visuel porteur de données résout à un objet du modèle, comparaison insensible à la
casse ; **RN3** une projection écrite `Table[Mesure]` est inventoriée comme mesure ; **RN4** aucun
visuel porteur de données sans projection affichée, les projections `active: false` étant comptées
et dites ; **RN5** le geste de vérification du RENDU RÉEL est déclaré, daté et résulté.

**Doctrine de livraison — le geste obligatoire, jamais passé sous silence.** Ce que le lecteur voit
ne se mécanise pas sans l'outil : aucun contrôle de ce dépôt ne l'atteint, et c'est écrit au
`non_juge` de l'oracle. Tout livrable dont l'usage est un rendu se vérifie donc par le geste
nommé — **publier → exporter la page depuis le service → lire l'IMAGE du fichier exporté →
verdict** (durée sous borne, octets au-dessus du plancher, texte extrait non vide par page, aucun
libellé d'erreur du service) — et ce geste entre au livrable par RN5 avec sa date et son résultat.
Un rendu non joué reste `non_juge` et se DIT ; il ne se déduit d'aucun contrôle sur le fichier.
Fixtures des deux sens : `rendu-{verte,rouge}.json`, plus la chaîne fermée jouée au self-test.

## Le verbe reconstruire (TF-1176, 17/09/2026) — ce que le mandat fournit ne se réinvente pas

Retour humain, mot pour mot : « Le PowerBI semble fonctionner mais le design a été modifié.
Corrige le rapport pour revenir sur le design original. » Pendant deux jours, un générateur a
DESSINÉ sa propre mise en page pour un rapport dont le fichier d'origine était fourni en entrée :
page en 1600 × 900 contre 1280 × 720, segments réalignés, tableau pleine page, ni fond, ni titre,
ni bouton de réinitialisation, ni signet, ni largeurs de colonnes. Vingt-trois contrôles de recette
et sept d'audit rendaient PASS, dont « en-têtes repris au caractère près, 70/70 » : l'invariant
mesuré était le texte des en-têtes, l'invariant protégé « le lecteur retrouve SON rapport ».

**Règle de reconstruction de la forge** : quand le rapport à reconstruire EXISTE et qu'il est
fourni en entrée, sa mise en page est CONSERVÉE et transposée — seules les liaisons changent.
Une mise en page générée n'est pas interdite : elle est un **repli**, déclaré avec son motif, dont
le coût reste compté. Ce qui n'existe pas, c'est le repli par omission.

`oracle-reconstruire.mjs <reconstruction.json>`, format `forge-data/reconstruction@1` —
RS1 forme (dont l'origine de la source et QUI l'a relevée) ; **RS2** doctrine du repli (`mode`
`transposition` ou `repli_genere`, ce dernier exigeant un motif ≥ 6 mots ; sous repli motivé, les
écarts sont comptés et nommés en avertissement au lieu de bloquer) ; **RS3** pages (bijection,
largeur, hauteur, ordre, visibilité) ; **RS4** visuels (bijection par page, type et géométrie à
`tolerance_px` près — prototype P24 du produit) ; **RS5** tout objet écarté porte son motif
(≥ 4 mots, convention CV4/RA4) ; **RS6** ressources portées ET référencées (une ressource copiée
que rien ne référence est un fond que le lecteur ne verra jamais). Quatre fixtures, deux sens
chacune : `reconstruction-{verte,rouge}.json` et `reconstruction-repli-{verte,rouge}.json`.

## Le verbe qualifier (TF-1186, 19/09/2026) — cinq dimensions vertes et une muette ne valent pas une garantie

La chaîne de migration s'arrêtait à la réconciliation des chiffres : rien ne disait, et aucun contrôle
ne prouvait, qu'un rapport migré PEUT REMPLACER l'original. Les mesures existaient — rendu, périmètre,
chiffres, mise en page, comportement — **dispersées**, sans composition et sans verdict de bascule. Et
une sixième dimension n'a aucun oracle possible : segments, signet, tri de colonne, largeurs, format
conditionnel, info-bulles et mise en évidence croisée ne survivent pas à l'export, seul chemin par
lequel un agent voit un rapport publié. Coût déjà payé : 22 contrôles de recette PASS et 7 d'audit
verts coexistaient avec un rapport qui n'affichait rien.

`oracle-qualifier.mjs <qualification.json>`, format `forge-data/qualification-rapport@1` — **QR1**
forme, l'ANCRE de la comparaison (le rapport d'origine, son instantané daté, qui l'a relevé), le
candidat, et les **six dimensions** du jeu fermé, chacune une fois : une dimension omise se lit comme
une dimension verte ; **QR2** chaque dimension porte son **angle mort** écrit (≥ 6 mots) — la colonne
que RF-27 exigeait, nommée « angle mort » parce que « ce que l'oracle ne prouve pas » annonce au lieu
de dire (plancher d'écriture, RF-29) ; **QR3** chaque classe porte sa pièce — `conforme_prouve` un
porteur qui EXISTE dont chaque règle citée se retrouve dans son fichier (convention CH4), avec verdict,
chiffre et date ; `ecart_assume` au moins un écart ; `non_jugeable_ici` le geste humain qui le lèverait
et son enregistreur (doctrine RN5/CH5) ; **QR4** la dimension `interactions` est non jugeable **par
construction** et rend de 5 à 8 gestes numérotés à jouer côte à côte ; **QR5** chaque écart porte son
id, son libellé et sa classe, un écart assumé nomme la décision qui l'a produit, et une dimension
conforme ne peut pas porter un écart non assumé ; **QR6** le verdict de bascule — remplaçable /
remplaçable sous conditions énumérées / non remplaçable — se **compose** des dimensions au lieu de se
poser au-dessus : chaque dimension non conforme et chaque réserve est couverte par une
condition qui la cite, et toute condition résout.

**QR7 et QR8 (TF-1190, retour RF-31)** — il manquait au contrat la classe **« définition changée »**.
Un chiffre qui diffère parce que la couche cible RECALCULE ce que la source STOCKAIT n'est ni un écart
assumé ni un défaut : il demande un arbitrage métier et **aucune correction**. Sur 4 écarts remontés au
même bac, 2 étaient de ceux-là, et les ranger en défaut aurait envoyé une équipe corriger ce qui n'est
pas cassé. **QR7** : la classe porte la définition d'origine, la définition cible et la question à
trancher (≥ 4 mots chacune), plus un `statut` du jeu fermé {a_trancher, tranchee} — et `tranchee` exige
l'**accord du commanditaire, nommé et daté**, sans quoi elle n'est pas tranchée, elle est oubliée.
Réciproquement, un écart qui déclare `recalcul_cible: true` ne peut pas être rangé ailleurs. Effet sur
la bascule : une définition tranchée et acceptée cesse d'être une réserve, celle qui reste à trancher
en est une. **QR8** : le test mécanisable qui sépare les deux causes — quand la cible recalcule un
agrégat sur une fenêtre temporelle, la part d'entités dont l'écart tombe sur un nombre **entier** de
fractions de cette fenêtre est RECALCULÉE (jamais recopiée, convention CV6/DL6) et confrontée à un
seuil **déclaré** : 122 sur 122 signe un recalcul sur fenêtre incomplète, 5 sur 316 une définition
réellement différente. Un diagnostic qui contredit sa propre mesure est refusé.

Conséquence assumée, et c'est la doctrine : tant que les interactions restent non jugeables ici,
« remplaçable » tout court est **inatteignable**, et le meilleur verdict possible nomme les gestes que
l'humain doit jouer. L'étape correspondante est **E11** de `references/MIGRATION-RAPPORT-POWERBI.md`,
insérée avant la restitution — la restitution rapporte un verdict de bascule, elle ne le fabrique pas
en chemin.

## RN6 et RS7 (TF-1188, 18/09/2026) — le résultat d'un geste se chiffre, et un champ se compte à l'occurrence

Le protocole de qualification a été exécuté sur un rapport réel le 18/09, et les trois contrôles qu'il
réclamait ont été écrits chez le produit puis joués. Confrontés à ce que cette forge portait depuis la
veille : la **fidélité de mise en page au pixel** était déjà tenue (`oracle-reconstruire`, RS3 pages,
RS4 visuels, RS6 ressources) ; deux choses ne l'étaient pas.

- `oracle-rendre` **RN6** — RN5 exige un résultat ÉCRIT, et une phrase écrite se contente de « export
  Succeeded ». C'est littéralement ce que le service affichait le 15/09 sur un PDF de **1 415 octets**
  et **zéro caractère**. Un geste qui déclare `nature: "export_rendu"` porte donc son bloc
  `mesure_export`, confronté à ses propres bornes : fichier réellement **téléchargé** (le statut du
  service n'est pas le fichier), durée sous la borne déclarée, octets au-dessus du plancher déclaré,
  chaque page du fichier exporté porte du texte, et aucun des libellés d'erreur **cherchés** n'est
  trouvé — chercher zéro libellé et n'en trouver aucun ne prouve rien. Mesure du 18/09 après
  correction : 27,0 s, 449 705 octets, 1 page, 2 235 caractères, 0 libellé. Aucun geste d'export
  déclaré : **avertissement**, jamais blocage — un rendu non joué se DIT.
- `oracle-reconstruire` **RS7** — le périmètre à l'**occurrence**. La recette du produit comptait 75
  objets de modèle distincts et 70 couples (page, en-tête) distincts, quand le rapport affichait **83
  occurrences** : deux occurrences partageant un en-tête comptaient pour une, et un champ perdu dont
  l'en-tête existe ailleurs sur la même page passait inaperçu. Quand les deux relevés déclarent leurs
  `projections`, les en-têtes se comparent en multiset par page ; une occurrence perdue ou ajoutée se
  déclare dans `ecarts_assumes`, sinon elle bloque. **RS4** compare en outre le **plan** d'un visuel
  quand la source le déclare : deux visuels superposés au plan inversé se cachent l'un l'autre sans
  un pixel d'écart.

## Migrer un rapport vers un nouveau modèle (TF-1179, 17/09/2026) — la procédure, et son contrôle

Migrer un rapport était une chaîne promise dont aucune étape n'était écrite : elles ont été
découvertes une à une par l'échec. Trois jours, 3 défauts vus par l'humain avant tout oracle,
3 fausses pistes mesurées avant la cause, 4 lots de retours avant que la procédure existe.

La procédure vit en référence : **`references/MIGRATION-RAPPORT-POWERBI.md`** — 11 étapes ordonnées
(relever les champs affichés, délimiter le périmètre, concevoir le modèle, transposer la mise en
page, recetter les liaisons, publier et reposer les identifiants, prouver le rendu par l'export lu,
réconcilier, diagnostiquer par banc, **qualifier la bascule**, restituer), chacune avec son entrée, sa
sortie et **le contrôle qui la juge** ; 14 règles ; l'arbre de diagnostic symptôme → cause ; le tableau
de ce que chaque contrôle prouve et **ne prouve pas**. Sa déclaration machine est
`references/migration-rapport-powerbi.chaine.json`.

`oracle-enchainer.mjs <chaine.json>`, format `forge-data/chaine@1` — **CH1** forme (chaque étape a
son id, son libellé, son entrée et sa sortie) ; **CH2** ordre en rangs contigus, parce que l'ordre
est la moitié de la procédure : un périmètre relevé APRÈS la conception est le périmètre du modèle ;
**CH3** chaque étape nomme un porteur du jeu fermé {oracle, script, geste_humain} dont le chemin
**EXISTE** — une étape sans porteur existant est une étape non écrite ; **CH4** toute règle citée
se retrouve **dans le fichier** de son oracle (un identifiant de règle survit à sa règle) ; **CH5**
ce qui ne se mécanise pas se déclare geste humain, nommé et **avec son enregistreur** (doctrine
RN5) ; **CH6** le document lu par les humains cite chaque étape déclarée. La procédure de la forge
passe son propre contrôle au self-test (10 étapes, 39 règles retrouvées), et la même procédure dont
un porteur est renommé y échoue sur CH3.

## Le verbe délimiter (TF-1180, 17/09/2026) — le périmètre est ce que les visuels LISENT

Le rapport d'origine porte 27 tables, 342 colonnes, 160 mesures. Ses visuels affichent 83 champs
qui lisent 66 colonnes réelles. La première proposition servait les 342, quand la demande humaine
disait « uniquement » les colonnes affichées ; puis 3 tables qu'aucun visuel ni aucune mesure ne
lit sont restées au modèle publié jusqu'à la décision D-32 du 16/09/2026. Personne n'avait demandé
ce surplus, et aucun contrôle ne comparait le SERVI au LU — `oracle-couvrir` mesure le défaut
inverse (ce que la source contient et que le livrable oublie), et une couverture parfaite est même
la façon la plus sûre de produire celui-ci.

**Règle de périmètre de la forge** : le périmètre d'un livrable migré est l'ensemble des objets
**lus par un visuel ou par une mesure affichée** du livrable d'origine, relevé sur ce **fichier
d'origine AVANT toute conception**. Tout objet publié hors de cet ensemble est un **excédent** :
il se retire du modèle publié, ou il porte son exclusion motivée. Un objet nécessaire que rien
n'affiche — clé de substitution, mesure intermédiaire — se **déclare** ; il ne se devine pas et ne
se tait pas. Rien n'est retiré de la couche de données : ce qui se réduit, c'est le modèle publié,
celui que le lecteur actualise et parcourt.

`oracle-delimiter.mjs <perimetre.json>`, format `forge-data/perimetre@1` — **DL1** forme, avec les
trois pièces qui rendent le jugement possible : la mise en page de l'origine (`mise-en-page@1`, ou
le `rendu@1` qui la porte déjà), l'usage relevé (`usage-restitution@1` de
`traduire-modele-semantique --usage-restitution`, dont la population `lue_par_mesure` est la
fermeture transitive qu'un relevé à la main manque — 45 colonnes sur 66 au cas mesuré) et le
périmètre livré (inline, ou le `source.inventaire` d'un `couverture@1` déjà relevé) ; **DL2** le
relevé s'identifie (qui, quand, et SUR QUEL FICHIER D'ORIGINE) ; **DL3** aucun champ affiché à
l'origine n'est perdu — un renommage se déclare en `correspondances`, une colonne lue par une
mesure sans être affichée est avertie et non bloquante (la migration peut recalculer la mesure) ;
**DL4** l'**excédent** — tout objet livré est lu, ou porte une exclusion motivée (≥ 4 mots,
convention CV4) — les lectures nécessaires se déclarant en `lectures_declarees`
(`relation`, `mesure_intermediaire`), dont la justification doit elle-même remonter à un objet lu ;
**DL5** les déclarations résolvent (défaut symétrique de CV3) ; **DL6** un taux déclaré se
recalcule. Fixtures `perimetre-{verte,rouge}.json`, plus la chaîne jouée au self-test : servir tout
le modèle de la fixture rend 15 excédents sur 26 objets (42,3 % lus), et le périmètre réduit PASSE.

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
**Ce que TMDL ne porte pas, et que le verbe REFUSE d'inventer** : la granularité d'un fait en une phrase,
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
```

## Mode --usage-restitution de traduire-modele-semantique (TF-0971, 14/09/2026)

`oracle-couvrir` mesure un mapping contre l'INVENTAIRE de sa source (jusqu'à 342 colonnes d'un
modèle réel) — jamais contre ce qui est réellement À L'ÉCRAN. Relevé manuel (Produit-62, RD-9) :
66 colonnes seulement mobilisées par 83 champs de 16 visuels porteurs de données (21 projetées
telles quelles, 45 lues par 54 mesures DAX affichées), 276 jamais lues, 10 tables sur 27
entièrement inutilisées. Conséquence directe : des 38 colonnes sans ligne de mapping, 20 sont
réellement mobilisées et 18 ne le sont pas — la dette bloquante réelle est deux fois plus
petite que celle que la couverture seule annonce.

`node scripts/traduire-modele-semantique.mjs --modele <dossier> --usage-restitution
--mise-en-page <fichier> [--orphelins <fichier>] [--sortie <fichier>]` — le LECTEUR DE MISE
EN PAGE, à côté du lecteur de modèle : entrée `forge-data/mise-en-page@1` (pages → visuels →
projections, nomenclature `Table.colonne` / `Table[Mesure]` déjà celle de `--inventaire`).
Rend TROIS POPULATIONS, jamais une seule mesure — `affichee` (projetée telle quelle),
`lue_par_mesure` (atteinte par FERMETURE TRANSITIVE depuis une mesure affichée, moteur de
TF-0972 réemployé) et `jamais_lue` — plus les `champs_inconnus` (une projection qui ne résout
à rien du modèle, avertie, jamais ignorée) et les tables entièrement inutilisées. **Règle
opposable** : avec `--orphelins <fichier>` (la liste que rend `oracle-couvrir` sur ses
colonnes sans ligne de mapping), le croisement dit combien sont réellement MOBILISÉES —
celles-là seules justifient la dette, les autres se déclarent en exclusion motivée
(`oracle-couvrir`, règle `exclusion`) au lieu de la gonfler. Preuve en boucle sur
`fixtures/mise-en-page-{verte,rouge}.json` + `fixtures/orphelins-usage-verte.json`.

```bash
node scripts/traduire-modele-semantique.mjs --modele fixtures/modele-semantique-verte \
     --usage-restitution --mise-en-page fixtures/mise-en-page-verte.json --orphelins fixtures/orphelins-usage-verte.json
```

## Mode --resolution-references de traduire-modele-semantique (TF-0972, 14/09/2026)

Mesure sur 160 mesures DAX d'un modèle réel (Produit-62, RD-10) : une comparaison SENSIBLE À
LA CASSE perdait une référence de colonne (DAX est insensible à la casse) ; une résolution
limitée à la table PORTEUSE ne remontait que 2 colonnes sur 8 pour une mesure qui en
référençait une AUTRE, vivant dans une autre table. Effet cumulé, sans une seule erreur
affichée : 42 colonnes lues au lieu de 45, 279 déclarées inutilisées au lieu de 276.

`node scripts/traduire-modele-semantique.mjs --modele <dossier> --resolution-references
[--sortie <fichier>]` expose une résolution NOMMÉE, contrat écrit : index insensible à la
casse ; référence qualifiée (`Table[Ref]`) résolue dans SA table ; référence non qualifiée
(`[Ref]`) cherchée D'ABORD dans la table porteuse, PUIS dans le reste du modèle (plusieurs
candidats → AMBIGUË, aucun → NON RÉSOLUE) ; FERMETURE TRANSITIVE sur les mesures (une mesure
qui n'en référence qu'une autre atteint quand même ses colonnes de base) ; un JOURNAL des
non-résolues et des ambiguës rendu AVEC le résultat, jamais à part. Limite déclarée : seule
la première ligne de l'expression DAX est lue (comme pour l'agrégation dérivée). Preuve en
boucle sur `fixtures/modele-resolution-verte/` (casse, référence croisée, fermeture
transitive, ambiguïté, référence perdue — les cinq cas dans un même modèle).

```bash
node scripts/traduire-modele-semantique.mjs --modele fixtures/modele-resolution-verte --resolution-references
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

## Le verbe rapprocher (TF-0975, 14/09/2026) — la seule preuve EXTERNE qu'une cible vise juste

`oracle-couvrir` compare un mapping à l'inventaire de SA SOURCE (l'amont) ; `oracle-reconcilier`
compare deux lots de VALEURS déjà identifiées, sous tolérance. Ce qu'un client remet quand on
lui demande à quoi ressemble le rapport est un EXPORT — des intitulés et des lignes — et rien
ne rapprochait un modèle de reconstruction de cette pièce EXTERNE. Mesure réelle : 60 en-têtes
d'un tableau livré et 60 colonnes d'un export correspondent un pour un, au même rang, zéro
orphelin dans les deux sens ; 60/66 colonnes du modèle portées par l'extrait, 6 motivées.

`oracle-rapprocher.mjs <rapprochement.json>` juge le format `forge-data/rapprochement@1` —
RA1 (forme) ; **RA2** bijection dans les DEUX SENS (tout intitulé de l'extrait est apparié ou
déclaré en écart, tout objet du modèle est apparié ou déclaré absent — un défaut sans verdict
est un OUBLI) ; **RA3** un dictionnaire de concepts déclaré n'invente rien (chaque `cote_modele`
et `cote_extrait` doit exister dans sa source) ; **RA4** chaque objet du modèle absent de
l'extrait porte son `motif` (≥ 4 mots, convention CV4) ET le `visuel` qui l'explique. Le
verbe qui lit l'export lui-même appartient à `scripts/isoler-lignes-non-donnees.mjs` (TF-0976,
en amont) ; celui qui juge la valeur à la granularité fine à `oracle-reconcilier`.

```bash
node oracles/oracle-rapprocher.mjs fixtures/rapprochement-verte.json
```

## Le verbe isoler-lignes-non-donnees (TF-0976, 14/09/2026) — le pied d'un export est une DONNÉE

Mesure : sur trois feuilles d'un export, la lecture naïve comptait 21 559/21 719/14 121 lignes
contre 21 557/21 716/14 117 réelles — une ligne vide et un pied « Filtres appliqués » de Power
BI par feuille, celui-ci atterrissant dans la PREMIÈRE colonne (les autres cellules de sa ligne
restent vides), d'où une modalité fantôme sur tout dénombrement par cette colonne. Second effet,
le plus coûteux à ignorer : ce pied est la SEULE trace que l'extrait est un instantané FILTRÉ.

`scripts/isoler-lignes-non-donnees.mjs <extrait.csv> [--sortie <fichier.json>]` LIT un export
CSV et ISOLE, en balayant depuis la FIN du fichier, trois types de lignes non-données —
`ligne_vide_terminale`, `pied_filtres_appliques`, `ligne_totaux` — et rend TOUJOURS deux
sorties : `lignes` (les données) et `contexte_de_l_extrait` (les prédicats décomposés du pied,
`null` si aucun pied n'a été trouvé, jamais inventé). Générateur, pas un oracle ; format produit
`forge-data/extrait-isole@1`. Un extrait dont le contexte n'est pas déclaré est de PORTÉE
INCONNUE — règle de contrat pour `oracle-rapprocher.mjs` (TF-0975, ci-dessus) quand cet extrait
lui sert de référence ; ce verbe-ci ne juge rien, il isole et rend.
Preuve en boucle : `oracles/self-test.mjs` sur `fixtures/extrait-pied-{verte,rouge}.csv`.

```bash
node scripts/isoler-lignes-non-donnees.mjs fixtures/extrait-pied-verte.csv
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
