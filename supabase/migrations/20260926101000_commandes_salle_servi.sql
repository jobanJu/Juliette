-- Commandes en salle : la cuisine marque un bon « prêt » (servi_at) sans le clore.
-- Cycle d'un bon : en_cours (prise de commande) → envoyee (en cuisine, stock décompté)
--                  → servi_at renseigné (prêt / servi) → terminee (table encaissée) ; ou annulee.
alter table public.commandes_salle add column if not exists servi_at timestamptz;
