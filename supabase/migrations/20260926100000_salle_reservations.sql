-- Salle : règles d'accès par établissement, réservations, temps réel.
--
-- 1. Les règles de commandes_salle, tables_salle et menu_salle utilisaient etablissement_courant()
--    (« le premier compte trouvé ») et est_manager() (rôle de ce même compte) : faux dès qu'une
--    personne travaille dans deux établissements. On passe aux fonctions par établissement.
-- 2. Nouvelle table `reservations` : le carnet de réservations (l'existante briefing_reservations ne
--    garde qu'un nombre de couverts par jour).
-- 3. Accès par défaut : réservations et HACCP ouverts aux responsables et salariés.
-- 4. Temps réel sur commandes_salle et reservations (la cuisine voit arriver les bons).

-- 1. Règles par établissement ------------------------------------------------------------------
drop policy if exists commandes_salle_create on public.commandes_salle;
drop policy if exists commandes_salle_read on public.commandes_salle;
drop policy if exists commandes_salle_update on public.commandes_salle;
create policy commandes_salle_create on public.commandes_salle for insert to authenticated
  with check (est_membre_actif(etablissement_id));
create policy commandes_salle_read on public.commandes_salle for select to authenticated
  using (est_membre_actif(etablissement_id));
create policy commandes_salle_update on public.commandes_salle for update to authenticated
  using (est_membre_actif(etablissement_id)) with check (est_membre_actif(etablissement_id));

drop policy if exists tables_salle_manage on public.tables_salle;
drop policy if exists tables_salle_read on public.tables_salle;
create policy tables_salle_manage on public.tables_salle for all to authenticated
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));
create policy tables_salle_read on public.tables_salle for select to authenticated
  using (est_membre_actif(etablissement_id));

drop policy if exists menu_salle_manage on public.menu_salle;
drop policy if exists menu_salle_read on public.menu_salle;
create policy menu_salle_manage on public.menu_salle for all to authenticated
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));
create policy menu_salle_read on public.menu_salle for select to authenticated
  using (est_membre_actif(etablissement_id));

-- 2. Réservations ----------------------------------------------------------------------------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  date date not null,
  heure time not null,
  nom text not null check (length(trim(nom)) > 0),
  telephone text,
  email text,
  couverts integer not null check (couverts between 1 and 200),
  table_id uuid references public.tables_salle(id) on delete set null,
  statut text not null default 'confirmee' check (statut in ('confirmee', 'arrivee', 'annulee', 'no_show')),
  note text,
  source text not null default 'telephone' check (source in ('telephone', 'sur_place', 'en_ligne', 'autre')),
  cree_par uuid references public.comptes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reservations_etab_date_idx on public.reservations (etablissement_id, date, heure);

drop trigger if exists reservations_updated_at on public.reservations;
create trigger reservations_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();

alter table public.reservations enable row level security;

drop policy if exists reservations_lecture on public.reservations;
create policy reservations_lecture on public.reservations for select to authenticated
  using (est_membre_actif(etablissement_id));
drop policy if exists reservations_ajout on public.reservations;
create policy reservations_ajout on public.reservations for insert to authenticated
  with check (est_membre_actif(etablissement_id));
drop policy if exists reservations_maj on public.reservations;
create policy reservations_maj on public.reservations for update to authenticated
  using (est_membre_actif(etablissement_id)) with check (est_membre_actif(etablissement_id));
drop policy if exists reservations_suppression on public.reservations;
create policy reservations_suppression on public.reservations for delete to authenticated
  using (est_manager_de(etablissement_id));
drop policy if exists reservations_module_access on public.reservations;
create policy reservations_module_access on public.reservations as restrictive for all to authenticated
  using (acces_module_de(etablissement_id, 'reservations')) with check (acces_module_de(etablissement_id, 'reservations'));

-- 3. Accès par défaut ------------------------------------------------------------------------
create or replace function public.acces_module_de(p_etablissement_id uuid, p_module text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare v_compte uuid; v_role text; v_poste text; v_override boolean;
begin
  select id, role::text, poste into v_compte, v_role, v_poste
  from comptes where auth_user_id = auth.uid() and etablissement_id = p_etablissement_id and (statut = 'actif' or (statut = 'parti' and date_depart >= current_date - interval '6 months'));
  if v_compte is null then return false; end if;
  if v_role = 'directeur' then return true; end if;
  select autorise into v_override from accreditations_acces
    where etablissement_id = p_etablissement_id and module = p_module and compte_id = v_compte limit 1;
  if found then return v_override; end if;
  if v_poste is not null then
    select autorise into v_override from accreditations_acces
      where etablissement_id = p_etablissement_id and module = p_module and poste = v_poste limit 1;
    if found then return v_override; end if;
  end if;
  if v_role = 'responsable' then
    return p_module = any(array['dashboard','commandes-caisse','configuration-commandes','inventaire','perte','aide-commande','reception','evenements','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp']);
  end if;
  return p_module = any(array['dashboard','commandes-caisse','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp']);
end $function$;

-- 4. Temps réel -------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'commandes_salle') then
    alter publication supabase_realtime add table public.commandes_salle;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reservations') then
    alter publication supabase_realtime add table public.reservations;
  end if;
end $$;
