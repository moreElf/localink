-- Localink MVP schema: public profile + destination discovery only.
-- Excluded for this migration: swipes, matches, messages, payments, reviews, bookings.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'traveler' check (role in ('traveler', 'local_host')),
  name text not null,
  email text,
  avatar_url text,
  bio text,
  languages text[] not null default '{}',
  home_city_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, country)
);

alter table public.profiles
  add constraint profiles_home_city_id_fkey
  foreign key (home_city_id)
  references public.cities(id)
  on delete set null;

create table public.local_host_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  job_title text,
  host_bio text,
  availability text,
  verified boolean not null default false,
  interests text[] not null default '{}',
  languages text[] not null default '{}',
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.host_spots (
  id uuid primary key default gen_random_uuid(),
  host_profile_id uuid not null references public.local_host_profiles(id) on delete cascade,
  name text not null,
  type text,
  image_url text,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cities_coordinates_idx on public.cities (latitude, longitude);
create index local_host_profiles_city_id_idx on public.local_host_profiles (city_id);
create index local_host_profiles_user_id_idx on public.local_host_profiles (user_id);
create index host_spots_host_profile_id_idx on public.host_spots (host_profile_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_cities_updated_at
before update on public.cities
for each row execute function public.set_updated_at();

create trigger set_local_host_profiles_updated_at
before update on public.local_host_profiles
for each row execute function public.set_updated_at();

create trigger set_host_spots_updated_at
before update on public.host_spots
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.local_host_profiles enable row level security;
alter table public.host_spots enable row level security;

-- Profiles: authenticated users can discover basic public profiles,
-- but can only create/update their own profile.
create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Cities: readable by logged-in users. Writes should happen through dashboard,
-- migrations, seed scripts, or service-role admin tools only.
create policy "Authenticated users can read cities"
on public.cities
for select
to authenticated
using (true);

-- Local host profiles: active hosts are public to authenticated users.
-- Hosts can manage only their own host profile.
create policy "Authenticated users can read active host profiles"
on public.local_host_profiles
for select
to authenticated
using (is_active = true);

create policy "Users can insert own host profile"
on public.local_host_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own host profile"
on public.local_host_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Host spots: readable when the related host profile is active.
-- Hosts can manage spots only for their own host profile.
create policy "Authenticated users can read spots for active hosts"
on public.host_spots
for select
to authenticated
using (
  exists (
    select 1
    from public.local_host_profiles lhp
    where lhp.id = host_spots.host_profile_id
      and lhp.is_active = true
  )
);

create policy "Users can insert spots for own host profile"
on public.host_spots
for insert
to authenticated
with check (
  exists (
    select 1
    from public.local_host_profiles lhp
    where lhp.id = host_spots.host_profile_id
      and lhp.user_id = auth.uid()
  )
);

create policy "Users can update spots for own host profile"
on public.host_spots
for update
to authenticated
using (
  exists (
    select 1
    from public.local_host_profiles lhp
    where lhp.id = host_spots.host_profile_id
      and lhp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.local_host_profiles lhp
    where lhp.id = host_spots.host_profile_id
      and lhp.user_id = auth.uid()
  )
);

create policy "Users can delete spots for own host profile"
on public.host_spots
for delete
to authenticated
using (
  exists (
    select 1
    from public.local_host_profiles lhp
    where lhp.id = host_spots.host_profile_id
      and lhp.user_id = auth.uid()
  )
);
