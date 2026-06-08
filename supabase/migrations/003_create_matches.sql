-- Localink MVP matches.
-- A traveler like creates a pending request. The local host can accept or reject it.
-- Excluded for this migration: chat, payments, bookings, reviews, notifications.

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null constraint matches_traveler_id_fkey references public.profiles(id) on delete cascade,
  host_profile_id uuid not null constraint matches_host_profile_id_fkey references public.local_host_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (traveler_id, host_profile_id)
);

create index matches_traveler_id_idx on public.matches (traveler_id);
create index matches_host_profile_id_idx on public.matches (host_profile_id);
create index matches_status_idx on public.matches (status);

create trigger set_matches_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

create or replace function public.prevent_invalid_match_update()
returns trigger
language plpgsql
as $$
begin
  if new.traveler_id <> old.traveler_id or new.host_profile_id <> old.host_profile_id then
    raise exception 'Only match status can be updated';
  end if;

  if old.status <> 'pending' then
    raise exception 'Only pending matches can be updated';
  end if;

  if new.status not in ('accepted', 'rejected') then
    raise exception 'Pending matches can only be accepted or rejected';
  end if;

  return new;
end;
$$;

create trigger prevent_invalid_match_update
before update on public.matches
for each row execute function public.prevent_invalid_match_update();

alter table public.matches enable row level security;

create policy "Travelers can read own matches"
on public.matches
for select
to authenticated
using (auth.uid() = traveler_id);

create policy "Hosts can read own host profile matches"
on public.matches
for select
to authenticated
using (
  exists (
    select 1
    from public.local_host_profiles lhp
    where lhp.id = matches.host_profile_id
      and lhp.user_id = auth.uid()
  )
);

create policy "Travelers can insert own pending matches"
on public.matches
for insert
to authenticated
with check (
  auth.uid() = traveler_id
  and status = 'pending'
);

create policy "Hosts can accept or reject pending matches"
on public.matches
for update
to authenticated
using (
  status = 'pending'
  and exists (
    select 1
    from public.local_host_profiles lhp
    where lhp.id = matches.host_profile_id
      and lhp.user_id = auth.uid()
  )
)
with check (
  status in ('accepted', 'rejected')
  and exists (
    select 1
    from public.local_host_profiles lhp
    where lhp.id = matches.host_profile_id
      and lhp.user_id = auth.uid()
  )
);
