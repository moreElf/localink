window.LocalinkMap = (() => {
  let activeMap = null;
  let activeMarkers = [];
  let fallbackDrag = null;

  function init({ cities, selectedCity, onSelectCity }) {
    const mapNode = document.querySelector("#map");
    const fallbackNode = document.querySelector("[data-fallback-map]");

    if (!mapNode || !fallbackNode) return;

    waitForLeaflet().then((leafletReady) => {
      const stillCurrent = document.querySelector("#map") === mapNode;
      if (!stillCurrent) return;

      if (!leafletReady) {
        showFallbackMap(mapNode, fallbackNode, onSelectCity);
        return;
      }

      fallbackNode.hidden = true;
      mapNode.hidden = false;
      renderLeafletMap({ mapNode, cities, selectedCity, onSelectCity });
    });
  }

  function renderLeafletMap({ mapNode, cities, selectedCity, onSelectCity }) {
    const L = window.L;
    if (activeMap) {
      activeMap.remove();
      activeMap = null;
      activeMarkers = [];
    }

    activeMap = L.map(mapNode, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      touchZoom: true,
      dragging: true,
    }).setView(toLeafletLatLng(selectedCity.coordinates), 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      crossOrigin: true,
    }).addTo(activeMap);

    activeMarkers = cities.map((city) => {
      const markerNode = document.createElement("button");
      markerNode.className = `city-bubble leaflet-city-marker ${city.id === selectedCity.id ? "selected" : ""}`;
      markerNode.type = "button";
      markerNode.innerHTML = markerMarkup(city);
      markerNode.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectCity(city.id);
      });

      const marker = L.marker(toLeafletLatLng(city.coordinates), {
        icon: L.divIcon({
          className: "city-marker-shell",
          html: markerNode.outerHTML,
          iconSize: city.id === selectedCity.id ? [104, 128] : [86, 108],
          iconAnchor: city.id === selectedCity.id ? [52, 96] : [43, 76],
        }),
      }).addTo(activeMap);

      marker.on("click", () => onSelectCity(city.id));
      return marker;
    });

    window.setTimeout(() => activeMap?.invalidateSize(), 0);
  }

  function showFallbackMap(mapNode, fallbackNode, onSelectCity) {
    if (activeMap) {
      activeMap.remove();
      activeMap = null;
      activeMarkers = [];
    }
    mapNode.hidden = true;
    fallbackNode.hidden = false;
    updateFallbackMap();
    bindFallbackMapGestures(onSelectCity);
  }

  function waitForLeaflet(timeoutMs = 2500) {
    if (window.L) return Promise.resolve(true);

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (window.L) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          window.clearInterval(timer);
          resolve(false);
        }
      }, 50);
    });
  }

  function markerMarkup(city) {
    return `
      <span class="city-marker-photo-wrap">
        <img class="city-photo" src="${city.image}" alt="${city.name}" />
        <span class="city-count">${city.hostCount}</span>
      </span>
      <span class="city-name">${city.name}</span>
    `;
  }

  function fallbackMarker(city, selectedCityId) {
    return `
      <button class="city-bubble fallback-city-marker ${city.id === selectedCityId ? "selected" : ""}" type="button" data-city="${city.id}" data-action="select-city" style="left:${city.position.x}%; top:${city.position.y}%">
        ${markerMarkup(city)}
      </button>
    `;
  }

  function zoom(delta, state) {
    if (activeMap && !document.querySelector("#map")?.hidden) {
      activeMap.setZoom(activeMap.getZoom() + delta * 3, { animate: true });
      return;
    }

    state.fallbackMap.scale = clamp(state.fallbackMap.scale + delta, 0.85, 1.65);
    updateFallbackMap(state);
  }

  function bindFallbackMapGestures(onSelectCity) {
    const fallback = document.querySelector("[data-fallback-map]");
    if (!fallback || fallback.dataset.bound === "true") return;
    fallback.dataset.bound = "true";

    fallback.addEventListener("pointerdown", (event) => {
      if (event.target.closest("[data-city]")) return;
      fallback.setPointerCapture(event.pointerId);
      const state = window.LocalinkApp.state;
      fallbackDrag = {
        x: event.clientX,
        y: event.clientY,
        offsetX: state.fallbackMap.offsetX,
        offsetY: state.fallbackMap.offsetY,
      };
    });

    fallback.addEventListener("pointermove", (event) => {
      if (!fallbackDrag) return;
      const state = window.LocalinkApp.state;
      state.fallbackMap.offsetX = fallbackDrag.offsetX + event.clientX - fallbackDrag.x;
      state.fallbackMap.offsetY = fallbackDrag.offsetY + event.clientY - fallbackDrag.y;
      updateFallbackMap(state);
    });

    fallback.addEventListener("pointerup", () => {
      fallbackDrag = null;
    });

    fallback.addEventListener("wheel", (event) => {
      event.preventDefault();
      zoom(event.deltaY < 0 ? 0.1 : -0.1, window.LocalinkApp.state);
    }, { passive: false });

    fallback.addEventListener("click", (event) => {
      const marker = event.target.closest("[data-city]");
      if (marker) {
        event.preventDefault();
        event.stopPropagation();
        onSelectCity(marker.dataset.city);
      }
    });
  }

  function updateFallbackMap(state = window.LocalinkApp?.state) {
    const canvas = document.querySelector("[data-map-canvas]");
    if (!canvas || !state) return;
    const { scale, offsetX, offsetY } = state.fallbackMap;
    canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  }

  function toLeafletLatLng(coordinates) {
    return [coordinates[1], coordinates[0]];
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  return {
    fallbackMarker,
    init,
    zoom,
  };
})();
