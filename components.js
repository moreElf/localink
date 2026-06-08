function localinkIcon(name) {
  const icons = {
    back: `<path d="m15 18-6-6 6-6" />`,
    menu: `<path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" />`,
    logout: `<path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" /><path d="m15 8 4 4-4 4" /><path d="M19 12H9" />`,
    settings: `<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.06a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 0 1 0-4h.06A1.7 1.7 0 0 0 4.6 8a1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 3.6 1.7 1.7 0 0 0 10 2.06V2a2 2 0 0 1 4 0v.06A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 0 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 8 1.7 1.7 0 0 0 21 9.94H21a2 2 0 0 1 0 4h-.06A1.7 1.7 0 0 0 19.4 15Z" />`,
    explore: `<circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.1 5-4.9 2 2.1-5 4.9-2Z" />`,
    chat: `<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-3.8-.88L3 20l1.1-4.7A8.3 8.3 0 1 1 21 11.5Z" />`,
    heart: `<path d="M20.5 8.7c0 5.3-8.5 10-8.5 10S3.5 14 3.5 8.7A4.5 4.5 0 0 1 12 6.5a4.5 4.5 0 0 1 8.5 2.2Z" />`,
    requests: `<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z" /><path d="M12 8v6" /><path d="M9 11h6" />`,
    profile: `<path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" />`,
    plus: `<path d="M12 5v14" /><path d="M5 12h14" />`,
    send: `<path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" />`,
    sparkle: `<path d="M12 3 9.6 9.6 3 12l6.6 2.4L12 21l2.4-6.6L21 12l-6.6-2.4L12 3Z" />`,
  };

  return `
    <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      ${icons[name] || icons.sparkle}
    </svg>
  `;
}

window.LocalinkComponents = {
  statusBar() {
    return `
      <div class="status-bar">
        <span>9:41</span>
        <span class="status-icons"><span class="signal"></span><span class="wifi"></span><span class="battery"></span></span>
      </div>
    `;
  },

  topRow({ title, subtitle = "", leftAction = "back", rightAction = "settings" }) {
    const actionButton = (action, side) => {
      if (!action) return `<span class="top-spacer" aria-hidden="true"></span>`;
      const icon = action === "back" ? "back" : action === "logout" ? "logout" : action === "menu" ? "menu" : "settings";
      return `
        <button class="icon-button flat" type="button" data-action="${action}" aria-label="${action}">
          ${localinkIcon(icon)}
        </button>
      `;
    };

    return `
      <div class="top-row">
        ${actionButton(leftAction, "left")}
        <div class="top-title">
          <h1>${title}</h1>
          ${subtitle ? `<p>${subtitle}</p>` : ""}
        </div>
        ${actionButton(rightAction, "right")}
      </div>
    `;
  },

  bottomNav(active, role = "traveler") {
    const localEnabled = role === "local_host";

    return `
      <nav class="bottom-nav" aria-label="Primary">
        <button class="${active === "map" ? "active" : ""}" type="button" data-screen="map">${localinkIcon("explore")}Explore</button>
        <button class="${active === "requests" ? "active" : ""} ${localEnabled ? "" : "locked"}" type="button" data-action="open-requests">${localinkIcon("requests")}Likes</button>
        <button class="${active === "chat" ? "active" : ""}" type="button" data-screen="chat">${localinkIcon("chat")}Chats</button>
        <button class="${active === "profile" ? "active" : ""}" type="button" data-screen="profile">${localinkIcon("profile")}Profile</button>
      </nav>
    `;
  },

  screen(content, { nav = "", className = "" } = {}) {
    return `<div class="screen ${className}">${content}${nav}</div>`;
  },

  emptyState({ title, body, actionLabel = "", actionScreen = "" }) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${localinkIcon("sparkle")}</div>
        <h2>${title}</h2>
        <p>${body}</p>
        ${actionLabel ? `<button class="full-button" type="button" data-screen="${actionScreen}">${actionLabel}</button>` : ""}
      </div>
    `;
  },

  errorState({ title, body }) {
    return `
      <div class="error-state">
        <strong>${title}</strong>
        <span>${body}</span>
      </div>
    `;
  },

  field(name, label, value, textarea = false, type = "text", placeholder = "") {
    return `
      <label class="field">
        <span>${label}</span>
        ${
          textarea
            ? `<textarea name="${name}" placeholder="${placeholder}">${value}</textarea>`
            : `<input name="${name}" type="${type}" value="${value}" placeholder="${placeholder}" />`
        }
      </label>
    `;
  },

  hostSummaryCard(host) {
    const title = `${host.name}${host.age ? `, ${host.age}` : ""}`;
    return `
      <article class="local-card" data-host-card="${host.id}">
        <img src="${host.image}" alt="${host.name}" />
        <div>
          <div class="local-card-title">
            <strong>${title}</strong>
            ${host.verified ? `<span>✓ Verified</span>` : `<span class="muted-badge">Verify soon</span>`}
          </div>
          <p>${host.job} ${host.homeCity ? `· ${host.homeCity}` : ""}<br />${host.bio}</p>
          <div class="tag-label">Interests</div>
          <div class="chip-row">${host.tags.slice(0, 3).map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
          ${host.favoriteSpots?.length ? `<div class="tag-label">Can show you</div><div class="chip-row local-tips">${host.favoriteSpots.slice(0, 3).map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>` : ""}
          <div class="chip-row subtle">${host.languages.slice(0, 3).map((lang) => `<span class="chip">${lang}</span>`).join("")}</div>
        </div>
        <button class="icon-button" type="button" data-host="${host.id}" aria-label="Open ${host.name}">›</button>
      </article>
    `;
  },

  hostHero(host) {
    return `
      <div class="profile-photo" style="background-image:url('${host.image}')">
        <span class="badge">${host.verified ? "✓ Verified" : "Verification pending"}</span>
        <div class="profile-copy">
          <h2>${host.name}${host.age ? `, ${host.age}` : ""}</h2>
          <p>${host.job}${host.homeCity ? ` · ${host.homeCity}` : ""}<br />${host.bio}</p>
          <div class="tag-label light">Interests</div>
          <div class="chip-row">${host.tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
          <div class="chip-row" style="margin-top:10px">${host.languages.map((lang) => `<span class="chip">${lang}</span>`).join("")}</div>
          ${host.favoriteSpots?.length ? `<div class="tag-label light">Can show you</div><div class="chip-row" style="margin-top:10px">${host.favoriteSpots.slice(0, 3).map((spot) => `<span class="chip">${spot}</span>`).join("")}</div>` : ""}
        </div>
      </div>
    `;
  },
};
