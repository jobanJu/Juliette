-- ============================================================================
-- 007 — Le restaurateur choisit lui-même son code établissement à la création
-- (au lieu d'un code généré aléatoirement à partir du nom de ville). Ce code
-- n'est pas confidentiel : c'est ce qui identifie l'établissement à la
-- connexion (voir /login) et qui est relayé tel quel dans l'email
-- d'invitation d'un collaborateur (voir /api/personnel/inviter).
-- ============================================================================

drop function if exists creer_etablissement(text, text, text, text);

create or replace function creer_etablissement(
  p_nom text, p_ville text, p_prenom_directeur text, p_nom_directeur text, p_code text
)
returns comptes
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_code text;
  v_etab_id uuid;
  v_compte comptes;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if exists (select 1 from comptes where auth_user_id = auth.uid()) then
    raise exception 'Ce compte est déjà rattaché à un établissement';
  end if;

  v_code := upper(regexp_replace(extensions.unaccent(trim(coalesce(p_code, ''))), '[^a-zA-Z0-9]', '', 'g'));
  if length(v_code) < 3 then
    raise exception 'Le code établissement doit faire au moins 3 caractères (lettres/chiffres)';
  end if;

  begin
    insert into etablissements (code, nom, ville) values (v_code, p_nom, p_ville) returning id into v_etab_id;
  exception when unique_violation then
    raise exception 'Ce code établissement est déjà pris, choisis-en un autre';
  end;

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

comment on function creer_etablissement is 'Crée un nouvel établissement (avec le code choisi par le restaurateur, non confidentiel) + son premier compte directeur (l''appelant).';

revoke execute on function creer_etablissement(text, text, text, text, text) from public, anon;
grant execute on function creer_etablissement(text, text, text, text, text) to authenticated;
