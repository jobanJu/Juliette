-- Boîte mail : les e-mails reçus par l'établissement (réponses des fournisseurs, factures…).
--
-- Chaque établissement a une adresse de réception « <code>.<jeton>@<domaine de réception> ». Les
-- commandes fournisseurs partent avec cette adresse en « Répondre à ». Le prestataire d'e-mail
-- (Mailjet Parse API, Postmark…) transmet chaque message reçu à /api/emails/entrants, qui l'écrit
-- ici avec la clé de service : aucun utilisateur n'insère directement.
--
-- Pièces jointes : bucket privé « emails », rangées sous <etablissement_id>/<email_id>/…
-- Accès : module « boite-mail » (ouvert par défaut aux responsables).

alter table public.etablissements add column if not exists boite_mail_jeton text
  not null default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
create unique index if not exists etablissements_boite_mail_jeton_idx on public.etablissements (boite_mail_jeton);

create table if not exists public.emails_recus (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  de_email text not null,
  de_nom text,
  a_email text,
  sujet text,
  texte text,
  html text,
  pieces_jointes jsonb not null default '[]'::jsonb,   -- [{ nom, type, taille, chemin }]
  fournisseur_id uuid references public.fournisseurs(id) on delete set null,
  commande_id uuid references public.commandes_envoyees(id) on delete set null,
  lu boolean not null default false,
  archive boolean not null default false,
  recu_at timestamptz not null default now()
);

create index if not exists emails_recus_etab_idx on public.emails_recus (etablissement_id, recu_at desc);
create index if not exists emails_recus_fournisseur_idx on public.emails_recus (fournisseur_id);
create index if not exists emails_recus_commande_idx on public.emails_recus (commande_id);

alter table public.emails_recus enable row level security;

drop policy if exists emails_lecture on public.emails_recus;
create policy emails_lecture on public.emails_recus for select to authenticated
  using ((select public.acces_module_de(etablissement_id, 'boite-mail')));

-- L'équipe autorisée ne peut que marquer lu / archiver (colonnes restreintes par le grant).
drop policy if exists emails_maj on public.emails_recus;
create policy emails_maj on public.emails_recus for update to authenticated
  using ((select public.acces_module_de(etablissement_id, 'boite-mail')))
  with check ((select public.acces_module_de(etablissement_id, 'boite-mail')));

drop policy if exists emails_suppression on public.emails_recus;
create policy emails_suppression on public.emails_recus for delete to authenticated
  using ((select public.est_manager_de(etablissement_id)) and (select public.acces_module_de(etablissement_id, 'boite-mail')));

revoke all on public.emails_recus from authenticated;
grant select, delete on public.emails_recus to authenticated;
grant update (lu, archive) on public.emails_recus to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('emails', 'emails', false, 26214400)
on conflict (id) do nothing;

drop policy if exists emails_pj_lecture on storage.objects;
create policy emails_pj_lecture on storage.objects for select to authenticated
  using (bucket_id = 'emails' and (select public.acces_module_de(((storage.foldername(name))[1])::uuid, 'boite-mail')));

alter table public.accreditations_acces drop constraint if exists accreditations_acces_module_check;
alter table public.accreditations_acces add constraint accreditations_acces_module_check check (module = any (array[
  'dashboard', 'inventaire', 'perte', 'aide-commande', 'evenements', 'documentation', 'fiche-technique', 'pointeuse',
  'planning', 'messagerie', 'equipe', 'rh-conges', 'reception', 'finance', 'commandes-caisse', 'configuration-commandes',
  'accreditations', 'reservations', 'haccp', 'haccp-parametres', 'haccp-historique', 'outils', 'boite-mail'
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
    return p_module = any(array['dashboard','commandes-caisse','configuration-commandes','inventaire','perte','aide-commande','reception','evenements','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','haccp-parametres','haccp-historique','documentation','outils','boite-mail']);
  end if;
  return p_module = any(array['dashboard','commandes-caisse','fiche-technique','pointeuse','planning','messagerie','equipe','rh-conges','reservations','haccp','documentation']);
end $function$;
