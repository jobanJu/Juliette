-- Coût de revient des fiches techniques (voir src/lib/couts-recette.ts) : portions produites, prix à
-- la carte TTC, TVA et allergènes. Le produit lié, le rendement et le prix manuel de chaque
-- ingrédient vivent dans la colonne jsonb `ingredients` existante (champs optionnels).
alter table public.fiches_techniques
  add column if not exists portions numeric,
  add column if not exists prix_vente_ttc numeric,
  add column if not exists tva_pct numeric,
  add column if not exists allergenes jsonb not null default '[]'::jsonb;
