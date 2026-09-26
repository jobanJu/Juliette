-- Documents : un responsable doit voir tous les fichiers de son établissement, sinon il ne peut pas
-- supprimer un fichier dont la fiche vient d'être effacée ou remplacée (la suppression passe par
-- une lecture), et le fichier reste orphelin dans le stockage.
drop policy if exists documents_fichiers_lecture on storage.objects;
create policy documents_fichiers_lecture on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      est_manager_de(((storage.foldername(name))[1])::uuid)
      or exists (
        select 1 from public.documents d
        where d.fichier_path = storage.objects.name
          and est_membre_actif(d.etablissement_id)
          and d.visibilite = 'tous'
      )
    )
  );
