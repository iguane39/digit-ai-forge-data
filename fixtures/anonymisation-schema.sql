-- Schéma SYNTHÉTIQUE de la recette du verbe anonymiser (TF-2011) : une petite boutique inventée,
-- quatre tables, deux chaînes de clés étrangères. Aucune donnée réelle n'a jamais vécu ici.
CREATE TABLE public.client (
    id integer NOT NULL,
    email text NOT NULL,
    nom text NOT NULL,
    prenom text NOT NULL,
    telephone text,
    date_naissance date NOT NULL,
    code_postal character(5) NOT NULL,
    sexe character(1) NOT NULL,
    pathologie text NOT NULL,
    commentaire text,
    cree_le timestamp with time zone NOT NULL,
    CONSTRAINT client_pkey PRIMARY KEY (id),
    CONSTRAINT client_email_key UNIQUE (email),
    CONSTRAINT client_sexe_check CHECK (sexe IN ('F', 'M'))
);

CREATE TABLE public.produit (
    id integer NOT NULL,
    libelle text NOT NULL,
    prix numeric(10,2) NOT NULL,
    CONSTRAINT produit_pkey PRIMARY KEY (id)
);

CREATE TABLE public.commande (
    id integer NOT NULL,
    client_id integer NOT NULL,
    date_commande date NOT NULL,
    montant numeric(10,2) NOT NULL,
    statut text NOT NULL,
    note_livraison text,
    CONSTRAINT commande_pkey PRIMARY KEY (id),
    CONSTRAINT commande_client_fk FOREIGN KEY (client_id) REFERENCES public.client (id)
);

CREATE TABLE public.ligne_commande (
    id integer NOT NULL,
    commande_id integer NOT NULL,
    produit_id integer NOT NULL,
    quantite integer NOT NULL,
    CONSTRAINT ligne_commande_pkey PRIMARY KEY (id),
    CONSTRAINT ligne_commande_commande_fk FOREIGN KEY (commande_id) REFERENCES public.commande (id),
    CONSTRAINT ligne_commande_produit_fk FOREIGN KEY (produit_id) REFERENCES public.produit (id),
    CONSTRAINT ligne_commande_quantite_check CHECK (quantite > 0)
);
