-- Messagerie : temps réel et heure du serveur.
--
-- * Les messages sont publiés dans supabase_realtime : l'application reçoit les nouveaux messages
--   sans recharger. La RLS s'applique aussi au temps réel, chacun ne reçoit que ce qu'il peut lire.
-- * L'heure d'un message est celle du serveur (avant, l'expéditeur pouvait la choisir).

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

create or replace function public.messages_heure_serveur()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user = 'authenticated' then
    new.created_at := now();
  end if;
  return new;
end $$;

drop trigger if exists messages_heure_serveur on public.messages;
create trigger messages_heure_serveur
  before insert on public.messages
  for each row execute function public.messages_heure_serveur();
