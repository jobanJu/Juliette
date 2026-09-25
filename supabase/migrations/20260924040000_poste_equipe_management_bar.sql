-- Le pôle se déduit désormais de la fonction (voir POSTE_DE_FONCTION dans src/lib/planning.ts) :
-- Directeur / Directeur adjoint / Manager → management, Chef barman → bar.
alter type public.poste_equipe add value if not exists 'management';
alter type public.poste_equipe add value if not exists 'bar';
