-- ============================================================================
-- 001 — Socle multi-établissement : établissements, comptes, rôles, RLS.
-- Architecture voulue par Jonathan : chaque établissement a un code unique
-- (ex. LILLE00001). Le directeur crée les comptes de son équipe (statut
-- 'invite'), chaque salarié rejoint ensuite avec le code + son e-mail et
-- choisit son mot de passe (Supabase Auth). Un départ passe le compte en
-- 'parti' : accès en lecture seule maintenu 6 mois puis coupé.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create type role_compte as enum ('directeur', 'responsable', 'salarie');
create type statut_compte as enum ('invite', 'actif', 'parti');
create type poste_equipe as enum ('salle', 'cuisine', 'plonge', 'extra');

create table etablissements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  nom text not null,
  ville text,
  created_at timestamptz not null default now()
);

comment on table etablissements is 'Un restaurant client de Juliette (tenant). Le code est utilisé par les salariés pour rejoindre leur établissement.';

-- Un compte par personne rattachée à un établissement. auth_user_id reste
-- null tant que la personne n''a pas rejoint via rejoindre_etablissement().
-- poste/heures_contrat servent au planning (remplace l''ancien roster local).
create table comptes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  nom text not null,
  prenom text not null,
  email text,
  role role_compte not null default 'salarie',
  statut statut_compte not null default 'invite',
  poste poste_equipe,
  heures_contrat numeric(5,2),
  date_embauche date,
  date_depart date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table comptes is 'Annuaire d''équipe d''un établissement + accréditation. Un salarié invité (statut=invite) n''a pas encore de auth_user_id.';
comment on column comptes.statut is 'invite = créé par le directeur, pas encore rejoint. actif = a rejoint. parti = a quitté (date_depart posée), accès lecture seule 6 mois via compte_actif_ou_recent().';

create index comptes_etablissement_idx on comptes(etablissement_id);
create unique index comptes_email_etablissement_idx on comptes(etablissement_id, lower(email)) where email is not null;

-- ---- Fonctions helper (utilisées par les policies RLS de toutes les tables) ----

create or replace function compte_courant()
returns comptes
language sql stable security definer set search_path = public as $$
  select * from comptes where auth_user_id = auth.uid() limit 1;
$$;

create or replace function etablissement_courant()
returns uuid
language sql stable security definer set search_path = public as $$
  select etablissement_id from comptes where auth_user_id = auth.uid() limit 1;
$$;

create or replace function role_courant()
returns role_compte
language sql stable security definer set search_path = public as $$
  select role from comptes where auth_user_id = auth.uid() limit 1;
$$;

create or replace function est_manager()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from comptes where auth_user_id = auth.uid()) in ('directeur', 'responsable'), false);
$$;

-- Accès en lecture maintenu 6 mois après un départ (voir architecture décrite par Jonathan).
create or replace function compte_actif_ou_recent()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from comptes
    where auth_user_id = auth.uid()
      and (statut = 'actif' or (statut = 'parti' and date_depart >= (current_date - interval '6 months')))
  );
$$;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger comptes_set_updated_at before update on comptes
  for each row execute function set_updated_at();

create or replace function proteger_code_etablissement()
returns trigger language plpgsql as $$
begin
  if new.code <> old.code then
    raise exception 'Le code établissement ne peut pas être modifié';
  end if;
  return new;
end;
$$;

create trigger etablissements_proteger_code before update on etablissements
  for each row execute function proteger_code_etablissement();

-- ---- Bootstrap : créer un établissement (premier directeur) ----
-- SECURITY DEFINER car à cet instant l''appelant n''a encore aucun compte, donc aucune policy RLS
-- normale ne le laisserait insérer quoi que ce soit — c''est la seule porte d''entrée.
create or replace function creer_etablissement(p_nom text, p_ville text, p_prenom_directeur text, p_nom_directeur text)
returns comptes
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_etab_id uuid;
  v_compte comptes;
  v_tentative int := 0;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if exists (select 1 from comptes where auth_user_id = auth.uid()) then
    raise exception 'Ce compte est déjà rattaché à un établissement';
  end if;

  loop
    v_code := upper(left(regexp_replace(unaccent(coalesce(p_ville, 'ETAB')), '[^a-zA-Z]', '', 'g') || 'XXXXX', 5))
              || lpad(floor(random() * 100000)::text, 5, '0');
    begin
      insert into etablissements (code, nom, ville) values (v_code, p_nom, p_ville) returning id into v_etab_id;
      exit;
    exception when unique_violation then
      v_tentative := v_tentative + 1;
      if v_tentative > 5 then
        raise exception 'Impossible de générer un code établissement unique, réessaie';
      end if;
    end;
  end loop;

  insert into comptes (auth_user_id, etablissement_id, nom, prenom, email, role, statut)
  values (
    auth.uid(), v_etab_id, p_nom_directeur, p_prenom_directeur,
    (select email from auth.users where id = auth.uid()),
    'directeur', 'actif'
  )
  returning * into v_compte;

  return v_compte;
end;
$$;

comment on function creer_etablissement is 'Crée un nouvel établissement + son premier compte directeur (l''appelant), généré avec un code unique de rejointe.';

-- ---- Rejoindre un établissement existant avec le code + son e-mail ----
-- L''e-mail doit correspondre à celui que le directeur a saisi en créant l''invitation : c''est ce
-- qui rattache le auth.users fraîchement créé (signup Supabase Auth classique) au bon compte
-- 'invite' plutôt qu''à un autre, dans le cas où deux personnes portent le même nom.
create or replace function rejoindre_etablissement(p_code text, p_email text)
returns comptes
language plpgsql security definer set search_path = public as $$
declare
  v_etab_id uuid;
  v_compte comptes;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if exists (select 1 from comptes where auth_user_id = auth.uid()) then
    raise exception 'Ce compte est déjà rattaché à un établissement';
  end if;

  select id into v_etab_id from etablissements where code = upper(trim(p_code));
  if v_etab_id is null then
    raise exception 'Code établissement invalide';
  end if;

  update comptes
    set auth_user_id = auth.uid(), statut = 'actif', updated_at = now()
    where etablissement_id = v_etab_id
      and email is not null
      and lower(email) = lower(trim(p_email))
      and statut = 'invite'
      and auth_user_id is null
    returning * into v_compte;

  if v_compte.id is null then
    raise exception 'Aucune invitation en attente ne correspond à ce code et cet e-mail';
  end if;

  return v_compte;
end;
$$;

comment on function rejoindre_etablissement is 'Rattache l''utilisateur Supabase Auth connecté (déjà signé, mot de passe déjà choisi côté client) au compte invité correspondant au code établissement + e-mail.';

-- ---- RLS ----

alter table etablissements enable row level security;
alter table comptes enable row level security;

create policy etablissements_select on etablissements for select
  using (id = etablissement_courant());

create policy etablissements_update on etablissements for update
  using (id = etablissement_courant() and role_courant() = 'directeur')
  with check (id = etablissement_courant());

create policy comptes_select on comptes for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent());

create policy comptes_insert on comptes for insert
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy comptes_update on comptes for update
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant());

create policy comptes_delete on comptes for delete
  using (etablissement_id = etablissement_courant() and est_manager());
