--
-- PostgreSQL database dump (extrait synthétique, schéma seul — pg_dump --schema-only)
-- Fixture verte du verbe importer (TF-0139) : couvre NOT NULL, CHECK bornes (forme cast
-- pg_dump `>= (0)::numeric`), CHECK ensemble (forme littérale IN et forme réécrite pg_dump
-- `= ANY (ARRAY[...])`), CHECK BETWEEN, UNIQUE et PRIMARY KEY (inline et via ALTER TABLE).
--

CREATE TABLE public.ventes (
    id_commande integer NOT NULL,
    id_produit integer NOT NULL,
    montant numeric(10,2) NOT NULL,
    pays character varying(2) NOT NULL,
    email_client text,
    date_maj timestamp without time zone NOT NULL,
    CONSTRAINT ventes_montant_check CHECK (((montant >= (0)::numeric) AND (montant <= (100000)::numeric))),
    CONSTRAINT ventes_pays_check CHECK (((pays)::text = ANY (ARRAY[('FR'::character varying)::text, ('BE'::character varying)::text, ('LU'::character varying)::text])))
);

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_pkey PRIMARY KEY (id_commande);

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_email_client_key UNIQUE (email_client);

CREATE TABLE public.clients (
    id_client integer NOT NULL,
    statut character varying(20) NOT NULL,
    remise numeric(4,2),
    CONSTRAINT clients_statut_check CHECK ((statut IN ('actif', 'inactif', 'suspendu'))),
    CONSTRAINT clients_remise_check CHECK ((remise BETWEEN 0 AND 50))
);

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id_client);
