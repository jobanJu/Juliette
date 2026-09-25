-- Option de pointage des pauses, désactivée par défaut pour chaque établissement.
alter table public.etablissements
  add column if not exists pause_pointage_active boolean not null default false;

alter type public.type_pointage add value if not exists 'pause_debut';
alter type public.type_pointage add value if not exists 'pause_fin';
