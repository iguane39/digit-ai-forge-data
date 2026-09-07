-- Export synthétique Databricks / Unity Catalog — sortie de `SHOW CREATE TABLE` sur deux tables
-- (fixture verte du dialecte Databricks du verbe importer, TF-0858, lot L1 du 07/09/2026).
-- Couvre : nom qualifié à trois segments, types Delta (BIGINT, DECIMAL, STRING, TIMESTAMP_NTZ,
-- BOOLEAN, ARRAY<STRING>), NOT NULL, CHECK bornes et CHECK IN (appliqués par le moteur),
-- PRIMARY KEY et FOREIGN KEY (informationnelles seulement — jamais appliquées), COMMENT en ligne
-- sur colonne et sur table, clauses de queue USING / TBLPROPERTIES / PARTITIONED BY.

CREATE TABLE catalog_any_silver_d1.ventes.ventes (
  id_commande BIGINT NOT NULL COMMENT 'Identifiant de commande, repris du système amont de caisse',
  id_client BIGINT NOT NULL,
  montant DECIMAL(10,2) NOT NULL COMMENT 'Montant TTC en euros',
  pays STRING NOT NULL,
  tags ARRAY<STRING> COMMENT 'Étiquettes libres de la commande',
  date_maj TIMESTAMP_NTZ NOT NULL,
  CONSTRAINT ventes_pk PRIMARY KEY (id_commande),
  CONSTRAINT ventes_client_fk FOREIGN KEY (id_client) REFERENCES catalog_any_silver_d1.ventes.clients (id_client),
  CONSTRAINT ventes_montant_check CHECK (montant >= 0 AND montant <= 100000),
  CONSTRAINT ventes_pays_check CHECK (pays IN ('FR', 'BE', 'LU')))
USING delta
COMMENT 'Ventes conformées de la couche Silver'
PARTITIONED BY (pays)
TBLPROPERTIES (
  'delta.minReaderVersion' = '1',
  'delta.minWriterVersion' = '7');

CREATE TABLE catalog_any_silver_d1.ventes.clients (
  id_client BIGINT NOT NULL,
  statut STRING NOT NULL COMMENT 'Statut du client : actif, inactif ou suspendu',
  remise DECIMAL(4,2),
  actif BOOLEAN NOT NULL,
  CONSTRAINT clients_pk PRIMARY KEY (id_client),
  CONSTRAINT clients_statut_check CHECK (statut IN ('actif', 'inactif', 'suspendu')),
  CONSTRAINT clients_remise_check CHECK (remise BETWEEN 0 AND 50))
USING delta
TBLPROPERTIES (
  'delta.minReaderVersion' = '1');
