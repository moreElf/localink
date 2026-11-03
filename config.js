// TravelBuddy demo configuration.
// window.LOCALINK_CONFIG is unchanged so the existing Supabase client keeps working.
// Swipe, match, and 1:1 messages are disabled in the client. Registration is not open.
//
// The Explore screen now uses Leaflet with OpenStreetMap tiles, so no map
// API key is required for the current prototype.
//
// Supabase:
// 1. Open Supabase Dashboard -> Project Settings -> API.
// 2. Copy "Project URL" into SUPABASE_URL.
// 3. Copy the public "anon" key into SUPABASE_ANON_KEY.
// 4. Do not put the service_role key in frontend code.
//
// In a future Next.js app, these should become:
// NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
// NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key
window.LOCALINK_CONFIG = {
  SUPABASE_URL: "https://bdfrphwlcwvamjnapmgv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZnJwaHdsY3d2YW1qbmFwbWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzQzMjUsImV4cCI6MjA5NTUxMDMyNX0.Pqxf0BTeuoq6VtennHWzHkO1uY9Rp_CBc4uzWWFVKMk",
  DEBUG: true,
};
