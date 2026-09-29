-- Modules que l'établissement n'utilise pas : masqués du menu pour toute l'équipe.
alter table public.etablissements add column if not exists modules_masques text[] not null default '{}';
