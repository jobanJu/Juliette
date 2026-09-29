-- Caisses connectées : le client choisit son logiciel de caisse ; les ventes remontent dans Juliette.
--
-- * caisse_connexions : logiciel choisi et état (lisible par les responsables de l'établissement).
--   Écriture uniquement par le serveur (/api/caisse/*), après vérification du directeur.
-- * caisse_secrets : clé d'accès à l'API de la caisse, chiffrée par le serveur (AES-256-GCM).
--   Aucune politique : jamais lisible depuis l'application.
-- * ventes_caisse : une ligne par encaissement importé (montant TTC en centimes), dédoublonnée par
--   (établissement, source, identifiant externe). Lue par Finance.
-- * La console lit désormais l'état caisse dans caisse_connexions (les colonnes caisse_logiciel /
--   caisse_statut d'etablissements_admin, jamais utilisées en production, sont retirées).

create table if not exists public.caisse_connexions (
  etablissement_id uuid primary key references public.etablissements(id) on delete cascade,
  logiciel text not null,
  statut text not null default 'demandee' check (statut in ('demandee', 'en_cours', 'connectee', 'erreur')),
  identifiant text,                 -- n° marchand SumUp, emplacement Square…
  derniere_synchro timestamptz,
  derniere_erreur text,
  demande_par uuid references public.comptes(id) on delete set null,
  demande_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.caisse_connexions enable row level security;
drop policy if exists caisse_connexions_lecture on public.caisse_connexions;
create policy caisse_connexions_lecture on public.caisse_connexions for select to authenticated
  using ((select public.est_manager_de(etablissement_id)));
revoke insert, update, delete on public.caisse_connexions from anon, authenticated;
grant select on public.caisse_connexions to authenticated;

drop trigger if exists caisse_connexions_updated_at on public.caisse_connexions;
create trigger caisse_connexions_updated_at before update on public.caisse_connexions
  for each row execute function public.set_updated_at();

create table if not exists public.caisse_secrets (
  etablissement_id uuid primary key references public.etablissements(id) on delete cascade,
  secret_chiffre text not null,
  updated_at timestamptz not null default now()
);
alter table public.caisse_secrets enable row level security;
revoke all on public.caisse_secrets from anon, authenticated;

create table if not exists public.ventes_caisse (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  source text not null,
  id_externe text not null,
  vendu_at timestamptz not null,
  montant_centimes integer not null,
  devise text not null default 'EUR',
  moyen text,
  created_at timestamptz not null default now(),
  unique (etablissement_id, source, id_externe)
);
create index if not exists ventes_caisse_etab_date_idx on public.ventes_caisse (etablissement_id, vendu_at);
alter table public.ventes_caisse enable row level security;
drop policy if exists ventes_caisse_lecture on public.ventes_caisse;
create policy ventes_caisse_lecture on public.ventes_caisse for select to authenticated
  using ((select public.acces_module_de(etablissement_id, 'finance')) or (select public.est_manager_de(etablissement_id)));
revoke insert, update, delete on public.ventes_caisse from anon, authenticated;
grant select on public.ventes_caisse to authenticated;

alter table public.etablissements_admin drop column if exists caisse_logiciel;
alter table public.etablissements_admin drop column if exists caisse_statut;

drop function if exists public.admin_etablissements();
create or replace function public.admin_etablissements()
returns table (
  id uuid, nom text, code text, ville text, pays text, created_at timestamptz,
  modules_masques text[], comptes_actifs bigint, invites bigint, directeur text, directeur_email text,
  derniere_activite timestamptz, formule text, fin_essai date, suspendu boolean, caisse_logiciel text, caisse_statut text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select e.id, e.nom, e.code, e.ville, e.pays, e.created_at, e.modules_masques,
    (select count(*) from comptes c where c.etablissement_id = e.id and c.statut = 'actif'),
    (select count(*) from comptes c where c.etablissement_id = e.id and c.statut = 'invite'),
    (select trim(coalesce(c.prenom, '') || ' ' || coalesce(c.nom, '')) from comptes c where c.etablissement_id = e.id and c.role = 'directeur' order by c.created_at limit 1),
    (select c.email from comptes c where c.etablissement_id = e.id and c.role = 'directeur' order by c.created_at limit 1),
    greatest(
      (select max(p.horodatage) from pointages p where p.etablissement_id = e.id),
      (select max(h.created_at) from haccp_enregistrements h where h.etablissement_id = e.id),
      (select max(u.last_sign_in_at) from auth.users u join comptes c on c.auth_user_id = u.id where c.etablissement_id = e.id)
    ),
    coalesce(a.formule, 'essai'), a.fin_essai, coalesce(a.suspendu, false), k.logiciel, coalesce(k.statut, 'aucune')
  from etablissements e
  left join etablissements_admin a on a.etablissement_id = e.id
  left join caisse_connexions k on k.etablissement_id = e.id
  order by e.created_at desc;
$$;
revoke all on function public.admin_etablissements() from public, anon, authenticated;
grant execute on function public.admin_etablissements() to service_role;
