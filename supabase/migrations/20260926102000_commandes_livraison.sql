-- Commandes : sur place, à emporter et livraison.
-- Une commande à emporter ou en livraison est un bon unique, rattaché à un client plutôt qu'à une table.
-- Suivi livraison : envoyee (en cuisine) → servi_at (prête) → en_livraison_at (partie) → terminee (livrée).
alter table public.commandes_salle
  add column if not exists type_commande text not null default 'sur_place',
  add column if not exists client_nom text,
  add column if not exists client_telephone text,
  add column if not exists adresse text,
  add column if not exists heure_souhaitee time,
  add column if not exists plateforme text,
  add column if not exists en_livraison_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'commandes_salle_type_commande_check') then
    alter table public.commandes_salle add constraint commandes_salle_type_commande_check
      check (type_commande in ('sur_place', 'emporter', 'livraison'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'commandes_salle_livraison_adresse_check') then
    alter table public.commandes_salle add constraint commandes_salle_livraison_adresse_check
      check (type_commande <> 'livraison' or length(trim(coalesce(adresse, ''))) > 0);
  end if;
end $$;
