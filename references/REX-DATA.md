# REX — rétro-ingénierie data, lineage et restitution (anonymisé)

Extrait le 11/08/2026 d'un chantier réel de reconstruction de data lineage de bout en bout
(chaîne PGI immobilier → datalake médaillon → applications avales), **en lecture seule et
anonymisé** : aucun nom d'engagement, de client ni d'application métier ne figure ici —
règle « zéro client » du dépôt (plus stricte que le nom-seul). Chaque pattern porte sa
**portée** : `générique` (transposable tel quel) ou `contingente` (liée à l'outillage du
contexte — à réévaluer avant réemploi).

| # | Pattern | Portée | Ce que la forge en fait |
|---|---|---|---|
| X1 | **Règle d'agnosticisme** : chaque étape décrite par capacités/rôles requis ; les produits réels n'apparaissent qu'en « instanciation (exemple) » | générique | doctrine CLAUDE.md §1 — et style imposé aux futurs playbooks |
| X2 | **Conventions de fiabilité** `[FAIT]` / `[RECO]` et `[FAIT]` / `[HYPOTHÈSE]` / `[INCONNU]` sur chaque constat de rétro-doc | générique | doctrine §2 ; converge avec le « à vérifier » maison — jamais de déduction déguisée en observation |
| X3 | **Pierre de Rosette** : commencer par identifier l'artefact pivot qui relie source ↔ cible (le fichier de mapping qui donne flux → fichiers → colonnes → application) | générique | doctrine §3 ; premier geste de tout verbe tracer |
| X4 | **La topologie réelle corrige la description initiale** : la sortie « mono-cible » annoncée s'est révélée alimenter 6 applications ; un « maillon » supposé était un système distinct (base legacy à milliers de tables avec son propre DWH dimensionnel) | générique | doctrine §4 — la topologie se dérive des artefacts, pas du discours |
| X5 | **Bifurcation structurante** : table-level (rapide, robuste) vs column-level ; et pour le colonne : **statique** (code/schémas, hors-ligne) vs **runtime** (plan exécuté, exhaustif). Les transformations opaques (pivot, UDF, SQL dynamique) ne sont accessibles **qu'en runtime** | générique | doctrine §5 ; champ `type` des transformations du format lineage@1 |
| X6 | **Niveaux de maturité du lineage** 0 (topologie + table) → 1 (colonne déclaratif) → 2 (colonne statique étendu) → 3 (colonne runtime exhaustif) — viser le niveau que la valeur justifie, pas le maximum | générique | champ `confiance.niveau` (0-3) exigé par oracle-tracer T5 |
| X7 | **Validation de justesse AVANT publication** au catalogue (phase dédiée, jamais sautée) | générique | c'est un oracle exécuté avant livraison — doctrine maison confirmée par le terrain |
| X8 | **Méta-lineage** : tracer la provenance du lineage lui-même (méthode de déduction, artefacts sources, confiance par lien) | générique | champ `confiance.methode` exigé par T5 |
| X9 | **Réconciliation des identifiants** entre mondes (specs ↔ code ↔ orchestration ↔ stockage) comme phase à part entière, avec recoupement de schémas pour le colonne→colonne | générique | pattern de playbook (REX §E-F) — hors périmètre oracle v0, documenté |
| X10 | **Ne pas bloquer sur une source injoignable** : démarrer sur dumps/exports, inscrire l'accès comme dépendance datée | générique | converge avec `non_testables[]` maison (R-15) |
| X11 | **Preuve de faisabilité chiffrée** en tête de playbook (volumes mappés par couche, part 1:1 vs clés techniques, rejouabilité) | générique | structure de restitution — le résumé exécutif porte les chiffres sourcés |
| X12 | Instanciation du chantier : médaillon Bronze/Silver/Gold sur orchestrateur cloud + moteur Spark + stockage objet ; catalogue OpenMetadata ; format pivot OpenLineage ; capture runtime par agent Spark ; clones sparse+blobless pour gros dépôts ; jetons AAD via CLI | **contingente** | exemples d'instanciation seulement — jamais des prérequis |

**Recouvrement assumé** : les patterns X1-X2 enrichissent aussi la pratique des fiches
expert data existantes (expert-data, expert-data-platform-cloud) — signalé au registre
experts-forge comme piste, sans duplication ici.
