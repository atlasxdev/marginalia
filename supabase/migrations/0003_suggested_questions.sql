-- Questions each document can answer, written during ingestion and offered on
-- the new question page.
alter table public.documents
  add column suggested_questions text[] not null default '{}';
