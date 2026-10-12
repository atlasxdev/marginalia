-- Conversations you can rename, pin and put in your own order.
--
-- `position` is the manual order (lower first); new conversations have none and
-- sit at the top until you reorder. Pinned conversations get their own section.
alter table public.conversations
  add column position double precision,
  add column pinned boolean not null default false;

-- Users may change only these three columns, and only on their own rows.
-- Everything else (owner, space, timestamps) stays as the server wrote it.
revoke update on public.conversations from authenticated;
grant update (title, pinned, position) on public.conversations to authenticated;

create policy "Rename, pin and order own conversations" on public.conversations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Saves a whole manual order in one call: ids[1] goes first.
-- Runs as the caller, so the policy above limits it to their own conversations.
create function public.reorder_conversations(ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.conversations c
  set position = o.ord
  from unnest(ids) with ordinality as o(id, ord)
  where c.id = o.id;
$$;

revoke execute on function public.reorder_conversations(uuid[]) from public, anon;
grant execute on function public.reorder_conversations(uuid[]) to authenticated;
