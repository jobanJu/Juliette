-- Préréglages des contrats de travail, par établissement : postes types (intitulé, statut, niveau,
-- échelon, salaire, heures) et choix par défaut (repas, tenue, matériel, primes, paraphes…), pour
-- qu'un nouveau contrat démarre déjà rempli. Réservé au directeur (contient des salaires).

create table if not exists public.contrats_reglages (
  etablissement_id uuid primary key references public.etablissements(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.contrats_reglages enable row level security;

drop policy if exists contrats_reglages_directeur on public.contrats_reglages;
create policy contrats_reglages_directeur on public.contrats_reglages for all to authenticated
  using ((select public.est_directeur_de(etablissement_id)))
  with check ((select public.est_directeur_de(etablissement_id)));

grant select, insert, update, delete on public.contrats_reglages to authenticated;

drop trigger if exists contrats_reglages_updated_at on public.contrats_reglages;
create trigger contrats_reglages_updated_at before update on public.contrats_reglages
  for each row execute function public.set_updated_at();
