#!/usr/bin/env python
"""mesurer_base.py — service cat-dat-08 « Mesurer une base connectée » (RD-3, SCC_ALX 13/08).

Exécute une requête SQL EN LECTURE SEULE sur un warehouse Databricks et archive le couple
requête/résultat/CIBLE : chaque chiffre d'un rapport devient remontable à sa source — c'est ce
que `oracle-restituer` exige d'un `[c:id]` et que `oracle-tracer` exige d'un lineage.
Le champ `cible` (TF-0580, 24/08) porte le profil, le warehouse, l'HÔTE et le `namespace`
OpenLineage de l'instance interrogée : le quoi et le comment étaient archivés, le OÙ ne
l'était pas — et deux workspaces d'un même groupe portent les mêmes noms de catalogues par
construction, ce qui rendait deux archives strictement indiscernables.
Porté du run SCC_ALX (scripts/dbx_sql.py, 7,2 M de lignes mesurées en conditions réelles),
généralisé : AUCUNE valeur de poste en dur — profil et warehouse viennent de
l'environnement, seuls leurs NOMS apparaissent dans les messages.

Usage :
    python mesurer_base.py <id-mesure> "<requete SQL>"
    python mesurer_base.py <id-mesure> --fichier <requete.sql>
    python mesurer_base.py --lot <lot.json>        # [{"id": ..., "sql": ...}, ...]
    python mesurer_base.py --self-test             # garde lecture-seule + cible, hors ligne

Environnement (noms seulement, jamais de valeur dans les sorties) :
    DATABRICKS_PROFILE       profil du CLI databricks (requis)
    DATABRICKS_WAREHOUSE_ID  warehouse SQL cible (requis)
    FORGE_DATA_MESURES       dossier d'archive (défaut : forge/etapes/data/mesures
                             sous le répertoire courant — le PROJET, jamais la forge)
    DATABRICKS_CONFIG_FILE   configuration du CLI où lire l'hôte du profil
                             (défaut : ~/.databrickscfg)

Garde-fou : toute requête dont la tête n'est pas SELECT / SHOW / DESCRIBE / DESC / WITH /
EXPLAIN est REFUSÉE avant tout appel réseau. La forge ne modifie jamais une base auditée.
"""
import configparser
import json
import os
import pathlib
import subprocess
import sys
import tempfile

AUTORISES = ("select", "show", "describe", "desc", "with", "explain")


def dossier_mesures() -> pathlib.Path:
    declare = os.environ.get("FORGE_DATA_MESURES")
    if declare:
        return pathlib.Path(declare)
    return pathlib.Path.cwd() / "forge" / "etapes" / "data" / "mesures"


def refuse_si_ecriture(sql: str) -> None:
    tete = sql.strip().lstrip("(").lower()
    tete = "\n".join(l for l in tete.splitlines() if not l.strip().startswith("--")).strip()
    if not tete.startswith(AUTORISES):
        raise SystemExit(f"[REFUS] requete non lecture-seule : {tete[:60]!r}")


def _environnement() -> tuple[str, str]:
    manquants = [n for n in ("DATABRICKS_PROFILE", "DATABRICKS_WAREHOUSE_ID")
                 if not os.environ.get(n)]
    if manquants:
        raise SystemExit(
            "[CONFIG] variable(s) requise(s) absente(s) : " + ", ".join(manquants)
            + " — les fournir dans l'environnement (jamais en dur dans un script)."
        )
    return os.environ["DATABRICKS_PROFILE"], os.environ["DATABRICKS_WAREHOUSE_ID"]


def cible(profil: str, warehouse: str) -> dict:
    """L'identite de l'instance interrogee — TF-0580 (retour SCC_ALX du 24/08/2026).

    LE FAIT MESURE. Une archive de mesure portait `id`, `sql`, `colonnes`, `lignes`,
    `nb_lignes`, `statement_id` — et rien d'autre. Or un poste porte couramment DEUX profils
    vers DEUX workspaces qui exposent tous deux un catalogue du meme nom : les environnements
    d'un meme groupe portent les memes noms de catalogues PAR CONSTRUCTION, c'est la regle et
    non l'exception. La meme requete y rend deux resultats differents et deux archives
    STRICTEMENT INDISCERNABLES. Soixante mesures ont ete prises ainsi en onze jours.

    POURQUOI LE NOM DU PROFIL NE SUFFIT PAS, et c'est la nuance qui compte : `-p client-a` est un
    ALIAS LOCAL. Deux postes nomment differemment le meme workspace, et le meme nom peut
    pointer ailleurs apres une edition de `~/.databrickscfg`. Ce qui identifie l'instance est
    son HOTE. On le lit donc, plutot que de tenir le profil pour une identite.

    ET SI ON NE PEUT PAS LE LIRE, on l'ECRIT. Une archive qui tait son hote sans dire pourquoi
    est exactement le defaut qu'on corrige, un cran plus bas : `hote_non_lu` porte la raison.
    """
    ident = {"profil": profil, "warehouse_id": warehouse, "hote": None}
    chemin = pathlib.Path(os.environ.get("DATABRICKS_CONFIG_FILE")
                          or (pathlib.Path.home() / ".databrickscfg"))
    if not chemin.exists():
        ident["hote_non_lu"] = f"fichier de configuration absent : {chemin}"
        return ident
    cfg = configparser.ConfigParser()
    try:
        cfg.read(chemin, encoding="utf-8")
    except (configparser.Error, OSError) as e:
        ident["hote_non_lu"] = f"configuration illisible ({type(e).__name__}) : {chemin}"
        return ident
    if not cfg.has_section(profil):
        ident["hote_non_lu"] = f"profil « {profil} » absent de {chemin}"
        return ident
    hote = (cfg.get(profil, "host", fallback="") or "").strip()
    if not hote:
        ident["hote_non_lu"] = f"profil « {profil} » sans clef `host` dans {chemin}"
        return ident
    ident["hote"] = hote
    # Forme OpenLineage `scheme://authority` (forge-data/lineage@1, regle T7) : l'archive se
    # branche telle quelle sur un lineage sans que personne ait a recomposer l'identite.
    ident["namespace"] = "databricks://" + hote.split("://", 1)[-1].rstrip("/")
    return ident


def executer(mesure_id: str, sql: str) -> dict:
    refuse_si_ecriture(sql)
    profil, warehouse = _environnement()
    charge = {
        "warehouse_id": warehouse,
        "statement": sql,
        "wait_timeout": "50s",
        "on_wait_timeout": "CONTINUE",
        "format": "JSON_ARRAY",
        "disposition": "INLINE",
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(charge, f)
        chemin = f.name
    try:
        r = subprocess.run(
            ["databricks", "api", "post", "/api/2.0/sql/statements", "--json", "@" + chemin,
             "-p", profil],
            capture_output=True, text=True, encoding="utf-8",
        )
    finally:
        os.unlink(chemin)
    if r.returncode != 0:
        raise SystemExit(f"[ECHEC API] {r.stderr.strip()[:500]}")
    rep = json.loads(r.stdout)
    # wait_timeout dépassé : suivre le statement jusqu'à son terme.
    while rep.get("status", {}).get("state") in ("PENDING", "RUNNING"):
        sid = rep["statement_id"]
        s = subprocess.run(["databricks", "api", "get", f"/api/2.0/sql/statements/{sid}",
                            "-p", profil], capture_output=True, text=True, encoding="utf-8")
        if s.returncode != 0:
            raise SystemExit(f"[ECHEC API suivi] {s.stderr.strip()[:500]}")
        rep = json.loads(s.stdout)
    etat = rep.get("status", {}).get("state")
    if etat != "SUCCEEDED":
        msg = rep.get("status", {}).get("error", {}).get("message", "")
        raise SystemExit(f"[ECHEC SQL] etat={etat} {msg[:600]}")
    colonnes = [c["name"] for c in rep["manifest"]["schema"]["columns"]]
    lignes = rep.get("result", {}).get("data_array") or []
    mesures = dossier_mesures()
    mesures.mkdir(parents=True, exist_ok=True)
    (mesures / f"{mesure_id}.json").write_text(
        json.dumps({"id": mesure_id, "cible": cible(profil, warehouse),
                    "sql": sql, "colonnes": colonnes, "lignes": lignes,
                    "nb_lignes": len(lignes),
                    "statement_id": rep.get("statement_id")}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    return {"id": mesure_id, "colonnes": colonnes, "lignes": lignes}


def self_test() -> None:
    """Fixtures double sens du garde lecture-seule — hors ligne, aucune connexion."""
    cas = [
        ("SELECT 1", True),
        ("  WITH t AS (SELECT 1) SELECT * FROM t", True),
        ("-- commentaire\nSHOW TABLES", True),
        ("(select 1)", True),
        ("INSERT INTO x VALUES (1)", False),
        ("DELETE FROM x", False),
        ("-- ruse\nDROP TABLE x", False),
        ("UPDATE x SET a = 1", False),
    ]
    echecs = []
    for sql, attendu_ok in cas:
        try:
            refuse_si_ecriture(sql)
            obtenu_ok = True
        except SystemExit:
            obtenu_ok = False
        if obtenu_ok != attendu_ok:
            echecs.append(f"{sql!r} : attendu {'accepté' if attendu_ok else 'refusé'}")
    if echecs:
        raise SystemExit("SELF-TEST FAIL : " + " · ".join(echecs))
    # TF-0580 — `cible()` dans ses DEUX sens, hors ligne. La branche qui compte n'est pas celle
    # qui trouve l'hôte : c'est celle qui ne le trouve pas, parce qu'une archive qui tait sa
    # cible SANS DIRE POURQUOI reproduit le défaut corrigé, un cran plus bas.
    cas_cible = []
    with tempfile.TemporaryDirectory() as tmp:
        cfg = pathlib.Path(tmp) / "databrickscfg"
        cfg.write_text("".join(["[client-a]\n", "host = https://adb-0000000000000001.10.azuredatabricks.net\n", "[sans-hote]\n", "token = x\n"]), encoding="utf-8")
        avant = os.environ.get("DATABRICKS_CONFIG_FILE")
        os.environ["DATABRICKS_CONFIG_FILE"] = str(cfg)
        try:
            c = cible("client-a", "w1")
            cas_cible.append(("hôte lu", c.get("hote") == "https://adb-0000000000000001.10.azuredatabricks.net"))
            cas_cible.append(("namespace OpenLineage composé",
                              c.get("namespace") == "databricks://adb-0000000000000001.10.azuredatabricks.net"))
            cas_cible.append(("aucun motif d'échec quand l'hôte est là", "hote_non_lu" not in c))
            absent = cible("inconnu", "w1")
            cas_cible.append(("profil absent : hôte nul ET motif écrit",
                              absent["hote"] is None and "absent de" in absent.get("hote_non_lu", "")))
            cas_cible.append(("profil absent : aucun namespace inventé", "namespace" not in absent))
            sans = cible("sans-hote", "w1")
            cas_cible.append(("profil sans clef host : motif écrit",
                              sans["hote"] is None and "sans clef" in sans.get("hote_non_lu", "")))
            os.environ["DATABRICKS_CONFIG_FILE"] = str(pathlib.Path(tmp) / "jamais-ecrit")
            nul = cible("client-a", "w1")
            cas_cible.append(("configuration absente : motif écrit",
                              nul["hote"] is None and "absent" in nul.get("hote_non_lu", "")))
        finally:
            if avant is None:
                os.environ.pop("DATABRICKS_CONFIG_FILE", None)
            else:
                os.environ["DATABRICKS_CONFIG_FILE"] = avant
    rates = [nom for nom, ok in cas_cible if not ok]
    if rates:
        raise SystemExit("SELF-TEST FAIL (cible) : " + " · ".join(rates))
    total = len(cas) + len(cas_cible)
    print(f"Self-test mesurer_base : {total}/{total} PASS "
          f"({len(cas)} garde lecture-seule + {len(cas_cible)} identité de cible, double sens)")


def _imprimer(res: dict) -> None:
    print(" | ".join(res["colonnes"]))
    for l in res["lignes"]:
        print(" | ".join("NULL" if v is None else str(v) for v in l))


def main() -> None:
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    if args[0] == "--self-test":
        self_test()
        return
    if args[0] == "--lot":
        lot = json.loads(pathlib.Path(args[1]).read_text(encoding="utf-8"))
        for item in lot:
            res = executer(item["id"], item["sql"])
            print(f"### {res['id']}")
            _imprimer(res)
            print()
        return
    mesure_id = args[0]
    sql = (pathlib.Path(args[2]).read_text(encoding="utf-8")
           if len(args) > 2 and args[1] == "--fichier" else args[1])
    _imprimer(executer(mesure_id, sql))


if __name__ == "__main__":
    main()
