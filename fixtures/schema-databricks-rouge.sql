-- Export Databricks sans aucune table : une vue seule (fixture rouge du dialecte Databricks du
-- verbe importer, TF-0858). Doit être refusée proprement (exit 2), jamais transformée en un
-- brouillon inventé — une vue n'a ni contrainte ni schéma physique à contractualiser.
CREATE VIEW catalog_any_gold_d1.ventes.v_ventes_par_pays AS
SELECT pays, SUM(montant) AS montant_total
FROM catalog_any_silver_d1.ventes.ventes
GROUP BY pays;
