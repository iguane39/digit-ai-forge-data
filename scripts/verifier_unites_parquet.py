#!/usr/bin/env python
"""verifier_unites_parquet.py — controle « type parquet ecrit » (TF-1065, Produit-62 RF-15,
ledger seq 119 a 122, mesure du 2026-09-11).

FAIT MESURE : fastparquet transcrit une colonne datetime64[ns] de pandas en TIMESTAMP(NANOS) ;
Databricks refuse cette unite a la lecture ([PARQUET_TYPE_ILLEGAL] Illegal Parquet type:
INT64 (TIMESTAMP(NANOS,false)), SQLSTATE 42846) alors que la recette d'export RELIT le fichier
avec le MEME moteur d'ecriture et rend PASS sur six controles — fastparquet se relit lui-meme
sans difficulte, donc un fichier que le lakehouse refusera sort vert. Sept tables sur vingt-sept
etaient concernees (dates de bail, d'indexation, de declaration).

CE CONTROLE lit le TYPE PHYSIQUE ecrit (jamais une relecture par le meme moteur) et refuse
toute colonne temporelle en nanoseconde. Deux voies MESUREES avant de choisir (aucune
dependance nouvelle payante, R-29) :
  - pyarrow, s'il est installable (n'ecrit jamais la nanoseconde par defaut depuis pandas) ;
  - fastparquet seul, via ParquetFile(f).dtypes — seule voie disponible quand pyarrow est
    bloque par une strategie de controle d'application (mesure sur ce poste le 2026-09-11 :
    pyarrow ABSENT — sa bibliotheque _compute bloquee, sa seule presence cassait
    `import pandas` — fastparquet 2026.5.0 PRESENT).
Le controle MESURE quel moteur est disponible et le DIT — jamais suppose (X2, REX-DATA.md).

Table des unites admises par destination : references/REX-DATA.md, pattern X17.

Usage :
    python verifier_unites_parquet.py <fichier.parquet>
    python verifier_unites_parquet.py --self-test      # fixture double sens, fichiers temporaires

Garde-fou (loi n. 4) : aucune connexion, aucune donnee client — fichiers Parquet synthetiques
uniquement, generes A LA VOLEE par --self-test (rien n'est commite).
"""
import json
import pathlib
import sys
import tempfile


def moteur_disponible():
    """Mesure ce qui est installable AVANT de choisir — jamais suppose (TF-1065)."""
    try:
        import pyarrow  # noqa: F401
        return "pyarrow"
    except ImportError:
        pass
    try:
        import fastparquet  # noqa: F401
        return "fastparquet"
    except ImportError:
        pass
    return None


def colonnes_nanoseconde_pyarrow(chemin):
    # Branche NON exercee sur ce poste (pyarrow absent, mesure du 2026-09-11 — X2, aucune
    # observation invente). A confirmer au premier run ou pyarrow est reellement disponible.
    import pyarrow.parquet as pq
    schema = pq.ParquetFile(str(chemin)).schema_arrow
    return [nom for nom, type_ in zip(schema.names, schema.types)
            if str(type_).startswith("timestamp") and "[ns" in str(type_)]


def colonnes_nanoseconde_fastparquet(chemin):
    # Voie mesuree et disponible sur ce poste (fastparquet 2026.5.0) — ParquetFile(f).dtypes,
    # exactement l'appel propose par la parade TF-1065, jamais une relecture par le moteur.
    from fastparquet import ParquetFile
    dtypes = ParquetFile(str(chemin)).dtypes
    return [nom for nom, dt in dtypes.items() if "datetime64[ns" in str(dt)]


def verifier(chemin):
    moteur = moteur_disponible()
    if moteur is None:
        return {"verdict": "SKIP", "moteur": None, "fichier": str(chemin),
                "motif": "ni pyarrow ni fastparquet installables sur ce poste — "
                         "le type ecrit n'est pas jugeable (mesure avant de choisir, TF-1065)"}
    lecteur = colonnes_nanoseconde_pyarrow if moteur == "pyarrow" else colonnes_nanoseconde_fastparquet
    colonnes = lecteur(chemin)
    verdict = "FAIL" if colonnes else "PASS"
    motif = (
        f"{len(colonnes)} colonne(s) en TIMESTAMP(NANOS) — refusees par Databricks a la "
        f"lecture ([PARQUET_TYPE_ILLEGAL], SQLSTATE 42846) : {', '.join(colonnes)}"
        if colonnes else "aucune colonne temporelle en nanoseconde"
    )
    return {"verdict": verdict, "moteur": moteur, "fichier": str(chemin),
            "colonnes_nanoseconde": colonnes, "motif": motif}


def self_test():
    """Fixture double sens : le MEME mecanisme que la mesure du 2026-09-11 — une colonne
    datetime64[ns] ecrite par fastparquet est REFUSEE, la meme convertie en datetime64[us]
    (la parade proposee a la forge) est ACCEPTEE. Fichiers temporaires, aucune donnee reelle
    (loi n. 4) : rien n'est commite, tout est genere et detruit dans le meme appel."""
    moteur = moteur_disponible()
    if moteur is None:
        print("SELF-TEST SKIP : ni pyarrow ni fastparquet installables sur ce poste — "
              "controle non jugeable ici (mesure avant de choisir, TF-1065)")
        return
    import pandas as pd
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        # pandas >= 2.x ne resout plus systematiquement en nanoseconde par defaut (mesure sur
        # ce poste, pandas 3.0.3 : pd.to_datetime seul rend un dtype[us]) — la resolution [ns]
        # exacte du defaut mesure le 2026-09-11 est donc forcee explicitement, jamais supposee.
        ns = pd.DataFrame({"id": [1, 2],
                            "date_bail": pd.to_datetime(["2026-01-01", "2026-06-01"]).astype("datetime64[ns]")})
        if str(ns["date_bail"].dtype) != "datetime64[ns]":
            raise SystemExit(f"SELF-TEST FAIL : fixture non conforme, dtype obtenu {ns['date_bail'].dtype}")
        fichier_rouge = tmp / "rouge_nanoseconde.parquet"
        fichier_verte = tmp / "verte_microseconde.parquet"
        ns_us = ns.copy()
        ns_us["date_bail"] = ns_us["date_bail"].astype("datetime64[us]")
        if moteur == "fastparquet":
            from fastparquet import write
            write(str(fichier_rouge), ns)      # reproduit TEL QUEL le defaut mesure le 2026-09-11
            write(str(fichier_verte), ns_us)   # la parade : conversion ns -> us avant ecriture
        else:
            # Branche pyarrow non exercee sur ce poste (X2) — ecriture explicite en ns pour
            # REPRODUIRE le defaut, jamais pour le recommander.
            import pyarrow as pa
            import pyarrow.parquet as pq
            tbl_rouge = pa.table({
                "id": pa.array(ns["id"]),
                "date_bail": pa.array(ns["date_bail"].values.astype("datetime64[ns]"), type=pa.timestamp("ns")),
            })
            pq.write_table(tbl_rouge, str(fichier_rouge))
            pq.write_table(pa.Table.from_pandas(ns_us), str(fichier_verte))
        r_rouge = verifier(fichier_rouge)
        r_verte = verifier(fichier_verte)
        echecs = []
        if r_rouge["verdict"] != "FAIL":
            echecs.append(f"rouge (ns) attendu FAIL, obtenu {r_rouge['verdict']}")
        if "date_bail" not in r_rouge.get("colonnes_nanoseconde", []):
            echecs.append("rouge : colonne « date_bail » non nommee dans colonnes_nanoseconde")
        if r_verte["verdict"] != "PASS":
            echecs.append(f"verte (us) attendu PASS, obtenu {r_verte['verdict']}")
        if echecs:
            raise SystemExit("SELF-TEST FAIL : " + " . ".join(echecs))
        print(f"Self-test verifier_unites_parquet : 2/2 PASS (moteur mesure : {moteur}) — "
              f"rouge (datetime64[ns]) refusee, verte (datetime64[us]) acceptee")


def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    if args[0] == "--self-test":
        self_test()
        return
    resultat = verifier(args[0])
    print(json.dumps(resultat, ensure_ascii=False, indent=1))
    sys.exit({"PASS": 0, "FAIL": 1, "SKIP": 2}[resultat["verdict"]])


if __name__ == "__main__":
    main()
