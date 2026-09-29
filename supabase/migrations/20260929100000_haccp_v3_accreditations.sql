-- HACCP V3 : paramètres et historique sur accréditation, traçabilité par photo, suivi de production.
--
-- * haccp_config accepte les nouveaux réglages : catalogue DLC (déjà utilisé par l'écran mais refusé
--   par la contrainte), champs obligatoires de la traçabilité.
-- * haccp_enregistrements accepte le type « production » (fiche de fabrication). Comme un
--   refroidissement, une fiche reste modifiable par l'équipe tant qu'elle n'est pas clôturée.
-- * Deux accréditations dédiées : « haccp-parametres » (équipements, produits DLC, plan de
--   nettoyage, traçabilité) et « haccp-historique » (registre et exports). Ouvertes par défaut aux
--   responsables, fermées aux salariés ; le directeur peut ouvrir à une personne précise.
-- * Bucket privé « haccp » pour les photos d'étiquettes et de production, rangées sous
--   <etablissement_id>/… : lisibles et ajoutées par l'équipe active, supprimées par un responsable.

alter table public.haccp_config drop constraint if exists haccp_config_cle_check;
alter table public.haccp_config add constraint haccp_config_cle_check
  check (cle in ('plan_nettoyage', 'equipements', 'produits_dlc', 'tracabilite'));

alter table public.haccp_enregistrements drop constraint if exists haccp_enregistrements_type_check;
alter table public.haccp_enregistrements add constraint haccp_enregistrements_type_check
  check (type in ('nettoyage', 'temperature', 'tracabilite', 'refroidissement', 'production'));

alter table public.accreditations_acces drop constraint if exists accreditations_acces_module_check;
alter table public.accreditations_acces add constraint accreditations_acces_module_check check (module = any (array[
  'dashboard', 'inventaire', 'perte', 'aide-commande', 'evenements', 'documentation', 'fiche-technique', 'pointeuse',
  'planning', 'messagerie', 'equipe', 'rh-conges', 'reception', 'finance', 'commandes-caisse', 'configuration-commandes',
  'accreditations', 'reservations', 'haccp', 'haccp-parametres', 'haccp-historique'
]));

create or replace function public.acces_module_de(p_etablissement_id uuid, p_module text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare v_compte uuid; v_role text; v_poste text; v_override boolean;
begin
  select id, role::text, poste into v_compte, v_role, v_poste
  from comptes where auth_user_id = auth.uid() and etablissement_id = p_etablissement_id and (statut = 'actif' or (statut = 'parti' and date_depart >= current_date - interval '6 months'));
  if v_compte is null then return false; end if;
  if v_role = 'directeur' then return true; end if;
  -- 1. réglage de la personne
  select autorise into v_override from accreditations_acces
    where etablissement_id = p_etablissement_id and module = p_module and compte_id = v_compte limit 1;
  if found then return v_override; end if;
  -- 2. réglage de son niveau hiérarchique
  select autorise into v_override from accreditations_acces
    where etablissement_id = p_etablissement_id and module = p_module and niveau = v_role limit 1;
  if found then return v_override; end if;
  -- 3. ancien réglage par zone de travail
  if v_poste is not null then
    select autorise into v_override from accreditations_acces
      where etablissement_id = p_etablissement_id and module = p_module and poste = v_poste limit 1;
    if found then return v_override; end if;
  end if;
  -- 4. valeur par défaut du niveau
  if v_role = 'responsable' then
    return p_module = any(array['dashboard','commandes-caisse','configuration-commandes','inventaire','perte','aide-commande','reception','evenements','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','haccp-parametres','haccp-historique','documentation']);
  end if;
  return p_module = any(array['dashboard','commandes-caisse','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','documentation']);
end $function$;

-- Réglages HACCP : modifiables par qui a l'accréditation « haccp-parametres ».
drop policy if exists haccp_config_gestion on public.haccp_config;
create policy haccp_config_gestion on public.haccp_config for all to authenticated
  using ((select public.acces_module_de(etablissement_id, 'haccp-parametres')))
  with check ((select public.acces_module_de(etablissement_id, 'haccp-parametres')));

-- Intégrité : une fiche de production ouverte se complète au fil de la journée.
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
  if not v_manager
     and not (old.type = 'refroidissement' and coalesce(old.data->>'fin_at', '') = '')
     and not (old.type = 'production' and coalesce(old.data->>'cloture_at', '') = '') then
    raise exception 'Un enregistrement HACCP ne se modifie pas : supprime-le ou demande à un responsable' using errcode = '42501';
  end if;
  return new;
end $$;

-- Photos HACCP (étiquettes fournisseurs, productions).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('haccp', 'haccp', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists haccp_photos_lecture on storage.objects;
create policy haccp_photos_lecture on storage.objects for select to authenticated
  using (bucket_id = 'haccp' and (select public.est_membre_actif(((storage.foldername(name))[1])::uuid)));

drop policy if exists haccp_photos_ajout on storage.objects;
create policy haccp_photos_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'haccp' and (select public.est_membre_actif(((storage.foldername(name))[1])::uuid)));

drop policy if exists haccp_photos_suppression on storage.objects;
create policy haccp_photos_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'haccp' and (select public.est_manager_de(((storage.foldername(name))[1])::uuid)));
