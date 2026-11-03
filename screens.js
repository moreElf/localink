window.LocalinkScreens = (() => {
  const C = window.LocalinkComponents;
  const M = window.LocalinkMap;

  function render(state, data) {
    const screens = {
      welcome: () => welcome(),
      map: () => map(state, data),
      clubs: () => clubs(data),
      clubDetail: () => clubDetail(data),
      community: () => community(data),
      profile: () => profile(data),
    };

    return (screens[state.screen] || screens.welcome)();
  }

  function welcome() {
    return C.screen(`
      <div class="screen-content login-screen">
        <div class="brand-mark" aria-hidden="true"><span>T</span></div>
        <div class="status-pill">受付開始前</div>
        <h1>TravelBuddy</h1>
        <p>旅先のランクラブとコミュニティを下見するデモです。受付はまだ始まっていません。</p>
        <button class="full-button" type="button" data-screen="map">デモを見る</button>
        <p class="welcome-note">アカウント作成、決済、投稿、1対1のメッセージはこのデモでは行えません。</p>
      </div>
    `);
  }

  function map(state, { cities, city, clubs, loadingCities, citiesError }) {
    const clubCount = clubs.length;
    return C.screen(`
      <div class="screen-content map-screen-content">
        ${C.topRow({ title: "どこへ行く？", subtitle: "ランクラブから旅を始める", leftAction: null, rightAction: null })}
        <div class="demo-banner"><strong>TravelBuddy デモ</strong>都市と地図は閲覧できます。参加受付は開始前です。</div>
        ${loadingCities ? `<div class="inline-status">都市を読み込んでいます…</div>` : ""}
        ${citiesError ? `<div class="inline-status">${citiesError}</div>` : ""}
        <label class="search-box city-search-box">
          <span>⌕</span>
          <input data-city-search value="${state.citySearchQuery || ""}" placeholder="都市を検索" autocomplete="off" />
        </label>
        ${
          state.citySearchQuery
            ? `<div class="city-results">${
              state.citySearchResults.length
                ? state.citySearchResults.map((item) => `<button type="button" data-city-result="${item.id}"><img src="${item.image}" alt="" /><span><strong>${item.name}</strong><small>${item.country}</small></span></button>`).join("")
                : `<span>該当する都市がありません</span>`
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
          <div class="map-controls" aria-label="地図のズーム">
            <button type="button" data-map-zoom="in" aria-label="拡大">+</button>
            <button type="button" data-map-zoom="out" aria-label="縮小">−</button>
          </div>
          <aside class="city-sheet">
            <div class="grabber"></div>
            <div class="city-sheet-main">
              <img class="city-image" src="${city.image}" alt="${city.name}" />
              <div>
                <h2>${city.name}, ${city.country}</h2>
                <p>${clubCount} のランクラブ</p>
                <div class="meta-line">
                  <span>デモ日程 ${city.date}</span>
                  <span>コミュニティ起点</span>
                </div>
              </div>
            </div>
            <button class="full-button" type="button" data-screen="clubs">${city.name} のランクラブを見る</button>
          </aside>
        </div>
      </div>
    `, { className: "map-screen", nav: C.bottomNav("map") });
  }

  function clubs({ city, clubs, loadingHosts, hostsError, readOnlyProfileCount, debug }) {
    const body = clubs.length
      ? `<div class="local-list">${clubs.map(C.clubCard).join("")}</div>`
      : C.emptyState({
        title: `${city.name} のデモクラブはまだありません`,
        body: "別の都市を選ぶと、用意されたランクラブを見られます。",
        actionLabel: "地図へ戻る",
        actionScreen: "map",
      });

    const profileNote = Number.isInteger(readOnlyProfileCount)
      ? `<p class="helper-text">公開コミュニティプロフィール ${readOnlyProfileCount} 件（閲覧のみ。1対1の連絡は無効）</p>`
      : loadingHosts
        ? `<p class="helper-text">コミュニティプロフィールの件数を確認しています…</p>`
        : hostsError
          ? `<p class="helper-text">件数は取得できませんでした。ランクラブのデモ一覧は表示しています。</p>`
          : "";

    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: `${city.name} のランクラブ`, subtitle: "コミュニティの集まり", leftAction: "back", rightAction: null })}
        <div class="demo-banner"><strong>1対1のマッチングは無効</strong>スワイプ、マッチ、個別メッセージはありません。</div>
        ${debugPanel(debug)}
        ${profileNote}
        ${body}
        <button class="outline-button teal" type="button" data-screen="community">この街のコミュニティを見る</button>
      </div>
    `, { nav: C.bottomNav("clubs") });
  }

  function clubDetail({ club, city }) {
    if (!club) {
      return C.screen(`
        <div class="screen-content">
          ${C.topRow({ title: city.name, subtitle: "ランクラブ", leftAction: "back", rightAction: null })}
          ${C.emptyState({
            title: "クラブが見つかりません",
            body: "一覧から別のランクラブを選んでください。",
            actionLabel: "クラブ一覧へ",
            actionScreen: "clubs",
          })}
        </div>
      `, { nav: C.bottomNav("clubs") });
    }

    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: city.name, subtitle: "ランクラブ", leftAction: "back", rightAction: null })}
        <div class="profile-photo club-hero" style="background-image:url('${club.image}')">
          <span class="badge">${club.level}</span>
          <div class="profile-copy">
            <h2>${club.name}</h2>
            <p>${club.summary}</p>
            <div class="chip-row">${club.tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
          </div>
        </div>
        <div class="club-facts">
          <div><span>ペース</span><strong>${club.pace}</strong></div>
          <div><span>距離</span><strong>${club.distance}</strong></div>
          <div><span>集合</span><strong>${club.meetingPoint}</strong></div>
          <div><span>人数</span><strong>${club.membersLabel}</strong></div>
        </div>
        <div class="demo-banner"><strong>${club.nextRun}</strong>申込、決済、個別メッセージは送信されません。</div>
        <button class="full-button" type="button" disabled>参加受付は開始前</button>
        <button class="outline-button" type="button" data-screen="community">コミュニティを見る</button>
      </div>
    `, { nav: C.bottomNav("clubDetail") });
  }

  function community({ city, posts }) {
    const body = posts.length
      ? `<div class="local-list">${posts.map(postCard).join("")}</div>`
      : C.emptyState({
        title: "コミュニティのデモ投稿がありません",
        body: "この都市用の閲覧サンプルはまだ用意されていません。",
        actionLabel: "クラブ一覧へ",
        actionScreen: "clubs",
      });

    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: `${city.name} のコミュニティ`, subtitle: "閲覧のみ", leftAction: "back", rightAction: null })}
        <div class="demo-banner"><strong>投稿は受け付けていません</strong>ランクラブからのお知らせを読むだけのデモです。</div>
        ${body}
        <button class="outline-button teal" type="button" data-screen="clubs">ランクラブを見る</button>
      </div>
    `, { nav: C.bottomNav("community") });
  }

  function profile({ currentUser }) {
    return C.screen(`
      <div class="screen-content">
        ${C.topRow({ title: "デモプロフィール", subtitle: "受付開始前", leftAction: null, rightAction: null })}
        <div class="demo-banner"><strong>保存・公開はしません</strong>この画面の内容は端末のデモ表示です。</div>
        <article class="host-preview-card">
          <img src="${currentUser.photo}" alt="${currentUser.name}" />
          <div class="host-preview-body">
            <span class="badge" style="position:static">デモ</span>
            <h2>${currentUser.name}</h2>
            <p>${currentUser.bio}</p>
            <div class="tag-label">興味</div>
            <div class="chip-row">${currentUser.interests.map((item) => `<span class="chip">${item}</span>`).join("")}</div>
            <div class="chip-row subtle">${currentUser.languages.map((item) => `<span class="chip">${item}</span>`).join("")}</div>
            <p class="helper-text">${currentUser.homeCity}</p>
          </div>
        </article>
        <button class="full-button" type="button" disabled>登録受付は開始前</button>
        <button class="outline-button teal" type="button" data-action="close-demo">デモを閉じる</button>
      </div>
    `, { nav: C.bottomNav("profile") });
  }

  function postCard(post) {
    return `
      <article class="local-card community-post">
        <div>
          <div class="local-card-title">
            <strong>${post.clubName}</strong>
            <span>${post.when}</span>
          </div>
          <p>${post.body}</p>
        </div>
      </article>
    `;
  }

  function debugPanel(debug) {
    if (!window.LOCALINK_CONFIG?.DEBUG || !debug) return "";
    const lastQuery = debug.lastHostQuery || {};
    const error = debug.supabaseError || lastQuery.initialError?.message || lastQuery.fallbackError?.message || "";
    return `
      <details class="debug-panel">
        <summary>TravelBuddy demo debug</summary>
        <dl>
          <div><dt>Configured</dt><dd>${debug.supabaseConfigured ? "yes" : "no"}</dd></div>
          <div><dt>Authenticated</dt><dd>${debug.isAuthenticated ? "yes" : "no"}</dd></div>
          <div><dt>Selected city id</dt><dd>${debug.selectedCityId || "none"}</dd></div>
          <div><dt>Raw city rows</dt><dd>${debug.rawCityRows}</dd></div>
          <div><dt>Community profiles</dt><dd>${debug.communityProfiles ?? "none"}</dd></div>
          <div><dt>Error</dt><dd>${error || "none"}</dd></div>
        </dl>
      </details>
    `;
  }

  return { render };
})();
