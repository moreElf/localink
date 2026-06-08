-- Localink MVP swipes.
-- This records a traveler's first like/pass action for a local host profile.
-- Excluded for this migration: matches, messages, payments, reviews, bookings.

create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.profiles(id) on delete cascade,
  host_profile_id uuid not null references public.local_host_profiles(id) on delete cascade,
  action text not null check (action in ('like', 'pass')),
  created_at timestamptz not null default now(),
  unique (traveler_id, host_profile_id)
);

create index swipes_traveler_id_idx on public.swipes (traveler_id);
create index swipes_host_profile_id_idx on public.swipes (host_profile_id);

alter table public.swipes enable row level security;

create policy "Users can read own swipes"
on public.swipes
for select
to authenticated
using (auth.uid() = traveler_id);

create policy "Users can insert own swipes"
on public.swipes
for insert
to authenticated
with check (auth.uid() = traveler_id);
