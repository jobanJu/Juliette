-- ============================================================================
-- Nettoyage suite aux advisors performance Supabase (get_advisors) :
-- - 7 clés étrangères sans index de couverture (unindexed_foreign_keys) — pas
--   critique tant que les tables sont petites, mais évite des scans séquentiels
--   quand elles grossiront.
-- - 1 index dupliqué sur comptes (duplicate_index) : comptes_email_etablissement_idx
--   faisait exactement la même chose que la contrainte unique
--   comptes_etablissement_email_uniq — on garde uniquement cette dernière.
-- ============================================================================

create index if not exists commandes_envoyees_created_by_idx on public.commandes_envoyees (created_by);
create index if not exists commandes_envoyees_fournisseur_id_idx on public.commandes_envoyees (fournisseur_id);
create index if not exists fournisseurs_created_by_idx on public.fournisseurs (created_by);
create index if not exists message_group_membres_etablissement_id_idx on public.message_group_membres (etablissement_id);
create index if not exists message_groups_created_by_idx on public.message_groups (created_by);
create index if not exists receptions_commande_id_idx on public.receptions (commande_id);
create index if not exists receptions_created_by_idx on public.receptions (created_by);

drop index if exists public.comptes_email_etablissement_idx;
