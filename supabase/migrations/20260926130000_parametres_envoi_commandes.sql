-- Paramètres et envoi automatique des commandes fournisseurs.
--
-- 1. maj_mon_profil() : chacun modifie SON profil (prénom, nom, téléphone, date de naissance, photo).
--    La RLS de comptes réserve sinon toute modification aux responsables.
-- 2. etablissements.email_contact : adresse de réponse des e-mails envoyés aux fournisseurs.
-- 3. Suivi de l'envoi des commandes : email_statut (non_envoye / envoye / echec / manuel), date,
--    identifiant du prestataire (Resend) et message d'erreur éventuel.

create or replace function public.maj_mon_profil(
  p_etablissement_id uuid,
  p_prenom text,
  p_nom text,
  p_telephone text,
  p_date_naissance date,
  p_avatar_url text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(trim(p_prenom), '') = '' or coalesce(trim(p_nom), '') = '' then
    raise exception 'Le prénom et le nom sont obligatoires' using errcode = '23514';
  end if;
  if p_avatar_url is not null and length(p_avatar_url) > 400000 then
    raise exception 'Photo trop lourde' using errcode = '23514';
  end if;
  update comptes
     set prenom = trim(p_prenom), nom = trim(p_nom), telephone = nullif(trim(coalesce(p_telephone, '')), ''),
         date_naissance = p_date_naissance, avatar_url = p_avatar_url
   where auth_user_id = auth.uid() and etablissement_id = p_etablissement_id;
  if not found then
    raise exception 'Compte introuvable' using errcode = '42501';
  end if;
end $$;

revoke all on function public.maj_mon_profil(uuid, text, text, text, date, text) from public, anon;
grant execute on function public.maj_mon_profil(uuid, text, text, text, date, text) to authenticated;

alter table public.etablissements add column if not exists email_contact text;

alter table public.commandes_envoyees
  add column if not exists email_statut text not null default 'non_envoye',
  add column if not exists email_envoye_at timestamptz,
  add column if not exists email_id text,
  add column if not exists email_erreur text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'commandes_envoyees_email_statut_check') then
    alter table public.commandes_envoyees add constraint commandes_envoyees_email_statut_check
      check (email_statut in ('non_envoye', 'envoye', 'echec', 'manuel'));
  end if;
end $$;

-- Les commandes passées avant ce suivi ont été transmises à la main.
update public.commandes_envoyees set email_statut = 'manuel' where email_statut = 'non_envoye' and email_envoye_at is null and envoyee_at < now();
