-- Nature du contrat (CDI / CDD / Intérim) sur la fiche collaborateur, et taux horaire brut rangé à
-- part dans comptes_remuneration : comptes est lisible par toute l'équipe (annuaire), alors que le
-- taux brut ne doit être lisible que par le Directeur de l'établissement et par le salarié lui-même.
alter table public.comptes add column if not exists nature_contrat text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comptes_nature_contrat_check') then
    alter table public.comptes add constraint comptes_nature_contrat_check
      check (nature_contrat is null or nature_contrat in ('cdi', 'cdd', 'interim'));
  end if;
end $$;

create or replace function public.est_directeur_de(p_etablissement_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select role = 'directeur' from comptes
    where auth_user_id = auth.uid() and etablissement_id = p_etablissement_id and statut = 'actif'
  ), false);
$$;

create table if not exists public.comptes_remuneration (
  compte_id uuid primary key references public.comptes(id) on delete cascade,
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  taux_brut numeric check (taux_brut is null or taux_brut >= 0),
  updated_at timestamptz not null default now()
);
create index if not exists comptes_remuneration_etab_idx on public.comptes_remuneration(etablissement_id);

alter table public.comptes_remuneration enable row level security;

drop policy if exists remuneration_select on public.comptes_remuneration;
create policy remuneration_select on public.comptes_remuneration for select to authenticated
  using (
    (select public.est_directeur_de(etablissement_id))
    or compte_id in (select id from public.comptes where auth_user_id = (select auth.uid()))
  );

drop policy if exists remuneration_write on public.comptes_remuneration;
create policy remuneration_write on public.comptes_remuneration for all to authenticated
  using ((select public.est_directeur_de(etablissement_id)))
  with check ((select public.est_directeur_de(etablissement_id)));
