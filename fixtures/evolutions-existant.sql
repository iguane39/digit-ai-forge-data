-- Etat ACTUEL de la meme couche (fixture du verbe projeter-evolutions, TF-0937). Sans ce
-- second DDL, rien ne distingue une table creee d'une table completee ou deplacee.

CREATE TABLE catalog_any_silver_d1.ventes.ventes (
  id_commande BIGINT NOT NULL,
  id_client BIGINT NOT NULL,
  montant DECIMAL(8,2) NOT NULL,
  pays STRING NOT NULL)
USING delta;

CREATE TABLE catalog_any_bronze_d1.brut.clients (
  id_client BIGINT NOT NULL,
  statut STRING NOT NULL,
  remise DECIMAL(4,2))
USING delta;
