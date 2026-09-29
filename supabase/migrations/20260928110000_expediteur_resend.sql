-- Adresse d'expédition propre à chaque établissement pour les commandes fournisseurs.
alter table public.etablissements
  add column if not exists email_expediteur text;
