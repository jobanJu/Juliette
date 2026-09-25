-- ============================================================================
-- 002 — RH & planning : créneaux (planning), congés, pointages, messagerie.
-- Toutes ces tables référencent directement comptes(id) : le "roster" du
-- planning et l''annuaire d''équipe sont désormais la même chose (comptes),
-- fini le doublon roster local séparé de l''appli localStorage.
-- ============================================================================

create type type_creneau as enum ('shift', 'repos', 'conge');

create table planning_creneaux (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  compte_id uuid not null references comptes(id) on delete cascade,
  date date not null,
  type type_creneau not null default 'shift',
  heure_debut time,
  heure_fin time,
  pause_minutes integer,
  note text,
  created_by uuid references comptes(id),
  created_at timestamptz not null default now(),
  constraint planning_creneau_horaires check (
    (type = 'shift' and heure_debut is not null and heure_fin is not null)
    or (type <> 'shift' and heure_debut is null and heure_fin is null and pause_minutes is null)
  )
);

comment on table planning_creneaux is 'Grille hebdomadaire : un créneau travaillé (shift, avec pause en durée), un repos ou un congé.';

create index planning_creneaux_etab_date_idx on planning_creneaux(etablissement_id, date);
create index planning_creneaux_compte_idx on planning_creneaux(compte_id, date);

create type statut_conge as enum ('en_attente', 'validee', 'refusee');

create table conges (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  compte_id uuid not null references comptes(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  motif text,
  statut statut_conge not null default 'en_attente',
  decide_par uuid references comptes(id),
  decide_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conges_dates_valides check (date_fin >= date_debut)
);

create index conges_etab_idx on conges(etablissement_id, statut);
create index conges_compte_idx on conges(compte_id);

create type type_pointage as enum ('arrivee', 'depart');

create table pointages (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  compte_id uuid not null references comptes(id) on delete cascade,
  type type_pointage not null,
  horodatage timestamptz not null,
  manuel boolean not null default false,
  created_by uuid references comptes(id),
  created_at timestamptz not null default now()
);

create index pointages_etab_compte_idx on pointages(etablissement_id, compte_id, horodatage);

create table messages (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  compte_id uuid not null references comptes(id) on delete cascade,
  texte text not null,
  created_at timestamptz not null default now()
);

create index messages_etab_idx on messages(etablissement_id, created_at);

-- ---- RLS ----

alter table planning_creneaux enable row level security;
alter table conges enable row level security;
alter table pointages enable row level security;
alter table messages enable row level security;

-- Planning : tout le monde de l''établissement consulte, seul directeur/responsable gère
-- (canManagePlanning côté appli).
create policy planning_select on planning_creneaux for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent());

create policy planning_insert on planning_creneaux for insert
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy planning_update on planning_creneaux for update
  using (etablissement_id = etablissement_courant() and est_manager());

create policy planning_delete on planning_creneaux for delete
  using (etablissement_id = etablissement_courant() and est_manager());

-- Congés : chacun voit ses propres demandes, directeur/responsable voient tout et valident/refusent ;
-- l''auteur peut retirer sa demande tant qu''elle est en attente (comme dans l''appli actuelle).
create policy conges_select on conges for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent()
    and (compte_id = (select id from comptes where auth_user_id = auth.uid()) or est_manager()));

create policy conges_insert on conges for insert
  with check (etablissement_id = etablissement_courant()
    and compte_id = (select id from comptes where auth_user_id = auth.uid()));

create policy conges_update on conges for update
  using (etablissement_id = etablissement_courant() and (
    est_manager()
    or (compte_id = (select id from comptes where auth_user_id = auth.uid()) and statut = 'en_attente')
  ));

create policy conges_delete on conges for delete
  using (etablissement_id = etablissement_courant() and (
    est_manager()
    or (compte_id = (select id from comptes where auth_user_id = auth.uid()) and statut = 'en_attente')
  ));

-- Pointages : chacun pointe pour soi-même, directeur/responsable voient/corrigent toute l''équipe.
create policy pointages_select on pointages for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent()
    and (compte_id = (select id from comptes where auth_user_id = auth.uid()) or est_manager()));

create policy pointages_insert on pointages for insert
  with check (etablissement_id = etablissement_courant() and (
    compte_id = (select id from comptes where auth_user_id = auth.uid())
    or est_manager()
  ));

create policy pointages_update on pointages for update
  using (etablissement_id = etablissement_courant() and est_manager());

create policy pointages_delete on pointages for delete
  using (etablissement_id = etablissement_courant() and est_manager());

-- Messagerie : mur d''équipe — tout le monde lit et écrit, chacun supprime ses messages,
-- directeur/responsable peuvent modérer (supprimer n''importe quel message).
create policy messages_select on messages for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent());

create policy messages_insert on messages for insert
  with check (etablissement_id = etablissement_courant()
    and compte_id = (select id from comptes where auth_user_id = auth.uid()));

create policy messages_delete on messages for delete
  using (etablissement_id = etablissement_courant() and (
    est_manager()
    or compte_id = (select id from comptes where auth_user_id = auth.uid())
  ));
