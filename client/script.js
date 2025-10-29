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
    routeOnly.style.display = m === "route" ? "flex" : "none";
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

// Address normalization and cleaning
function normalizeAddress(address) {
  if (!address) return '';
  
  return address
    .trim()
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Normalize common abbreviations
    .replace(/\bSt\b/gi, 'Street')
    .replace(/\bAve\b/gi, 'Avenue')
    .replace(/\bBlvd\b/gi, 'Boulevard')
    .replace(/\bRd\b/gi, 'Road')
    .replace(/\bDr\b/gi, 'Drive')
    .replace(/\bLn\b/gi, 'Lane')
    .replace(/\bCt\b/gi, 'Court')
    .replace(/\bPl\b/gi, 'Place')
    .replace(/\bSte\b/gi, 'Suite')
    .replace(/\bApt\b/gi, 'Apartment')
    .replace(/\b#\b/g, '')
    // Remove common punctuation issues
    .replace(/[.,;]+$/, '')
    .replace(/^[.,;]+/, '')
    // Fix common typos
    .replace(/\bSan Fransisco\b/gi, 'San Francisco')
    .replace(/\bLos Angelas\b/gi, 'Los Angeles')
    .replace(/\bNew York City\b/gi, 'New York')
    .replace(/\bWashington DC\b/gi, 'Washington, DC')
    .replace(/\bWashington D\.C\.\b/gi, 'Washington, DC');
}

// Simple fuzzy matching for common misspellings
function fuzzyMatchAddress(address) {
  const commonMistakes = {
    'San Fransisco': 'San Francisco',
    'Los Angelas': 'Los Angeles',
    'New York City': 'New York',
    'Washington DC': 'Washington, DC',
    'Washington D.C.': 'Washington, DC',
    'St.': 'Street',
    'Ave.': 'Avenue',
    'Blvd.': 'Boulevard',
    'Rd.': 'Road',
    'Dr.': 'Drive',
    'Ln.': 'Lane',
    'Ct.': 'Court',
    'Pl.': 'Place',
    'Ste.': 'Suite',
    'Apt.': 'Apartment'
  };
  
  let corrected = address;
  for (const [mistake, correction] of Object.entries(commonMistakes)) {
    const regex = new RegExp(`\\b${mistake.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    corrected = corrected.replace(regex, correction);
  }
  return corrected;
}

function parseLatLng(text) {
  const parts = (text || "").split(",").map(s => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function parseGoogleMapsLink(text) {
  // Handle various Google Maps link formats
  const patterns = [
    // maps.google.com/maps?q=lat,lng
    /maps\.google\.com\/maps\?q=([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/,
    // maps.google.com/maps/@lat,lng
    /maps\.google\.com\/maps\/@([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/,
    // goo.gl/maps/... or maps.app.goo.gl/...
    /(?:goo\.gl\/maps\/|maps\.app\.goo\.gl\/)[A-Za-z0-9_-]+/,
    // maps.google.com/maps/place/.../@lat,lng
    /maps\.google\.com\/maps\/place\/[^\/]+\/@([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1] && match[2]) {
        const lat = Number(match[1]);
        const lng = Number(match[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
      }
      // For shortened links, we'll need to geocode the full address
      return null;
    }
  }
  return null;
}

async function geocodeAddress(address) {
  if (!window.google?.maps?.geocoder) return null;
  
  const geocoder = new google.maps.Geocoder();
  
  // Try multiple strategies with increasing tolerance
  const strategies = [
    // 1. Original address
    address,
    // 2. Normalized address
    normalizeAddress(address),
    // 3. Fuzzy matched address
    fuzzyMatchAddress(address),
    // 4. Remove suite/apartment numbers for broader search
    address.replace(/\b(?:Suite|Apt|Apartment|Unit|#)\s*\w+.*$/i, '').trim(),
    // 5. Try with just city, state if it looks like a full address
    extractCityState(address)
  ];
  
  // Remove duplicates and empty strings
  const uniqueStrategies = [...new Set(strategies)].filter(s => s && s.trim());
  
  for (const strategy of uniqueStrategies) {
    try {
      const result = await geocodeSingleAddress(geocoder, strategy);
      if (result) {
        console.log(`Geocoding success with strategy: "${strategy}"`);
        return result;
      }
    } catch (error) {
      console.warn(`Geocoding failed for strategy "${strategy}":`, error);
    }
  }
  
  return null;
}

function extractCityState(address) {
  // Try to extract city, state from full address
  const cityStateMatch = address.match(/([^,]+),\s*([A-Z]{2})\s*\d*$/);
  if (cityStateMatch) {
    return `${cityStateMatch[1].trim()}, ${cityStateMatch[2]}`;
  }
  return null;
}

function geocodeSingleAddress(geocoder, address) {
  return new Promise((resolve) => {
    geocoder.geocode({ 
      address,
      componentRestrictions: {
        country: 'US' // Restrict to US for better results
      }
    }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        resolve({
          lat: location.lat(),
          lng: location.lng()
        });
      } else {
        resolve(null);
      }
    });
  });
}

async function getCoords(inputEl, placeObj) {
  // 1. Check if we have a Google Places autocomplete result
  if (placeObj?.geometry?.location) {
    const lat = placeObj.geometry.location.lat();
    const lng = placeObj.geometry.location.lng();
    return { lat, lng };
  }
  
  const inputValue = inputEl.value.trim();
  if (!inputValue) return null;
  
  // 2. Try to parse as lat,lng pair
  const latLng = parseLatLng(inputValue);
  if (latLng) return latLng;
  
  // 3. Try to parse as Google Maps link
  const linkCoords = parseGoogleMapsLink(inputValue);
  if (linkCoords) return linkCoords;
  
  // 4. Try to geocode as address (requires Google Maps API)
  if (window.google?.maps?.geocoder) {
    const coords = await geocodeAddress(inputValue);
    if (coords) return coords;
  }
  
  return null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Searching...';
  submitBtn.disabled = true;
  
  try {
    await loadMapsApi();
    const mode = currentMode();
    
    // Show progress for geocoding
    if (originInput.value && !originPlace) {
      submitBtn.textContent = 'Finding location...';
    }
    
    const origin = await getCoords(originInput, originPlace);
    
    if (destinationInput.value && !destinationPlace) {
      submitBtn.textContent = 'Finding destination...';
    }
    
    const destination = await getCoords(destinationInput, destinationPlace);
    const radius_miles = Number(radiusInput.value || 5);
    if (!origin) { 
      const suggestions = [
        "• Try: 3125 Kerner Boulevard, San Rafael, CA 94901",
        "• Or: 37.9697, -122.5159",
        "• Or: https://maps.google.com/maps?q=37.9697,-122.5159",
        "• Check spelling and try common abbreviations (St, Ave, Blvd)"
      ].join('\n');
      
      alert(`Address not found. Please try:\n\n${suggestions}`); 
      return; 
    }

    submitBtn.textContent = 'Finding leads...';
    const resp = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, origin, destination, radius_miles })
    });
    const data = await resp.json();
    if (!resp.ok) { alert(data.error || "Error"); return; }
    renderTable(data.table);
  } catch (error) {
    console.error('Search error:', error);
    alert('An error occurred while searching. Please try again.');
  } finally {
    // Reset button state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
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


