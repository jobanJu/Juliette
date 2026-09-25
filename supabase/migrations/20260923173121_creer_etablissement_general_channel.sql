-- Corrige la Messagerie totalement vide pour tout nouvel établissement : creer_etablissement() ne
-- provisionnait jamais le salon "Général" (ouvert_a_tous), et la RLS interdit sa création côté
-- client — donc aucun signup (y compris la démo) n'avait de salon de messagerie utilisable.

create or replace function public.creer_etablissement(
  p_nom text,
  p_ville text,
  p_prenom_directeur text,
  p_nom_directeur text,
  p_code text
)
returns comptes
language plpgsql
security definer
set search_path = public, extensions
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

  -- Canal général de l'établissement — toujours présent dès la création, sinon la messagerie est
  -- vide et personne (même pas le directeur) n'a de moyen client de le créer (RLS).
  insert into message_groups (etablissement_id, nom, est_direct, ouvert_a_tous, created_by)
  values (v_etab_id, 'Général', false, true, null);

  return v_compte;
end;
$$;

-- Backfill : tout établissement existant sans salon ouvert_a_tous en reçoit un.
insert into message_groups (etablissement_id, nom, est_direct, ouvert_a_tous, created_by)
select e.id, 'Général', false, true, null
from etablissements e
where not exists (
  select 1 from message_groups g where g.etablissement_id = e.id and g.ouvert_a_tous
);
