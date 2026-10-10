-- Marginalia schema: documents and their chunks (pgvector + full-text search),
-- conversations, messages, a per-user daily question quota, and the private
-- storage bucket for uploaded files. Every table has row level security, so the
-- publishable key can only ever reach the signed-in user's own rows.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Documents: one row per uploaded file. Status is written by ingestion only.
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  filename text not null check (char_length(filename) between 1 and 255),
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  error text,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_user_created_idx on public.documents (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Chunks: markdown sections with their embedding and a full-text index.
-- 768 dimensions keeps the HNSW index under pgvector's 2000-dimension limit and
-- must match EMBEDDING_DIMENSIONS.
-- ---------------------------------------------------------------------------
create table public.chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  chunk_index integer not null,
  heading_path text not null default '',
  content text not null,
  embedding extensions.vector(768) not null,
  fts tsvector generated always as (to_tsvector('english', heading_path || ' ' || content)) stored
);
create index chunks_document_idx on public.chunks (document_id);
create index chunks_user_idx on public.chunks (user_id);
create index chunks_embedding_idx on public.chunks using hnsw (embedding extensions.vector_cosine_ops);
create index chunks_fts_idx on public.chunks using gin (fts);

-- ---------------------------------------------------------------------------
-- Conversations and messages. Assistant messages keep the sources they cited.
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- New messages move their conversation to the top of the sidebar
create function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------------------------------------------------------------------------
-- Daily question quota, counted in UTC days. Only the server (secret key) can
-- spend it, so a user can't call the function with a bigger limit.
-- ---------------------------------------------------------------------------
create table public.usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  questions integer not null default 0,
  primary key (user_id, day)
);

create function public.consume_question(p_user_id uuid, p_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
  used integer;
begin
  insert into public.usage (user_id, day, questions) values (p_user_id, today, 1)
  on conflict (user_id, day) do update set questions = public.usage.questions + 1
  returning questions into used;

  if used > p_limit then
    update public.usage set questions = questions - 1 where user_id = p_user_id and day = today;
    return false;
  end if;
  return true;
end;
$$;
revoke execute on function public.consume_question from public, anon, authenticated;
grant execute on function public.consume_question to service_role;

-- ---------------------------------------------------------------------------
-- Hybrid search: semantic (cosine) and keyword (full text) results merged with
-- reciprocal rank fusion. Security invoker, so RLS limits it to the caller's
-- own chunks. Keyword terms are OR-ed, since questions rarely contain every word
-- of the passage that answers them.
-- ---------------------------------------------------------------------------
create function public.hybrid_search(
  query_text text,
  query_embedding extensions.vector(768),
  match_count integer default 8,
  min_similarity double precision default 0.55,
  rrf_k integer default 50
)
returns table (
  id bigint,
  document_id uuid,
  document_title text,
  heading_path text,
  content text,
  similarity double precision
)
language sql stable security invoker
set search_path = public, extensions
-- Keep scanning the HNSW index until enough rows pass the RLS filter
set hnsw.iterative_scan = relaxed_order
as $$
  with query as (
    select to_tsquery('english', replace(plainto_tsquery('english', query_text)::text, '&', '|')) as q
  ),
  semantic as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rank
    from chunks c
    where 1 - (c.embedding <=> query_embedding) >= min_similarity
    order by c.embedding <=> query_embedding
    limit match_count * 2
  ),
  keyword as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, query.q) desc) as rank
    from chunks c, query
    where c.fts @@ query.q
    order by ts_rank_cd(c.fts, query.q) desc
    limit match_count * 2
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
      coalesce(1.0 / (rrf_k + s.rank), 0) + coalesce(1.0 / (rrf_k + k.rank), 0) as score
    from semantic s
    full outer join keyword k on s.id = k.id
  )
  select c.id, c.document_id, d.filename, c.heading_path, c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from fused f
  join chunks c on c.id = f.id
  join documents d on d.id = c.document_id
  where d.status = 'ready'
  order by f.score desc
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.usage enable row level security;

-- Documents: users add and remove their own; status changes come from ingestion.
create policy "Read own documents" on public.documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own documents" on public.documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Delete own documents" on public.documents
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Chunks: read-only for users; ingestion writes them with the secret key.
create policy "Read own chunks" on public.chunks
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Read own conversations" on public.conversations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Start own conversations" on public.conversations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Delete own conversations" on public.conversations
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Read own messages" on public.messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add messages to own conversations" on public.messages
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

create policy "Read own usage" on public.usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage: a private bucket, one folder per user (<user id>/<document id>/<file>)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 10485760)
on conflict (id) do nothing;

create policy "Upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Read own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
