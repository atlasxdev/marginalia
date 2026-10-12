-- Each user's margin pet: what it looks like, its name, and where on the
-- screen they left it (x and y as fractions: 0,0 top left, 1,1 bottom right).
create table public.pets (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  species text not null check (species in ('blob', 'cat', 'bird', 'bookworm')),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  eyes text not null check (eyes in ('dot', 'sparkle', 'sleepy')),
  accessory text not null check (accessory in ('none', 'glasses', 'scarf', 'bookmark')),
  x real not null default 0.9 check (x between 0 and 1),
  y real not null default 1 check (y between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pets enable row level security;

create policy "Read own pet" on public.pets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Adopt own pet" on public.pets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Change own pet" on public.pets
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Release own pet" on public.pets
  for delete to authenticated using ((select auth.uid()) = user_id);
