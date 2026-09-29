-- Console de l'équipe Juliette : suivi et paramétrage des établissements clients.
--
-- * equipe_juliette : les comptes Auth de l'équipe. Aucune politique RLS : ni lecture ni écriture
--   depuis l'application ; seul le serveur (clé de service) la consulte. On ajoute un membre en SQL.
-- * etablissements_admin : données internes par client (formule, notes, suspension, caisse
--   connectée). Invisibles pour les clients (RLS sans politique).
-- * etablissements.pays : France ou Belgique (utile aux modèles de contrats, outils, etc.).
-- * admin_etablissements() : vue d'ensemble agrégée, exécutable uniquement par la clé de service.
-- * etablissement_suspendu() : lu par l'application pour bloquer un établissement suspendu.

create table if not exists public.equipe_juliette (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  nom text,
  created_at timestamptz not null default now()
);
alter table public.equipe_juliette enable row level security;
revoke all on public.equipe_juliette from anon, authenticated;

alter table public.etablissements add column if not exists pays text not null default 'FR';
alter table public.etablissements drop constraint if exists etablissements_pays_check;
alter table public.etablissements add constraint etablissements_pays_check check (pays in ('FR', 'BE'));

create table if not exists public.etablissements_admin (
  etablissement_id uuid primary key references public.etablissements(id) on delete cascade,
  formule text not null default 'essai',
  fin_essai date,
  suspendu boolean not null default false,
  motif_suspension text,
  caisse_logiciel text,
  caisse_statut text not null default 'aucune' check (caisse_statut in ('aucune', 'demandee', 'en_cours', 'connectee', 'erreur')),
  caisse_note text,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.etablissements_admin enable row level security;
revoke all on public.etablissements_admin from anon, authenticated;

drop trigger if exists etablissements_admin_updated_at on public.etablissements_admin;
create trigger etablissements_admin_updated_at before update on public.etablissements_admin
  for each row execute function public.set_updated_at();

create or replace function public.etablissement_suspendu(p_etablissement_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select suspendu from etablissements_admin where etablissement_id = p_etablissement_id), false)
  where est_membre_actif(p_etablissement_id);
$$;
revoke all on function public.etablissement_suspendu(uuid) from public, anon;
grant execute on function public.etablissement_suspendu(uuid) to authenticated;

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
    coalesce(a.formule, 'essai'), a.fin_essai, coalesce(a.suspendu, false), a.caisse_logiciel, coalesce(a.caisse_statut, 'aucune')
  from etablissements e
  left join etablissements_admin a on a.etablissement_id = e.id
  order by e.created_at desc;
$$;
revoke all on function public.admin_etablissements() from public, anon, authenticated;
grant execute on function public.admin_etablissements() to service_role;

-- Ajouter un membre de l'équipe (à faire en SQL, jamais depuis l'application) :
--   insert into public.equipe_juliette (auth_user_id, nom)
--   select id, 'Prénom' from auth.users where lower(email) = '<e-mail>';
