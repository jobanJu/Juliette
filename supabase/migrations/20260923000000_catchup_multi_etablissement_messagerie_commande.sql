-- ============================================================================
-- 005 — Rattrapage consolidé (documentation de reproductibilité).
--
-- Contexte : entre le fichier 004 (20260922120300) et aujourd'hui, une dizaine
-- de migrations ont été appliquées directement sur le projet Supabase
-- (fbzovjwzdmabekbnasnv) sans que leurs fichiers .sql d'origine soient
-- conservés dans ce dépôt — dont deux migrations de cette session même
-- (ajout de fiches_techniques.images, et les tables fournisseurs /
-- commandes_envoyees / receptions pour Aide-commande / Réception).
--
-- Plutôt que de reconstituer l'historique exact (le texte SQL original des
-- migrations intermédiaires n'est pas récupérable), ce fichier régénère l'ÉTAT
-- FINAL actuel de la base en un seul bloc idempotent, obtenu par introspection
-- directe du projet (pg_proc, pg_policies, pg_indexes, pg_constraint,
-- pg_trigger, information_schema.routine_privileges) le 2026-09-23.
--
-- ⚠️ NE PAS appliquer ce fichier sur le projet fbzovjwzdmabekbnasnv — tout son
-- contenu y est déjà en place. Il sert de référence pour reconstruire un
-- environnement Supabase local/de test identique (supabase db reset, ou une
-- nouvelle instance), et pour que `supabase/migrations/` redevienne une
-- description fidèle de la base réelle.
--
-- Changement d'architecture principal documenté ici : passage d'un modèle
-- "un compte = un seul établissement par utilisateur Auth" (fonctions
-- etablissement_courant()/role_courant()/est_manager()/compte_actif_ou_recent()
-- dérivées d'une seule ligne comptes par auth.uid()) à un modèle multi-
-- établissement ("un utilisateur Auth peut avoir plusieurs lignes comptes,
-- une par établissement rejoint" — fonctions mes_comptes()/mon_compte_id(p_etab)
-- /role_dans(p_etab)/est_manager_de(p_etab)/est_membre_actif(p_etab), toutes
-- paramétrées par l'établissement concerné). Les anciennes fonctions ont été
-- supprimées de la base ; ce fichier fait de même pour rester fidèle à l'état
-- réel. rejoindre_etablissement() a été mis à jour en conséquence (n'interdit
-- plus de rejoindre un 2e établissement) ; creer_etablissement() n'a, lui, pas
-- été mis à jour et interdit toujours d'en créer un second — comportement
-- actuel reproduit tel quel, pas corrigé ici (hors périmètre de ce fichier).
--
-- Nouveauté fonctionnelle également couverte : la messagerie d'équipe a gagné
-- des groupes/canaux (message_groups, message_group_membres, messages.group_id
-- + messages.attachments pour les pièces jointes en data URL), en plus d'un
-- lot de colonnes ajoutées au fil de l'eau sur comptes/planning_creneaux/
-- conges/zones_stockage/produits.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- A. Nouveau type enum
-- ----------------------------------------------------------------------------

do $$ begin
  create type type_conge as enum ('conge', 'acompte');
exception when duplicate_object then null;
end $$;


-- ----------------------------------------------------------------------------
-- B. Colonnes ajoutées aux tables existantes (001-003)
-- ----------------------------------------------------------------------------

alter table comptes add column if not exists date_naissance date;
comment on column comptes.date_naissance is 'Date de naissance — saisie RH, jamais affichée hors de cette fiche.';

alter table comptes add column if not exists telephone text;
comment on column comptes.telephone is 'Téléphone de contact du salarié.';

alter table comptes add column if not exists code_badgeuse text;
comment on column comptes.code_badgeuse is 'Code court utilisé pour pointer (arrivée/départ) sans se connecter avec email+mot de passe.';

create unique index if not exists comptes_code_badgeuse_uniq on comptes(code_badgeuse) where code_badgeuse is not null;

alter table planning_creneaux add column if not exists motif text;
comment on column planning_creneaux.motif is 'motif précis d''une absence (conge_paye, conge_sans_solde, recuperation, maladie) — uniquement quand type = ''conge''. Correspond au kind "absence" côté frontend (lib/planning.ts).';

alter table conges add column if not exists type type_conge not null default 'conge';
comment on column conges.type is 'conge (congé/absence, fenêtre de dates) ou acompte (avance sur salaire, une date + un montant)';

alter table conges add column if not exists motif_detail text;
comment on column conges.motif_detail is 'précision libre optionnelle, pour les deux types';

alter table conges add column if not exists montant numeric;
comment on column conges.montant is 'montant demandé en euros — acomptes uniquement';

comment on column conges.motif is 'catégorie de congé (conge_paye, maladie, etc.) — non utilisé pour un acompte';

alter table zones_stockage add column if not exists slug text;
create unique index if not exists zones_stockage_slug_uniq on zones_stockage(etablissement_id, slug);

alter table produits add column if not exists slug text;
create unique index if not exists produits_slug_uniq on produits(etablissement_id, slug);

-- Photos de fiche technique (déjà appliqué en base via la migration MCP
-- fiches_techniques_add_images de cette session — reproduit ici à l'identique).
alter table fiches_techniques add column if not exists images jsonb not null default '[]'::jsonb;
comment on column fiches_techniques.images is 'Photos de la fiche — string[] de data URLs redimensionnées côté client (voir fileToResizedDataUrl dans src/lib/recettes.ts). Miroir de Recette.images en local.';


-- ----------------------------------------------------------------------------
-- C. Messagerie — groupes/canaux
-- ----------------------------------------------------------------------------

create table if not exists message_groups (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  nom text not null,
  est_direct boolean not null default false,
  ouvert_a_tous boolean not null default false,
  created_by uuid references comptes(id),
  created_at timestamptz not null default now()
);

create index if not exists message_groups_etablissement_idx on message_groups(etablissement_id);
-- Au plus un groupe "ouvert à tous" (le canal général) par établissement.
create unique index if not exists message_groups_general_uniq on message_groups(etablissement_id) where ouvert_a_tous;

create table if not exists message_group_membres (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  group_id uuid not null references message_groups(id) on delete cascade,
  compte_id uuid not null references comptes(id) on delete cascade,
  est_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (group_id, compte_id)
);

create index if not exists message_group_membres_group_idx on message_group_membres(group_id);
create index if not exists message_group_membres_compte_idx on message_group_membres(compte_id);

alter table messages add column if not exists group_id uuid references message_groups(id) on delete cascade;
create index if not exists messages_group_idx on messages(group_id);

alter table messages add column if not exists attachments jsonb;
comment on column messages.attachments is 'MessageAttachment[] (name, dataUrl, kind) — stocké inline comme côté local, pas de bucket Storage pour l''instant (volume attendu faible).';


-- ----------------------------------------------------------------------------
-- D. Aide-commande / Réception — fournisseurs, commandes envoyées, réceptions
--    (déjà appliqué en base via la migration MCP aide_commande_fournisseurs_
--    receptions de cette session — reproduit ici à l'identique).
-- ----------------------------------------------------------------------------

create table if not exists fournisseurs (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  nom text not null,
  regles jsonb not null default '[]'::jsonb,
  email text,
  tva_pct numeric(4,2),
  created_by uuid references comptes(id),
  created_at timestamptz not null default now()
);
create index if not exists fournisseurs_etab_idx on fournisseurs(etablissement_id);

create table if not exists commandes_envoyees (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  fournisseur_id uuid references fournisseurs(id) on delete set null,
  fournisseur_nom text not null,
  fournisseur_email text,
  envoyee_at timestamptz not null default now(),
  lignes jsonb not null default '[]'::jsonb,
  created_by uuid references comptes(id)
);
create index if not exists commandes_envoyees_etab_idx on commandes_envoyees(etablissement_id, envoyee_at);

create table if not exists receptions (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  commande_id uuid references commandes_envoyees(id) on delete set null,
  fournisseur_nom text not null,
  fournisseur_email text,
  received_at timestamptz not null default now(),
  received_by text not null,
  temperature_camion numeric(4,1),
  lignes jsonb not null default '[]'::jsonb,
  signalement_envoye boolean not null default false,
  created_by uuid references comptes(id)
);
create index if not exists receptions_etab_idx on receptions(etablissement_id, received_at);


-- ----------------------------------------------------------------------------
-- E. comptes — passage au modèle multi-établissement
--    (auth_user_id n'est plus unique tout seul : un même utilisateur Auth
--    peut avoir une ligne comptes par établissement rejoint.)
-- ----------------------------------------------------------------------------

alter table comptes drop constraint if exists comptes_auth_user_id_key;
alter table comptes add constraint comptes_auth_user_id_etablissement_id_key unique (auth_user_id, etablissement_id);

-- Doublon constaté tel quel en base (même définition que comptes_email_etablissement_idx
-- posé par le fichier 001) — reproduit pour fidélité, sans conséquence fonctionnelle.
create unique index if not exists comptes_etablissement_email_uniq on comptes(etablissement_id, lower(email)) where email is not null;


-- ----------------------------------------------------------------------------
-- F. Policies RLS existantes (001-004) qui référencent les anciennes fonctions
--    mono-établissement — à supprimer avant de supprimer ces fonctions.
-- ----------------------------------------------------------------------------

drop policy if exists etablissements_select on etablissements;
drop policy if exists etablissements_update on etablissements;
drop policy if exists comptes_select on comptes;
drop policy if exists comptes_insert on comptes;
drop policy if exists comptes_update on comptes;
drop policy if exists comptes_delete on comptes;
drop policy if exists planning_select on planning_creneaux;
drop policy if exists planning_insert on planning_creneaux;
drop policy if exists planning_update on planning_creneaux;
drop policy if exists planning_delete on planning_creneaux;
drop policy if exists conges_select on conges;
drop policy if exists conges_insert on conges;
drop policy if exists conges_update on conges;
drop policy if exists conges_delete on conges;
drop policy if exists pointages_select on pointages;
drop policy if exists pointages_insert on pointages;
drop policy if exists pointages_update on pointages;
drop policy if exists pointages_delete on pointages;
drop policy if exists messages_select on messages;
drop policy if exists messages_insert on messages;
drop policy if exists messages_delete on messages;
drop policy if exists zones_stockage_all on zones_stockage;
drop policy if exists produits_all on produits;
drop policy if exists produit_zones_all on produit_zones;
drop policy if exists inventaire_releves_all on inventaire_releves;
drop policy if exists pertes_all on pertes;
drop policy if exists commande_liste_all on commande_liste;
drop policy if exists evenements_all on evenements;
drop policy if exists briefing_notes_all on briefing_notes;
drop policy if exists briefing_reservations_all on briefing_reservations;
drop policy if exists fiches_techniques_select on fiches_techniques;
drop policy if exists fiches_techniques_write on fiches_techniques;
drop policy if exists fiches_techniques_update on fiches_techniques;
drop policy if exists fiches_techniques_delete on fiches_techniques;
-- Au cas où ce fichier serait rejoué après un rattrapage partiel :
drop policy if exists fournisseurs_all on fournisseurs;
drop policy if exists commandes_envoyees_all on commandes_envoyees;
drop policy if exists receptions_all on receptions;
drop policy if exists groupes_select on message_groups;
drop policy if exists groupes_insert on message_groups;
drop policy if exists groupes_update on message_groups;
drop policy if exists groupes_delete on message_groups;
drop policy if exists membres_select on message_group_membres;
drop policy if exists membres_insert on message_group_membres;
drop policy if exists membres_update on message_group_membres;
drop policy if exists membres_delete on message_group_membres;


-- ----------------------------------------------------------------------------
-- G. Suppression des anciennes fonctions mono-établissement (remplacées par
--    les fonctions paramétrées par établissement en section H).
-- ----------------------------------------------------------------------------

drop function if exists compte_courant();
drop function if exists etablissement_courant();
drop function if exists role_courant();
drop function if exists est_manager();
drop function if exists compte_actif_ou_recent();


-- ----------------------------------------------------------------------------
-- H. Nouvelles fonctions — modèle multi-établissement + messagerie par groupes
--    (toutes SECURITY DEFINER, search_path fixé — même durcissement que 004).
-- ----------------------------------------------------------------------------

create or replace function mes_comptes()
returns setof comptes
language sql stable security definer set search_path = public as $$
  select * from comptes where auth_user_id = auth.uid() order by created_at asc;
$$;

create or replace function mon_compte_id(p_etablissement_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from comptes where auth_user_id = auth.uid() and etablissement_id = p_etablissement_id;
$$;

create or replace function role_dans(p_etablissement_id uuid)
returns role_compte
language sql stable security definer set search_path = public as $$
  select role from comptes where auth_user_id = auth.uid() and etablissement_id = p_etablissement_id;
$$;

create or replace function est_manager_de(p_etablissement_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select role in ('directeur', 'responsable') from comptes
    where auth_user_id = auth.uid() and etablissement_id = p_etablissement_id
  ), false);
$$;

create or replace function est_membre_actif(p_etablissement_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from comptes
    where auth_user_id = auth.uid()
      and etablissement_id = p_etablissement_id
      and (statut = 'actif' or (statut = 'parti' and date_depart >= (current_date - interval '6 months')))
  );
$$;

create or replace function groupe_est_direct(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select est_direct from message_groups where id = p_group_id), false);
$$;

create or replace function est_membre_du_groupe(p_group_id uuid, p_etablissement_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from message_group_membres
    where group_id = p_group_id and compte_id = mon_compte_id(p_etablissement_id)
  );
$$;

create or replace function est_admin_du_groupe(p_group_id uuid, p_etablissement_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from message_group_membres
    where group_id = p_group_id and compte_id = mon_compte_id(p_etablissement_id) and est_admin
  );
$$;

create or replace function est_createur_du_groupe(p_group_id uuid, p_etablissement_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from message_groups
    where id = p_group_id and created_by = mon_compte_id(p_etablissement_id)
  );
$$;

create or replace function peut_voir_groupe(p_group_id uuid, p_etablissement_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select
      g.ouvert_a_tous
      or exists (select 1 from message_group_membres m where m.group_id = g.id and m.compte_id = mon_compte_id(p_etablissement_id))
      or (not g.est_direct and role_dans(p_etablissement_id) = 'directeur')
    from message_groups g
    where g.id = p_group_id
  ), false);
$$;

-- rejoindre_etablissement : n'interdit plus de rejoindre un 2e établissement
-- (seule une invitation en attente pour CET établissement est requise) —
-- mise à jour pour le modèle multi-établissement.
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

  select id into v_etab_id from etablissements where code = upper(trim(p_code));
  if v_etab_id is null then
    raise exception 'Code établissement invalide';
  end if;

  if exists (select 1 from comptes where auth_user_id = auth.uid() and etablissement_id = v_etab_id) then
    raise exception 'Ce compte est déjà rattaché à cet établissement';
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

-- creer_etablissement inchangée depuis 004 (n'a pas suivi le passage au
-- multi-établissement — interdit toujours un 2e établissement par utilisateur
-- Auth). Reproduite ici pour que ce fichier soit un CREATE OR REPLACE complet,
-- sans corriger ce comportement (hors périmètre de ce rattrapage).
create or replace function creer_etablissement(p_nom text, p_ville text, p_prenom_directeur text, p_nom_directeur text)
returns comptes
language plpgsql security definer set search_path = public, extensions as $$
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
    v_code := upper(left(regexp_replace(extensions.unaccent(coalesce(p_ville, 'ETAB')), '[^a-zA-Z]', '', 'g') || 'XXXXX', 5))
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


-- ----------------------------------------------------------------------------
-- I. Privilèges — mêmes règles que 004 : fonctions helper/RPC exécutables
--    seulement par un utilisateur connecté, jamais anonyme.
-- ----------------------------------------------------------------------------

revoke execute on function mes_comptes() from public, anon;
revoke execute on function mon_compte_id(uuid) from public, anon;
revoke execute on function role_dans(uuid) from public, anon;
revoke execute on function est_manager_de(uuid) from public, anon;
revoke execute on function est_membre_actif(uuid) from public, anon;
revoke execute on function groupe_est_direct(uuid) from public, anon;
revoke execute on function est_membre_du_groupe(uuid, uuid) from public, anon;
revoke execute on function est_admin_du_groupe(uuid, uuid) from public, anon;
revoke execute on function est_createur_du_groupe(uuid, uuid) from public, anon;
revoke execute on function peut_voir_groupe(uuid, uuid) from public, anon;
revoke execute on function rejoindre_etablissement(text, text) from public, anon;
revoke execute on function creer_etablissement(text, text, text, text) from public, anon;

grant execute on function mes_comptes() to authenticated;
grant execute on function mon_compte_id(uuid) to authenticated;
grant execute on function role_dans(uuid) to authenticated;
grant execute on function est_manager_de(uuid) to authenticated;
grant execute on function est_membre_actif(uuid) to authenticated;
grant execute on function groupe_est_direct(uuid) to authenticated;
grant execute on function est_membre_du_groupe(uuid, uuid) to authenticated;
grant execute on function est_admin_du_groupe(uuid, uuid) to authenticated;
grant execute on function est_createur_du_groupe(uuid, uuid) to authenticated;
grant execute on function peut_voir_groupe(uuid, uuid) to authenticated;
grant execute on function rejoindre_etablissement(text, text) to authenticated;
grant execute on function creer_etablissement(text, text, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- J. RLS — activation sur les nouvelles tables + policies actuelles pour
--    TOUTES les tables (celles qui viennent d'être réécrites en section F,
--    et les nouvelles tables des sections C/D).
-- ----------------------------------------------------------------------------

alter table message_groups enable row level security;
alter table message_group_membres enable row level security;
alter table fournisseurs enable row level security;
alter table commandes_envoyees enable row level security;
alter table receptions enable row level security;

create policy etablissements_select on etablissements for select
  using (est_membre_actif(id));

create policy etablissements_update on etablissements for update
  using (role_dans(id) = 'directeur')
  with check (role_dans(id) = 'directeur');

create policy comptes_select on comptes for select
  using (est_membre_actif(etablissement_id));

create policy comptes_insert on comptes for insert
  with check (est_manager_de(etablissement_id));

create policy comptes_update on comptes for update
  using (est_manager_de(etablissement_id))
  with check (est_manager_de(etablissement_id));

create policy comptes_delete on comptes for delete
  using (est_manager_de(etablissement_id));

create policy planning_select on planning_creneaux for select
  using (est_membre_actif(etablissement_id));

create policy planning_insert on planning_creneaux for insert
  with check (est_manager_de(etablissement_id));

create policy planning_update on planning_creneaux for update
  using (est_manager_de(etablissement_id));

create policy planning_delete on planning_creneaux for delete
  using (est_manager_de(etablissement_id));

create policy conges_select on conges for select
  using (est_membre_actif(etablissement_id) and (compte_id = mon_compte_id(etablissement_id) or est_manager_de(etablissement_id)));

create policy conges_insert on conges for insert
  with check (compte_id = mon_compte_id(etablissement_id));

create policy conges_update on conges for update
  using (est_manager_de(etablissement_id) or (compte_id = mon_compte_id(etablissement_id) and statut = 'en_attente'));

create policy conges_delete on conges for delete
  using (est_manager_de(etablissement_id) or (compte_id = mon_compte_id(etablissement_id) and statut = 'en_attente'));

create policy pointages_select on pointages for select
  using (est_membre_actif(etablissement_id) and (compte_id = mon_compte_id(etablissement_id) or est_manager_de(etablissement_id)));

create policy pointages_insert on pointages for insert
  with check (compte_id = mon_compte_id(etablissement_id) or est_manager_de(etablissement_id));

create policy pointages_update on pointages for update
  using (est_manager_de(etablissement_id));

create policy pointages_delete on pointages for delete
  using (est_manager_de(etablissement_id));

create policy messages_select on messages for select
  using (est_membre_actif(etablissement_id) and peut_voir_groupe(group_id, etablissement_id));

create policy messages_insert on messages for insert
  with check (compte_id = mon_compte_id(etablissement_id) and peut_voir_groupe(group_id, etablissement_id));

create policy messages_delete on messages for delete
  using (compte_id = mon_compte_id(etablissement_id) or (est_manager_de(etablissement_id) and not groupe_est_direct(group_id)));

create policy zones_stockage_all on zones_stockage for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy produits_all on produits for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy produit_zones_all on produit_zones for all
  using (exists (select 1 from produits p where p.id = produit_zones.produit_id and est_manager_de(p.etablissement_id)))
  with check (exists (select 1 from produits p where p.id = produit_zones.produit_id and est_manager_de(p.etablissement_id)));

create policy inventaire_releves_all on inventaire_releves for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy pertes_all on pertes for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy commande_liste_all on commande_liste for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy evenements_all on evenements for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy briefing_notes_all on briefing_notes for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy briefing_reservations_all on briefing_reservations for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy fiches_techniques_select on fiches_techniques for select
  using (est_membre_actif(etablissement_id));

create policy fiches_techniques_write on fiches_techniques for insert
  with check (est_manager_de(etablissement_id));

create policy fiches_techniques_update on fiches_techniques for update
  using (est_manager_de(etablissement_id));

create policy fiches_techniques_delete on fiches_techniques for delete
  using (est_manager_de(etablissement_id));

create policy fournisseurs_all on fournisseurs for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy commandes_envoyees_all on commandes_envoyees for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy receptions_all on receptions for all
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));

create policy groupes_select on message_groups for select
  using (est_membre_actif(etablissement_id) and peut_voir_groupe(id, etablissement_id));

create policy groupes_insert on message_groups for insert
  with check (est_membre_actif(etablissement_id) and not ouvert_a_tous and created_by = mon_compte_id(etablissement_id)
    and (est_direct or role_dans(etablissement_id) = 'directeur'));

create policy groupes_update on message_groups for update
  using (not ouvert_a_tous and not est_direct and (role_dans(etablissement_id) = 'directeur' or est_admin_du_groupe(id, etablissement_id)));

create policy groupes_delete on message_groups for delete
  using (not ouvert_a_tous and not est_direct and role_dans(etablissement_id) = 'directeur');

create policy membres_select on message_group_membres for select
  using (est_membre_actif(etablissement_id) and (
    compte_id = mon_compte_id(etablissement_id)
    or est_membre_du_groupe(group_id, etablissement_id)
    or role_dans(etablissement_id) = 'directeur'
  ));

create policy membres_insert on message_group_membres for insert
  with check (est_membre_actif(etablissement_id) and (
    role_dans(etablissement_id) = 'directeur'
    or est_admin_du_groupe(group_id, etablissement_id)
    or est_createur_du_groupe(group_id, etablissement_id)
  ));

create policy membres_update on message_group_membres for update
  using (role_dans(etablissement_id) = 'directeur' or est_admin_du_groupe(group_id, etablissement_id));

create policy membres_delete on message_group_membres for delete
  using (role_dans(etablissement_id) = 'directeur' or est_admin_du_groupe(group_id, etablissement_id) or est_createur_du_groupe(group_id, etablissement_id));
