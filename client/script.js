const modeInputs = document.getElementsByName("mode");
const originInput = document.getElementById("origin");
const destinationInput = document.getElementById("destination");
const routeOnly = document.querySelector(".route-only");
const form = document.getElementById("search-form");
const radiusInput = document.getElementById("radius");
const thead = document.getElementById("thead");
const tbody = document.getElementById("tbody");
const results = document.getElementById("results");
const downloadBtn = document.getElementById("download-csv");

let mapsApiLoaded = false;
let originPlace = null;
let destinationPlace = null;

function currentMode() {
  return Array.from(modeInputs).find(r => r.checked)?.value || "radius";
}

Array.from(modeInputs).forEach(r => {
  r.addEventListener("change", () => {
    const m = currentMode();
    routeOnly.style.display = m === "route" ? "block" : "none";
  });
});

async function loadMapsApi() {
  if (mapsApiLoaded) return;
  const cfg = await fetch("/api/config").then(r => r.json());
  const key = cfg.mapsApiKey || "";
  if (!key) return; // allow manual lat,lng entry
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  mapsApiLoaded = true;
  setupAutocomplete();
}

function setupAutocomplete() {
  if (!window.google?.maps?.places) return;
  const o = new google.maps.places.Autocomplete(originInput, { fields: ["geometry", "formatted_address", "name"] });
  o.addListener("place_changed", () => { originPlace = o.getPlace(); });
  const d = new google.maps.places.Autocomplete(destinationInput, { fields: ["geometry", "formatted_address", "name"] });
  d.addListener("place_changed", () => { destinationPlace = d.getPlace(); });
}

function parseLatLng(text) {
  const parts = (text || "").split(",").map(s => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function getCoords(inputEl, placeObj) {
  if (placeObj?.geometry?.location) {
    const lat = placeObj.geometry.location.lat();
    const lng = placeObj.geometry.location.lng();
    return { lat, lng };
  }
  return parseLatLng(inputEl.value);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  await loadMapsApi();
  const mode = currentMode();
  const origin = getCoords(originInput, originPlace);
  const destination = getCoords(destinationInput, destinationPlace);
  const radius_miles = Number(radiusInput.value || 5);
  if (!origin) { alert("Please enter a valid origin address or 'lat,lng'"); return; }

  const resp = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, origin, destination, radius_miles })
  });
  const data = await resp.json();
  if (!resp.ok) { alert(data.error || "Error"); return; }
  renderTable(data.table);
});

function renderTable(table) {
  thead.innerHTML = "";
  tbody.innerHTML = "";
  for (const h of table.headers) {
    const th = document.createElement("th");
    th.textContent = h;
    thead.appendChild(th);
  }
  for (const row of table.rows) {
    const tr = document.createElement("tr");
    for (const cell of row) {
      const td = document.createElement("td");
      if (typeof cell === "string" && cell.startsWith("http")) {
        const a = document.createElement("a");
        a.href = cell;
        a.textContent = "Map";
        a.target = "_blank";
        td.appendChild(a);
      } else {
        td.textContent = String(cell ?? "");
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  results.hidden = false;
}

downloadBtn.addEventListener("click", async () => {
  const headers = Array.from(thead.children).map(th => th.textContent);
  const rows = Array.from(tbody.children).map(tr => Array.from(tr.children).map(td => td.textContent));
  const resp = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: { headers, rows } })
  });
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "geofence_route.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Try to load Maps API early for autocomplete; non-fatal if key missing
loadMapsApi().catch(() => {});


