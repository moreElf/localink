window.LocalinkScreens = (() => {
  const C = window.LocalinkComponents;
  const M = window.LocalinkMap;

  function render(state, data) {
    const screens = {
      login: () => login(state),
      role: () => map(state, data),
      map: () => map(state, data),
      locals: () => localList(data),
      hostDetail: () => hostDetail(data),
      match: () => match(data),
      matches: () => matches(data),
      requests: () => incomingRequests(data),
      chat: () => chat(data),
      profile: () => profile(data),
      editProfile: () => editProfile(data, state),
    };

    return (screens[state.screen] || screens.login)();
  }

  function login(state) {
    const isSignup = state.authMode === "signup";
    return C.screen(`
      <div class="screen-content login-screen">
        <div class="brand-heart"><span>L</span></div>
        <h1>${isSignup ? "Create your account" : "Log in to Localink"}</h1>
        <p>${state.loading.session ? "Checking your session…" : "Plan your trip with locals before you arrive."}</p>
        ${state.loginError ? C.errorState({ title: "Login needs attention", body: state.loginError }) : ""}
        ${state.authMessage ? `<div class="inline-status">${state.authMessage}</div>` : ""}
        <form class="login-form" data-login-form>
          ${C.field("email", "Email", "", false, "email", "you@yourmail.com")}
          ${C.field("password", "Password", "", false, "password", isSignup ? "Create a password" : "Enter your password")}
          <button class="full-button" type="submit" ${state.loading.auth || state.loading.session ? "disabled" : ""}>
            ${state.loading.auth ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
          </button>
        </form>
        <button class="outline-button teal" type="button" data-auth-mode="${isSignup ? "login" : "signup"}" ${state.loading.auth ? "disabled" : ""}>
          ${isSignup ? "I already have an account" : "Create account"}
        </button>
      </div>
    `);
  }

  function map(state, { cities, city, loadingCities, citiesError }) {
    return C.screen(`
      <div class="screen-content map-screen-content">
        ${C.topRow({ title: "Where are you going?", leftAction: null, rightAction: null })}
        ${loadingCities ? `<div class="inline-status">Loading cities from Supabase…</div>` : ""}
        ${citiesError ? C.errorState({ title: "Could not load cities", body: `${citiesError} Showing local prototype cities for now.` }) : ""}
        <label class="search-box city-search-box">
          <span>⌕</span>
          <input data-city-search value="${state.citySearchQuery || ""}" placeholder="Search cities" autocomplete="off" />
        </label>
        ${
          state.citySearchQuery
            ? `<div class="city-results">${
              state.citySearchResults.length
                ? state.citySearchResults.map((item) => `<button type="button" data-city-result="${item.id}"><img src="${item.image}" alt="" /><span><strong>${item.name}</strong><small>${item.country}</small></span></button>`).join("")
                : `<span>No cities found</span>`
            }</div>`
            : ""
        }
        <div class="map-area">
          <div id="map" class="real-map"></div>
          <div class="map-fallback" data-fallback-map>
            <div class="fallback-map-canvas" data-map-canvas>
              ${cities.map((item) => M.fallbackMarker(item, state.selectedCityId)).join("")}
            </div>
          </div>
          <div class="map-controls" aria-label="Map zoom controls">
            <button type="button" data-map-zoom="in" aria-label="Zoom in">+</button>
            <button type="button" data-map-zoom="out" aria-label="Zoom out">−</button>
          </div>
          <aside class="city-sheet">
            <div class="grabber"></div>
            <div class="city-sheet-main">
              <img class="city-image" src="${city.image}" alt="${city.name}" />
              <div>
                <h2>${city.name}, ${city.country}</h2>
                <p>${city.hostCount} locals</p>
                <div class="meta-line">
                  <span>▣ ${city.date}</span>
                  <span>♙ ${city.travelers} traveler</span>
                </div>
              </div>
            </div>
            <button class="full-button" type="button" data-screen="locals">Explore ${city.name} locals</button>
          </aside>
        </div>
      </div>
    `, { className: "map-screen", nav: C.bottomNav("map", (state.profile?.local_enabled || state.profile?.localEnabled) ? "local_host" : state.profile?.role) });
  }

  function localList({ city, role, hosts, loadingHosts, hostsError, swipesError, debug }) {
    const body = loadingHosts
      ? C.emptyState({
        title: "Loading locals",
        body: "Fetching Local profiles from Supabase.",
      })
      : hostsError
        ? C.errorState({
          title: "Could not load locals",
          body: hostsError,
        })
        : hosts.length
      ? `
        <div class="local-list">
          ${hosts.map(C.hostSummaryCard).join("")}
        </div>
      `
      : C.emptyState({
        title: `No locals in ${city.name} yet`,
        body: "No active Local profiles were found for this city.",
        actionLabel: "Back to map",
        actionScreen: "map",
      });

    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: `${city.name} locals`, subtitle: "Choose someone to learn more", leftAction: null, rightAction: null })}
        ${debugPanel(debug)}
        ${swipesError ? C.errorState({ title: "Could not load your swipes", body: swipesError }) : ""}
        ${body}
      </div>
    `, { nav: C.bottomNav("map", role) });
  }

  function hostDetail({ host, city, role, loadingHostDetail, hostError, loadingHostSpots, hostSpotsError, loadingSwipes, swipesError, matchesError, debug }) {
    if (loadingHostDetail) {
      return C.screen(`
        <div class="screen-content">
          ${C.topRow({ title: city.name, subtitle: "Loading Local", rightAction: null })}
          ${debugPanel(debug)}
          ${C.emptyState({ title: "Loading Local detail", body: "Fetching this profile and favorite categories from Supabase." })}
        </div>
      `, { nav: C.bottomNav("map", role) });
    }

    if (hostError) {
      return C.screen(`
        <div class="screen-content">
          ${C.topRow({ title: city.name, subtitle: "Local unavailable", rightAction: null })}
          ${debugPanel(debug)}
          ${C.errorState({ title: "Could not load Local", body: hostError })}
          <button class="full-button" type="button" data-screen="locals">Back to locals</button>
        </div>
      `, { nav: C.bottomNav("map", role) });
    }

    if (!host) {
      return C.screen(C.emptyState({
        title: "Local not found",
        body: "This Local may no longer be available.",
        actionLabel: "Back to locals",
        actionScreen: "locals",
      }));
    }

    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: city.name, subtitle: `${city.hostCount} locals`, rightAction: null })}
        ${debugPanel(debug)}
        ${swipesError ? C.errorState({ title: "Could not save swipe", body: swipesError }) : ""}
        ${matchesError ? C.errorState({ title: "Could not create request", body: matchesError }) : ""}
        ${C.hostHero(host)}
        <section class="favorite-spots">
          <div class="list-title"><span>Local categories</span><button type="button">See all</button></div>
          ${
            loadingHostSpots
              ? C.emptyState({ title: "Loading Local categories", body: "Fetching this Local’s traveler tips from Supabase." })
              : hostSpotsError
                ? C.errorState({ title: "Could not load Local categories", body: hostSpotsError })
                : host.spots.length
                  ? host.spots.map(spotItem).join("")
                  : C.emptyState({ title: "No Local categories yet", body: "This Local has not added traveler tips." })
          }
        </section>
        <div class="swipe-actions">
          <div><button class="round-action" type="button" data-action="pass" data-host="${host.id}" ${loadingSwipes ? "disabled" : ""}>×</button><span class="action-label">Pass</span></div>
          <div><button class="round-action" type="button" data-action="settings">i</button><span class="action-label">Info</span></div>
          <div><button class="round-action like" type="button" data-action="like" data-host="${host.id}" ${loadingSwipes ? "disabled" : ""}>♥</button><span class="action-label like">${loadingSwipes ? "Saving" : "Like"}</span></div>
        </div>
      </div>
    `, { nav: C.bottomNav("map", role) });
  }

  function match({ host, currentUser }) {
    if (!host) {
      return C.screen(C.emptyState({
        title: "No match selected",
        body: "Choose a Local before opening the match screen.",
        actionLabel: "Explore locals",
        actionScreen: "locals",
      }));
    }

    return C.screen(`
      <div class="screen-content match-screen">
        <div class="confetti">⌁ ·⌁·</div>
        <h1>It’s a match!</h1>
        <p>You and ${host.name} liked each other.</p>
        <div class="match-faces">
          <img class="match-face" src="${currentUser.photo}" alt="${currentUser.name}" />
          <img class="match-face" src="${host.image}" alt="${host.name}" />
          <span class="heart-center">♥</span>
        </div>
        <div class="match-benefits">
          <div class="benefit"><span class="benefit-icon">…</span><span><strong>Start a conversation</strong><span>Get to know each other before your trip.</span></span></div>
          <div class="benefit"><span class="benefit-icon">⌖</span><span><strong>Ask for recommendations</strong><span>Discover local spots and hidden gems.</span></span></div>
          <div class="benefit"><span class="benefit-icon">✓</span><span><strong>Meet safely</strong><span>Keep safety in mind and have an amazing time.</span></span></div>
        </div>
        <button class="full-button coral" type="button" data-action="open-chat" data-host="${host.id}">Send a message</button>
        <button class="outline-button" type="button" data-screen="locals">Maybe later</button>
      </div>
    `);
  }

  function matches({ matches, role, loadingMatches, matchesError }) {
    const content = loadingMatches
      ? C.emptyState({
        title: "Loading matches",
        body: "Fetching accepted matches from Supabase.",
      })
      : matchesError
        ? C.errorState({
          title: "Could not load matches",
          body: matchesError,
        })
        : matches.length
      ? `<div class="local-list">${matches.map((item) => matchCard(item, role)).join("")}</div>`
      : C.emptyState({
        title: "No matches yet",
        body: role === "local_host" ? "Accepted traveler requests will appear here." : "When a Local accepts your request, the match will appear here.",
        actionLabel: role === "local_host" ? "View requests" : "Explore locals",
        actionScreen: role === "local_host" ? "requests" : "locals",
      });

    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: "Matches", subtitle: "Accepted connections", leftAction: null, rightAction: null })}
        ${content}
      </div>
    `, { nav: C.bottomNav("matches", role) });
  }

  function incomingRequests({ incomingRequests, role, profile, loadingIncomingRequests, incomingRequestsError, loadingMatchAction }) {
    if (!profile.localEnabled) {
      const profileReady = profile.profileComplete === true;
      return C.screen(`
        <div class="screen-content">
          ${C.topRow({ title: "Likes", subtitle: "For Locals", leftAction: null, rightAction: null })}
          <div class="empty-state">
            <div class="empty-icon">${localinkIcon("sparkle")}</div>
            <h2>Unlock Likes as a Local</h2>
            <p>${profileReady ? "Turn on Local mode to receive traveler likes here." : "Complete your profile before becoming a Local."}</p>
            <button class="full-button" type="button" ${profileReady ? `data-action="toggle-local" data-enabled="false"` : `data-action="edit-profile"`}>
              ${profileReady ? "Become a Local" : "Complete profile first"}
            </button>
          </div>
        </div>
      `, { nav: C.bottomNav("requests", role) });
    }

    const content = loadingIncomingRequests
      ? C.emptyState({
        title: "Loading likes",
        body: "Fetching pending traveler likes from Supabase.",
      })
      : incomingRequestsError
        ? C.errorState({
          title: "Could not load likes",
          body: incomingRequestsError,
        })
        : incomingRequests.length
      ? `<div class="local-list">${incomingRequests.map((item) => requestCard(item, loadingMatchAction)).join("")}</div>`
      : C.emptyState({
        title: "No likes yet",
        body: "Traveler likes will appear here for you to accept or reject.",
        actionLabel: "Explore",
        actionScreen: "map",
      });

    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: "Likes", subtitle: "Review traveler likes", leftAction: null, rightAction: null })}
        ${content}
      </div>
    `, { nav: C.bottomNav("requests", role) });
  }

  function chat({ activeChatMatch, chatMessages, role, loadingMessages, sendingMessage, messagesError }) {
    if (!activeChatMatch) {
      return C.screen(`
        <div class="screen-content">
          ${C.topRow({ title: "Chats", subtitle: "Matched conversations", leftAction: null, rightAction: null })}
          <div class="chat-tabs"><button class="active" type="button">Traveling</button><button type="button">As Local</button></div>
          ${C.emptyState({
            title: "Choose a match",
            body: "Open chat from an accepted match to start a conversation. Traveling and As Local tabs are coming next.",
            actionLabel: "View matches",
            actionScreen: "matches",
          })}
        </div>
      `, { nav: C.bottomNav("chat", role) });
    }

    const person = role === "local_host" ? activeChatMatch.traveler : activeChatMatch.host;

    return C.screen(`
      <div class="screen-content">
        <header class="chat-header">
          <button class="icon-button flat" type="button" data-screen="matches" aria-label="Back to matches">${localinkIcon("back")}</button>
          <img class="chat-avatar" src="${person.image}" alt="${person.name}" />
          <div><strong>${person.name}</strong><br /><span class="chat-time">Accepted match</span></div>
        </header>
        <div class="chat-tabs"><button class="active" type="button">Traveling</button><button type="button">As Local</button></div>
        <div class="safe-strip"><span>✓ Meet safely and be respectful.</span><strong>Learn more</strong></div>
        ${messagesError ? C.errorState({ title: "Could not load chat", body: messagesError }) : ""}
        <div class="chat-messages">
          ${
            loadingMessages
              ? `<div class="inline-status">Loading messages…</div>`
              : chatMessages.length
                ? chatMessages.map((message) => chatBubble(message, person)).join("")
                : C.emptyState({ title: "No messages yet", body: `Say hello to ${person.name}.` })
          }
        </div>
      </div>
      <form class="chat-composer" data-chat-form>
        <button class="composer-button" type="button" aria-label="Add attachment">${localinkIcon("plus")}</button>
        <input aria-label="Message" name="body" placeholder="Type a message..." ${sendingMessage ? "disabled" : ""} />
        <button class="composer-button" type="submit" aria-label="Send message" ${sendingMessage ? "disabled" : ""}>${localinkIcon("send")}</button>
      </form>
      <div class="safety-actions">
        <button type="button" data-action="report">⚑ Report</button>
        <button type="button" data-action="block">⊘ Block</button>
      </div>
    `);
  }

  function profile({ profile, role, profileError, mediaError, profileMedia, profileCompletion }) {
    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: "Profile", subtitle: "Trust and matching context", leftAction: null, rightAction: null })}
        ${profileError ? C.errorState({ title: "Profile needs attention", body: profileError }) : ""}
        ${mediaError ? C.errorState({ title: "Media needs attention", body: mediaError }) : ""}
        <section class="completion-card">
          <div><strong>${profileCompletion.percent}% complete</strong><span>${profileCompletion.missing.length ? `Add ${profileCompletion.missing.join(", ")}` : "Your profile is ready."}</span></div>
          <div class="completion-track"><span style="width:${profileCompletion.percent}%"></span></div>
        </section>
        <article class="host-preview-card">
          <img src="${profileMedia[0]?.publicUrl || profile.image || "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=80"}" alt="${profile.name}" />
          <div class="host-preview-body">
            <span class="badge" style="position:static">${profile.verified ? "✓ Verified" : "Verification pending"}</span>
            <h2>${profile.name}</h2>
            <p>${profile.bio || "Add a short bio so people understand your travel style."}</p>
            <div class="tag-label">Interests</div>
            <div class="chip-row">${profile.interests.slice(0, 4).map((item) => `<span class="chip">${item}</span>`).join("")}</div>
            <div class="chip-row subtle">${profile.languages.slice(0, 4).map((item) => `<span class="chip">${item}</span>`).join("")}</div>
          </div>
        </article>
        <section class="local-mode-card">
          <div>
            <strong>Become a Local</strong>
            <span>${profile.localEnabled ? "Likes are unlocked." : "Receive traveler likes."}</span>
          </div>
          <button class="toggle-button ${profile.localEnabled ? "on" : ""}" type="button" data-action="toggle-local" data-enabled="${profile.localEnabled}" aria-label="Toggle Local mode"><span></span></button>
        </section>
        <button class="full-button" type="button" data-action="edit-profile">Edit profile</button>
        <button class="outline-button teal" type="button" data-action="logout">Log out</button>
      </div>
    `, { nav: C.bottomNav("profile", role) });
  }

  function editProfile({ profileDraft, role, loadingProfile, profileError, mediaError, profileMedia, profileCompletion }, state) {
    const draft = profileDraft || {};
    const isOnboarding = state.isNewProfile || profileCompletion.percent < 100;
    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: isOnboarding ? "Complete profile" : "Edit profile", subtitle: "Help matches feel safer", leftAction: "back", rightAction: null })}
        ${profileError ? C.errorState({ title: "Could not save profile", body: profileError }) : ""}
        ${mediaError ? C.errorState({ title: "Could not update media", body: mediaError }) : ""}
        <section class="completion-card">
          <div><strong><span data-completion-percent>${profileCompletion.percent}</span>% complete</strong><span data-completion-missing>${profileCompletion.missing.length ? `Required: ${profileCompletion.missing.join(", ")}` : "Ready to explore."}</span></div>
          <div class="completion-track"><span data-completion-bar style="width:${profileCompletion.percent}%"></span></div>
        </section>
        <section class="media-section">
          <div class="list-title"><span>Media</span><small>${profileMedia.length}/9 photos</small></div>
          <div class="media-grid">
            ${profileMedia.map((item) => `
              <div class="media-tile">
                <img src="${item.publicUrl}" alt="Profile media" />
                <button type="button" data-action="delete-media" data-media="${item.id}" aria-label="Remove photo">×</button>
              </div>
            `).join("")}
            ${profileMedia.length < 9 ? `
              <label class="media-add">
                <span>+</span>
                <small>Add photo</small>
                <input data-media-input type="file" accept="image/*" ${loadingProfile ? "disabled" : ""} />
              </label>
            ` : ""}
          </div>
          <p class="helper-text">Add at least 3 photos. You can add up to 9 total.</p>
        </section>
        <form class="host-form" data-profile-form>
          ${C.field("name", "Name", draft.name || "")}
          ${C.field("bio", "Bio", draft.bio || "", true)}
          ${C.field("interests", "Interests", draft.interests || "", false, "text", "Photography, music, food")}
          ${C.field("languages", "Languages", draft.languages || "")}
          ${C.field("homeCity", "Home area / city", draft.homeCity || "")}
          ${C.field("job", "Job (optional)", draft.job || "")}
          ${C.field("education", "Education (optional)", draft.education || "")}
          ${C.field("favoriteSpots", "Local categories", draft.favoriteSpots || "", true, "text", "Cafes, nightlife, art walks")}
          <p class="helper-text">Interests are about you. Local categories are what you can show travelers.</p>
          <div class="verification-note"><span>✓</span><strong>Verification badge placeholder</strong><p>ID verification is not connected yet, but the badge space is ready.</p></div>
          <button class="full-button" type="submit" ${loadingProfile ? "disabled" : ""}>${loadingProfile ? "Saving…" : "Save profile"}</button>
        </form>
      </div>
    `, { nav: C.bottomNav("profile", role) });
  }

  function hostSetupProfile(state) {
    const draft = state.hostDraft;
    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: "Local profile", subtitle: "Create what travelers will see", rightAction: null })}
        <form class="host-form" data-host-form>
          ${C.field("name", "Name", draft.name)}
          ${C.field("city", "City", draft.city)}
          ${C.field("languages", "Languages", draft.languages)}
          ${C.field("interests", "Interests", draft.interests)}
          ${C.field("availability", "Availability", draft.availability)}
          ${C.field("photo", "Photo URL", draft.photo)}
          ${C.field("bio", "Short bio", draft.bio, true)}
          <button class="full-button" type="submit">Save preview</button>
        </form>
        <article class="host-preview-card">
          <img src="${draft.photo}" alt="${draft.name}" />
          <div class="host-preview-body">
            <span class="badge" style="position:static">✓ Verified</span>
            <h2>${draft.name}</h2>
            <p>${draft.bio}</p>
            <div class="chip-row"><span class="chip">${draft.city}</span><span class="chip">${draft.languages}</span></div>
          </div>
        </article>
      </div>
    `, { nav: C.bottomNav("profile", state.profile?.role) });
  }

  function requestCard(match, loadingMatchAction) {
    return `
      <article class="request-card">
        <img src="${match.traveler.image}" alt="${match.traveler.name}" />
        <div class="request-body">
          <div class="local-card-title">
            <strong>${match.traveler.name}</strong>
            <span>${match.traveler.verified ? "✓ Verified" : "Verify soon"}</span>
          </div>
          <p>${match.traveler.bio}</p>
          <div class="chip-row">
            ${match.traveler.tags.slice(0, 3).map((tag) => `<span class="chip">${tag}</span>`).join("")}
            ${match.traveler.languages.slice(0, 3).map((lang) => `<span class="chip">${lang}</span>`).join("")}
          </div>
          ${match.traveler.favoriteSpots.length ? `<p>Favorite places: ${match.traveler.favoriteSpots.slice(0, 3).join(", ")}</p>` : ""}
          <div class="request-actions">
            <button class="outline-button compact" type="button" data-action="reject-match" data-match="${match.id}" ${loadingMatchAction ? "disabled" : ""}>Reject</button>
            <button class="full-button compact" type="button" data-action="accept-match" data-match="${match.id}" ${loadingMatchAction ? "disabled" : ""}>Accept</button>
          </div>
        </div>
      </article>
    `;
  }

  function matchCard(match, role) {
    const person = role === "local_host" ? match.traveler : match.host;
    const subtitle = role === "local_host" ? "Traveler" : `${match.host.job} · ${match.host.cityId ? "Local" : "Local"}`;
    const tags = role === "local_host" ? match.traveler.languages : match.host.tags;
    return `
      <article class="local-card match-card">
        <img src="${person.image}" alt="${person.name}" />
        <div>
          <div class="local-card-title">
            <strong>${person.name}</strong>
            <span>${person.verified ? "✓ Verified" : "Verify soon"}</span>
          </div>
          <p>${subtitle}<br />${person.bio || ""}</p>
          <div class="chip-row">${(tags || []).slice(0, 3).map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
          ${person.favoriteSpots?.length ? `<div class="chip-row subtle">${person.favoriteSpots.slice(0, 2).map((spot) => `<span class="chip">${spot}</span>`).join("")}</div>` : ""}
        </div>
        <button class="outline-button compact open-chat-button" type="button" data-action="open-chat" data-match="${match.id}">Open chat</button>
      </article>
    `;
  }

  function spotItem(spot) {
    return `
      <div class="spot-item">
        <img src="${spot.image}" alt="${spot.name}" />
        <div><strong>${spot.name}</strong><span>${spot.type}</span></div>
        <span class="heart-mini">♡</span>
      </div>
    `;
  }

  function chatBubble(message, host) {
    return `
      <div class="bubble-row ${message.from === "me" ? "me" : ""}">
        ${message.from !== "me" ? `<img class="chat-avatar" src="${host.image}" alt="" />` : ""}
        <div class="bubble ${message.from === "me" ? "me" : ""}">${message.body}</div>
      </div>
    `;
  }

  function debugPanel(debug) {
    if (!window.LOCALINK_CONFIG?.DEBUG || !debug) return "";
    const lastQuery = debug.lastHostQuery || {};
    const error = debug.supabaseError || lastQuery.initialError?.message || lastQuery.fallbackError?.message || "";
    return `
      <details class="debug-panel" open>
        <summary>Supabase Local debug</summary>
        <dl>
          <div><dt>Configured</dt><dd>${debug.supabaseConfigured ? "yes" : "no"}</dd></div>
          <div><dt>Authenticated</dt><dd>${debug.isAuthenticated ? "yes" : "no"}</dd></div>
          <div><dt>Selected city id</dt><dd>${debug.selectedCityId || "none"}</dd></div>
          <div><dt>Fallback city id</dt><dd>${lastQuery.fallbackCityId || "none"}</dd></div>
          <div><dt>Raw rows</dt><dd>${debug.rawHostRows}</dd></div>
          <div><dt>Normalized hosts</dt><dd>${debug.normalizedHosts}</dd></div>
          <div><dt>Swipe rows</dt><dd>${debug.swipeRows || 0}</dd></div>
          <div><dt>Selected host id</dt><dd>${debug.selectedHostId || "none"}</dd></div>
          <div><dt>Error</dt><dd>${error || "none"}</dd></div>
        </dl>
      </details>
    `;
  }

  return { render };
})();
