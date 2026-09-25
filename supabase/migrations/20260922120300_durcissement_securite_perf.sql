-- ============================================================================
-- 004 — Durcissement suite aux advisors Supabase : search_path fixe sur les
-- fonctions restantes, extension unaccent déplacée hors du schéma public,
-- privilèges resserrés sur les fonctions SECURITY DEFINER, auth.uid() mis en
-- sous-requête dans les policies RLS (évite une réévaluation par ligne),
-- index de couverture manquants sur les clés étrangères.
-- ============================================================================

-- ---- search_path fixe sur les triggers (manquant sur ces deux-là) ----
create or replace function set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function proteger_code_etablissement()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.code <> old.code then
    raise exception 'Le code établissement ne peut pas être modifié';
  end if;
  return new;
end;
$$;

-- ---- unaccent hors du schéma public ----
create schema if not exists extensions;
drop extension if exists unaccent;
create extension if not exists unaccent with schema extensions;

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

-- ---- Privilèges resserrés : les fonctions "courant/manager" et les RPC de rattachement ne
-- doivent être appelables que par un utilisateur connecté (authenticated), jamais anonyme.
revoke execute on function compte_courant() from public, anon;
revoke execute on function etablissement_courant() from public, anon;
revoke execute on function role_courant() from public, anon;
revoke execute on function est_manager() from public, anon;
revoke execute on function compte_actif_ou_recent() from public, anon;
revoke execute on function creer_etablissement(text, text, text, text) from public, anon;
revoke execute on function rejoindre_etablissement(text, text) from public, anon;

grant execute on function compte_courant() to authenticated;
grant execute on function etablissement_courant() to authenticated;
grant execute on function role_courant() to authenticated;
grant execute on function est_manager() to authenticated;
grant execute on function compte_actif_ou_recent() to authenticated;
grant execute on function creer_etablissement(text, text, text, text) to authenticated;
grant execute on function rejoindre_etablissement(text, text) to authenticated;

-- ---- Index de couverture manquants sur les clés étrangères (colonnes d'audit created_by/
-- added_by/decide_par + quelques relations oubliées) ----
create index if not exists briefing_notes_created_by_idx on briefing_notes(created_by);
create index if not exists commande_liste_added_by_idx on commande_liste(added_by);
create index if not exists commande_liste_produit_idx on commande_liste(produit_id);
create index if not exists conges_decide_par_idx on conges(decide_par);
create index if not exists evenements_created_by_idx on evenements(created_by);
create index if not exists fiches_techniques_created_by_idx on fiches_techniques(created_by);
create index if not exists inventaire_releves_created_by_idx on inventaire_releves(created_by);
create index if not exists inventaire_releves_produit_idx on inventaire_releves(produit_id);
create index if not exists inventaire_releves_zone_idx on inventaire_releves(zone_id);
create index if not exists messages_compte_idx on messages(compte_id);
create index if not exists pertes_created_by_idx on pertes(created_by);
create index if not exists pertes_produit_idx on pertes(produit_id);
create index if not exists planning_creneaux_created_by_idx on planning_creneaux(created_by);
create index if not exists pointages_compte_idx on pointages(compte_id);
create index if not exists pointages_created_by_idx on pointages(created_by);
create index if not exists produit_zones_zone_idx on produit_zones(zone_id);
create index if not exists zones_stockage_etablissement_idx on zones_stockage(etablissement_id);

-- ---- RLS : auth.uid() en sous-requête pour éviter une réévaluation par ligne (recommandation
-- Supabase) — conges, pointages, messages étaient les seules policies à l'appeler directement. ----

drop policy conges_select on conges;
create policy conges_select on conges for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent()
    and (compte_id = (select id from comptes where auth_user_id = (select auth.uid())) or est_manager()));

drop policy conges_insert on conges;
create policy conges_insert on conges for insert
  with check (etablissement_id = etablissement_courant()
    and compte_id = (select id from comptes where auth_user_id = (select auth.uid())));

drop policy conges_update on conges;
create policy conges_update on conges for update
  using (etablissement_id = etablissement_courant() and (
    est_manager()
    or (compte_id = (select id from comptes where auth_user_id = (select auth.uid())) and statut = 'en_attente')
  ));

drop policy conges_delete on conges;
create policy conges_delete on conges for delete
  using (etablissement_id = etablissement_courant() and (
    est_manager()
    or (compte_id = (select id from comptes where auth_user_id = (select auth.uid())) and statut = 'en_attente')
  ));

drop policy pointages_select on pointages;
create policy pointages_select on pointages for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent()
    and (compte_id = (select id from comptes where auth_user_id = (select auth.uid())) or est_manager()));

drop policy pointages_insert on pointages;
create policy pointages_insert on pointages for insert
  with check (etablissement_id = etablissement_courant() and (
    compte_id = (select id from comptes where auth_user_id = (select auth.uid()))
    or est_manager()
  ));

drop policy messages_insert on messages;
create policy messages_insert on messages for insert
  with check (etablissement_id = etablissement_courant()
    and compte_id = (select id from comptes where auth_user_id = (select auth.uid())));

drop policy messages_delete on messages;
create policy messages_delete on messages for delete
  using (etablissement_id = etablissement_courant() and (
    est_manager()
    or compte_id = (select id from comptes where auth_user_id = (select auth.uid()))
  ));
