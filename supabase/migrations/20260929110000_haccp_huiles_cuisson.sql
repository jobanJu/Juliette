-- HACCP : contrôle des huiles de friture (et collecte par un prestataire), points de cuisson, et
-- choix des rubriques affichées.
--
-- haccp_config :
--   « huiles »    { friteuses: [{ id, nom, capacite_l }], seuil_polaires, prestataire: { nom, contact,
--                   telephone, email, adresse, frequence, note } }
--   « cuisson »   [{ id, nom, seuil }]  catégories de produits et température à cœur minimale
--   « rubriques » [clé d'onglet…]       onglets HACCP masqués par l'établissement
-- haccp_enregistrements :
--   « huile »     { friteuse_id, friteuse, action: controle|filtration|changement|collecte,
--                   polaires?, temperature?, conforme?, litres?, bordereau?, remarque? }
--   « cuisson »   { produit, categorie, seuil, valeur, conforme, action? }

alter table public.haccp_config drop constraint if exists haccp_config_cle_check;
alter table public.haccp_config add constraint haccp_config_cle_check
  check (cle in ('plan_nettoyage', 'equipements', 'produits_dlc', 'tracabilite', 'huiles', 'cuisson', 'rubriques'));

alter table public.haccp_enregistrements drop constraint if exists haccp_enregistrements_type_check;
alter table public.haccp_enregistrements add constraint haccp_enregistrements_type_check
  check (type in ('nettoyage', 'temperature', 'tracabilite', 'refroidissement', 'production', 'huile', 'cuisson'));
