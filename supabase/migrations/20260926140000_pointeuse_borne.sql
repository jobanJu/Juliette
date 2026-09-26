-- Pointeuse (borne / tablette à l'entrée).
--
-- Activation d'un appareil : code établissement + e-mail du directeur + mot de passe « pointeuse »
-- (distinct du mot de passe du directeur, défini dans Paramètres). L'appareil reçoit un jeton
-- aléatoire : seule son empreinte (SHA-256) est stockée dans badgeuses.token_hash.
-- Avec ce jeton, l'appareil ne sait faire qu'une chose : identifier un salarié par son code
-- badgeuse (6 chiffres) et enregistrer son pointage, à l'heure du serveur.
--
-- Protections :
--   * 5 activations ratées en 15 minutes pour un établissement → activation bloquée 15 minutes ;
--   * 5 codes badgeuse faux d'affilée sur un appareil → appareil bloqué 2 minutes ;
--   * le directeur révoque un appareil à tout moment ; changer le mot de passe pointeuse
--     n'invalide pas les appareils déjà activés (on les révoque un par un).

alter table public.etablissements add column if not exists pointeuse_mdp_hash text;

create table if not exists public.pointeuse_tentatives (
  id bigint generated always as identity primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade,
  code_saisi text,
  created_at timestamptz not null default now()
);
alter table public.pointeuse_tentatives enable row level security; -- aucune règle : accès par fonctions uniquement

-- Le directeur définit (ou change) le mot de passe de la pointeuse.
create or replace function public.definir_mdp_pointeuse(p_etablissement_id uuid, p_mdp text)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $$
begin
  if not est_directeur_de(p_etablissement_id) then
    raise exception 'Réservé au directeur' using errcode = '42501';
  end if;
  if length(coalesce(p_mdp, '')) < 6 then
    raise exception 'Le mot de passe de la pointeuse doit faire au moins 6 caractères' using errcode = '23514';
  end if;
  update etablissements set pointeuse_mdp_hash = crypt(p_mdp, gen_salt('bf')) where id = p_etablissement_id;
end $$;

-- Activation d'un appareil. Renvoie le jeton (à garder sur l'appareil) et le nom de l'établissement,
-- ou un message d'erreur. On renvoie l'erreur au lieu de la lever : une exception annulerait aussi
-- l'enregistrement de la tentative ratée, et le compteur anti-essais ne servirait à rien.
create or replace function public.badgeuse_activer(p_code text, p_email_directeur text, p_mdp text, p_nom text)
returns table (jeton text, etablissement text, erreur text)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_etab etablissements;
  v_ok boolean;
  v_jeton text;
begin
  select * into v_etab from etablissements where code = upper(trim(p_code));
  if v_etab.id is not null and (select count(*) from pointeuse_tentatives
      where etablissement_id = v_etab.id and created_at > now() - interval '15 minutes') >= 5 then
    return query select null::text, null::text, 'Trop d''essais : réessaie dans 15 minutes'::text;
    return;
  end if;
  v_ok := v_etab.id is not null
    and v_etab.pointeuse_mdp_hash is not null
    and v_etab.pointeuse_mdp_hash = crypt(coalesce(p_mdp, ''), v_etab.pointeuse_mdp_hash)
    and exists (select 1 from comptes where etablissement_id = v_etab.id and role = 'directeur' and statut = 'actif'
                and lower(email) = lower(trim(p_email_directeur)));
  if not v_ok then
    insert into pointeuse_tentatives(etablissement_id, code_saisi) values (v_etab.id, left(upper(trim(p_code)), 40));
    return query select null::text, null::text, 'Code établissement, e-mail du directeur ou mot de passe incorrect'::text;
    return;
  end if;
  v_jeton := encode(gen_random_bytes(32), 'hex');
  insert into badgeuses(etablissement_id, token_hash, nom, derniere_activite, echecs)
  values (v_etab.id, encode(digest(v_jeton, 'sha256'), 'hex'), coalesce(nullif(trim(p_nom), ''), 'Pointeuse'), now(), 0);
  return query select v_jeton, v_etab.nom, null::text;
end $$;

-- Appareil correspondant à un jeton (non révoqué).
create or replace function public.badgeuse_de(p_jeton text)
returns badgeuses language sql stable security definer set search_path to 'public', 'extensions' as $$
  select * from badgeuses where token_hash = encode(digest(coalesce(p_jeton, ''), 'sha256'), 'hex') and revoquee_at is null limit 1;
$$;
revoke all on function public.badgeuse_de(text) from public, anon, authenticated;

-- Informations de l'appareil (pour l'écran de la borne).
create or replace function public.badgeuse_infos(p_jeton text)
returns table (etablissement text, nom text, pause_active boolean)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare b badgeuses;
begin
  b := badgeuse_de(p_jeton);
  if b.id is null then raise exception 'Pointeuse non reconnue' using errcode = '28000'; end if;
  update badgeuses set derniere_activite = now() where id = b.id;
  return query select e.nom, b.nom, coalesce(e.pause_pointage_active, false) from etablissements e where e.id = b.etablissement_id;
end $$;

-- Identifie un salarié par son code : prénom et dernier pointage du jour (pour proposer la bonne action).
create or replace function public.badgeuse_identifier(p_jeton text, p_code text)
returns table (prenom text, nom text, dernier_type text, dernier_at timestamptz, erreur text)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare b badgeuses; c comptes;
begin
  b := badgeuse_de(p_jeton);
  if b.id is null then raise exception 'Pointeuse non reconnue' using errcode = '28000'; end if;
  if b.bloquee_jusqua is not null and b.bloquee_jusqua > now() then
    return query select null::text, null::text, null::text, null::timestamptz, 'Trop de codes faux : patiente 2 minutes'::text;
    return;
  end if;
  select * into c from comptes where etablissement_id = b.etablissement_id and code_badgeuse = trim(p_code) and statut = 'actif';
  if c.id is null then
    update badgeuses set echecs = coalesce(echecs, 0) + 1,
      bloquee_jusqua = case when coalesce(echecs, 0) + 1 >= 5 then now() + interval '2 minutes' else bloquee_jusqua end
      where id = b.id;
    return query select null::text, null::text, null::text, null::timestamptz, 'Code inconnu'::text;
    return;
  end if;
  update badgeuses set echecs = 0, bloquee_jusqua = null, derniere_activite = now() where id = b.id;
  return query
    select c.prenom, c.nom, p.type::text, p.horodatage, null::text
    from (select 1) x
    left join lateral (select type, horodatage from pointages where compte_id = c.id and horodatage > now() - interval '16 hours'
                       order by horodatage desc limit 1) p on true;
end $$;

-- Enregistre un pointage (heure du serveur) pour le salarié identifié par son code.
create or replace function public.badgeuse_pointer(p_jeton text, p_code text, p_type text)
returns table (prenom text, type text, horodatage timestamptz)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare b badgeuses; c comptes;
begin
  if p_type not in ('arrivee', 'depart', 'pause_debut', 'pause_fin') then
    raise exception 'Action inconnue' using errcode = '22023';
  end if;
  b := badgeuse_de(p_jeton);
  if b.id is null then raise exception 'Pointeuse non reconnue' using errcode = '28000'; end if;
  if b.bloquee_jusqua is not null and b.bloquee_jusqua > now() then
    raise exception 'Trop de codes faux : patiente 2 minutes' using errcode = '42501';
  end if;
  select * into c from comptes where etablissement_id = b.etablissement_id and code_badgeuse = trim(p_code) and statut = 'actif';
  if c.id is null then raise exception 'Code inconnu' using errcode = '28000'; end if;
  insert into pointages(etablissement_id, compte_id, type, horodatage, manuel, justificatif)
  values (b.etablissement_id, c.id, p_type::type_pointage, now(), false, 'Pointeuse « ' || b.nom || ' »');
  update badgeuses set derniere_activite = now() where id = b.id;
  return query select c.prenom, p_type, now();
end $$;

-- Détacher l'appareil (depuis la borne elle-même, avec le mot de passe de la pointeuse).
create or replace function public.badgeuse_desactiver(p_jeton text, p_mdp text)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare b badgeuses; h text;
begin
  b := badgeuse_de(p_jeton);
  if b.id is null then return; end if;
  select pointeuse_mdp_hash into h from etablissements where id = b.etablissement_id;
  if h is null or h <> crypt(coalesce(p_mdp, ''), h) then raise exception 'Mot de passe incorrect' using errcode = '28000'; end if;
  update badgeuses set revoquee_at = now() where id = b.id;
end $$;

-- Pour le directeur : état du mot de passe, liste et révocation des appareils.
create or replace function public.pointeuse_mdp_defini(p_etablissement_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case when est_directeur_de(p_etablissement_id) then (select pointeuse_mdp_hash is not null from etablissements where id = p_etablissement_id) end;
$$;

create or replace function public.badgeuses_liste(p_etablissement_id uuid)
returns table (id uuid, nom text, created_at timestamptz, derniere_activite timestamptz, revoquee_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not est_directeur_de(p_etablissement_id) then raise exception 'Réservé au directeur' using errcode = '42501'; end if;
  return query select b.id, b.nom, b.created_at, b.derniere_activite, b.revoquee_at from badgeuses b
    where b.etablissement_id = p_etablissement_id order by b.revoquee_at nulls first, b.created_at desc;
end $$;

create or replace function public.badgeuse_revoquer(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update badgeuses set revoquee_at = now() where id = p_id and est_directeur_de(etablissement_id);
  if not found then raise exception 'Réservé au directeur' using errcode = '42501'; end if;
end $$;

revoke all on function public.definir_mdp_pointeuse(uuid, text) from public, anon;
grant execute on function public.definir_mdp_pointeuse(uuid, text) to authenticated;
revoke all on function public.pointeuse_mdp_defini(uuid) from public, anon;
grant execute on function public.pointeuse_mdp_defini(uuid) to authenticated;
revoke all on function public.badgeuses_liste(uuid) from public, anon;
grant execute on function public.badgeuses_liste(uuid) to authenticated;
revoke all on function public.badgeuse_revoquer(uuid) from public, anon;
grant execute on function public.badgeuse_revoquer(uuid) to authenticated;
-- La borne n'est pas connectée à un compte : ces fonctions sont appelables sans session.
grant execute on function public.badgeuse_activer(text, text, text, text) to anon, authenticated;
grant execute on function public.badgeuse_infos(text) to anon, authenticated;
grant execute on function public.badgeuse_identifier(text, text) to anon, authenticated;
grant execute on function public.badgeuse_pointer(text, text, text) to anon, authenticated;
grant execute on function public.badgeuse_desactiver(text, text) to anon, authenticated;
