-- Accréditations par niveau hiérarchique (responsable / salarié) plutôt que par zone de travail.
--
-- Une règle vise maintenant soit une personne (compte_id), soit un niveau (niveau), soit — pour les
-- anciens réglages de l'ancien site — un poste (zone de travail).
-- Ordre de priorité dans acces_module_de : directeur (tout) > personne > niveau > poste > défaut.
-- La documentation (procédures) devient lisible par défaut par toute l'équipe.

alter table public.accreditations_acces add column if not exists niveau text;

alter table public.accreditations_acces drop constraint if exists accreditations_acces_niveau_check;
alter table public.accreditations_acces add constraint accreditations_acces_niveau_check
  check (niveau is null or niveau in ('responsable', 'salarie'));

alter table public.accreditations_acces drop constraint if exists accreditations_acces_check;
alter table public.accreditations_acces add constraint accreditations_acces_check
  check ((poste is not null)::int + (compte_id is not null)::int + (niveau is not null)::int = 1);

alter table public.accreditations_acces drop constraint if exists accreditations_acces_etablissement_id_module_poste_compte_i_key;
alter table public.accreditations_acces drop constraint if exists accreditations_acces_cible_unique;
alter table public.accreditations_acces add constraint accreditations_acces_cible_unique
  unique nulls not distinct (etablissement_id, module, poste, compte_id, niveau);

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
    return p_module = any(array['dashboard','commandes-caisse','configuration-commandes','inventaire','perte','aide-commande','reception','evenements','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','documentation']);
  end if;
  return p_module = any(array['dashboard','commandes-caisse','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','documentation']);
end $function$;
