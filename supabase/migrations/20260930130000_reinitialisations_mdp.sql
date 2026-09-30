-- Demandes de réinitialisation de mot de passe : sert uniquement à limiter les envois par adresse.
-- Table serveur (RLS sans politique). L'adresse est conservée sous forme d'empreinte, pas en clair.
create table if not exists public.reinitialisations_mdp (
  id bigint generated always as identity primary key,
  email_empreinte text not null,
  created_at timestamptz not null default now()
);
create index if not exists reinitialisations_mdp_email_idx on public.reinitialisations_mdp (email_empreinte, created_at);
alter table public.reinitialisations_mdp enable row level security;
revoke all on public.reinitialisations_mdp from anon, authenticated;
