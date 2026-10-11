-- Spaces: a named set of documents with optional instructions. A conversation
-- started in a space searches only that space's documents. Documents stay in the
-- library and can belong to several spaces.

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spaces_user_updated_idx on public.spaces (user_id, updated_at desc);

create table public.space_documents (
  space_id uuid not null references public.spaces on delete cascade,
  document_id uuid not null references public.documents on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (space_id, document_id)
);
create index space_documents_document_idx on public.space_documents (document_id);

-- Deleting a space keeps its conversations; they go back to searching everything.
alter table public.conversations add column space_id uuid references public.spaces on delete set null;
create index conversations_space_idx on public.conversations (space_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.spaces enable row level security;
alter table public.space_documents enable row level security;

create policy "Read own spaces" on public.spaces
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own spaces" on public.spaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own spaces" on public.spaces
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own spaces" on public.spaces
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Both the space and the document must be the user's own
create policy "Read own space documents" on public.space_documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own documents to own spaces" on public.space_documents
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.spaces s where s.id = space_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.documents d where d.id = document_id and d.user_id = (select auth.uid()))
  );
create policy "Remove own space documents" on public.space_documents
  for delete to authenticated using ((select auth.uid()) = user_id);

-- A conversation can only be started in one of the user's own spaces
drop policy "Start own conversations" on public.conversations;
create policy "Start own conversations" on public.conversations
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (space_id is null or exists (
      select 1 from public.spaces s where s.id = space_id and s.user_id = (select auth.uid())
    ))
  );

-- ---------------------------------------------------------------------------
-- Hybrid search, now with an optional document filter for spaces. Null searches
-- every document; an array limits both the semantic and keyword halves to it.
-- ---------------------------------------------------------------------------
drop function public.hybrid_search(text, extensions.vector, integer, double precision, integer);

-- Using the vector type loads pgvector in this session, which registers
-- hnsw.iterative_scan; without it, the function can't set that parameter.
select '[1]'::extensions.vector;

create function public.hybrid_search(
  query_text text,
  query_embedding extensions.vector(768),
  match_count integer default 8,
  min_similarity double precision default 0.55,
  rrf_k integer default 50,
  document_ids uuid[] default null
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
-- Keep scanning the HNSW index until enough rows pass the RLS and space filters
set hnsw.iterative_scan = relaxed_order
as $$
  with query as (
    select to_tsquery('english', replace(plainto_tsquery('english', query_text)::text, '&', '|')) as q
  ),
  semantic as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rank
    from chunks c
    where 1 - (c.embedding <=> query_embedding) >= min_similarity
      and (document_ids is null or c.document_id = any(document_ids))
    order by c.embedding <=> query_embedding
    limit match_count * 2
  ),
  keyword as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, query.q) desc) as rank
    from chunks c, query
    where c.fts @@ query.q
      and (document_ids is null or c.document_id = any(document_ids))
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
