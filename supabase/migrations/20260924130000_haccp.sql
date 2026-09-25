-- HACCP : plan de nettoyage, relevés de température, traçabilité, refroidissements.
-- (La réception de marchandise garde ses tables `commandes_envoyees` / `receptions`.)
--
-- haccp_config : un document jsonb par établissement et par clé ("plan_nettoyage", "equipements").
-- haccp_enregistrements : chaque case cochée, relevé, étiquette ou refroidissement ; le détail
-- propre au type est dans `data`.
--
-- RLS : toute l'équipe active lit et enregistre (c'est elle qui nettoie et relève les
-- températures) ; le plan et les équipements ne sont modifiables que par Responsable/Directeur ;
-- un enregistrement ne se supprime que par son auteur ou un Responsable/Directeur.

create table if not exists public.haccp_config (
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  cle text not null check (cle in ('plan_nettoyage', 'equipements')),
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (etablissement_id, cle)
);

create table if not exists public.haccp_enregistrements (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  type text not null check (type in ('nettoyage', 'temperature', 'tracabilite', 'refroidissement')),
  data jsonb not null default '{}'::jsonb,
  compte_id uuid references public.comptes(id) on delete set null,
  auteur text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists haccp_enregistrements_etab_date_idx
  on public.haccp_enregistrements (etablissement_id, created_at desc);
create index if not exists haccp_enregistrements_compte_idx
  on public.haccp_enregistrements (compte_id);

drop trigger if exists haccp_config_updated_at on public.haccp_config;
create trigger haccp_config_updated_at before update on public.haccp_config
  for each row execute function public.set_updated_at();
drop trigger if exists haccp_enregistrements_updated_at on public.haccp_enregistrements;
create trigger haccp_enregistrements_updated_at before update on public.haccp_enregistrements
  for each row execute function public.set_updated_at();

alter table public.haccp_config enable row level security;
alter table public.haccp_enregistrements enable row level security;

drop policy if exists haccp_config_lecture on public.haccp_config;
create policy haccp_config_lecture on public.haccp_config for select to authenticated
  using ((select public.est_membre_actif(etablissement_id)));

drop policy if exists haccp_config_gestion on public.haccp_config;
create policy haccp_config_gestion on public.haccp_config for all to authenticated
  using ((select public.est_manager_de(etablissement_id)))
  with check ((select public.est_manager_de(etablissement_id)));

drop policy if exists haccp_enreg_lecture on public.haccp_enregistrements;
create policy haccp_enreg_lecture on public.haccp_enregistrements for select to authenticated
  using ((select public.est_membre_actif(etablissement_id)));

drop policy if exists haccp_enreg_ajout on public.haccp_enregistrements;
create policy haccp_enreg_ajout on public.haccp_enregistrements for insert to authenticated
  with check (
    (select public.est_membre_actif(etablissement_id))
    and compte_id = (select public.mon_compte_id(etablissement_id))
  );

-- Mise à jour ouverte à l'équipe : un refroidissement lancé par un cuisinier peut être clôturé par
-- un autre.
drop policy if exists haccp_enreg_maj on public.haccp_enregistrements;
create policy haccp_enreg_maj on public.haccp_enregistrements for update to authenticated
  using ((select public.est_membre_actif(etablissement_id)))
  with check ((select public.est_membre_actif(etablissement_id)));

drop policy if exists haccp_enreg_suppression on public.haccp_enregistrements;
create policy haccp_enreg_suppression on public.haccp_enregistrements for delete to authenticated
  using (
    (select public.est_manager_de(etablissement_id))
    or compte_id = (select public.mon_compte_id(etablissement_id))
  );
