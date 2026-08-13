#!/usr/bin/env python
"""mesurer_base.py — service cat-dat-08 « Mesurer une base connectée » (RD-3, SCC_ALX 13/08).

Exécute une requête SQL EN LECTURE SEULE sur un warehouse Databricks et archive le couple
requête/résultat : chaque chiffre d'un rapport devient remontable à sa source — c'est ce
que `oracle-restituer` exige d'un `[c:id]` et que `oracle-tracer` exige d'un lineage.
Porté du run SCC_ALX (scripts/dbx_sql.py, 7,2 M de lignes mesurées en conditions réelles),
généralisé : AUCUNE valeur de poste en dur — profil et warehouse viennent de
l'environnement, seuls leurs NOMS apparaissent dans les messages.

Usage :
    python mesurer_base.py <id-mesure> "<requete SQL>"
    python mesurer_base.py <id-mesure> --fichier <requete.sql>
    python mesurer_base.py --lot <lot.json>        # [{"id": ..., "sql": ...}, ...]
    python mesurer_base.py --self-test             # garde lecture-seule, hors ligne

Environnement (noms seulement, jamais de valeur dans les sorties) :
    DATABRICKS_PROFILE       profil du CLI databricks (requis)
    DATABRICKS_WAREHOUSE_ID  warehouse SQL cible (requis)
    FORGE_DATA_MESURES       dossier d'archive (défaut : forge/etapes/data/mesures
                             sous le répertoire courant — le PROJET, jamais la forge)

Garde-fou : toute requête dont la tête n'est pas SELECT / SHOW / DESCRIBE / DESC / WITH /
EXPLAIN est REFUSÉE avant tout appel réseau. La forge ne modifie jamais une base auditée.
"""
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
        json.dumps({"id": mesure_id, "sql": sql, "colonnes": colonnes, "lignes": lignes,
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
    print(f"Self-test mesurer_base : {len(cas)}/{len(cas)} PASS (garde lecture-seule, double sens)")


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
