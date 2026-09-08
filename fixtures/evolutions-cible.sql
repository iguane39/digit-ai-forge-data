-- Etat VISE d'une couche Silver (fixture du verbe projeter-evolutions, TF-0937) — sortie de
-- SHOW CREATE TABLE, dialecte Databricks. A comparer a fixtures/evolutions-existant.sql :
-- une table completee et corrigee, une table deplacee depuis Bronze, une table creee.

CREATE TABLE catalog_any_silver_d1.ventes.ventes (
  id_commande BIGINT NOT NULL COMMENT 'Identifiant de commande, repris du systeme amont de caisse',
  id_client BIGINT NOT NULL,
  montant DECIMAL(10,2) NOT NULL COMMENT 'Montant TTC en euros, elargi de DECIMAL(8,2)',
  pays STRING NOT NULL,
  date_maj TIMESTAMP_NTZ NOT NULL,
  CONSTRAINT ventes_pk PRIMARY KEY (id_commande))
USING delta
COMMENT 'Ventes conformees de la couche Silver';

CREATE TABLE catalog_any_silver_d1.ventes.clients (
  id_client BIGINT NOT NULL,
  statut STRING NOT NULL COMMENT 'Statut du client : actif, inactif ou suspendu',
  remise DECIMAL(4,2),
  actif BOOLEAN NOT NULL)
USING delta;

CREATE TABLE servi.ventes_mensuelles (
  mois DATE NOT NULL,
  pays STRING NOT NULL,
  total_ht DECIMAL(12,2) NOT NULL)
USING delta;
