-- Pointages à l'heure du serveur.
--
-- Avant : l'heure d'un pointage venait du téléphone ou de l'ordinateur du salarié. Il pouvait donc
-- arriver à 9h20 et enregistrer « 9h00 », ou pointer son départ en avance.
--
-- Maintenant, pour toute requête directe d'un utilisateur :
--   * un pointage normal (manuel = false) prend toujours l'heure du serveur ;
--   * seul un responsable ou directeur peut enregistrer un pointage manuel (correction), avec une
--     heure choisie ; il est alors signé par responsable_id ;
--   * un salarié qui tente une correction voit son pointage ramené à un pointage normal, à l'heure
--     du serveur.

create or replace function public.pointages_heure_serveur()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if coalesce(new.manuel, false) and est_manager_de(new.etablissement_id) then
    new.responsable_id := coalesce(new.responsable_id, mon_compte_id(new.etablissement_id));
    if new.horodatage > now() + interval '1 minute' then
      raise exception 'Un pointage ne peut pas être dans le futur' using errcode = '22008';
    end if;
    return new;
  end if;
  new.horodatage := now();
  new.manuel := false;
  new.responsable_id := null;
  return new;
end $$;

drop trigger if exists pointages_heure_serveur on public.pointages;
create trigger pointages_heure_serveur
  before insert on public.pointages
  for each row execute function public.pointages_heure_serveur();
