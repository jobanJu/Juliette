-- Règles des demandes RH (congés et acomptes), appliquées par la base.
--
-- Avant : la RLS laissait un salarié modifier sa demande tant qu'elle était « en attente », sans
-- contrôler ce qu'il modifiait. Il pouvait donc la passer lui-même en « validée », ou antidater
-- created_at pour déclencher la validation automatique à 5 jours.
--
-- Maintenant, pour les requêtes directes des utilisateurs :
--   * created_at est toujours l'heure du serveur et ne se modifie plus ;
--   * seul un responsable/directeur valide ou refuse ; sa décision est signée (decide_par, decide_at) ;
--   * un salarié ne peut passer sa demande en « validée » qu'en appliquant la règle des 5 jours
--     (congé sans réponse depuis 5 jours) : c'est ce que fait l'ancien site, qui continue de marcher ;
--   * un acompte doit avoir un montant positif ;
--   * une demande ne change ni de salarié ni d'établissement.
-- La fonction auto_valider_conges() applique la règle des 5 jours côté serveur.

create or replace function public.conges_regles()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_manager boolean;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  v_manager := est_manager_de(new.etablissement_id);

  if new.type = 'acompte' and (new.montant is null or new.montant <= 0) then
    raise exception 'Un acompte doit avoir un montant positif' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    if not v_manager or new.statut = 'en_attente' then
      new.statut := 'en_attente';
      new.decide_par := null;
      new.decide_at := null;
    else
      new.decide_par := mon_compte_id(new.etablissement_id);
      new.decide_at := now();
    end if;
    return new;
  end if;

  -- UPDATE
  if new.compte_id <> old.compte_id or new.etablissement_id <> old.etablissement_id then
    raise exception 'Une demande ne change pas de salarié ni d''établissement' using errcode = '42501';
  end if;
  new.created_at := old.created_at;

  if v_manager then
    if new.statut is distinct from old.statut then
      if new.statut = 'en_attente' then
        new.decide_par := null;
        new.decide_at := null;
      else
        new.decide_par := mon_compte_id(new.etablissement_id);
        new.decide_at := now();
      end if;
    end if;
    return new;
  end if;

  -- Salarié (la RLS limite déjà à ses propres demandes en attente).
  if new.statut is distinct from old.statut then
    if new.statut = 'validee' and old.type = 'conge' and old.created_at < now() - interval '5 days'
       and new.date_debut = old.date_debut and new.date_fin = old.date_fin and new.type = old.type then
      new.decide_par := null;
      new.decide_at := now();
      return new;
    end if;
    raise exception 'Seul un responsable peut valider ou refuser une demande' using errcode = '42501';
  end if;
  new.decide_par := null;
  new.decide_at := null;
  return new;
end $$;

drop trigger if exists conges_regles on public.conges;
create trigger conges_regles
  before insert or update on public.conges
  for each row execute function public.conges_regles();

-- Validation tacite : un congé sans réponse depuis 5 jours est validé. Appelable par tout membre
-- actif ; elle n'agit que selon la règle, donc sans risque.
create or replace function public.auto_valider_conges(p_etablissement_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer;
begin
  if not est_membre_actif(p_etablissement_id) then
    return 0;
  end if;
  update conges
    set statut = 'validee', decide_at = now(), decide_par = null
    where etablissement_id = p_etablissement_id
      and statut = 'en_attente'
      and type = 'conge'
      and created_at < now() - interval '5 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.auto_valider_conges(uuid) from public, anon;
grant execute on function public.auto_valider_conges(uuid) to authenticated;
