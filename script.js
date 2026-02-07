// --- Queensland Map Viewer Starter --- //

// Replace with your MapTiler key
const MAPTILER_KEY = "0bjCw6ttHKyLJEqHouef";

// --- Basemap Styles --- //
const basemaps = {
  streets: "https://demotiles.maplibre.org/style.json",
  satellite: `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`,
  hybrid: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
  terrain: `https://api.maptiler.com/maps/terrain/style.json?key=${MAPTILER_KEY}`
};

// --- Initial Map (Hybrid default) --- //
const map = new maplibregl.Map({
  container: "map",
  style: basemaps.hybrid,
  center: [146.5, -21],
  zoom: 5
});

// --- Basemap Switcher --- //
document.getElementById("basemap-select").addEventListener("change", (e) => {
  const styleUrl = basemaps[e.target.value];
  if (styleUrl) {
    map.setStyle(styleUrl);
  }
});

// --- ArcGIS FeatureServer Layers --- //
const layers = {
  culverts: {
    id: "culverts",
    url: "https://services-ap1.arcgis.com/22SoQyN5G8T8opSx/arcgis/rest/services/STRU_Structure_Assets/FeatureServer/2/query?where=1%3D1&outFields=*&f=json",
    type: "circle",
    paint: {
      "circle-radius": 3,
      "circle-color": "#1f78b4"
    }
  },
  bridges: {
    id: "bridges",
    url: "https://services-ap1.arcgis.com/22SoQyN5G8T8opSx/arcgis/rest/services/STRU_Structure_Assets/FeatureServer/1/query?where=1%3D1&outFields=*&f=json",
    type: "circle",
    paint: {
      "circle-radius": 4,
      "circle-color": "#e31a1c"
    }
  },
  property: {
    id: "property",
    url: "https://services-ap1.arcgis.com/22SoQyN5G8T8opSx/arcgis/rest/services/PLAN_Property_and_Rail_Corridor_Boundaries/FeatureServer/2/query?where=1%3D1&outFields=*&f=json",
    type: "line",
    paint: {
      "line-color": "#33a02c",
      "line-width": 1
    }
  },
  rail: {
    id: "rail",
    url: "https://services-ap1.arcgis.com/22SoQyN5G8T8opSx/arcgis/rest/services/TRAN_Railway_Tracks_CQCN/FeatureServer/2/query?where=1%3D1&outFields=*&f=json",
    type: "line",
    paint: {
      "line-color": "#ff7f00",
      "line-width": 2
    }
  }
};

// --- Pagination + ESRI JSON → GeoJSON --- //
async function fetchAllFeatures(url) {
  let all = { type: "FeatureCollection", features: [] };
  let offset = 0;
  const pageSize = 2000;

  while (true) {
    const pagedUrl = `${url}&resultOffset=${offset}&resultRecordCount=${pageSize}`;
    const res = await fetch(pagedUrl);
    const json = await res.json();

    if (!json.features || json.features.length === 0) break;

    // Convert ESRI JSON → GeoJSON
    const geo = Terraformer.ArcGIS.parse(json);
    all.features.push(...geo.features);

    if (!json.exceededTransferLimit || json.features.length < pageSize) break;

    offset += pageSize;
  }

  return all;
}

// --- Load all layers --- //
async function loadAllLayers() {
  for (const layer of Object.values(layers)) {
    if (map.getSource(layer.id)) continue;

    const data = await fetchAllFeatures(layer.url);

    map.addSource(layer.id, { type: "geojson", data });

    map.addLayer({
      id: layer.id,
      type: layer.type,
      source: layer.id,
      paint: layer.paint
    });
  }
}

map.on("load", loadAllLayers);

// Reload layers after basemap change
map.on("styledata", () => {
  setTimeout(loadAllLayers, 500);
});

// --- Layer Toggles --- //
function bindToggle(toggleId, layerId) {
  const el = document.getElementById(toggleId);
  el.addEventListener("change", (e) => {
    if (!map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", e.target.checked ? "visible" : "none");
  });
}

bindToggle("culverts-toggle", "culverts");
bindToggle("bridges-toggle", "bridges");
bindToggle("property-toggle", "property");
bindToggle("rail-toggle", "rail");

// --- Popups --- //
map.on("click", (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ["culverts", "bridges", "property", "rail"]
  });

  if (!features.length) return;

  const f = features[0];
  const props = f.properties;

  let html = `<h3>${f.layer.id.toUpperCase()}</h3><table>`;
  for (const key in props) {
    html += `<tr><td><strong>${key}</strong></td><td>${props[key]}</td></tr>`;
  }
  html += "</table>";

  new maplibregl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(html)
    .addTo(map);
});
