-- Actions: things made from an answer, like a checklist, calendar events, an
-- email draft or flashcards. The server writes `payload` from the model's output;
-- the user can only change `state` (ticked items, quiz progress).

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('checklist', 'calendar', 'email', 'flashcards')),
  payload jsonb not null,
  state jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index actions_message_idx on public.actions (message_id, created_at);

-- Actions the model suggested for an answer, shown as buttons under it
alter table public.messages add column suggested_actions text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.actions enable row level security;

create policy "Read own actions" on public.actions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add actions to own answers" on public.actions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.user_id = (select auth.uid()) and m.role = 'assistant'
    )
  );
create policy "Delete own actions" on public.actions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke update on public.actions from authenticated;
grant update (state) on public.actions to authenticated;
create policy "Update own action state" on public.actions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
