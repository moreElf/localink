async function requireSupabase() {
  const config = window.LOCALINK_CONFIG || {};
  if (!window.LocalinkSupabase && !window.supabase && config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
    await waitForSupabaseLibrary();
  }

  if (!window.LocalinkSupabase && window.supabase && config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
    window.LocalinkSupabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  if (!window.LocalinkSupabase) {
    throw new Error("Supabase client is not configured. Add credentials in config.js.");
  }
  return window.LocalinkSupabase;
}

function waitForSupabaseLibrary(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.supabase || Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}

function throwIfError(error) {
  if (error) throw error;
}

function refuseDemoWrite() {
  throw new Error("TravelBuddy デモではプロフィールとメディアの保存を受け付けていません（受付開始前）。");
}

// TravelBuddy demo: swipe, match, and 1:1 message clients are removed.
// Tables created by supabase/migrations/002–004 stay in place and are not queried here.
window.LocalinkApi = {
  matchingEnabled: false,
  directMessagesEnabled: false,
  profileWritesEnabled: false,

  async signIn() {
    throw new Error("TravelBuddy デモではログインを受け付けていません（受付開始前）。");
  },

  async signUp() {
    throw new Error("TravelBuddy デモではアカウント作成を受け付けていません（受付開始前）。");
  },

  async signOut() {
    const supabase = await requireSupabase();
    const { error } = await supabase.auth.signOut();
    throwIfError(error);
  },

  async getSession() {
    const supabase = await requireSupabase();
    const { data, error } = await supabase.auth.getSession();
    throwIfError(error);
    return data.session || null;
  },

  async getDebugContext() {
    const supabase = await requireSupabase();
    const { data, error } = await supabase.auth.getSession();
    return {
      error,
      isAuthenticated: Boolean(data?.session?.user),
      userId: data?.session?.user?.id || null,
    };
  },

  async getCurrentUserProfile() {
    const supabase = await requireSupabase();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    throwIfError(userError);

    const userId = userData.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    throwIfError(error);
    return data;
  },

  async getProfileByUserId(userId) {
    const supabase = await requireSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    throwIfError(error);
    return data;
  },

  async getProfileById(profileId) {
    const supabase = await requireSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();

    throwIfError(error);
    return data;
  },

  async upsertProfile() {
    refuseDemoWrite();
  },

  async updateProfileRole() {
    refuseDemoWrite();
  },

  async updateProfile() {
    refuseDemoWrite();
  },

  async updateLocalMode() {
    refuseDemoWrite();
  },

  async upsertLocalProfileFromProfile() {
    refuseDemoWrite();
  },

  async getProfileMedia(profileId) {
    const supabase = await requireSupabase();
    const { data, error } = await supabase
      .from("profile_media")
      .select("*")
      .eq("profile_id", profileId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    console.log("[Localink Supabase] getProfileMedia", {
      profileId,
      error,
      count: data?.length || 0,
      rows: data || [],
    });

    throwIfError(error);
    return data;
  },

  async uploadProfileMedia() {
    refuseDemoWrite();
  },

  async deleteProfileMedia() {
    refuseDemoWrite();
  },

  async reorderProfileMedia() {
    refuseDemoWrite();
  },

  async searchCities(query) {
    const supabase = await requireSupabase();
    const trimmed = String(query || "").trim();
    let request = supabase
      .from("cities")
      .select("*")
      .order("name", { ascending: true })
      .limit(12);

    if (trimmed) {
      request = request.or(`name.ilike.%${trimmed}%,country.ilike.%${trimmed}%`);
    }

    const { data, error } = await request;
    throwIfError(error);
    return data || [];
  },

  async getCities() {
    const supabase = await requireSupabase();
    const { data, error } = await supabase
      .from("cities")
      .select("*")
      .order("name", { ascending: true });

    console.log("[Localink Supabase] getCities raw", {
      error,
      count: data?.length || 0,
      rows: data || [],
    });

    throwIfError(error);
    return data;
  },

  async getHostsByCity(cityId, city = null) {
    const supabase = await requireSupabase();
    const debug = {
      selectedCityId: cityId,
      selectedCityName: city?.name || null,
      selectedCityCountry: city?.country || null,
      fallbackCityId: null,
      initialRows: [],
      fallbackRows: [],
      initialError: null,
      fallbackError: null,
      cityLookupError: null,
      finalRows: [],
    };
    const queryHosts = (id) => supabase
      .from("local_host_profiles")
      .select(`
        *,
        profile:profiles!local_host_profiles_user_id_fkey(
          *,
          profile_media(*)
        ),
        city:cities!local_host_profiles_city_id_fkey(*)
      `)
      .eq("city_id", id)
      .eq("is_active", true)
      .order("verified", { ascending: false })
      .order("created_at", { ascending: false });

    let { data, error } = await queryHosts(cityId);
    debug.initialRows = data || [];
    debug.initialError = error;
    throwIfError(error);

    if ((!data || data.length === 0) && city?.name && city?.country) {
      const { data: cityRow, error: cityError } = await supabase
        .from("cities")
        .select("id")
        .eq("name", city.name)
        .eq("country", city.country)
        .maybeSingle();

      debug.cityLookupError = cityError;
      throwIfError(cityError);

      if (cityRow?.id && cityRow.id !== cityId) {
        debug.fallbackCityId = cityRow.id;
        ({ data, error } = await queryHosts(cityRow.id));
        debug.fallbackRows = data || [];
        debug.fallbackError = error;
      }
    }

    debug.finalRows = data || [];
    console.log("[Localink Supabase] getHostsByCity raw", debug);
    window.LocalinkLastHostQueryDebug = debug;

    throwIfError(error);
    return data;
  },

  async getHostById(hostProfileId) {
    const supabase = await requireSupabase();
    const { data, error } = await supabase
      .from("local_host_profiles")
      .select(`
        *,
        profile:profiles!local_host_profiles_user_id_fkey(
          *,
          profile_media(*)
        ),
        city:cities!local_host_profiles_city_id_fkey(*)
      `)
      .eq("id", hostProfileId)
      .eq("is_active", true)
      .single();

    console.log("[Localink Supabase] getHostById raw", {
      hostProfileId,
      error,
      row: data,
    });

    throwIfError(error);
    return data;
  },

  async getHostSpots(hostProfileId) {
    const supabase = await requireSupabase();
    const { data, error } = await supabase
      .from("host_spots")
      .select("*")
      .eq("host_profile_id", hostProfileId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    console.log("[Localink Supabase] getHostSpots raw", {
      hostProfileId,
      error,
      count: data?.length || 0,
      rows: data || [],
    });

    throwIfError(error);
    return data;
  },
};
