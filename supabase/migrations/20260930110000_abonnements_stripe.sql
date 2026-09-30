-- Souscription en ligne avec Stripe.
--
-- * souscriptions : demandes d'inscription en attente de paiement. Le mot de passe n'y est jamais
--   stocké : le compte Auth est créé à la demande, sans confirmation, et n'est validé qu'une fois
--   le paiement accepté. Table serveur uniquement (RLS sans politique).
-- * abonnements : l'abonnement Stripe de chaque établissement, lisible par son directeur.
-- * creer_etablissement_pour() : création de l'établissement et du compte directeur par le serveur,
--   après paiement (clé de service uniquement).

create table if not exists public.souscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  prenom text not null,
  nom text not null,
  etablissement_nom text not null,
  ville text,
  pays text not null default 'FR' check (pays in ('FR', 'BE')),
  code text not null,
  stripe_session_id text unique,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'active', 'erreur')),
  erreur text,
  etablissement_id uuid references public.etablissements(id) on delete set null,
  created_at timestamptz not null default now(),
  activee_at timestamptz
);
alter table public.souscriptions enable row level security;
revoke all on public.souscriptions from anon, authenticated;

create table if not exists public.abonnements (
  etablissement_id uuid primary key references public.etablissements(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  statut text not null,
  fin_essai timestamptz,
  fin_periode timestamptz,
  resiliation_prevue boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.abonnements enable row level security;
revoke all on public.abonnements from anon;
grant select on public.abonnements to authenticated;

drop policy if exists abonnements_directeur on public.abonnements;
create policy abonnements_directeur on public.abonnements
  for select to authenticated
  using (public.est_directeur_de(etablissement_id));

create or replace function public.creer_etablissement_pour(
  p_user uuid, p_nom text, p_ville text, p_pays text, p_prenom text, p_nom_directeur text, p_code text, p_fin_essai date
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_code text;
  v_etab_id uuid;
begin
  v_code := upper(regexp_replace(extensions.unaccent(trim(coalesce(p_code, ''))), '[^a-zA-Z0-9]', '', 'g'));
  if length(v_code) < 3 then
    raise exception 'Le code établissement doit faire au moins 3 caractères';
  end if;

  insert into etablissements (code, nom, ville, pays, email_contact)
  values (v_code, p_nom, p_ville, coalesce(p_pays, 'FR'), (select email from auth.users where id = p_user))
  returning id into v_etab_id;

  insert into comptes (auth_user_id, etablissement_id, nom, prenom, email, role, statut)
  values (p_user, v_etab_id, p_nom_directeur, p_prenom, (select email from auth.users where id = p_user), 'directeur', 'actif');

  insert into message_groups (etablissement_id, nom, est_direct, ouvert_a_tous, created_by)
  values (v_etab_id, 'Général', false, true, null);

  insert into etablissements_admin (etablissement_id, formule, fin_essai)
  values (v_etab_id, 'abonnement', p_fin_essai)
  on conflict (etablissement_id) do update set formule = excluded.formule, fin_essai = excluded.fin_essai;

  return v_etab_id;
end;
$$;

revoke all on function public.creer_etablissement_pour(uuid, text, text, text, text, text, text, date) from public, anon, authenticated;
grant execute on function public.creer_etablissement_pour(uuid, text, text, text, text, text, text, date) to service_role;
