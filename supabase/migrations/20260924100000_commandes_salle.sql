-- Prise de commande en salle, menu et tables propres à chaque établissement.
-- Prérequis : les migrations du socle doivent déjà avoir créé etablissements et comptes.
-- Ces helpers sont répétés ici pour que l'exécution manuelle de cette migration ne bloque pas
-- si le socle a créé les tables mais pas encore ses fonctions RLS.
create or replace function public.etablissement_courant()
returns uuid language sql stable security definer set search_path = public as $$
  select etablissement_id from public.comptes where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.est_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.comptes where auth_user_id = auth.uid()) in ('directeur', 'responsable'), false);
$$;

create or replace function public.compte_actif_ou_recent()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.comptes
    where auth_user_id = auth.uid()
      and (statut = 'actif' or (statut = 'parti' and date_depart >= current_date - interval '6 months'))
  );
$$;

revoke execute on function public.etablissement_courant() from public, anon;
revoke execute on function public.est_manager() from public, anon;
revoke execute on function public.compte_actif_ou_recent() from public, anon;
grant execute on function public.etablissement_courant() to authenticated;
grant execute on function public.est_manager() to authenticated;
grant execute on function public.compte_actif_ou_recent() to authenticated;

create table if not exists tables_salle (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  nom text not null,
  couverts_max integer not null default 4 check (couverts_max between 1 and 40),
  ordre integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (etablissement_id, nom)
);

create table if not exists menu_salle (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  nom text not null,
  categorie text not null default 'Carte',
  prix_centimes integer not null check (prix_centimes >= 0),
  etat_stock text not null default 'disponible' check (etat_stock in ('disponible','quantite_limitee','rupture')),
  composition text,
  cout_matiere_centimes integer check (cout_matiere_centimes >= 0),
  ratio_matiere numeric(5,2) check (ratio_matiere >= 0),
  square_catalog_id text,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists commandes_salle (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  table_id uuid references tables_salle(id) on delete set null,
  table_nom text not null,
  couverts integer not null check (couverts between 1 and 40),
  lignes jsonb not null default '[]'::jsonb,
  statut text not null default 'en_cours' check (statut in ('en_cours','envoyee','terminee','annulee')),
  note text,
  cree_par uuid references comptes(id) on delete set null,
  cree_par_nom text not null default 'Équipe',
  square_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rend la migration rejouable si une première tentative a créé une partie des tables.
alter table menu_salle add column if not exists etat_stock text not null default 'disponible';
alter table menu_salle add column if not exists composition text;
alter table menu_salle add column if not exists cout_matiere_centimes integer;
alter table menu_salle add column if not exists ratio_matiere numeric(5,2);
alter table commandes_salle add column if not exists cree_par_nom text not null default 'Équipe';
alter table commandes_salle add column if not exists square_order_id text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menu_salle' and column_name = 'disponible'
  ) then
    execute $sql$
      update public.menu_salle
      set etat_stock = case when disponible then 'disponible' else 'rupture' end
    $sql$;
    alter table public.menu_salle drop column disponible;
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_salle_etat_stock_check') then
    alter table public.menu_salle add constraint menu_salle_etat_stock_check check (etat_stock in ('disponible','quantite_limitee','rupture'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_salle_cout_matiere_centimes_check') then
    alter table public.menu_salle add constraint menu_salle_cout_matiere_centimes_check check (cout_matiere_centimes >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_salle_ratio_matiere_check') then
    alter table public.menu_salle add constraint menu_salle_ratio_matiere_check check (ratio_matiere >= 0);
  end if;
end;
$$;

create index if not exists tables_salle_etab_idx on tables_salle(etablissement_id, ordre);
create index if not exists menu_salle_etab_idx on menu_salle(etablissement_id, categorie, ordre);
create index if not exists commandes_salle_etab_idx on commandes_salle(etablissement_id, created_at desc);

alter table tables_salle enable row level security;
alter table menu_salle enable row level security;
alter table commandes_salle enable row level security;

drop policy if exists tables_salle_read on tables_salle;
drop policy if exists tables_salle_manage on tables_salle;
drop policy if exists menu_salle_read on menu_salle;
drop policy if exists menu_salle_manage on menu_salle;
drop policy if exists commandes_salle_read on commandes_salle;
drop policy if exists commandes_salle_create on commandes_salle;
drop policy if exists commandes_salle_update on commandes_salle;

create policy tables_salle_read on tables_salle for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent());
create policy tables_salle_manage on tables_salle for all
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy menu_salle_read on menu_salle for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent());
create policy menu_salle_manage on menu_salle for all
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy commandes_salle_read on commandes_salle for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent());
create policy commandes_salle_create on commandes_salle for insert
  with check (etablissement_id = etablissement_courant() and compte_actif_ou_recent());
create policy commandes_salle_update on commandes_salle for update
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent())
  with check (etablissement_id = etablissement_courant() and compte_actif_ou_recent());
