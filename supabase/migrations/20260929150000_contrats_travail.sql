-- Contrats de travail : générés depuis un modèle (France HCR / Belgique CP 302), imprimés ou signés
-- dans Juliette (signature électronique simple : tracé + horodatage + empreinte du texte).
--
-- Cycle : brouillon → a_signer (texte figé, empreinte SHA-256 calculée par la base) → signe
-- (employeur ET salarié ont signé). Un contrat signé ne se modifie plus ; il peut seulement être
-- annulé. Revenir en brouillon efface les signatures.
--
-- Accès : le directeur gère les contrats de son établissement (ils contiennent la rémunération et
-- des données personnelles) ; le salarié lit les siens dès qu'ils lui sont présentés, et les signe
-- via signer_mon_contrat().

create table if not exists public.contrats_travail (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  compte_id uuid not null references public.comptes(id) on delete cascade,
  modele text not null,
  donnees jsonb not null default '{}'::jsonb,
  contenu text,
  empreinte text,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'a_signer', 'signe', 'annule')),
  signature_employeur text,
  signe_employeur_at timestamptz,
  signe_employeur_par uuid references public.comptes(id) on delete set null,
  signature_salarie text,
  signe_salarie_at timestamptz,
  created_by uuid references public.comptes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contrats_travail_etab_idx on public.contrats_travail (etablissement_id, created_at desc);
create index if not exists contrats_travail_compte_idx on public.contrats_travail (compte_id);

alter table public.contrats_travail enable row level security;

drop policy if exists contrats_lecture on public.contrats_travail;
create policy contrats_lecture on public.contrats_travail for select to authenticated
  using (
    (select public.est_directeur_de(etablissement_id))
    or (statut <> 'brouillon' and compte_id = (select public.mon_compte_id(etablissement_id)))
  );

drop policy if exists contrats_gestion on public.contrats_travail;
create policy contrats_gestion on public.contrats_travail for all to authenticated
  using ((select public.est_directeur_de(etablissement_id)))
  with check ((select public.est_directeur_de(etablissement_id)));

grant select, insert, update, delete on public.contrats_travail to authenticated;

-- Cycle de vie et intégrité.
create or replace function public.contrats_integrite()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.statut := 'brouillon';
    new.signature_employeur := null; new.signe_employeur_at := null; new.signe_employeur_par := null;
    new.signature_salarie := null; new.signe_salarie_at := null; new.empreinte := null;
    return new;
  end if;

  new.etablissement_id := old.etablissement_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if old.statut in ('signe', 'annule') then
    if old.statut = 'signe' and new.statut = 'annule' then
      new := old;
      new.statut := 'annule';
      new.updated_at := now();
      return new;
    end if;
    raise exception 'Un contrat signé ou annulé ne se modifie plus' using errcode = '42501';
  end if;

  if new.statut = 'brouillon' then
    -- Retour en brouillon : on efface signatures et empreinte.
    new.signature_employeur := null; new.signe_employeur_at := null; new.signe_employeur_par := null;
    new.signature_salarie := null; new.signe_salarie_at := null; new.empreinte := null;
    return new;
  end if;

  if new.statut in ('a_signer', 'signe') then
    -- La signature du salarié ne vient que de signer_mon_contrat() (exécutée hors rôle authenticated).
    if current_user = 'authenticated' then
      new.signature_salarie := old.signature_salarie; new.signe_salarie_at := old.signe_salarie_at;
    end if;
    if old.statut = 'brouillon' then
      if coalesce(new.contenu, '') = '' then
        raise exception 'Le texte du contrat est vide' using errcode = '22023';
      end if;
      new.empreinte := encode(extensions.digest(new.contenu, 'sha256'), 'hex');
      new.signature_salarie := null; new.signe_salarie_at := null;
    else
      -- Déjà présenté : le texte est figé.
      new.contenu := old.contenu; new.donnees := old.donnees; new.empreinte := old.empreinte;
      new.modele := old.modele; new.compte_id := old.compte_id;
    end if;
    if old.signature_employeur is not null then
      new.signature_employeur := old.signature_employeur; new.signe_employeur_at := old.signe_employeur_at; new.signe_employeur_par := old.signe_employeur_par;
    end if;
    if new.signature_employeur is not null and old.signature_employeur is null then
      new.signe_employeur_at := now();
      new.signe_employeur_par := public.mon_compte_id(new.etablissement_id);
    end if;
    new.statut := case when new.signature_employeur is not null and new.signature_salarie is not null then 'signe' else 'a_signer' end;
    return new;
  end if;

  if new.statut = 'annule' then return new; end if;
  raise exception 'Passage de statut non autorisé' using errcode = '22023';
end $$;

drop trigger if exists contrats_integrite on public.contrats_travail;
create trigger contrats_integrite before insert or update on public.contrats_travail
  for each row execute function public.contrats_integrite();

-- Signature du salarié : uniquement son propre contrat, présenté et pas encore signé par lui.
create or replace function public.signer_mon_contrat(p_contrat uuid, p_signature text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare v public.contrats_travail;
begin
  select * into v from contrats_travail where id = p_contrat for update;
  if v.id is null or v.compte_id <> mon_compte_id(v.etablissement_id) then
    raise exception 'Contrat introuvable' using errcode = '42501';
  end if;
  if v.statut <> 'a_signer' or v.signature_salarie is not null then
    raise exception 'Ce contrat n''est pas à signer' using errcode = '22023';
  end if;
  if p_signature is null or length(p_signature) < 100 or length(p_signature) > 400000 or p_signature not like 'data:image/png;base64,%' then
    raise exception 'Signature invalide' using errcode = '22023';
  end if;
  update contrats_travail
     set signature_salarie = p_signature,
         signe_salarie_at = now(),
         statut = case when signature_employeur is not null then 'signe' else statut end,
         updated_at = now()
   where id = p_contrat;
  return case when v.signature_employeur is not null then 'signe' else 'a_signer' end;
end $$;

revoke all on function public.signer_mon_contrat(uuid, text) from public, anon;
grant execute on function public.signer_mon_contrat(uuid, text) to authenticated;

-- Module « contrats » : ouvert à tous (le salarié y signe les siens ; la RLS limite ce qu'il voit).
alter table public.accreditations_acces drop constraint if exists accreditations_acces_module_check;
alter table public.accreditations_acces add constraint accreditations_acces_module_check check (module = any (array[
  'dashboard', 'inventaire', 'perte', 'aide-commande', 'evenements', 'documentation', 'fiche-technique', 'pointeuse',
  'planning', 'messagerie', 'equipe', 'rh-conges', 'reception', 'finance', 'commandes-caisse', 'configuration-commandes',
  'accreditations', 'reservations', 'haccp', 'haccp-parametres', 'haccp-historique', 'outils', 'boite-mail', 'contrats'
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
    return p_module = any(array['dashboard','commandes-caisse','configuration-commandes','inventaire','perte','aide-commande','reception','evenements','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','haccp-parametres','haccp-historique','documentation','outils','boite-mail','contrats']);
  end if;
  return p_module = any(array['dashboard','commandes-caisse','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','documentation','contrats']);
end $function$;
