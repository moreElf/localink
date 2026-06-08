-- Localink V3: unified profiles, optional Local mode, and profile media.
-- This version avoids dollar-quoted blocks for Supabase SQL Editor compatibility.

alter table public.profiles
  add column if not exists local_enabled boolean not null default false,
  add column if not exists job text,
  add column if not exists education text;

create table if not exists public.profile_media (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  public_url text,
  category text not null default 'self' check (category in ('self', 'favorite')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists profile_media_profile_id_idx
on public.profile_media (profile_id);

alter table public.profile_media enable row level security;

do '
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = ''public''
      and tablename = ''profile_media''
      and policyname = ''Users can read own profile media''
  ) then
    execute ''create policy "Users can read own profile media" on public.profile_media for select to authenticated using (auth.uid() = profile_id)'';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = ''public''
      and tablename = ''profile_media''
      and policyname = ''Authenticated users can read active Local media''
  ) then
    execute ''create policy "Authenticated users can read active Local media" on public.profile_media for select to authenticated using (exists (select 1 from public.local_host_profiles lhp where lhp.user_id = profile_media.profile_id and lhp.is_active = true))'';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = ''public''
      and tablename = ''profile_media''
      and policyname = ''Users can insert own profile media''
  ) then
    execute ''create policy "Users can insert own profile media" on public.profile_media for insert to authenticated with check (auth.uid() = profile_id)'';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = ''public''
      and tablename = ''profile_media''
      and policyname = ''Users can update own profile media''
  ) then
    execute ''create policy "Users can update own profile media" on public.profile_media for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id)'';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = ''public''
      and tablename = ''profile_media''
      and policyname = ''Users can delete own profile media''
  ) then
    execute ''create policy "Users can delete own profile media" on public.profile_media for delete to authenticated using (auth.uid() = profile_id)'';
  end if;
end;
';

insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do update set public = excluded.public;

do '
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = ''storage''
      and tablename = ''objects''
      and policyname = ''Users can read own profile media objects''
  ) then
    execute ''create policy "Users can read own profile media objects" on storage.objects for select to authenticated using (bucket_id = ''''profile-media'''' and auth.uid()::text = (storage.foldername(name))[1])'';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = ''storage''
      and tablename = ''objects''
      and policyname = ''Users can upload own profile media objects''
  ) then
    execute ''create policy "Users can upload own profile media objects" on storage.objects for insert to authenticated with check (bucket_id = ''''profile-media'''' and auth.uid()::text = (storage.foldername(name))[1])'';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = ''storage''
      and tablename = ''objects''
      and policyname = ''Users can update own profile media objects''
  ) then
    execute ''create policy "Users can update own profile media objects" on storage.objects for update to authenticated using (bucket_id = ''''profile-media'''' and auth.uid()::text = (storage.foldername(name))[1]) with check (bucket_id = ''''profile-media'''' and auth.uid()::text = (storage.foldername(name))[1])'';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = ''storage''
      and tablename = ''objects''
      and policyname = ''Users can delete own profile media objects''
  ) then
    execute ''create policy "Users can delete own profile media objects" on storage.objects for delete to authenticated using (bucket_id = ''''profile-media'''' and auth.uid()::text = (storage.foldername(name))[1])'';
  end if;
end;
';
