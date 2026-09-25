-- HACCP : intégrité du registre.
--
-- Un registre HACCP doit pouvoir être présenté tel quel lors d'un contrôle sanitaire. Avant, tout
-- membre pouvait modifier n'importe quel relevé (ou l'antidater, ou le supprimer longtemps après).
--
-- Maintenant, pour les requêtes directes des utilisateurs :
--   * un enregistrement prend l'heure du serveur et le nom de son auteur (non modifiables) ;
--   * un salarié ne modifie plus un enregistrement, sauf pour clôturer un refroidissement encore
--     ouvert (celui qui le termine n'est pas forcément celui qui l'a lancé) ;
--   * un salarié peut supprimer sa propre saisie pendant 15 minutes (erreur de frappe) ; ensuite,
--     seul un responsable ou le directeur le peut.

create or replace function public.haccp_integrite()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_manager boolean;
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;
  v_manager := est_manager_de(coalesce(new.etablissement_id, old.etablissement_id));

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    select trim(coalesce(prenom, '') || ' ' || coalesce(nom, '')) into new.auteur from comptes where id = new.compte_id;
    new.auteur := coalesce(new.auteur, '');
    return new;
  end if;

  if tg_op = 'DELETE' then
    if not v_manager and old.created_at < now() - interval '15 minutes' then
      raise exception 'Passé 15 minutes, seul un responsable peut supprimer un enregistrement HACCP' using errcode = '42501';
    end if;
    return old;
  end if;

  -- UPDATE
  new.created_at := old.created_at;
  new.compte_id := old.compte_id;
  new.auteur := old.auteur;
  new.etablissement_id := old.etablissement_id;
  new.type := old.type;
  if not v_manager and not (old.type = 'refroidissement' and coalesce(old.data->>'fin_at', '') = '') then
    raise exception 'Un enregistrement HACCP ne se modifie pas : supprime-le ou demande à un responsable' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists haccp_integrite on public.haccp_enregistrements;
create trigger haccp_integrite
  before insert or update or delete on public.haccp_enregistrements
  for each row execute function public.haccp_integrite();
