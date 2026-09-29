-- La borne est activée avec la session Supabase du directeur. Elle ne conserve ensuite
-- qu'un jeton de borne, sans garder la session personnelle sur l'appareil partagé.
create or replace function public.badgeuse_activer_directeur(p_nom text)
returns table (jeton text, etablissement text, erreur text)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_compte comptes;
  v_jeton text;
begin
  if auth.uid() is null then
    return query select null::text, null::text, 'Connecte-toi avec le compte du directeur'::text;
    return;
  end if;

  select c.* into v_compte
  from comptes c
  where c.auth_user_id = auth.uid() and c.role = 'directeur' and c.statut = 'actif'
  order by c.created_at
  limit 1;

  if v_compte.id is null then
    return query select null::text, null::text, 'Seul un compte directeur actif peut activer la pointeuse'::text;
    return;
  end if;

  v_jeton := encode(gen_random_bytes(32), 'hex');
  insert into badgeuses(etablissement_id, token_hash, nom, cree_par, derniere_activite, echecs)
  values (v_compte.etablissement_id, encode(digest(v_jeton, 'sha256'), 'hex'), coalesce(nullif(trim(p_nom), ''), 'Pointeuse'), v_compte.id, now(), 0);
  return query select v_jeton, e.nom, null::text from etablissements e where e.id = v_compte.etablissement_id;
end $$;

revoke all on function public.badgeuse_activer_directeur(text) from public, anon;
grant execute on function public.badgeuse_activer_directeur(text) to authenticated;

-- Désactivation locale : le jeton ne peut révoquer que le terminal qui le détient.
create or replace function public.badgeuse_desactiver_jeton(p_jeton text)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $$
begin
  update badgeuses
  set revoquee_at = now()
  where token_hash = encode(digest(coalesce(p_jeton, ''), 'sha256'), 'hex')
    and revoquee_at is null;
end $$;

revoke all on function public.badgeuse_desactiver_jeton(text) from public;
grant execute on function public.badgeuse_desactiver_jeton(text) to anon, authenticated;

-- Désactive les anciens chemins qui reposaient sur un mot de passe séparé pour la borne.
revoke all on function public.badgeuse_activer(text, text, text, text) from public, anon, authenticated;
revoke all on function public.badgeuse_desactiver(text, text) from public, anon, authenticated;
revoke all on function public.definir_mdp_pointeuse(uuid, text) from public, anon, authenticated;
revoke all on function public.pointeuse_mdp_defini(uuid) from public, anon, authenticated;
