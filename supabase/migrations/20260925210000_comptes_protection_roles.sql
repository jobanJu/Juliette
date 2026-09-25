-- Protection des niveaux d'accès sur comptes.
--
-- Avant : la RLS laissait tout manager (directeur OU responsable) modifier n'importe quelle ligne
-- de comptes, y compris la colonne role. Un responsable pouvait donc se nommer directeur, ou
-- retirer ses droits au directeur, en appelant l'API directement.
--
-- Règles ajoutées (requêtes directes des utilisateurs uniquement : les fonctions SECURITY DEFINER
-- comme creer_etablissement ou rejoindre_etablissement s'exécutent sous un autre rôle et ne sont
-- pas concernées) :
--   * seul le directeur crée un compte autre que « salarié » ou change un rôle ;
--   * seul le directeur modifie le statut ou supprime la fiche d'un directeur ;
--   * personne ne déplace une fiche vers un autre établissement ni ne change son compte de connexion ;
--   * un établissement garde toujours au moins un directeur actif.

create or replace function public.comptes_proteger_roles()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_etab uuid := coalesce(new.etablissement_id, old.etablissement_id);
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.role <> 'salarie' and not est_directeur_de(v_etab) then
      raise exception 'Seul le directeur peut créer un compte responsable ou directeur' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'directeur' and not est_directeur_de(v_etab) then
      raise exception 'Seul un directeur peut supprimer la fiche d''un directeur' using errcode = '42501';
    end if;
    if old.role = 'directeur' and old.statut = 'actif' and not exists (
      select 1 from comptes
      where etablissement_id = v_etab and role = 'directeur' and statut = 'actif' and id <> old.id
    ) then
      raise exception 'L''établissement doit garder au moins un directeur actif' using errcode = '42501';
    end if;
    return old;
  end if;

  -- UPDATE
  if new.etablissement_id is distinct from old.etablissement_id or new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Établissement et compte de connexion ne se modifient pas ici' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and not est_directeur_de(v_etab) then
    raise exception 'Seul le directeur peut changer un niveau d''accès' using errcode = '42501';
  end if;
  if old.role = 'directeur' and new.statut is distinct from old.statut and not est_directeur_de(v_etab) then
    raise exception 'Seul un directeur peut changer le statut d''un directeur' using errcode = '42501';
  end if;
  if old.role = 'directeur' and old.statut = 'actif' and (new.role <> 'directeur' or new.statut <> 'actif')
     and not exists (
       select 1 from comptes
       where etablissement_id = v_etab and role = 'directeur' and statut = 'actif' and id <> old.id
     ) then
    raise exception 'L''établissement doit garder au moins un directeur actif' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists comptes_proteger_roles on public.comptes;
create trigger comptes_proteger_roles
  before insert or update or delete on public.comptes
  for each row execute function public.comptes_proteger_roles();
