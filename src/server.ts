import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { getBusinessesInGeofence } from "../services/getBusinessesInGeofence";
import { optimizeRoute } from "../services/optimizeRoute";
import { formatOutput } from "../services/formatOutput";

dotenv.config();

const app = express();
app.use(express.json());

// Basic Auth middleware (password only)
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD || "123";
app.use((req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Basic ")) return unauthorized(res);
  const creds = Buffer.from(auth.slice(6), "base64").toString("utf8");
  // Format: username:password — we ignore username, only check password
  const idx = creds.indexOf(":");
  const password = idx >= 0 ? creds.slice(idx + 1) : creds;
  if (password !== BASIC_AUTH_PASSWORD) return unauthorized(res);
  next();
});

function unauthorized(res: express.Response) {
  res.setHeader("WWW-Authenticate", "Basic realm=\"Restricted\"");
  return res.status(401).send("Unauthorized");
}

// Serve client files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, "..", "client");
app.use(express.static(clientDir));

// Config endpoint to expose Maps API key to client
app.get("/api/config", (_req, res) => {
  res.json({ mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "" });
});

// Search endpoint
app.post("/api/search", async (req, res) => {
  try {
    const { mode, origin, destination, radius_miles } = req.body || {};
    if (!origin || typeof origin.lat !== "number" || typeof origin.lng !== "number") {
      return res.status(400).json({ error: "origin {lat,lng} is required" });
    }
    const radius = Math.max(2, Math.min(10, Number(radius_miles ?? 5)));

    // Discover businesses around origin
    let businesses = await getBusinessesInGeofence(origin, radius, { maxPages: 3 });
    businesses = businesses.slice(0, 23);

    // Determine route destination
    const dest = mode === "route" && destination ? destination : origin;
    const route = await optimizeRoute(origin, businesses);
    // For a linear route, we could set destination but our optimizeRoute returns loop from origin.
    const table = formatOutput(route);
    res.json({ route, table, count: route.stops.length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Internal error" });
  }
});

// Export CSV endpoint
app.post("/api/export", (req, res) => {
  const { table } = req.body || {};
  if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) {
    return res.status(400).json({ error: "table {headers, rows} is required" });
  }
  const lines: string[] = [];
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  lines.push(table.headers.map(esc).join(","));
  for (const row of table.rows) {
    lines.push((row as (string | number)[]).map(esc).join(","));
  }
  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=geofence_route.csv");
  res.send(csv);
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


