-- Outils externes : les services que l'établissement utilise autour de son activité (URSSAF,
-- banque, mutuelle, paie, comptabilité, caisse, livraison…), choisis dans un catalogue ou ajoutés à
-- la main, avec le lien et les repères utiles (n° client, interlocuteur). Aucun mot de passe.
--
-- Accréditation « outils » : ouverte par défaut aux responsables, fermée aux salariés.

create table if not exists public.outils_externes (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  cle text not null,                -- clé du catalogue, ou « perso-… » pour un outil ajouté à la main
  nom text,
  categorie text,
  url text,
  identifiant text,                 -- n° client / adhérent / SIRET déclaré… (jamais un mot de passe)
  contact text,
  note text,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (etablissement_id, cle)
);

create index if not exists outils_externes_etab_idx on public.outils_externes (etablissement_id);

drop trigger if exists outils_externes_updated_at on public.outils_externes;
create trigger outils_externes_updated_at before update on public.outils_externes
  for each row execute function public.set_updated_at();

alter table public.outils_externes enable row level security;

drop policy if exists outils_lecture on public.outils_externes;
create policy outils_lecture on public.outils_externes for select to authenticated
  using ((select public.acces_module_de(etablissement_id, 'outils')));

drop policy if exists outils_gestion on public.outils_externes;
create policy outils_gestion on public.outils_externes for all to authenticated
  using ((select public.est_manager_de(etablissement_id)) and (select public.acces_module_de(etablissement_id, 'outils')))
  with check ((select public.est_manager_de(etablissement_id)) and (select public.acces_module_de(etablissement_id, 'outils')));

grant select, insert, update, delete on public.outils_externes to authenticated;

alter table public.accreditations_acces drop constraint if exists accreditations_acces_module_check;
alter table public.accreditations_acces add constraint accreditations_acces_module_check check (module = any (array[
  'dashboard', 'inventaire', 'perte', 'aide-commande', 'evenements', 'documentation', 'fiche-technique', 'pointeuse',
  'planning', 'messagerie', 'equipe', 'rh-conges', 'reception', 'finance', 'commandes-caisse', 'configuration-commandes',
  'accreditations', 'reservations', 'haccp', 'haccp-parametres', 'haccp-historique', 'outils'
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
  select autorise into v_override from accreditations_acces
    where etablissement_id = p_etablissement_id and module = p_module and compte_id = v_compte limit 1;
  if found then return v_override; end if;
  select autorise into v_override from accreditations_acces
    where etablissement_id = p_etablissement_id and module = p_module and niveau = v_role limit 1;
  if found then return v_override; end if;
  if v_poste is not null then
    select autorise into v_override from accreditations_acces
      where etablissement_id = p_etablissement_id and module = p_module and poste = v_poste limit 1;
    if found then return v_override; end if;
  end if;
  if v_role = 'responsable' then
    return p_module = any(array['dashboard','commandes-caisse','configuration-commandes','inventaire','perte','aide-commande','reception','evenements','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','haccp-parametres','haccp-historique','documentation','outils']);
  end if;
  return p_module = any(array['dashboard','commandes-caisse','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','documentation']);
end $function$;
