-- Documents RH : fiches de poste, remises de matériel, règlement intérieur, promesses d'embauche,
-- avertissements, convocations, certificats et attestations.
--
-- Même cycle que les contrats : brouillon → a_signer (texte figé, empreinte SHA-256) → signe ; ou,
-- pour un document non nominatif (règlement intérieur), brouillon → publie (texte figé, visible par
-- toute l'équipe active). Un document signé ou publié ne se modifie plus ; il peut être annulé.
--
-- Accès : le directeur gère ; le salarié lit et signe les siens ; l'équipe lit les documents publiés.

create table if not exists public.documents_rh (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  compte_id uuid references public.comptes(id) on delete cascade,
  type text not null check (type in ('fiche_poste', 'remise_materiel', 'reglement', 'promesse', 'avertissement', 'convocation', 'certificat', 'attestation')),
  titre text not null default '',
  donnees jsonb not null default '{}'::jsonb,
  contenu text,
  empreinte text,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'a_signer', 'signe', 'publie', 'annule')),
  signature_employeur text,
  signe_employeur_at timestamptz,
  signature_salarie text,
  signe_salarie_at timestamptz,
  created_by uuid references public.comptes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_rh_etab_idx on public.documents_rh (etablissement_id, created_at desc);
create index if not exists documents_rh_compte_idx on public.documents_rh (compte_id);

alter table public.documents_rh enable row level security;

drop policy if exists documents_rh_lecture on public.documents_rh;
create policy documents_rh_lecture on public.documents_rh for select to authenticated
  using (
    (select public.est_directeur_de(etablissement_id))
    or (statut not in ('brouillon', 'annule') and compte_id = (select public.mon_compte_id(etablissement_id)))
    or (statut = 'publie' and compte_id is null and (select public.est_membre_actif(etablissement_id)))
  );

drop policy if exists documents_rh_gestion on public.documents_rh;
create policy documents_rh_gestion on public.documents_rh for all to authenticated
  using ((select public.est_directeur_de(etablissement_id)))
  with check ((select public.est_directeur_de(etablissement_id)));

grant select, insert, update, delete on public.documents_rh to authenticated;

create or replace function public.documents_rh_integrite()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.statut := 'brouillon';
    new.signature_employeur := null; new.signe_employeur_at := null;
    new.signature_salarie := null; new.signe_salarie_at := null; new.empreinte := null;
    return new;
  end if;
  new.etablissement_id := old.etablissement_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if old.statut in ('signe', 'publie', 'annule') then
    if old.statut in ('signe', 'publie') and new.statut = 'annule' then
      new := old; new.statut := 'annule'; new.updated_at := now();
      return new;
    end if;
    raise exception 'Un document signé, publié ou annulé ne se modifie plus' using errcode = '42501';
  end if;

  if new.statut = 'brouillon' then
    new.signature_employeur := null; new.signe_employeur_at := null;
    new.signature_salarie := null; new.signe_salarie_at := null; new.empreinte := null;
    return new;
  end if;

  if old.statut = 'brouillon' then
    if coalesce(new.contenu, '') = '' then
      raise exception 'Le texte du document est vide' using errcode = '22023';
    end if;
    new.empreinte := encode(extensions.digest(new.contenu, 'sha256'), 'hex');
    new.signature_salarie := null; new.signe_salarie_at := null;
  else
    new.contenu := old.contenu; new.donnees := old.donnees; new.empreinte := old.empreinte;
    new.type := old.type; new.compte_id := old.compte_id; new.titre := old.titre;
  end if;

  if new.statut = 'publie' then
    return new;
  end if;

  if new.statut in ('a_signer', 'signe') then
    if current_user = 'authenticated' then
      new.signature_salarie := old.signature_salarie; new.signe_salarie_at := old.signe_salarie_at;
    end if;
    if old.signature_employeur is not null then
      new.signature_employeur := old.signature_employeur; new.signe_employeur_at := old.signe_employeur_at;
    elsif new.signature_employeur is not null then
      new.signe_employeur_at := now();
    end if;
    -- Document sans salarié à signer : la signature de l'employeur suffit.
    new.statut := case
      when new.signature_employeur is not null and (new.signature_salarie is not null or new.compte_id is null or (new.donnees->>'sans_signature_salarie') = 'true') then 'signe'
      else 'a_signer' end;
    return new;
  end if;

  if new.statut = 'annule' then return new; end if;
  raise exception 'Passage de statut non autorisé' using errcode = '22023';
end $$;

drop trigger if exists documents_rh_integrite on public.documents_rh;
create trigger documents_rh_integrite before insert or update on public.documents_rh
  for each row execute function public.documents_rh_integrite();

create or replace function public.signer_mon_document(p_document uuid, p_signature text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare v public.documents_rh;
begin
  select * into v from documents_rh where id = p_document for update;
  if v.id is null or v.compte_id is null or v.compte_id <> mon_compte_id(v.etablissement_id) then
    raise exception 'Document introuvable' using errcode = '42501';
  end if;
  if v.statut <> 'a_signer' or v.signature_salarie is not null then
    raise exception 'Ce document n''est pas à signer' using errcode = '22023';
  end if;
  if p_signature is null or length(p_signature) < 100 or length(p_signature) > 400000 or p_signature not like 'data:image/png;base64,%' then
    raise exception 'Signature invalide' using errcode = '22023';
  end if;
  update documents_rh set signature_salarie = p_signature, signe_salarie_at = now(), statut = 'a_signer' where id = p_document;
  return (select statut from documents_rh where id = p_document);
end $$;

revoke all on function public.signer_mon_document(uuid, text) from public, anon;
grant execute on function public.signer_mon_document(uuid, text) to authenticated;

-- Module « documents-rh » : ouvert à tous (chacun y lit et signe les siens ; la RLS filtre).
alter table public.accreditations_acces drop constraint if exists accreditations_acces_module_check;
alter table public.accreditations_acces add constraint accreditations_acces_module_check check (module = any (array[
  'dashboard', 'inventaire', 'perte', 'aide-commande', 'evenements', 'documentation', 'fiche-technique', 'pointeuse',
  'planning', 'messagerie', 'equipe', 'rh-conges', 'reception', 'finance', 'commandes-caisse', 'configuration-commandes',
  'accreditations', 'reservations', 'haccp', 'haccp-parametres', 'haccp-historique', 'outils', 'boite-mail', 'contrats', 'documents-rh'
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
    return p_module = any(array['dashboard','commandes-caisse','configuration-commandes','inventaire','perte','aide-commande','reception','evenements','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','haccp-parametres','haccp-historique','documentation','outils','boite-mail','contrats','documents-rh']);
  end if;
  return p_module = any(array['dashboard','commandes-caisse','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','documentation','contrats','documents-rh']);
end $function$;
