-- Préférences privées du tableau de bord : chaque membre règle sa vue par établissement.
create table public.tableau_bord_preferences (
  compte_id uuid primary key references public.comptes(id) on delete cascade,
  cartes text[] not null default array[
    'presence', 'stock-stat', 'pertes', 'commandes-stat', 'equipe', 'stock', 'evenements', 'commandes', 'raccourcis'
  ]::text[],
  updated_at timestamptz not null default now(),
  constraint tableau_bord_preferences_cartes_valides check (
    cartes <@ array['presence', 'stock-stat', 'pertes', 'commandes-stat', 'equipe', 'stock', 'evenements', 'commandes', 'raccourcis']::text[]
  )
);

alter table public.tableau_bord_preferences enable row level security;

create policy tableau_bord_preferences_select on public.tableau_bord_preferences
  for select to authenticated
  using (compte_id = (select id from public.comptes where auth_user_id = (select auth.uid())));

create policy tableau_bord_preferences_insert on public.tableau_bord_preferences
  for insert to authenticated
  with check (compte_id = (select id from public.comptes where auth_user_id = (select auth.uid())));

create policy tableau_bord_preferences_update on public.tableau_bord_preferences
  for update to authenticated
  using (compte_id = (select id from public.comptes where auth_user_id = (select auth.uid())))
  with check (compte_id = (select id from public.comptes where auth_user_id = (select auth.uid())));

grant select, insert, update on public.tableau_bord_preferences to authenticated;
