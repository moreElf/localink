const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const jsFiles = [
  "api.js",
  "app.js",
  "components.js",
  "config.js",
  "data.js",
  "map.js",
  "screens.js",
  "supabaseClient.js",
  "scripts/check-travelbuddy-demo.js",
];

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, file)], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail(`${file} failed syntax check:\n${result.stderr || result.stdout}`);
  }
}

const forbidden = [
  ["api.js", /\.from\(\s*["']swipes["']\s*\)/],
  ["api.js", /\.from\(\s*["']matches["']\s*\)/],
  ["api.js", /\.from\(\s*["']messages["']\s*\)/],
  ["api.js", /createSwipe|createOrGetPendingMatch|getMyMatches|getIncomingMatchRequests|updateMatchStatus|\bsendMessage\b|\bgetMessages\b/],
  ["api.js", /signInWithPassword|auth\.signUp/],
  ["app.js", /createSwipe|createOrGetPendingMatch|getMyMatches|getIncomingMatchRequests|updateMatchStatus|\bsendMessage\b|\bgetMessages\b|signInWithPassword|auth\.signUp/],
  ["app.js", /LocalinkApi\.(signIn|signUp|uploadProfileMedia|updateProfile|updateLocalMode|upsertProfile|deleteProfileMedia)\s*\(/],
  ["screens.js", /data-action="(like|pass|open-chat|accept-match|reject-match|open-requests)"|data-chat-form|data-login-form|data-screen="chat"|type="password"/],
  ["components.js", /data-action="open-requests"|data-screen="chat"/],
];

for (const [file, pattern] of forbidden) {
  const source = read(file);
  if (pattern.test(source)) {
    fail(`${file} still contains disabled matching or direct-message behavior (${pattern})`);
  }
}

const required = [
  ["index.html", /TravelBuddy/],
  ["index.html", /受付開始前/],
  ["screens.js", /受付開始前/],
  ["screens.js", /デモを見る/],
  ["screens.js", /1対1のマッチングは無効/],
  ["screens.js", /投稿は受け付けていません/],
  ["api.js", /matchingEnabled:\s*false/],
  ["api.js", /directMessagesEnabled:\s*false/],
  ["data.js", /runClubs/],
  ["components.js", /data-screen="clubs"/],
  ["components.js", /data-screen="community"/],
];

for (const [file, pattern] of required) {
  if (!pattern.test(read(file))) {
    fail(`${file} is missing required TravelBuddy demo copy (${pattern})`);
  }
}

for (const file of [
  "supabase/migrations/002_create_swipes.sql",
  "supabase/migrations/003_create_matches.sql",
  "supabase/migrations/004_create_messages.sql",
]) {
  const source = read(file);
  if (!/create table/i.test(source)) {
    fail(`${file} was removed or emptied. Historical migrations must stay.`);
  }
}

const config = read("config.js");
if (!config.includes("SUPABASE_URL:") || !config.includes("SUPABASE_ANON_KEY:")) {
  fail("config.js no longer exposes the Supabase client settings.");
}

const windowStub = {
  LOCALINK_CONFIG: { SUPABASE_URL: "", SUPABASE_ANON_KEY: "", DEBUG: false },
  LocalinkMap: {
    fallbackMarker() {
      return "<button type=\"button\" data-city=\"demo\"></button>";
    },
    init() {},
    zoom() {},
  },
  addEventListener() {},
  setInterval() { return 0; },
  clearInterval() {},
  setTimeout() { return 0; },
};
windowStub.window = windowStub;
const documentStub = {
  querySelector() {
    return { innerHTML: "", append() {}, remove() {} };
  },
  querySelectorAll() {
    return [];
  },
  addEventListener() {},
};

const context = {
  window: windowStub,
  document: documentStub,
  console,
  setInterval: windowStub.setInterval,
  clearInterval: windowStub.clearInterval,
  setTimeout: windowStub.setTimeout,
};
context.globalThis = context;

const vm = require("vm");
for (const file of ["data.js", "components.js", "screens.js", "api.js"]) {
  vm.runInNewContext(read(file), context, { filename: file });
}

const api = context.window.LocalinkApi;
if (api.matchingEnabled !== false || api.directMessagesEnabled !== false) {
  fail("LocalinkApi flags do not disable matching and direct messages.");
}
for (const name of [
  "createSwipe",
  "getMySwipes",
  "createOrGetPendingMatch",
  "getMyMatches",
  "getIncomingMatchRequests",
  "updateMatchStatus",
  "getMessages",
  "sendMessage",
]) {
  if (typeof api[name] !== "undefined") {
    fail(`LocalinkApi.${name} is still defined.`);
  }
}

async function assertClosed(label, promise) {
  try {
    await promise;
    fail(`${label} resolved instead of refusing.`);
  } catch (error) {
    if (!String(error && error.message).includes("受付開始前")) {
      fail(`${label} refused without the pre-registration message.`);
    }
  }
}

async function main() {
  await assertClosed("signIn", api.signIn("person@example.com", "secret"));
  await assertClosed("signUp", api.signUp("person@example.com", "secret"));

  const screens = context.window.LocalinkScreens;
  const data = context.window.LocalinkData;
  const state = {
    screen: "welcome",
    citySearchQuery: "",
    citySearchResults: [],
    selectedCityId: data.cities[0].id,
  };
  const city = data.cities[0];
  const clubs = data.runClubs.filter((club) => club.cityName === city.name);
  const posts = data.communityPosts.filter((post) => post.cityName === city.name);
  const model = {
    currentUser: data.currentUser,
    cities: data.cities,
    city,
    clubs,
    club: clubs[0],
    posts,
    readOnlyProfileCount: 0,
    loadingCities: false,
    citiesError: "",
    loadingHosts: false,
    hostsError: "",
    debug: null,
  };

  const html = ["welcome", "map", "clubs", "clubDetail", "community", "profile"].map((screen) => {
    return screens.render({ ...state, screen }, model);
  }).join("\n");

  const banned = [
    'data-action="like"',
    'data-action="pass"',
    'data-action="open-chat"',
    'data-action="accept-match"',
    'data-action="reject-match"',
    "data-chat-form",
    "data-login-form",
    'type="password"',
    "It’s a match",
  ];
  for (const snippet of banned) {
    if (html.includes(snippet)) fail(`Rendered demo still includes ${snippet}`);
  }
  if (!html.includes("TravelBuddy") || !html.includes("受付開始前") || !html.includes("デモを見る")) {
    fail("Rendered demo is missing TravelBuddy pre-registration copy.");
  }
  if (!html.includes(clubs[0].name) || !html.includes("参加受付は開始前")) {
    fail("Rendered run club detail is missing the closed join action.");
  }
  if (html.includes("<textarea") || html.includes("data-profile-form")) {
    fail("Rendered demo still includes a composer or profile form.");
  }
  finish();
}

main().catch((error) => {
  fail(error.stack || error.message);
  finish();
});

function finish() {
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("TravelBuddy demo checks passed.");
  console.log("Syntax check: node --check on the static JavaScript files.");
  console.log("No project ESLint config or TypeScript compiler is present.");
}
