alter table public.etablissements
  add column if not exists siret text,
  add column if not exists siren text,
  add column if not exists numero_tva text,
  add column if not exists adresse text,
  add column if not exists adresse_facturation text,
  add column if not exists telephone text,
  add column if not exists photo_couverture text;
