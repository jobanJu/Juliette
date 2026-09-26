-- Documentation : procédures écrites et fichiers (contrats, attestations, factures…).
--
-- * Table documents : un document = un texte et/ou un fichier, une catégorie, une visibilité
--   (toute l'équipe ou responsables seulement) et une échéance facultative (contrat, contrôle…).
-- * Fichiers dans le bucket privé « documents », rangés sous <etablissement_id>/… ; la lecture d'un
--   fichier suit exactement la visibilité de son document.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references public.etablissements(id) on delete cascade,
  titre text not null check (length(trim(titre)) > 0),
  categorie text not null default 'Autre',
  contenu text,
  fichier_path text unique,
  fichier_nom text,
  fichier_type text,
  fichier_taille bigint,
  visibilite text not null default 'tous' check (visibilite in ('tous', 'responsables')),
  epingle boolean not null default false,
  echeance date,
  created_by uuid references public.comptes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_etab_idx on public.documents (etablissement_id, categorie);

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at before update on public.documents for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

drop policy if exists documents_lecture on public.documents;
create policy documents_lecture on public.documents for select to authenticated
  using (est_membre_actif(etablissement_id) and (visibilite = 'tous' or est_manager_de(etablissement_id)));
drop policy if exists documents_gestion on public.documents;
create policy documents_gestion on public.documents for all to authenticated
  using (est_manager_de(etablissement_id)) with check (est_manager_de(etablissement_id));
drop policy if exists documents_module_access on public.documents;
create policy documents_module_access on public.documents as restrictive for select to authenticated
  using (acces_module_de(etablissement_id, 'documentation'));

-- Bucket privé (20 Mo par fichier).
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Lecture : seulement si le document correspondant est lisible (même règle que la table).
drop policy if exists documents_fichiers_lecture on storage.objects;
create policy documents_fichiers_lecture on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.fichier_path = storage.objects.name
        and est_membre_actif(d.etablissement_id)
        and (d.visibilite = 'tous' or est_manager_de(d.etablissement_id))
    )
  );

-- Écriture : responsables et directeur, dans le dossier de leur établissement.
drop policy if exists documents_fichiers_ajout on storage.objects;
create policy documents_fichiers_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and est_manager_de(((storage.foldername(name))[1])::uuid));
drop policy if exists documents_fichiers_suppression on storage.objects;
create policy documents_fichiers_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and est_manager_de(((storage.foldername(name))[1])::uuid));
