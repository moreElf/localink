const supabaseConfig = window.LOCALINK_CONFIG || {};

if (!supabaseConfig.SUPABASE_URL || !supabaseConfig.SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in config.js.",
  );
}

window.LocalinkSupabase =
  supabaseConfig.SUPABASE_URL && supabaseConfig.SUPABASE_ANON_KEY
    ? window.supabase?.createClient(
      supabaseConfig.SUPABASE_URL,
      supabaseConfig.SUPABASE_ANON_KEY,
    )
    : null;
