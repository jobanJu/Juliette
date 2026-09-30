-- Documents de fin de contrat : licenciement, rupture conventionnelle, rupture de l'essai,
-- rupture anticipée de CDD, accusé de réception de démission, reçu pour solde de tout compte.
alter table public.documents_rh drop constraint if exists documents_rh_type_check;
alter table public.documents_rh add constraint documents_rh_type_check check (type in (
  'fiche_poste', 'remise_materiel', 'reglement', 'promesse', 'avertissement', 'convocation', 'certificat', 'attestation',
  'licenciement', 'rupture_conventionnelle', 'rupture_essai', 'rupture_cdd', 'demission', 'solde_tout_compte'
));
