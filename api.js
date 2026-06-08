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

async function getAuthUserId(supabase) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  throwIfError(userError);

  const userId = userData.user?.id;
  if (!userId) throw new Error("No authenticated user found.");
  return userId;
}

const matchSelect = `
  *,
  traveler:profiles!matches_traveler_id_fkey(*),
  host_profile:local_host_profiles!matches_host_profile_id_fkey(
    *,
    profile:profiles!local_host_profiles_user_id_fkey(
      *,
      profile_media(*)
    ),
    city:cities!local_host_profiles_city_id_fkey(*)
  )
`;

window.LocalinkApi = {
  async signIn(email, password) {
    const supabase = await requireSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    throwIfError(error);
    return data;
  },

  async signUp(email, password, name = "") {
    const supabase = await requireSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: name ? { name } : {},
      },
    });
    throwIfError(error);
    return data;
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

  async upsertProfile({ id, email, name, role = "traveler", avatarUrl = null }) {
    const supabase = await requireSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id,
          email,
          name,
          role,
          avatar_url: avatarUrl,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    throwIfError(error);
    return data;
  },

  async updateProfileRole(role) {
    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const { data, error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select("*")
      .single();

    throwIfError(error);
    return data;
  },

  async updateProfile(profile) {
    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const { data, error } = await supabase
      .from("profiles")
      .update({
        name: profile.name,
        bio: profile.bio,
        interests: profile.interests,
        languages: profile.languages,
        home_city: profile.homeCity,
        favorite_spots: profile.favoriteSpots,
        profile_photo_url: profile.profilePhotoUrl,
        avatar_url: profile.profilePhotoUrl || profile.avatarUrl || null,
        job: profile.job,
        education: profile.education,
      })
      .eq("id", userId)
      .select("*")
      .single();

    console.log("[Localink Supabase] updateProfile", {
      error,
      row: data,
    });

    throwIfError(error);
    return data;
  },

  async updateLocalMode(enabled) {
    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const { data, error } = await supabase
      .from("profiles")
      .update({
        local_enabled: Boolean(enabled),
        role: enabled ? "local_host" : "traveler",
      })
      .eq("id", userId)
      .select("*")
      .single();

    console.log("[Localink Supabase] updateLocalMode", {
      enabled,
      error,
      row: data,
    });

    throwIfError(error);

    if (!enabled) {
      const { error: hostError } = await supabase
        .from("local_host_profiles")
        .update({ is_active: false })
        .eq("user_id", userId);
      throwIfError(hostError);
    }

    return data;
  },

  async upsertLocalProfileFromProfile(cityId = null) {
    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    throwIfError(profileError);

    let targetCityId = cityId || profile.home_city_id || null;
    if (!targetCityId && profile.home_city) {
      const { data: cityByName, error: cityByNameError } = await supabase
        .from("cities")
        .select("id")
        .ilike("name", profile.home_city)
        .maybeSingle();
      throwIfError(cityByNameError);
      targetCityId = cityByName?.id || null;
    }
    if (!targetCityId) {
      const { data: firstCity, error: cityError } = await supabase
        .from("cities")
        .select("id")
        .order("name", { ascending: true })
        .limit(1)
        .maybeSingle();
      throwIfError(cityError);
      targetCityId = firstCity?.id;
    }
    if (!targetCityId) throw new Error("A city is required before enabling Local mode.");

    const { data, error } = await supabase
      .from("local_host_profiles")
      .upsert(
        {
          user_id: userId,
          city_id: targetCityId,
          job_title: profile.job || "Local",
          host_bio: profile.bio || "Happy to share local tips with travelers.",
          verified: Boolean(profile.verified),
          interests: profile.interests || [],
          languages: profile.languages || [],
          photo_url: profile.profile_photo_url || profile.avatar_url || null,
          is_active: true,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    console.log("[Localink Supabase] upsertLocalProfileFromProfile", {
      cityId: targetCityId,
      error,
      row: data,
    });

    throwIfError(error);
    return data;
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

  async uploadProfileMedia(file, category = "self", sortOrder = 0) {
    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);
    if (!file) throw new Error("Choose a photo before uploading.");
    if (!["self", "favorite"].includes(category)) throw new Error("Media category must be self or favorite.");

    const extension = file.name?.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = `${crypto.randomUUID()}.${extension}`;
    const storagePath = `${userId}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });
    throwIfError(uploadError);

    const { data: publicData } = supabase.storage
      .from("profile-media")
      .getPublicUrl(storagePath);

    const { data, error } = await supabase
      .from("profile_media")
      .insert({
        profile_id: userId,
        storage_path: storagePath,
        public_url: publicData?.publicUrl || "",
        category,
        sort_order: sortOrder,
      })
      .select("*")
      .single();

    console.log("[Localink Supabase] uploadProfileMedia", {
      category,
      storagePath,
      error,
      row: data,
    });

    throwIfError(error);
    return data;
  },

  async deleteProfileMedia(mediaId) {
    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const { data: media, error: mediaError } = await supabase
      .from("profile_media")
      .select("*")
      .eq("id", mediaId)
      .eq("profile_id", userId)
      .single();
    throwIfError(mediaError);

    const { error: removeError } = await supabase.storage
      .from("profile-media")
      .remove([media.storage_path]);
    throwIfError(removeError);

    const { error } = await supabase
      .from("profile_media")
      .delete()
      .eq("id", mediaId)
      .eq("profile_id", userId);

    console.log("[Localink Supabase] deleteProfileMedia", {
      mediaId,
      error,
    });

    throwIfError(error);
    return media;
  },

  async reorderProfileMedia(mediaIds) {
    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const updates = mediaIds.map((id, index) => supabase
      .from("profile_media")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("profile_id", userId));

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    throwIfError(failed?.error);
    return true;
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

  async createSwipe(hostProfileId, action) {
    if (!["like", "pass"].includes(action)) {
      throw new Error("Swipe action must be like or pass.");
    }

    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const { data, error } = await supabase
      .from("swipes")
      .insert({
        traveler_id: userId,
        host_profile_id: hostProfileId,
        action,
      })
      .select("*")
      .single();

    console.log("[Localink Supabase] createSwipe", {
      hostProfileId,
      action,
      error,
      row: data,
    });

    throwIfError(error);
    return data;
  },

  async getMySwipes() {
    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const { data, error } = await supabase
      .from("swipes")
      .select("*")
      .eq("traveler_id", userId)
      .order("created_at", { ascending: false });

    console.log("[Localink Supabase] getMySwipes", {
      error,
      count: data?.length || 0,
      rows: data || [],
    });

    throwIfError(error);
    return data;
  },

  async createOrGetPendingMatch(hostProfileId) {
    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const { data, error } = await supabase
      .from("matches")
      .insert({
        traveler_id: userId,
        host_profile_id: hostProfileId,
        status: "pending",
      })
      .select(matchSelect)
      .single();

    if (error?.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("matches")
        .select(matchSelect)
        .eq("traveler_id", userId)
        .eq("host_profile_id", hostProfileId)
        .single();

      console.log("[Localink Supabase] createOrGetPendingMatch existing", {
        hostProfileId,
        error: existingError,
        row: existing,
      });

      throwIfError(existingError);
      return existing;
    }

    console.log("[Localink Supabase] createOrGetPendingMatch", {
      hostProfileId,
      error,
      row: data,
    });

    throwIfError(error);
    return data;
  },

  async getMyMatches() {
    const supabase = await requireSupabase();
    await getAuthUserId(supabase);

    const { data, error } = await supabase
      .from("matches")
      .select(matchSelect)
      .eq("status", "accepted")
      .order("updated_at", { ascending: false });

    console.log("[Localink Supabase] getMyMatches", {
      error,
      count: data?.length || 0,
      rows: data || [],
    });

    throwIfError(error);
    return data;
  },

  async getIncomingMatchRequests() {
    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const { data: hostProfile, error: hostError } = await supabase
      .from("local_host_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    throwIfError(hostError);
    if (!hostProfile?.id) return [];

    const { data, error } = await supabase
      .from("matches")
      .select(matchSelect)
      .eq("host_profile_id", hostProfile.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    console.log("[Localink Supabase] getIncomingMatchRequests", {
      hostProfileId: hostProfile.id,
      error,
      count: data?.length || 0,
      rows: data || [],
    });

    throwIfError(error);
    return data;
  },

  async updateMatchStatus(matchId, status) {
    if (!["accepted", "rejected"].includes(status)) {
      throw new Error("Match status must be accepted or rejected.");
    }

    const supabase = await requireSupabase();
    await getAuthUserId(supabase);

    const { data, error } = await supabase
      .from("matches")
      .update({ status })
      .eq("id", matchId)
      .select(matchSelect)
      .single();

    console.log("[Localink Supabase] updateMatchStatus", {
      matchId,
      status,
      error,
      row: data,
    });

    throwIfError(error);
    return data;
  },

  async getMessages(matchId) {
    const supabase = await requireSupabase();
    await getAuthUserId(supabase);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    console.log("[Localink Supabase] getMessages", {
      matchId,
      error,
      count: data?.length || 0,
      rows: data || [],
    });

    throwIfError(error);
    return data;
  },

  async sendMessage(matchId, body) {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      throw new Error("Message cannot be empty.");
    }

    const supabase = await requireSupabase();
    const userId = await getAuthUserId(supabase);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        match_id: matchId,
        sender_id: userId,
        body: trimmedBody,
      })
      .select("*")
      .single();

    console.log("[Localink Supabase] sendMessage", {
      matchId,
      error,
      row: data,
    });

    throwIfError(error);
    return data;
  },
};
