-- Perte + Inventaire : permet de déclarer une perte ou pointer un stock dans une unité différente
-- de l'unité de commande (ex : commandé au carton de 5kg, mais jeté/pointé au kg ou à la pièce).
-- Nullable : par défaut, Perte/Inventaire continuent d'utiliser l'unité de commande du produit.
alter table public.produits
  add column if not exists unite_alternative text;
