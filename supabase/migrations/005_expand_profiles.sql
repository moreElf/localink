-- Localink richer profiles.
-- Adds optional profile context fields without removing existing data.

alter table public.profiles
  add column if not exists bio text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists instagram text,
  add column if not exists home_city text,
  add column if not exists favorite_spots text[] not null default '{}',
  add column if not exists profile_photo_url text,
  add column if not exists verified boolean not null default false;
