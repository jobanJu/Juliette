-- Coordonnées privées des collaborateurs.
--
-- Avant : tout membre actif lisait toutes les colonnes de comptes, dont le code badgeuse de ses
-- collègues (il pouvait donc pointer à leur place), leur date de naissance et leur téléphone.
--
-- Maintenant :
--   * ces trois colonnes ne sont plus lisibles directement par les rôles anon / authenticated ;
--   * la fonction comptes_coordonnees(etablissement) les renvoie, mais seulement pour les
--     responsables/directeurs de l'établissement, ou pour sa propre fiche ;
--   * l'écriture ne change pas (RLS inchangée) : un responsable peut toujours les modifier.
--
-- ATTENTION pour la suite : un privilège par colonne ne couvre pas les colonnes ajoutées plus
-- tard. Toute nouvelle colonne de comptes devra être ajoutée au GRANT ci-dessous.

revoke select on public.comptes from anon, authenticated;

grant select (
  id, auth_user_id, etablissement_id, nom, prenom, email, role, statut, poste, heures_contrat,
  date_embauche, date_depart, created_at, updated_at, avatar_url, fonction, type_contrat, nature_contrat
) on public.comptes to anon, authenticated;

-- Le générateur de code badgeuse doit voir tous les codes pour garantir l'unicité (il ne voyait
-- auparavant que ceux de l'établissement, à cause de la RLS).
alter function public.comptes_code_badgeuse_auto() security definer;

create or replace function public.comptes_coordonnees(p_etablissement_id uuid)
returns table (compte_id uuid, telephone text, date_naissance date, code_badgeuse text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id, c.telephone, c.date_naissance, c.code_badgeuse
  from comptes c
  where c.etablissement_id = p_etablissement_id
    and est_membre_actif(p_etablissement_id)
    and (est_manager_de(p_etablissement_id) or c.auth_user_id = auth.uid());
$$;

revoke all on function public.comptes_coordonnees(uuid) from public, anon;
grant execute on function public.comptes_coordonnees(uuid) to authenticated;
