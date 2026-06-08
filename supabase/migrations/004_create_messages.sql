-- Localink MVP messages.
-- Simple one-to-one chat for accepted matches only.
-- Excluded for this migration: realtime, image messages, payments, bookings, reviews, notifications.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz default now()
);

create index messages_match_id_created_at_idx on public.messages (match_id, created_at);
create index messages_sender_id_idx on public.messages (sender_id);

alter table public.messages enable row level security;

create policy "Accepted match members can read messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.matches m
    left join public.local_host_profiles lhp on lhp.id = m.host_profile_id
    where m.id = messages.match_id
      and m.status = 'accepted'
      and (
        m.traveler_id = auth.uid()
        or lhp.user_id = auth.uid()
      )
  )
);

create policy "Accepted match members can send messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and length(btrim(body)) > 0
  and exists (
    select 1
    from public.matches m
    left join public.local_host_profiles lhp on lhp.id = m.host_profile_id
    where m.id = messages.match_id
      and m.status = 'accepted'
      and (
        m.traveler_id = auth.uid()
        or lhp.user_id = auth.uid()
      )
  )
);
