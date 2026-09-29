-- Avenants : un avenant est un document signé comme un contrat (même cycle brouillon → à signer →
-- signé, même preuve d'intégrité), rattaché au contrat qu'il modifie et numéroté.

alter table public.contrats_travail add column if not exists type_document text not null default 'contrat';
alter table public.contrats_travail drop constraint if exists contrats_travail_type_document_check;
alter table public.contrats_travail add constraint contrats_travail_type_document_check check (type_document in ('contrat', 'avenant'));
alter table public.contrats_travail add column if not exists contrat_parent uuid references public.contrats_travail(id) on delete cascade;
alter table public.contrats_travail add column if not exists numero integer;

alter table public.contrats_travail drop constraint if exists contrats_travail_avenant_parent_check;
alter table public.contrats_travail add constraint contrats_travail_avenant_parent_check
  check ((type_document = 'avenant') = (contrat_parent is not null));

create index if not exists contrats_travail_parent_idx on public.contrats_travail (contrat_parent);
