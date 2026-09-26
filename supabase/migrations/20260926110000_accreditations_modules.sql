-- Accréditations : la liste des modules autorisés ne connaissait pas « reservations » ni « haccp ».
alter table public.accreditations_acces drop constraint if exists accreditations_acces_module_check;
alter table public.accreditations_acces add constraint accreditations_acces_module_check check (module = any (array[
  'dashboard', 'inventaire', 'perte', 'aide-commande', 'evenements', 'documentation', 'fiche-technique', 'pointeuse',
  'planning', 'messagerie', 'equipe', 'rh-conges', 'reception', 'finance', 'commandes-caisse', 'configuration-commandes',
  'accreditations', 'reservations', 'haccp'
]));
