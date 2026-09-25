-- Fonction (intitulé de poste précis, ex. "Chef de partie") et type de contrat (heures hebdo de
-- référence ou statut cadre) — plus fin que poste/heures_contrat déjà en place, pour identifier
-- chaque personne en couleur sur le Planning (voir FONCTION_COLOR côté client, lib/planning.ts).
-- Colonnes texte + contrainte de valeurs (pas un type enum Postgres) pour rester simple à faire
-- évoluer plus tard sans migration de type.
alter table public.comptes
  add column if not exists fonction text,
  add column if not exists type_contrat text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comptes_fonction_check') then
    alter table public.comptes
      add constraint comptes_fonction_check check (
        fonction is null or fonction in (
          'directeur', 'directeur_adjoint', 'manager', 'chef_cuisine', 'second', 'chef_de_partie',
          'commis', 'chef_de_rang', 'sommelier', 'serveur', 'runner', 'chef_barman', 'polyvalent'
        )
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comptes_type_contrat_check') then
    alter table public.comptes
      add constraint comptes_type_contrat_check check (
        type_contrat is null or type_contrat in (
          'libre', '15h', '18h', '24h', '25h', '30h', '35h', '39h', 'cadre'
        )
      );
  end if;
end $$;
