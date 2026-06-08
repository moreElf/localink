-- Localink MVP sample seed.
--
-- Before running:
-- 1. In Supabase Dashboard -> Authentication -> Users, create three sample users.
-- 2. Copy each user's UUID.
-- 3. Replace the three 00000000 placeholder UUIDs below.
-- 4. Run this file in Supabase Dashboard -> SQL Editor.
--
-- The profile IDs must exist in auth.users because public.profiles.id
-- references auth.users(id).

do $$
declare
  aiko_user_id uuid := '7626dd0a-87b9-4505-9ef6-48058f708a36';
  ren_user_id uuid := '526577c1-089d-46d1-a2e2-38b0e8c378e4';
  nana_user_id uuid := 'edaeb43b-dcf0-4be5-9c2c-802f505aef41';
  tokyo_city_id uuid;
  seoul_city_id uuid;
  osaka_city_id uuid;
begin
  if aiko_user_id::text like '00000000-%'
    or ren_user_id::text like '00000000-%'
    or nana_user_id::text like '00000000-%' then
    raise exception 'Replace sample user UUID placeholders with real auth.users IDs before running this seed.';
  end if;

  insert into public.cities (id, name, country, latitude, longitude, image_url)
  values
    ('11111111-1111-4111-8111-111111111111', 'Tokyo', 'Japan', 35.681200, 139.767100, 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=500&q=80'),
    ('22222222-2222-4222-8222-222222222222', 'Seoul', 'South Korea', 37.566500, 126.978000, 'https://images.unsplash.com/photo-1538485399081-7c8edc61cdbf?auto=format&fit=crop&w=500&q=80'),
    ('33333333-3333-4333-8333-333333333333', 'Osaka', 'Japan', 34.693700, 135.502300, 'https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=500&q=80')
  on conflict (name, country) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    image_url = excluded.image_url;

  select id into tokyo_city_id from public.cities where name = 'Tokyo' and country = 'Japan';
  select id into seoul_city_id from public.cities where name = 'Seoul' and country = 'South Korea';
  select id into osaka_city_id from public.cities where name = 'Osaka' and country = 'Japan';

  insert into public.profiles (id, role, name, email, avatar_url, bio, languages, home_city_id)
  values
    (aiko_user_id, 'local_host', 'Aiko', 'aiko.localink@example.com', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80', 'Tokyo designer who loves cafe hopping and local art spots.', array['English', 'Japanese'], tokyo_city_id),
    (ren_user_id, 'local_host', 'Ren', 'ren.localink@example.com', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80', 'Restaurant editor who knows tiny dinner counters and quiet jazz bars.', array['English', 'Japanese'], tokyo_city_id),
    (nana_user_id, 'local_host', 'Nana', 'nana.localink@example.com', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80', 'Osaka local who enjoys coffee, art walks, and neighborhood restaurants.', array['English', 'Japanese'], osaka_city_id)
  on conflict (id) do update set
    role = excluded.role,
    name = excluded.name,
    email = excluded.email,
    avatar_url = excluded.avatar_url,
    bio = excluded.bio,
    languages = excluded.languages,
    home_city_id = excluded.home_city_id;

  insert into public.local_host_profiles (
    id,
    user_id,
    city_id,
    job_title,
    host_bio,
    availability,
    verified,
    interests,
    languages,
    photo_url,
    is_active
  )
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', aiko_user_id, tokyo_city_id, 'Graphic Designer', 'Loves cafe hopping and local art spots.', 'Weeknights and Sunday afternoons', true, array['Coffee', 'Art', 'Travel', 'Photography'], array['English', 'Japanese'], 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80', true),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ren_user_id, tokyo_city_id, 'Restaurant Editor', 'Knows tiny dinner counters and quiet jazz bars.', 'Friday evenings', true, array['Foodie', 'Jazz', 'Design'], array['English', 'Japanese'], 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80', true),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', nana_user_id, osaka_city_id, 'Ceramic Artist', 'Finds calm coffee shops, galleries, and local Osaka dinner spots.', 'Weekend afternoons', false, array['Coffee', 'Art walks', 'Local food'], array['English', 'Japanese'], 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80', true)
  on conflict (id) do update set
    user_id = excluded.user_id,
    city_id = excluded.city_id,
    job_title = excluded.job_title,
    host_bio = excluded.host_bio,
    availability = excluded.availability,
    verified = excluded.verified,
    interests = excluded.interests,
    languages = excluded.languages,
    photo_url = excluded.photo_url,
    is_active = excluded.is_active;

  insert into public.host_spots (host_profile_id, name, type, image_url, description, sort_order)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Kiyosumi coffee walk', 'Coffee spot', 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=300&q=80', 'Quiet cafes and small galleries for a first Tokyo afternoon.', 1),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Yanaka backstreet snacks', 'Local food', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=300&q=80', 'Old streets, casual snacks, and slower neighborhood energy.', 2),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Ebisu listening bar', 'Night spot', 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=300&q=80', 'A relaxed evening route for music and conversation.', 3),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Koenji vinyl bars', 'Music', 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80', 'Small music bars and casual late-night places.', 1),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Monzen izakaya lane', 'Dinner', 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=300&q=80', 'Easygoing dinner counters away from the obvious tourist routes.', 2),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Nakazakicho art walk', 'Art walk', 'https://images.unsplash.com/photo-1526481280693-3bfa7568e0f3?auto=format&fit=crop&w=300&q=80', 'Small shops, galleries, and older houses in central Osaka.', 1),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Utsubo Park coffee', 'Coffee spot', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=300&q=80', 'A calmer coffee route near a green park.', 2),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Tenma dinner alleys', 'Local food', 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=300&q=80', 'Casual dinner spots with local energy.', 3)
  on conflict do nothing;
end $$;
