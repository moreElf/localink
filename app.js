const app = document.querySelector("#app");
const { currentUser, cities: fallbackCities, hostDraft } = window.LocalinkData;

const state = {
  screen: "login",
  authMode: "login",
  authUser: null,
  profile: null,
  isNewProfile: false,
  authMessage: "",
  selectedCityId: "11111111-1111-4111-8111-111111111111",
  cities: fallbackCities,
  selectedHostId: null,
  activeChatMatchId: null,
  matches: [],
  incomingRequests: [],
  messagesByMatch: {},
  profileMedia: [],
  citySearchQuery: "",
  citySearchResults: [],
  passedHostIds: [],
  swipes: [],
  loginError: "",
  cityIdAliases: {},
  hostsByCity: {},
  hostDetails: {},
  hostSpots: {},
  debug: {
    supabaseConfigured: false,
    isAuthenticated: false,
    authUserId: null,
    selectedCityId: "",
    rawCityRows: 0,
    rawHostRows: 0,
    normalizedHosts: 0,
    selectedHostId: null,
    swipeRows: 0,
    matchRows: 0,
    incomingRows: 0,
    supabaseError: "",
    lastHostQuery: null,
  },
  loading: {
    auth: false,
    session: true,
    role: false,
    cities: false,
    hosts: false,
    hostDetail: false,
    hostSpots: false,
    swipes: false,
    matches: false,
    incomingRequests: false,
    matchAction: false,
    messages: false,
    sendingMessage: false,
    profile: false,
  },
  errors: {
    cities: "",
    hosts: "",
    hostDetail: "",
    hostSpots: "",
    swipes: "",
    matches: "",
    incomingRequests: "",
    messages: "",
    profile: "",
    media: "",
  },
  fallbackMap: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
  hostDraft: { ...hostDraft },
  profileDraft: {},
};

window.LocalinkApp = {
  state,
  setScreen,
  selectCity,
  selectHost,
  logout,
};

state.debug.supabaseConfigured = Boolean(
  window.LOCALINK_CONFIG?.SUPABASE_URL && window.LOCALINK_CONFIG?.SUPABASE_ANON_KEY,
);
state.debug.selectedCityId = state.selectedCityId;

function getCity(cityId = state.selectedCityId) {
  return state.cities.find((city) => city.id === cityId) || state.cities[0];
}

function getCityHosts(cityId = state.selectedCityId) {
  const swipedHostIds = new Set([
    ...state.passedHostIds,
    ...state.swipes.map((swipe) => swipe.host_profile_id),
  ]);
  return (state.hostsByCity[cityId] || []).filter((host) => !swipedHostIds.has(host.id));
}

function getHost(hostId = state.selectedHostId) {
  return state.hostDetails[hostId] || getCityHosts().find((host) => host.id === hostId) || getCityHosts()[0] || null;
}

function setScreen(screen) {
  if (screen === "role") screen = "map";
  state.screen = screen;
  render();
  if (screen === "map") {
    loadCities();
  }
  if (screen === "locals") {
    loadHostsForCity(state.selectedCityId);
  }
  if (screen === "matches") {
    loadMatches();
  }
  if (screen === "requests") {
    if (state.profile?.local_enabled || state.profile?.role === "local_host") {
      loadIncomingRequests();
    }
  }
  if (screen === "chat") {
    loadMessages(state.activeChatMatchId);
  }
}

function profileNeedsOnboarding(profile) {
  return getProfileCompletion(profile, state.profileMedia).percent < 100;
}

function setAuthMode(mode) {
  state.authMode = mode;
  state.loginError = "";
  state.authMessage = "";
  render();
}

function selectCity(cityId) {
  state.selectedCityId = cityId;
  state.debug.selectedCityId = cityId;
  state.selectedHostId = null;
  render();
}

function selectHost(hostId) {
  state.selectedHostId = hostId;
  setScreen("hostDetail");
  loadHostDetail(hostId);
}

function getActiveChatMatch() {
  return state.matches.find((match) => match.id === state.activeChatMatchId) || null;
}

function render() {
  app.innerHTML = window.LocalinkComponents.statusBar() + window.LocalinkScreens.render(state, selectors());
  bindEvents();

  if (state.screen === "map") {
    window.LocalinkMap.init({
      cities: state.cities,
      selectedCity: getCity(),
      onSelectCity: selectCity,
    });
  }
}

function selectors() {
  const normalizedProfile = normalizeProfile(state.profile);
  const profileCompletion = getProfileCompletion(state.profile, state.profileMedia);
  return {
    currentUser,
    cities: state.cities,
    city: getCity(),
    role: normalizedProfile.localEnabled ? "local_host" : normalizedProfile.role || "traveler",
    hosts: getCityHosts(),
    host: getHost(),
    activeChatMatch: getActiveChatMatch(),
    matches: state.matches,
    incomingRequests: state.incomingRequests,
    profile: {
      ...normalizedProfile,
      profileComplete: profileCompletion.percent === 100,
    },
    profileDraft: state.profileDraft,
    profileMedia: state.profileMedia.map(normalizeMedia),
    profileCompletion,
    chatMessages: state.messagesByMatch[state.activeChatMatchId] || [],
    citySearchQuery: state.citySearchQuery,
    citySearchResults: state.citySearchResults,
    loadingCities: state.loading.cities,
    citiesError: state.errors.cities,
    loadingHosts: state.loading.hosts,
    hostsError: state.errors.hosts,
    loadingHostDetail: state.loading.hostDetail,
    hostError: state.errors.hostDetail,
    loadingHostSpots: state.loading.hostSpots,
    hostSpotsError: state.errors.hostSpots,
    loadingSwipes: state.loading.swipes,
    swipesError: state.errors.swipes,
    loadingMatches: state.loading.matches,
    matchesError: state.errors.matches,
    loadingIncomingRequests: state.loading.incomingRequests,
    incomingRequestsError: state.errors.incomingRequests,
    loadingMatchAction: state.loading.matchAction,
    loadingProfile: state.loading.profile,
    loadingMessages: state.loading.messages,
    sendingMessage: state.loading.sendingMessage,
    messagesError: state.errors.messages,
    profileError: state.errors.profile,
    mediaError: state.errors.media,
    debug: state.debug,
  };
}

async function initializeSession() {
  state.loading.session = true;
  render();

  try {
    const session = await window.LocalinkApi.getSession();
    const user = session?.user || null;
    state.authUser = user;
    state.debug.isAuthenticated = Boolean(user);
    state.debug.authUserId = user?.id || null;

    if (user) {
      await ensureProfile(user);
      await loadProfileMedia();
      await loadMySwipes();
      await loadMatches();
      state.screen = profileNeedsOnboarding(state.profile) ? "editProfile" : "map";
    }

    debugLog("auth session initialized", {
      authUserId: user?.id || null,
      profileId: state.profile?.id || null,
    });
  } catch (error) {
    state.loginError = error.message || "Could not initialize Supabase session.";
    state.debug.supabaseError = state.loginError;
  } finally {
    state.loading.session = false;
    render();
  }
}

async function handleAuthSubmit(form) {
  const formData = new FormData(form);
  const email = formData.get("email")?.trim() || "";
  const password = formData.get("password") || "";

  if (!email || !password) {
    state.loginError = "Please enter both email and password.";
    render();
    return;
  }

  if (state.authMode === "signup" && email.toLowerCase().endsWith("@example.com")) {
    state.loginError = "Supabase does not accept example.com test emails. Please sign up with a real email address.";
    render();
    return;
  }

  state.loading.auth = true;
  state.loginError = "";
  state.authMessage = "";
  render();

  try {
    const result =
      state.authMode === "signup"
        ? await window.LocalinkApi.signUp(email, password)
        : await window.LocalinkApi.signIn(email, password);

    const user = result.session?.user || result.user;
    if (!user) {
      state.authMessage = "Check your email to confirm your account, then log in.";
      return;
    }

    if (state.authMode === "signup" && !result.session) {
      state.authMessage = "Check your email to confirm your account, then log in.";
      state.authMode = "login";
      return;
    }

    state.authUser = user;
    state.debug.isAuthenticated = true;
    state.debug.authUserId = user.id;
    await ensureProfile(user);
    await loadProfileMedia();
    await loadMySwipes();
    await loadMatches();
    state.screen = state.isNewProfile || profileNeedsOnboarding(state.profile) ? "editProfile" : "map";
    debugLog("auth complete", {
      authUserId: user.id,
      profileId: state.profile?.id || null,
    });
  } catch (error) {
    state.loginError = error.message || "Authentication failed.";
    state.debug.supabaseError = state.loginError;
  } finally {
    state.loading.auth = false;
    render();
  }
}

async function ensureProfile(user, options = {}) {
  const existing = await window.LocalinkApi.getProfileByUserId(user.id);
  if (existing) {
    state.profile = existing;
    state.profileDraft = profileToDraft(existing);
    state.isNewProfile = false;
    state.debug.profileId = existing.id;
    return existing;
  }

  const created = await window.LocalinkApi.upsertProfile({
    id: user.id,
    email: user.email,
    name: options.name || user.user_metadata?.name || "Localink user",
    role: "traveler",
    avatarUrl: user.user_metadata?.avatar_url || null,
  });
  state.profile = created;
  state.profileDraft = profileToDraft(created);
  state.isNewProfile = true;
  state.debug.profileId = created.id;
  return created;
}

async function saveProfile(form) {
  state.loading.profile = true;
  state.errors.profile = "";
  render();

  try {
    const formData = new FormData(form);
    const profile = {
      name: formData.get("name")?.trim() || state.profile?.name || "Localink user",
      bio: formData.get("bio")?.trim() || "",
      interests: parseList(formData.get("interests")),
      languages: parseList(formData.get("languages")),
      homeCity: formData.get("homeCity")?.trim() || "",
      favoriteSpots: parseList(formData.get("favoriteSpots")),
      profilePhotoUrl: state.profileMedia[0]?.public_url || state.profileMedia[0]?.publicUrl || state.profile?.profile_photo_url || "",
      avatarUrl: state.profile?.avatar_url || "",
      job: formData.get("job")?.trim() || "",
      education: formData.get("education")?.trim() || "",
    };
    const completion = getProfileCompletion(profile, state.profileMedia);
    if (completion.percent < 100) {
      throw new Error(`Profile is ${completion.percent}% complete. Add: ${completion.missing.join(", ")}.`);
    }
    state.profile = await window.LocalinkApi.updateProfile(profile);
    state.profileDraft = profileToDraft(state.profile);
    await syncLocalProfileIfEnabled();
    state.isNewProfile = false;
    toast("Profile saved");
    setScreen("map");
  } catch (error) {
    state.errors.profile = error.message || "Could not save profile.";
    state.debug.supabaseError = state.errors.profile;
    render();
  } finally {
    state.loading.profile = false;
    render();
  }
}

async function loadProfileMedia() {
  if (!state.profile?.id) return;
  state.errors.media = "";
  try {
    state.profileMedia = await window.LocalinkApi.getProfileMedia(state.profile.id);
  } catch (error) {
    state.errors.media = error.message || "Could not load profile media.";
    state.debug.supabaseError = state.errors.media;
  }
}

async function uploadProfileMedia(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (state.profileMedia.length >= 9) {
    toast("You can add up to 9 photos");
    input.value = "";
    return;
  }

  state.loading.profile = true;
  state.errors.media = "";
  render();

  try {
    const category = state.profileMedia.length < 3 ? "self" : "favorite";
    await window.LocalinkApi.uploadProfileMedia(file, category, state.profileMedia.length);
    await loadProfileMedia();
    await syncPrimaryPhotoFromMedia();
    state.profileDraft = profileToDraft(state.profile);
    toast("Photo added");
  } catch (error) {
    state.errors.media = error.message || "Could not upload photo.";
    state.debug.supabaseError = state.errors.media;
  } finally {
    input.value = "";
    state.loading.profile = false;
    render();
  }
}

async function deleteProfileMedia(mediaId) {
  state.loading.profile = true;
  state.errors.media = "";
  render();

  try {
    await window.LocalinkApi.deleteProfileMedia(mediaId);
    await loadProfileMedia();
    await syncPrimaryPhotoFromMedia();
    toast("Photo removed");
  } catch (error) {
    state.errors.media = error.message || "Could not remove photo.";
    state.debug.supabaseError = state.errors.media;
  } finally {
    state.loading.profile = false;
    render();
  }
}

async function syncPrimaryPhotoFromMedia() {
  const primaryPhotoUrl = getPrimaryMediaUrl();
  const profile = normalizeProfile(state.profile);
  state.profile = await window.LocalinkApi.updateProfile({
    ...profile,
    profilePhotoUrl: primaryPhotoUrl,
    avatarUrl: primaryPhotoUrl,
  });
  state.profileDraft = profileToDraft(state.profile);
  await syncLocalProfileIfEnabled();
}

async function syncLocalProfileIfEnabled() {
  if (!isLocalEnabled(state.profile)) return;
  await window.LocalinkApi.upsertLocalProfileFromProfile(state.selectedCityId);
}

async function toggleLocalMode(enabled) {
  if (enabled && profileNeedsOnboarding(state.profile)) {
    toast("Complete your profile before becoming a Local");
    setScreen("editProfile");
    return;
  }

  state.loading.profile = true;
  state.errors.profile = "";
  render();

  try {
    state.profile = await window.LocalinkApi.updateLocalMode(enabled);
    state.profileDraft = profileToDraft(state.profile);
    if (enabled) {
      await window.LocalinkApi.upsertLocalProfileFromProfile(state.selectedCityId);
      if (state.screen === "requests") await loadIncomingRequests();
      toast("Local mode is on");
    } else {
      toast("Local mode is off");
    }
  } catch (error) {
    state.errors.profile = error.message || "Could not update Local mode.";
    state.debug.supabaseError = state.errors.profile;
  } finally {
    state.loading.profile = false;
    render();
  }
}

async function searchCities(query) {
  state.citySearchQuery = query;
  if (!query.trim()) {
    state.citySearchResults = [];
    render();
    return;
  }

  try {
    const rows = await window.LocalinkApi.searchCities(query);
    state.citySearchResults = mergeCities(rows);
  } catch (error) {
    state.citySearchResults = state.cities.filter((city) => {
      const haystack = `${city.name} ${city.country}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }
  render();
}

async function saveRole(role) {
  if (!state.authUser) {
    state.loginError = "Please log in before choosing a role.";
    setScreen("login");
    return;
  }

  state.loading.role = true;
  render();

  try {
    state.profile = await window.LocalinkApi.updateProfileRole(role);
    debugLog("role saved", {
      authUserId: state.authUser.id,
      profileId: state.profile?.id || null,
      role,
    });
    setScreen(role === "local_host" ? "requests" : "map");
  } catch (error) {
    state.loginError = error.message || "Could not save role.";
    state.debug.supabaseError = state.loginError;
    setScreen("role");
  } finally {
    state.loading.role = false;
    render();
  }
}

async function logout() {
  state.loading.auth = true;
  render();

  try {
    await window.LocalinkApi.signOut();
  } catch (error) {
    state.loginError = error.message || "Could not log out.";
  } finally {
    state.authUser = null;
    state.profile = null;
    state.profileDraft = {};
    state.profileMedia = [];
    state.isNewProfile = false;
    state.authMode = "login";
    state.matches = [];
    state.incomingRequests = [];
    state.messagesByMatch = {};
    state.swipes = [];
    state.passedHostIds = [];
    state.activeChatMatchId = null;
    state.debug.isAuthenticated = false;
    state.debug.authUserId = null;
    state.debug.profileId = null;
    state.debug.matchRows = 0;
    state.debug.incomingRows = 0;
    state.loading.auth = false;
    state.screen = "login";
    render();
  }
}

async function loadMessages(matchId) {
  if (!matchId || state.loading.messages) return;

  state.loading.messages = true;
  state.errors.messages = "";
  render();

  try {
    const rows = await window.LocalinkApi.getMessages(matchId);
    state.messagesByMatch[matchId] = rows.map(normalizeMessage);
    debugLog("messages fetched", { matchId, count: rows.length });
  } catch (error) {
    state.messagesByMatch[matchId] = [];
    state.errors.messages = error.message || "Could not load messages.";
    state.debug.supabaseError = state.errors.messages;
    debugLog("messages fetch failed", { matchId, error: state.errors.messages });
  } finally {
    state.loading.messages = false;
    render();
  }
}

async function sendChatMessage(form) {
  if (!state.activeChatMatchId) return;

  const input = form.querySelector("[name='body']");
  const body = input?.value?.trim() || "";
  if (!body) {
    state.errors.messages = "Message cannot be empty.";
    render();
    return;
  }

  state.loading.sendingMessage = true;
  state.errors.messages = "";
  render();

  try {
    const row = await window.LocalinkApi.sendMessage(state.activeChatMatchId, body);
    state.messagesByMatch[state.activeChatMatchId] = [
      ...(state.messagesByMatch[state.activeChatMatchId] || []),
      normalizeMessage(row),
    ];
    form.reset();
    debugLog("message sent", { matchId: state.activeChatMatchId });
  } catch (error) {
    state.errors.messages = error.message || "Could not send message.";
    state.debug.supabaseError = state.errors.messages;
    debugLog("message send failed", {
      matchId: state.activeChatMatchId,
      error: state.errors.messages,
    });
  } finally {
    state.loading.sendingMessage = false;
    render();
  }
}

async function loadMatches() {
  if (!state.authUser || state.loading.matches) return;

  state.loading.matches = true;
  state.errors.matches = "";
  render();

  try {
    const rows = await window.LocalinkApi.getMyMatches();
    state.matches = rows.map(normalizeMatch);
    state.debug.matchRows = rows.length;
    debugLog("matches fetched", { count: rows.length });
  } catch (error) {
    state.matches = [];
    state.errors.matches = error.message || "Could not load matches.";
    state.debug.supabaseError = state.errors.matches;
    debugLog("matches fetch failed", { error: state.errors.matches });
  } finally {
    state.loading.matches = false;
    render();
  }
}

async function loadIncomingRequests() {
  if (!state.authUser || state.loading.incomingRequests) return;

  state.loading.incomingRequests = true;
  state.errors.incomingRequests = "";
  render();

  try {
    const rows = await window.LocalinkApi.getIncomingMatchRequests();
    state.incomingRequests = rows.map(normalizeMatch);
    state.debug.incomingRows = rows.length;
    debugLog("incoming requests fetched", { count: rows.length });
  } catch (error) {
    state.incomingRequests = [];
    state.errors.incomingRequests = error.message || "Could not load incoming requests.";
    state.debug.supabaseError = state.errors.incomingRequests;
    debugLog("incoming requests fetch failed", { error: state.errors.incomingRequests });
  } finally {
    state.loading.incomingRequests = false;
    render();
  }
}

async function loadMySwipes() {
  if (!state.authUser || state.loading.swipes) return;

  state.loading.swipes = true;
  state.errors.swipes = "";

  try {
    const rows = await window.LocalinkApi.getMySwipes();
    state.swipes = rows;
    state.debug.swipeRows = rows.length;
    debugLog("swipes fetched", { count: rows.length });
  } catch (error) {
    state.errors.swipes = error.message || "Could not load your swipes.";
    state.debug.supabaseError = state.errors.swipes;
    debugLog("swipes fetch failed", { error: state.errors.swipes });
  } finally {
    state.loading.swipes = false;
  }
}

async function loadCities() {
  if (state.citiesLoaded || state.loading.cities) return;

  state.loading.cities = true;
  state.errors.cities = "";
  render();

  try {
    const authDebug = await window.LocalinkApi.getDebugContext();
    state.debug.isAuthenticated = authDebug.isAuthenticated;
    state.debug.authUserId = authDebug.userId;
    if (authDebug.error) {
      state.debug.supabaseError = authDebug.error.message || "Could not read Supabase session.";
    }
    const rows = await window.LocalinkApi.getCities();
    state.debug.rawCityRows = rows.length;
    state.cities = mergeCities(rows);
    state.citiesLoaded = true;
    if (!state.cities.some((city) => city.id === state.selectedCityId)) {
      state.selectedCityId = state.cities[0]?.id || state.selectedCityId;
    }
    debugLog("cities fetched", { count: rows.length });
  } catch (error) {
    state.errors.cities = error.message || "Could not load cities.";
    state.debug.supabaseError = state.errors.cities;
    debugLog("cities fetch failed", { error: state.errors.cities });
  } finally {
    state.loading.cities = false;
    render();
  }
}

async function loadHostsForCity(cityId) {
  if (state.hostsByCity[cityId] || state.loading.hosts) return;

  state.loading.hosts = true;
  state.errors.hosts = "";
  render();

  try {
    state.debug.selectedCityId = cityId;
    state.debug.selectedHostId = state.selectedHostId;
    const rows = await window.LocalinkApi.getHostsByCity(cityId, getCity(cityId));
    state.debug.lastHostQuery = window.LocalinkLastHostQueryDebug || null;
    state.debug.rawHostRows = rows.length;
    state.hostsByCity[cityId] = rows.map(normalizeHost);
    state.debug.normalizedHosts = state.hostsByCity[cityId].length;
    state.debug.supabaseError = "";
    console.log("[Localink debug] normalized hosts", state.hostsByCity[cityId]);
    debugLog("hosts fetched", {
      selectedCityId: cityId,
      count: rows.length,
    });
  } catch (error) {
    state.hostsByCity[cityId] = [];
    state.errors.hosts = error.message || "Could not load Locals.";
    state.debug.lastHostQuery = window.LocalinkLastHostQueryDebug || null;
    state.debug.rawHostRows = 0;
    state.debug.normalizedHosts = 0;
    state.debug.supabaseError = state.errors.hosts;
    debugLog("hosts fetch failed", {
      selectedCityId: cityId,
      error: state.errors.hosts,
    });
  } finally {
    state.loading.hosts = false;
    render();
  }
}

async function loadHostDetail(hostProfileId) {
  if (!hostProfileId || state.hostDetails[hostProfileId] || state.loading.hostDetail) return;

  state.loading.hostDetail = true;
  state.loading.hostSpots = true;
  state.errors.hostDetail = "";
  state.errors.hostSpots = "";
  render();

  try {
    const hostRow = await window.LocalinkApi.getHostById(hostProfileId);
    state.hostDetails[hostProfileId] = {
      ...normalizeHost(hostRow),
      spots: [],
    };
  } catch (error) {
    state.errors.hostDetail = error.message || "Could not load this Local.";
    debugLog("host detail fetch failed", {
      selectedHostId: hostProfileId,
      error: state.errors.hostDetail,
    });
  } finally {
    state.loading.hostDetail = false;
    render();
  }

  if (state.errors.hostDetail) {
    state.loading.hostSpots = false;
    render();
    return;
  }

  try {
    const spotRows = await window.LocalinkApi.getHostSpots(hostProfileId);
    state.hostSpots[hostProfileId] = spotRows.map(normalizeSpot);
    state.hostDetails[hostProfileId] = {
      ...state.hostDetails[hostProfileId],
      spots: state.hostSpots[hostProfileId],
    };
    debugLog("host detail fetched", {
      selectedHostId: hostProfileId,
      spots: spotRows.length,
    });
  } catch (error) {
    state.errors.hostSpots = error.message || "Could not load favorite spots.";
    debugLog("host spots fetch failed", {
      selectedHostId: hostProfileId,
      error: state.errors.hostSpots,
    });
  } finally {
    state.loading.hostSpots = false;
    render();
  }
}

async function createSwipeAction(hostProfileId, action) {
  const host = getHost(hostProfileId);
  if (!host) {
    toast("This Local is no longer available");
    return;
  }
  let navigated = false;

  state.loading.swipes = true;
  state.errors.swipes = "";
  state.errors.matches = "";
  render();

  try {
    const swipe = await window.LocalinkApi.createSwipe(host.id, action);
    let match = null;
    if (action === "like") {
      match = await window.LocalinkApi.createOrGetPendingMatch(host.id);
    }
    state.swipes = [
      swipe,
      ...state.swipes.filter((item) => item.host_profile_id !== host.id),
    ];
    state.debug.swipeRows = state.swipes.length;
    state.selectedHostId = null;
    state.activeChatMatchId = null;
    state.loading.swipes = false;
    debugLog("swipe created", {
      selectedCityId: state.selectedCityId,
      selectedHostId: host.id,
      action,
      matchId: match?.id || null,
      matchStatus: match?.status || null,
    });
    setScreen("locals");
    navigated = true;
    toast(action === "like" ? `Request sent to ${host.name}` : `Passed ${host.name}`);
  } catch (error) {
    if (error.code === "23505") {
      let match = null;
      if (action === "like") {
        try {
          match = await window.LocalinkApi.createOrGetPendingMatch(host.id);
        } catch (matchError) {
          state.errors.matches = matchError.message || "Could not create pending request.";
          state.debug.supabaseError = state.errors.matches;
        }
      }
      state.swipes = [
        {
          host_profile_id: host.id,
          action,
        },
        ...state.swipes.filter((item) => item.host_profile_id !== host.id),
      ];
      state.debug.swipeRows = state.swipes.length;
      state.selectedHostId = null;
      state.loading.swipes = false;
      setScreen("locals");
      navigated = true;
      toast(match ? "Request already exists" : "You already swiped this Local");
      return;
    }

    state.errors.swipes = error.message || "Could not save this swipe.";
    state.debug.supabaseError = state.errors.swipes;
    debugLog("swipe failed", {
      selectedHostId: host.id,
      action,
      error: state.errors.swipes,
    });
    toast(state.errors.swipes);
    render();
  } finally {
    state.loading.swipes = false;
    if (!navigated) render();
  }
}

async function updateMatchStatus(matchId, status) {
  state.loading.matchAction = true;
  state.errors.incomingRequests = "";
  render();

  try {
    const row = await window.LocalinkApi.updateMatchStatus(matchId, status);
    const normalized = normalizeMatch(row);
    state.incomingRequests = state.incomingRequests.filter((match) => match.id !== matchId);
    if (normalized.status === "accepted") {
      state.matches = [
        normalized,
        ...state.matches.filter((match) => match.id !== normalized.id),
      ];
    }
    state.debug.incomingRows = state.incomingRequests.length;
    state.debug.matchRows = state.matches.length;
    debugLog("match status updated", { matchId, status });
    toast(status === "accepted" ? "Request accepted" : "Request rejected");
  } catch (error) {
    state.errors.incomingRequests = error.message || "Could not update this request.";
    state.debug.supabaseError = state.errors.incomingRequests;
    debugLog("match status update failed", {
      matchId,
      status,
      error: state.errors.incomingRequests,
    });
    toast(state.errors.incomingRequests);
  } finally {
    state.loading.matchAction = false;
    render();
  }
}

function mergeCities(rows) {
  if (!rows.length) return fallbackCities;
  return rows.map((row, index) => {
    const fallback =
      fallbackCities.find((city) => city.name === row.name && city.country === row.country) ||
      fallbackCities[index % fallbackCities.length];

    if (fallback) {
      state.cityIdAliases[fallback.id] = row.id;
    }

    return {
      ...(fallback || {}),
      id: row.id,
      name: row.name,
      country: row.country,
      hostCount: fallback?.hostCount || 0,
      coordinates: [Number(row.longitude), Number(row.latitude)],
      image: row.image_url || fallback?.image,
      position: fallback?.position || { x: 50, y: 50 },
      date: fallback?.date || "Choose dates",
      travelers: fallback?.travelers || 1,
    };
  });
}

function normalizeHost(row) {
  const profile = row.profile || {};
  const favoriteSpots = profile.favorite_spots || [];
  const media = (profile.profile_media || profile.media || [])
    .map(normalizeMedia)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryMediaUrl = getPrimaryMediaUrl(media);
  return {
    id: row.id,
    cityId: row.city_id,
    name: profile.name || "Local",
    job: row.job_title || profile.job || "Local",
    verified: Boolean(row.verified || profile.verified),
    bio: row.host_bio || profile.bio || "Happy to share local places with travelers.",
    image: primaryMediaUrl || row.photo_url || profile.profile_photo_url || profile.avatar_url || "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
    media,
    tags: profile.interests?.length ? profile.interests : row.interests || [],
    languages: profile.languages?.length ? profile.languages : row.languages || [],
    favoriteSpots,
    homeCity: profile.home_city || "",
    spots: state.hostSpots[row.id] || favoriteSpots.map((name, index) => ({ id: `${row.id}-profile-${index}`, name, type: "Local category", image: "", description: "" })),
  };
}

function normalizeSpot(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type || "Favorite spot",
    image: row.image_url || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=300&q=80",
    description: row.description || "",
  };
}

function normalizeTraveler(profile = {}) {
  return {
    id: profile.id,
    name: profile.name || "Traveler",
    email: profile.email || "",
    bio: profile.bio || "Planning a trip and looking for local recommendations.",
    image: profile.profile_photo_url || profile.avatar_url || "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=600&q=80",
    languages: profile.languages || [],
    tags: profile.interests || [],
    favoriteSpots: profile.favorite_spots || [],
    homeCity: profile.home_city || "",
    verified: Boolean(profile.verified),
  };
}

function normalizeProfile(profile = {}) {
  profile = profile || {};
  return {
    id: profile.id,
    role: profile.role || "traveler",
    name: profile.name || "Localink user",
    email: profile.email || "",
    bio: profile.bio || "",
    interests: profile.interests || [],
    languages: profile.languages || [],
    homeCity: profile.home_city || profile.homeCity || "",
    favoriteSpots: profile.favorite_spots || profile.favoriteSpots || [],
    image: profile.profile_photo_url || profile.profilePhotoUrl || profile.avatar_url || profile.avatarUrl || "",
    profilePhotoUrl: profile.profile_photo_url || profile.profilePhotoUrl || profile.avatar_url || profile.avatarUrl || "",
    job: profile.job || "",
    education: profile.education || "",
    localEnabled: Boolean(profile.local_enabled || profile.localEnabled || profile.role === "local_host"),
    verified: Boolean(profile.verified),
  };
}

function profileToDraft(profile = {}) {
  const normalized = normalizeProfile(profile);
  return {
    name: normalized.name,
    bio: normalized.bio,
    interests: normalized.interests.join(", "),
    languages: normalized.languages.join(", "),
    homeCity: normalized.homeCity,
    favoriteSpots: normalized.favoriteSpots.join(", "),
    profilePhotoUrl: normalized.profilePhotoUrl,
    job: normalized.job,
    education: normalized.education,
  };
}

function normalizeMedia(row = {}) {
  return {
    id: row.id,
    profileId: row.profile_id,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    public_url: row.public_url,
    category: row.category || "self",
    sortOrder: row.sort_order || 0,
  };
}

function getPrimaryMediaUrl(media = state.profileMedia) {
  const first = media.map(normalizeMedia)[0];
  return first?.publicUrl || "";
}

function isLocalEnabled(profile = state.profile) {
  return normalizeProfile(profile).localEnabled;
}

function getProfileCompletion(profile = state.profile, media = state.profileMedia) {
  const normalized = normalizeProfile(profile);
  const mediaCount = media.length;
  const checks = [
    ["name", normalized.name && normalized.name !== "Localink user"],
    ["bio", normalized.bio],
    ["home area", normalized.homeCity],
    ["languages", normalized.languages.length],
    ["interest tags", normalized.interests.length],
    ["3 photos", mediaCount >= 3],
  ];
  const complete = checks.filter(([, value]) => Boolean(value)).length;
  return {
    percent: Math.round((complete / checks.length) * 100),
    complete,
    total: checks.length,
    mediaCount,
    missing: checks.filter(([, value]) => !value).map(([label]) => label),
  };
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMatch(row) {
  return {
    id: row.id,
    travelerId: row.traveler_id,
    hostProfileId: row.host_profile_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    traveler: normalizeTraveler(row.traveler),
    host: normalizeHost(row.host_profile || {}),
  };
}

function normalizeMessage(row) {
  return {
    id: row.id,
    matchId: row.match_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    from: row.sender_id === state.authUser?.id ? "me" : "other",
  };
}

function debugLog(message, details = {}) {
  const config = window.LOCALINK_CONFIG || {};
  const isLocal = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
  if (!config.DEBUG && !isLocal) return;

  const payload = {
    supabaseConfigured: Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY),
    isAuthenticated: state.debug.isAuthenticated,
    citiesFetched: state.citiesLoaded ? state.cities.length : 0,
    hostsFetchedForSelectedCity: state.hostsByCity[state.selectedCityId]?.length || 0,
    swipesFetched: state.swipes.length,
    matchesFetched: state.matches.length,
    incomingRequestsFetched: state.incomingRequests.length,
    selectedHostId: state.selectedHostId,
    ...details,
  };

  window.LocalinkDebugLogs = window.LocalinkDebugLogs || [];
  window.LocalinkDebugLogs.push({ message, ...payload });
  console.log(`[Localink debug] ${message}`, payload);
}

function bindEvents() {
  document.querySelectorAll("[data-screen]").forEach((node) => {
    node.addEventListener("click", () => setScreen(node.dataset.screen));
  });

  document.querySelectorAll("[data-action]").forEach((node) => {
    node.addEventListener("click", () => handleAction(node.dataset.action, node));
  });

  document.querySelectorAll("[data-host]:not([data-action])").forEach((node) => {
    node.addEventListener("click", () => selectHost(node.dataset.host));
  });

  document.querySelectorAll("[data-city]").forEach((node) => {
    node.addEventListener("click", () => selectCity(node.dataset.city));
  });

  document.querySelectorAll("[data-map-zoom]").forEach((node) => {
    node.addEventListener("click", () => {
      window.LocalinkMap.zoom(node.dataset.mapZoom === "in" ? 0.25 : -0.25, state);
    });
  });

  document.querySelectorAll("[data-city-result]").forEach((node) => {
    node.addEventListener("click", () => {
      selectCity(node.dataset.cityResult);
      state.citySearchQuery = "";
      state.citySearchResults = [];
      render();
    });
  });

  const citySearchInput = document.querySelector("[data-city-search]");
  if (citySearchInput) {
    citySearchInput.addEventListener("input", () => searchCities(citySearchInput.value));
  }

  const loginForm = document.querySelector("[data-login-form]");
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      handleAuthSubmit(loginForm);
    });
  }

  document.querySelectorAll("[data-auth-mode]").forEach((node) => {
    node.addEventListener("click", () => setAuthMode(node.dataset.authMode));
  });

  const hostForm = document.querySelector("[data-host-form]");
  if (hostForm) {
    hostForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(hostForm);
      Object.keys(state.hostDraft).forEach((key) => {
        state.hostDraft[key] = data.get(key) || state.hostDraft[key];
      });
      toast("Local preview saved");
      render();
    });
  }

  const profileForm = document.querySelector("[data-profile-form]");
  if (profileForm) {
    profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveProfile(profileForm);
    });
    profileForm.addEventListener("input", () => updateProfileCompletionPreview(profileForm));
  }

  const mediaInput = document.querySelector("[data-media-input]");
  if (mediaInput) {
    mediaInput.addEventListener("change", () => uploadProfileMedia(mediaInput));
  }

  const composer = document.querySelector("[data-chat-form]");
  if (composer) {
    composer.addEventListener("submit", (event) => {
      event.preventDefault();
      sendChatMessage(composer);
    });
  }
}

function updateProfileCompletionPreview(form) {
  const formData = new FormData(form);
  const draftProfile = {
    ...state.profile,
    name: formData.get("name")?.trim() || "",
    bio: formData.get("bio")?.trim() || "",
    home_city: formData.get("homeCity")?.trim() || "",
    interests: parseList(formData.get("interests")),
    languages: parseList(formData.get("languages")),
  };
  const completion = getProfileCompletion(draftProfile, state.profileMedia);
  const percentNode = document.querySelector("[data-completion-percent]");
  const missingNode = document.querySelector("[data-completion-missing]");
  const barNode = document.querySelector("[data-completion-bar]");
  if (percentNode) percentNode.textContent = completion.percent;
  if (missingNode) missingNode.textContent = completion.missing.length ? `Required: ${completion.missing.join(", ")}` : "Ready to explore.";
  if (barNode) barNode.style.width = `${completion.percent}%`;
}

async function handleAction(action, node) {
  if (action === "select-traveler") {
    saveRole("traveler");
    return;
  }
  if (action === "select-host") {
    toggleLocalMode(true);
    return;
  }
  if (action === "logout") {
    logout();
    return;
  }
  if (action === "back") {
    if (state.screen === "hostDetail") {
      setScreen("locals");
    } else if (state.screen === "editProfile") {
      setScreen("profile");
    } else {
      setScreen("map");
    }
    return;
  }
  if (action === "menu") {
    setScreen("profile");
    return;
  }
  if (action === "select-city") {
    selectCity(node.dataset.city);
    return;
  }
  if (action === "open-requests") {
    setScreen("requests");
    return;
  }
  if (action === "open-matches") {
    setScreen("matches");
    return;
  }
  if (action === "edit-profile") {
    state.profileDraft = profileToDraft(state.profile);
    setScreen("editProfile");
    return;
  }
  if (action === "toggle-local") {
    toggleLocalMode(node.dataset.enabled !== "true");
    return;
  }
  if (action === "delete-media") {
    deleteProfileMedia(node.dataset.media);
    return;
  }
  if (action === "settings") {
    toast("Filters will connect to search later");
    return;
  }
  if (action === "like") {
    await createSwipeAction(node.dataset.host, "like");
    return;
  }
  if (action === "pass") {
    await createSwipeAction(node.dataset.host, "pass");
    return;
  }
  if (action === "accept-match" || action === "reject-match") {
    await updateMatchStatus(node.dataset.match, action === "accept-match" ? "accepted" : "rejected");
    return;
  }
  if (action === "open-chat") {
    state.activeChatMatchId = node.dataset.match || state.activeChatMatchId || state.matches[0]?.id || null;
    setScreen("chat");
    return;
  }
  if (action === "report" || action === "block") {
    toast(action === "report" ? "Report action visible" : "Block action visible");
  }
}

function toast(message) {
  const oldToast = document.querySelector(".toast");
  if (oldToast) oldToast.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  app.append(node);
  window.setTimeout(() => node.remove(), 1700);
}

debugLog("startup");
initializeSession();
