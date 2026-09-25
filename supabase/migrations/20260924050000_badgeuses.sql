-- Badgeuse (borne de pointage) : un appareil connecté une fois par le Directeur (code établissement
-- + email + mot de passe) reçoit un jeton aléatoire ; seule son empreinte SHA-256 est gardée ici.
-- Pas de policy RLS : seules les routes serveur /api/badgeuse/* (clé service_role) y accèdent.
create table if not exists public.badgeuses (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  token_hash text not null unique,
  nom text,
  cree_par uuid references public.comptes(id) on delete set null,
  created_at timestamptz not null default now(),
  derniere_activite timestamptz,
  revoquee_at timestamptz,
  echecs integer not null default 0,
  bloquee_jusqua timestamptz
);
create index if not exists badgeuses_etablissement_idx on public.badgeuses(etablissement_id);
alter table public.badgeuses enable row level security;

-- Chaque fiche doit avoir son code personnel pour pouvoir badger : on en génère un (6 chiffres,
-- unique) pour les comptes qui n'en avaient pas encore (ex. Directeur créé via /creer-etablissement).
do $$
declare
  r record;
  essai text;
begin
  for r in select id from public.comptes where code_badgeuse is null loop
    loop
      essai := (100000 + floor(random() * 900000))::int::text;
      begin
        update public.comptes set code_badgeuse = essai where id = r.id;
        exit;
      exception when unique_violation then
      end;
    end loop;
  end loop;
end $$;

-- Et pour les comptes créés ensuite par un autre chemin que l'invitation (création d'établissement,
-- rattachement multi-site…) : code généré automatiquement à l'insertion s'il manque.
create or replace function public.comptes_code_badgeuse_auto()
returns trigger language plpgsql set search_path to 'public' as $$
declare
  essai text;
begin
  if new.code_badgeuse is null then
    loop
      essai := (100000 + floor(random() * 900000))::int::text;
      exit when not exists (select 1 from comptes where code_badgeuse = essai);
    end loop;
    new.code_badgeuse := essai;
  end if;
  return new;
end $$;

drop trigger if exists comptes_code_badgeuse_auto on public.comptes;
create trigger comptes_code_badgeuse_auto before insert on public.comptes
  for each row execute function public.comptes_code_badgeuse_auto();
