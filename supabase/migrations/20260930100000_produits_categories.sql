-- Catégories de produits : une famille (mode de conservation / rayon) et une sous-catégorie libre
-- (Fromages, Légumes, Viandes…) que l'application propose et devine d'après le nom.
alter table public.produits
  add column if not exists famille text,
  add column if not exists sous_categorie text;

alter table public.produits drop constraint if exists produits_famille_valide;
alter table public.produits add constraint produits_famille_valide
  check (famille is null or famille in ('frais', 'surgele', 'sec', 'boissons', 'non_alimentaire'));

-- Reprise de l'ancien champ texte « conservation ».
update public.produits set famille = case
    when lower(conservation) like 'surgel%' then 'surgele'
    when lower(conservation) like 'frais%' then 'frais'
    when lower(conservation) like 'ambiant%' then 'sec'
  end
where famille is null and conservation is not null;

create index if not exists produits_famille_idx on public.produits (etablissement_id, famille, sous_categorie);
