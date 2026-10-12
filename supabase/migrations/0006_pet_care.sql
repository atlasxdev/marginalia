-- The pet as a little handheld game: when it was last fed, played with and put
-- to bed (its hunger, happiness and energy wear down from those), and the XP it
-- earns as you use Marginalia.
alter table public.pets
  add column fed_at timestamptz not null default now(),
  add column played_at timestamptz not null default now(),
  add column slept_at timestamptz not null default now(),
  add column xp integer not null default 0 check (xp >= 0);
