-- Preuve d'acceptation des conditions générales lors de la souscription (version datée + horodatage).
alter table public.souscriptions
  add column if not exists conditions_version text,
  add column if not exists conditions_acceptees_at timestamptz;
