-- ============================================================================
-- 003 — Opérations : catalogue produits/zones, stocks, pertes, liste de
-- commande, événements, briefing, fiches techniques. Le catalogue produits
-- devient une table par établissement (remplace le catalog.json statique
-- de Jonathan — voir note de migration séparée pour importer ses données).
-- ============================================================================

create table zones_stockage (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  titre text not null,
  couleur text,
  note text,
  ordre integer not null default 0
);

create type origine_produit as enum ('achat', 'fabrication');

create table produits (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  nom text not null,
  unite text not null,
  origine origine_produit,
  fournisseur text,
  conditionnement text,
  conservation text,
  prix_unitaire numeric(10,2),
  reference_fournisseur text,
  created_at timestamptz not null default now()
);

create index produits_etab_idx on produits(etablissement_id);

create table produit_zones (
  produit_id uuid not null references produits(id) on delete cascade,
  zone_id uuid not null references zones_stockage(id) on delete cascade,
  categorie text,
  primary key (produit_id, zone_id)
);

create table inventaire_releves (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  zone_id uuid not null references zones_stockage(id) on delete cascade,
  valeur numeric(10,2) not null,
  created_by uuid references comptes(id),
  created_at timestamptz not null default now()
);

create index inventaire_releves_etab_idx on inventaire_releves(etablissement_id, created_at);

create type motif_perte as enum ('dlc', 'casse', 'erreur_preparation', 'retour_client', 'controle_qualite', 'autre');

create table pertes (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  date date not null,
  valeur numeric(10,2) not null,
  motif motif_perte not null,
  precision text,
  created_by uuid references comptes(id),
  created_at timestamptz not null default now()
);

create index pertes_etab_date_idx on pertes(etablissement_id, date);

create table commande_liste (
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  quantite numeric(10,2),
  added_by uuid references comptes(id),
  added_at timestamptz not null default now(),
  primary key (etablissement_id, produit_id)
);

create type sens_impact as enum ('hausse', 'baisse');
create type niveau_impact as enum ('faible', 'moyen', 'fort', 'exceptionnel');

create table evenements (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  nom text not null,
  date date not null,
  date_fin date,
  lieu text,
  type text,
  sens sens_impact not null default 'hausse',
  impact niveau_impact not null default 'moyen',
  note text,
  created_by uuid references comptes(id),
  created_at timestamptz not null default now()
);

create index evenements_etab_date_idx on evenements(etablissement_id, date);

create type categorie_briefing as enum ('rupture', 'a_pousser', 'quantite_limitee');

create table briefing_notes (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  date date not null,
  categorie categorie_briefing not null,
  libelle text not null,
  restant integer,
  note text,
  created_by uuid references comptes(id),
  created_at timestamptz not null default now()
);

create index briefing_notes_etab_date_idx on briefing_notes(etablissement_id, date);

create table briefing_reservations (
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  date date not null,
  nombre integer not null,
  note text,
  primary key (etablissement_id, date)
);

-- Ingrédients/étapes en jsonb plutôt que des tables de jointure séparées : structure simple,
-- jamais interrogée par champ individuel (toujours affichée fiche entière) — juste stockée et
-- récupérée telle quelle, comme aujourd'hui en localStorage.
create table fiches_techniques (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements(id) on delete cascade,
  nom text not null,
  categorie text not null,
  format text,
  ingredients jsonb not null default '[]',
  etapes jsonb not null default '[]',
  accompagnement text,
  note text,
  created_by uuid references comptes(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fiches_techniques_etab_idx on fiches_techniques(etablissement_id);

create trigger fiches_techniques_set_updated_at before update on fiches_techniques
  for each row execute function set_updated_at();

-- ---- RLS ----
-- Stocks/pertes/commandes/événements/briefing : réservés à directeur/responsable (comme
-- inventaire, perte, aide-commande, evenements, briefing dans la table ACCESS de l'appli —
-- le salarié n'a jamais accès à ces routes). Fiches techniques : tout le monde consulte,
-- directeur/responsable seuls éditent (canEditFicheTechnique).

alter table zones_stockage enable row level security;
alter table produits enable row level security;
alter table produit_zones enable row level security;
alter table inventaire_releves enable row level security;
alter table pertes enable row level security;
alter table commande_liste enable row level security;
alter table evenements enable row level security;
alter table briefing_notes enable row level security;
alter table briefing_reservations enable row level security;
alter table fiches_techniques enable row level security;

create policy zones_stockage_all on zones_stockage for all
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy produits_all on produits for all
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy produit_zones_all on produit_zones for all
  using (exists (select 1 from produits p where p.id = produit_id and p.etablissement_id = etablissement_courant() and est_manager()))
  with check (exists (select 1 from produits p where p.id = produit_id and p.etablissement_id = etablissement_courant() and est_manager()));

create policy inventaire_releves_all on inventaire_releves for all
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy pertes_all on pertes for all
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy commande_liste_all on commande_liste for all
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy evenements_all on evenements for all
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy briefing_notes_all on briefing_notes for all
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy briefing_reservations_all on briefing_reservations for all
  using (etablissement_id = etablissement_courant() and est_manager())
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy fiches_techniques_select on fiches_techniques for select
  using (etablissement_id = etablissement_courant() and compte_actif_ou_recent());

create policy fiches_techniques_write on fiches_techniques for insert
  with check (etablissement_id = etablissement_courant() and est_manager());

create policy fiches_techniques_update on fiches_techniques for update
  using (etablissement_id = etablissement_courant() and est_manager());

create policy fiches_techniques_delete on fiches_techniques for delete
  using (etablissement_id = etablissement_courant() and est_manager());
