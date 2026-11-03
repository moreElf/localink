const app = document.querySelector("#app");
const { currentUser, cities: fallbackCities, runClubs = [], communityPosts = [] } = window.LocalinkData;

const state = {
  screen: "welcome",
  authUser: null,
  selectedCityId: "11111111-1111-4111-8111-111111111111",
  selectedClubId: null,
  cities: fallbackCities,
  citySearchQuery: "",
  citySearchResults: [],
  cityIdAliases: {},
  communityProfileCountByCity: {},
  debug: {
    supabaseConfigured: false,
    isAuthenticated: false,
    authUserId: null,
    selectedCityId: "",
    rawCityRows: 0,
    communityProfiles: null,
    supabaseError: "",
    lastHostQuery: null,
  },
  loading: {
    session: false,
    cities: false,
    hosts: false,
  },
  errors: {
    cities: "",
    hosts: "",
  },
  fallbackMap: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
};

window.LocalinkApp = {
  state,
  setScreen,
  selectCity,
  logout: closeDemo,
};

state.debug.supabaseConfigured = Boolean(
  window.LOCALINK_CONFIG?.SUPABASE_URL && window.LOCALINK_CONFIG?.SUPABASE_ANON_KEY,
);
state.debug.selectedCityId = state.selectedCityId;

function getCity(cityId = state.selectedCityId) {
  return state.cities.find((city) => city.id === cityId) || state.cities[0];
}

function getCityClubs(city = getCity()) {
  return runClubs.filter((club) => club.cityName === city?.name);
}

function getCommunityPosts(city = getCity()) {
  return communityPosts.filter((post) => post.cityName === city?.name);
}

function getClub(clubId = state.selectedClubId) {
  return runClubs.find((club) => club.id === clubId) || null;
}

function setScreen(screen) {
  const allowed = new Set(["welcome", "map", "clubs", "clubDetail", "community", "profile"]);
  if (!allowed.has(screen)) screen = "welcome";
  state.screen = screen;
  render();
  if (screen === "map") loadCities();
  if (screen === "clubs") loadCommunityProfileCount(state.selectedCityId);
}

function selectCity(cityId) {
  state.selectedCityId = cityId;
  state.debug.selectedCityId = cityId;
  state.selectedClubId = null;
  render();
}

function openClub(clubId) {
  if (!getClub(clubId)) return;
  state.selectedClubId = clubId;
  setScreen("clubDetail");
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
  const city = getCity();
  return {
    currentUser,
    cities: state.cities,
    city,
    clubs: getCityClubs(city),
    club: getClub(),
    posts: getCommunityPosts(city),
    readOnlyProfileCount: state.communityProfileCountByCity[state.selectedCityId],
    loadingCities: state.loading.cities,
    citiesError: state.errors.cities,
    loadingHosts: state.loading.hosts,
    hostsError: state.errors.hosts,
    debug: state.debug,
  };
}

async function initializeSession() {
  try {
    const session = await window.LocalinkApi.getSession();
    const user = session?.user || null;
    state.authUser = user;
    state.debug.isAuthenticated = Boolean(user);
    state.debug.authUserId = user?.id || null;
    debugLog("auth session read", { authUserId: user?.id || null });
  } catch (error) {
    state.debug.supabaseError = error.message || "Could not read Supabase session.";
    debugLog("auth session read failed", { error: state.debug.supabaseError });
  }

  if (state.screen === "welcome") render();
}

async function closeDemo() {
  try {
    if (state.authUser) await window.LocalinkApi.signOut();
  } catch (error) {
    state.debug.supabaseError = error.message || "Could not close the demo session.";
  } finally {
    state.authUser = null;
    state.debug.isAuthenticated = false;
    state.debug.authUserId = null;
    state.screen = "welcome";
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
      state.debug.selectedCityId = state.selectedCityId;
    }
    debugLog("cities fetched", { count: rows.length });
  } catch (error) {
    state.debug.supabaseError = error.message || "Could not load cities.";
    state.errors.cities = "デモ用の都市を表示しています。";
    debugLog("cities fetch failed", { error: state.errors.cities });
  } finally {
    state.loading.cities = false;
    render();
  }
}

async function loadCommunityProfileCount(cityId) {
  if (Object.prototype.hasOwnProperty.call(state.communityProfileCountByCity, cityId) || state.loading.hosts) return;

  state.loading.hosts = true;
  state.errors.hosts = "";
  render();

  try {
    const rows = await window.LocalinkApi.getHostsByCity(cityId, getCity(cityId));
    state.debug.lastHostQuery = window.LocalinkLastHostQueryDebug || null;
    state.communityProfileCountByCity[cityId] = rows.length;
    state.debug.communityProfiles = rows.length;
    state.debug.supabaseError = "";
    debugLog("community profiles counted", { selectedCityId: cityId, count: rows.length });
  } catch (error) {
    state.errors.hosts = error.message || "Could not count community profiles.";
    state.debug.lastHostQuery = window.LocalinkLastHostQueryDebug || null;
    state.debug.supabaseError = state.errors.hosts;
    debugLog("community profile count failed", {
      selectedCityId: cityId,
      error: state.errors.hosts,
    });
  } finally {
    state.loading.hosts = false;
    render();
  }
}

function mergeCities(rows) {
  if (!rows.length) return fallbackCities;
  return rows.map((row, index) => {
    const fallback =
      fallbackCities.find((city) => city.name === row.name && city.country === row.country) ||
      fallbackCities[index % fallbackCities.length];

    if (fallback) state.cityIdAliases[fallback.id] = row.id;

    return {
      ...(fallback || {}),
      id: row.id,
      name: row.name,
      country: row.country,
      hostCount: getCityClubs({ name: row.name }).length || fallback?.hostCount || 0,
      coordinates: [Number(row.longitude), Number(row.latitude)],
      image: row.image_url || fallback?.image,
      position: fallback?.position || { x: 50, y: 50 },
      date: fallback?.date || "デモ日程",
      travelers: fallback?.travelers || 1,
    };
  });
}

function debugLog(message, details = {}) {
  const config = window.LOCALINK_CONFIG || {};
  const isLocal = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
  if (!config.DEBUG && !isLocal) return;

  const payload = {
    supabaseConfigured: Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY),
    isAuthenticated: state.debug.isAuthenticated,
    matchingEnabled: window.LocalinkApi.matchingEnabled === true,
    directMessagesEnabled: window.LocalinkApi.directMessagesEnabled === true,
    citiesFetched: state.citiesLoaded ? state.cities.length : 0,
    selectedCityId: state.selectedCityId,
    ...details,
  };

  window.LocalinkDebugLogs = window.LocalinkDebugLogs || [];
  window.LocalinkDebugLogs.push({ message, ...payload });
  console.log(`[TravelBuddy debug] ${message}`, payload);
}

function bindEvents() {
  document.querySelectorAll("[data-screen]").forEach((node) => {
    node.addEventListener("click", () => setScreen(node.dataset.screen));
  });

  document.querySelectorAll("[data-action]").forEach((node) => {
    node.addEventListener("click", () => handleAction(node.dataset.action, node));
  });

  document.querySelectorAll("[data-club-card]").forEach((node) => {
    node.addEventListener("click", (event) => {
      if (event.target.closest("[data-action]")) return;
      openClub(node.dataset.clubCard);
    });
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
}

function handleAction(action, node) {
  if (action === "back") {
    if (state.screen === "clubDetail") setScreen("clubs");
    else if (state.screen === "clubs" || state.screen === "community") setScreen("map");
    else setScreen("map");
    return;
  }
  if (action === "select-city") {
    selectCity(node.dataset.city);
    return;
  }
  if (action === "open-club") {
    openClub(node.dataset.club);
    return;
  }
  if (action === "close-demo") {
    closeDemo();
  }
}

debugLog("startup", {
  matchingEnabled: false,
  directMessagesEnabled: false,
});
render();
initializeSession();
