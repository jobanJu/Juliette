-- Documents RH belges : licenciement avec préavis, motif grave, rupture de commun accord,
-- accusé de réception de démission, certificat de travail.
alter table public.documents_rh drop constraint if exists documents_rh_type_check;
alter table public.documents_rh add constraint documents_rh_type_check check (type in (
  'fiche_poste', 'remise_materiel', 'reglement', 'promesse', 'avertissement', 'convocation', 'certificat', 'attestation',
  'licenciement', 'rupture_conventionnelle', 'rupture_essai', 'rupture_cdd', 'demission', 'solde_tout_compte',
  'be_licenciement', 'be_motif_grave', 'be_commun_accord', 'be_demission', 'be_certificat'
));
