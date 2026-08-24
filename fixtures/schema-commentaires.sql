-- Fixture TF-0585 (retour SCC_ALX du 24/08) — LES COMMENTAIRES DU SCHEMA, dans les deux sens.
--
-- Ce que le cas fondateur a etabli : le commentaire d'une colonne est une source de verite de
-- PREMIER ORDRE. Celui de `activite.cod_activite` declare de quel systeme le code est repris, et
-- c'est lui qui a tranche un sujet reste ouvert TROIS TOURS d'analyse. L'importeur le rangeait
-- avec GRANT et SET sous « hors perimetre, ignore ».
--
-- Et le piege, present exprès : le commentaire de `client.cod_activite` renvoie a une table
-- `ref.activites` — AU PLURIEL — que le schema ne porte pas. Sur le cas reel, un commentaire de
-- cle etrangere de cette forme avait traverse trois revues sans etre releve.
--
-- Le troisieme commentaire cite `ref.activite.cod_activite`, qui EXISTE : il est la pour tenir le
-- second sens du controle. Au premier passage, l'oracle l'accusait — la citation n'etait pas
-- normalisee comme les noms du schema. Un controle qui crie un coup sur deux se fait desactiver.

CREATE TABLE ref.activite (
    cod_activite text NOT NULL,
    libelle text
);
CREATE TABLE ref.client (
    cod_client text NOT NULL,
    cod_activite text,
    CONSTRAINT fk_client_activite FOREIGN KEY (cod_activite) REFERENCES ref.activites (cod_activite)
);
COMMENT ON TABLE ref.activite IS 'Referentiel des activites du preneur.';
COMMENT ON COLUMN ref.activite.cod_activite IS 'Code repris du systeme tiers, aligne sur ref.activite.cod_activite.';
COMMENT ON COLUMN ref.client.cod_activite IS 'Cle etrangere vers ref.activites.cod_activite (table au pluriel).';
