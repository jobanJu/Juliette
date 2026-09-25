-- Commande automatique par niveau cible (inspiré de "Léon") : chaque produit peut avoir un seuil
-- de réassort et un niveau cible, exprimés dans son unité d'inventaire (effectiveUnit côté client :
-- unite_alternative si renseignée, sinon unite) — puisque c'est dans cette unité que le stock actuel
-- est mesuré via les relevés d'inventaire. Nullable : par défaut, aucune suggestion automatique tant
-- que le produit n'a pas été configuré.
alter table public.produits
  add column if not exists seuil numeric,
  add column if not exists niveau_cible numeric;

-- Montant minimum de commande d'un fournisseur (HT) — sert à avertir quand la commande suggérée
-- pour ce fournisseur n'atteint pas son minimum, avant de la préparer pour de vrai.
alter table public.fournisseurs
  add column if not exists minimum_commande numeric;
