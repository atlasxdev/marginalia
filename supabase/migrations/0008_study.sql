-- Studying: decks made from a whole document or subject, every answer a student
-- gives (to find weak topics), focus sessions, and a learning method per subject.

-- ---------------------------------------------------------------------------
-- Decks and other actions can come from an answer, a document or a subject
-- ---------------------------------------------------------------------------
alter table public.actions alter column message_id drop not null;
alter table public.actions
  add column document_id uuid references public.documents on delete cascade,
  add column space_id uuid references public.spaces on delete cascade,
  add constraint actions_one_origin check (num_nonnulls(message_id, document_id, space_id) = 1);
create index actions_user_kind_idx on public.actions (user_id, kind, created_at desc);

drop policy "Add actions to own answers" on public.actions;
create policy "Add own actions" on public.actions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (message_id is null or exists (
      select 1 from public.messages m
      where m.id = message_id and m.user_id = (select auth.uid()) and m.role = 'assistant'
    ))
    and (document_id is null or exists (
      select 1 from public.documents d where d.id = document_id and d.user_id = (select auth.uid())
    ))
    and (space_id is null or exists (
      select 1 from public.spaces s where s.id = space_id and s.user_id = (select auth.uid())
    ))
  );

-- ---------------------------------------------------------------------------
-- How each subject teaches: quiz you (recall), have you explain it (feynman),
-- guide you with questions (socratic), or just answer
-- ---------------------------------------------------------------------------
alter table public.spaces
  add column study_method text not null default 'recall'
  check (study_method in ('recall', 'feynman', 'socratic', 'answer'));

-- ---------------------------------------------------------------------------
-- Attempts: one row per card answered, from flipping, the quiz or typing it
-- ---------------------------------------------------------------------------
create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  action_id uuid not null references public.actions on delete cascade,
  card_index integer not null check (card_index between 0 and 99),
  topic text not null default '' check (char_length(topic) <= 80),
  result text not null check (result in ('right', 'almost', 'wrong')),
  mode text not null check (mode in ('cards', 'quiz', 'recall')),
  created_at timestamptz not null default now()
);
create index attempts_user_created_idx on public.attempts (user_id, created_at desc);
create index attempts_action_idx on public.attempts (action_id);

-- ---------------------------------------------------------------------------
-- Focus sessions with your buddy
-- ---------------------------------------------------------------------------
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  method text not null check (method in ('pomodoro', '52-17', 'flow')),
  focus_seconds integer not null check (focus_seconds between 60 and 14400),
  space_id uuid references public.spaces on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null default now()
);
create index study_sessions_user_ended_idx on public.study_sessions (user_id, ended_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.attempts enable row level security;
alter table public.study_sessions enable row level security;

create policy "Read own attempts" on public.attempts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add attempts on own decks" on public.attempts
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.actions a where a.id = action_id and a.user_id = (select auth.uid()))
  );

create policy "Read own study sessions" on public.study_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own study sessions" on public.study_sessions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (space_id is null or exists (
      select 1 from public.spaces s where s.id = space_id and s.user_id = (select auth.uid())
    ))
  );
