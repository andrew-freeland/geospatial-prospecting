# System Prompt

You are a full-stack TypeScript developer. Build the complete codebase for the ‘Geofence Route Generator’ agent described below, targeting deployment in Google Agentspace using Vertex AI Agent Builder. Follow the file/folder structure exactly

## Functional Specification

### Goal

Given a location (address or lat/lon), a radius, and optional excluded categories, return a **driving-optimized** list of nearby storefront businesses and **deliver it via Slack or email**, with a link to a Google Sheet or a downloadable CSV. Designed for field sales reps.

### In-Scope (MVP)

* Inputs

  * `location`: free-text address or `lat,lng`
  * `radius_miles`: 2–10 (default 5)
  * `excluded_categories` (e.g., “restaurant”, “salon”; string list)
* Core logic

  1. Discover places in geofence (Google Places API *Nearby Search*).
  2. Filter out categories.
  3. Optimize visit order for driving (Google Directions API waypoint optimization).
  4. Produce a tabular route (stop #, name, address, map link, ETA between stops).
  5. Deliver results via Slack DM/message or Gmail email.
* Outputs

  * Google Sheet (preferred for mobile) **or** downloadable CSV (URL in the message).
  * Slack/Gmail message includes: quick summary, file link(s), and top 3 stops preview inline.

### Out-of-Scope (MVP)

No CRM writes, no follow-ups, no AI summarization, no telephony/voice. (Per user brief.)

# Architecture

The agent runs inside **Google Agentspace** (invoked from Agent Designer or deployed via Vertex AI Agent Builder). Agentspace natively supports prompt-initiated, human-in-the-loop workflows and connects agents across systems; it’s designed for employees to access and act on information in Chrome/Agentspace. 

### High-Level Diagram (Mermaid)

```mermaid
flowchart TD
  A[Agent UI (Agentspace<br/>Agent Designer prompt)] --> B[Input Parser]
  B --> C[getBusinessesInGeofence (Vertex AI Extension -> Google Places Nearby Search)]
  C --> D[filterByCategory]
  D --> E[optimizeRoute (Vertex AI Extension -> Google Maps Directions Waypoints)]
  E --> F{Output Formatter}
  F -->|Sheets| G[Create Sheet (Sheets API via Extension)]
  F -->|CSV| H[Generate CSV -> Upload (Drive API or GCS via Extension)]
  G --> I[Sharable Link]
  H --> I
  I --> J{Delivery}
  J -->|Slack| K[deliverToSlack (Slack Web API via Extension)]
  J -->|Email| L[deliverToEmail (Gmail API via Extension)]
  subgraph Agentspace Runtime
    A
  end
  subgraph Vertex AI Agent Builder
    B --> C --> D --> E --> F --> J
  end
  subgraph Vertex AI Extensions (Secure)
    C
    E
    G
    H
    K
    L
  end
```

> Notes
> • **Agent Designer** enables no-/low-code prompt-initiated agents; devs can extend in **Vertex AI Agent Builder**. 
> • Agentspace is built to connect pre-built and custom agents and external systems securely. 

# Components & Responsibilities

## 1) Agentspace-Compatible Frontend Logic

* **Invocation**: human enters prompt or uses a lightweight form (Agent Designer parameters). (Agentspace promotes human-in-the-loop flows.) 
* **Input Parser**: normalize address/lat,lng; validate radius (2–10); canonicalize excluded categories.
* **Prompt Routing**: route to “RoutePlan” tool when intent is geofence route generation.

## 2) Vertex AI Extensions (secure API calls)

* **Places Extension**: Google Places API *Nearby Search*

  * Purpose: storefront discovery within radius.
* **Maps Directions Extension**: Google Maps Directions (waypoint optimization)

  * Purpose: sort by efficient driving order.
* **Sheets Extension** (Google Sheets API) and **Drive/GCS Extension** for file link.
* **Slack Extension** (Slack Web API) and **Gmail Extension** (Gmail API) for delivery.

> Use Extensions to avoid embedding secrets; all credentials stored and governed centrally. 

## 3) Services (agent functions)

* `getBusinessesInGeofence()`: wraps Places Nearby Search; handles paging and dedupe.
* `filterByCategory()`: excludes records where `primary_category` or `types[]` intersects excluded list.
* `optimizeRoute()`: builds Directions request with waypoints and `optimize:true` to return best order and legs.
* `formatOutput()`: returns `RouteList` and a 2D table for export.
* `sheetWriter() | csvWriter()`: create a Sheet or CSV and generate a sharable link.
* `deliverToSlack() | deliverToEmail()`: deliver message with links and a small inline preview.

## 4) Data Models

```ts
// /models/business.ts
export interface BusinessRecord {
  placeId: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  primaryCategory: string;       // canonicalized
  types: string[];               // raw Google types
  mapUrl: string;                // https://maps.google.com/?q=<lat>,<lng>
}

// /models/route.ts
export interface RouteList {
  origin: { lat: number; lng: number; label?: string };
  stops: Array<BusinessRecord & { stopNumber: number }>;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}
```

## 5) Security & Permissions

* All external calls via **Vertex AI Extensions** with service-account scopes set least-privilege.
* No public endpoints; execution only within Agentspace/Agent Builder.
* PII avoidance: business data only; no user secrets in logs.
* Rate-limit and backoff for Maps APIs; handle quota errors gracefully.

## 6) Testing & Demo

* **Test Mode**: feature flag `TEST_MODE=true`

  * Uses a static lat/lon (e.g., `37.7749,-122.4194`) and **mocked** API payloads (JSON fixtures).
* **UI Preview**: render preview table inside Agentspace (Chrome UI) before delivery. 
* No hardcoded API keys or tokens; all via Extensions.

# API Call Scaffolds & Payload Shapes (spec-level)

> All requests executed through **Vertex AI Extensions** with named connectors (placeholders shown).

## 1) Discover Businesses (Places Nearby Search)

**Extension Name**: `ext-google-places`
**HTTP**: `GET https://maps.googleapis.com/maps/api/place/nearbysearch/json`
**Params**:

```json
{
  "location": "LAT,LNG",
  "radius": 8046,                     // miles * 1609.34
  "type": "store",                    // optional narrowing (MVP: omit to stay broad)
  "opennow": false,
  "pagetoken": "NEXT_PAGE_TOKEN?"     // handle pagination
}
```

**Response Mapping → BusinessRecord**:

* `place_id` → `placeId`
* `name` → `name`
* `vicinity` or `formatted_address` → `address`
* `geometry.location` → `coordinates`
* `types[]` → `types` (derive `primaryCategory`)
* Build `mapUrl` as `https://maps.google.com/?q=<lat>,<lng>`

## 2) Filter Categories

**Function**: `filterByCategory(records, excludedCategories: string[])`

* Normalize both sides to lowercase; simple `types` membership test; maintain a small synonym map (e.g., `restaurant` matches `restaurant`, `meal_takeaway`, `food`).

## 3) Optimize Route (Directions)

**Extension Name**: `ext-google-directions`
**HTTP**: `GET https://maps.googleapis.com/maps/api/directions/json`
**Params**:

```json
{
  "origin": "LAT,LNG",
  "destination": "LAT,LNG",
  "waypoints": "optimize:true|LAT1,LNG1|LAT2,LNG2|...",
  "mode": "driving",
  "departure_time": "now"
}
```

**Response Handling**:

* Read `routes[0].waypoint_order[]` for optimized index order.
* Use `legs[]` to compute inter-stop ETAs and total time/distance.
* Build ordered `RouteList.stops` with `stopNumber` = 1..N.

## 4) Output (Google Sheets or CSV)

**Sheets Path** (`ext-google-sheets`):

* Create spreadsheet → write header + rows
* Header: `#`, `Business Name`, `Address`, `Map Link`, `ETA to Next`, `Distance to Next`
* Share link: anyone in domain with link (or specific users)
  **CSV Path**:
* Generate UTF-8 CSV; upload via Drive (`ext-google-drive`) or GCS (`ext-gcs`) and produce a signed URL (time-limited).

**Row Example**:

```csv
1, "Acme Hardware", "123 Main St, Springfield", "https://maps.google.com/?q=..", "8 min", "2.7 mi"
```

## 5) Delivery

### Slack

**Extension**: `ext-slack-web`
**Endpoint**: `POST https://slack.com/api/chat.postMessage`
**Payload (blocks excerpt)**:

```json
{
  "channel": "U12345 or #channel",
  "text": "Geofence Route (5 stops) ready.",
  "blocks": [
    { "type": "header", "text": { "type": "plain_text", "text": "Geofence Route Generator" } },
    { "type": "section", "text": { "type": "mrkdwn", "text":
      "*Origin:* 1600 Amphitheatre Pkwy\n*Radius:* 5 mi\n*Stops:* 12"
    }},
    { "type": "section", "fields": [
      { "type": "mrkdwn", "text": "*1.* Acme Hardware\n123 Main St" },
      { "type": "mrkdwn", "text": "<SHEET_URL|Open Sheet>  •  <CSV_URL|Download CSV>" }
    ]}
  ]
}
```

### Email (Gmail)

**Extension**: `ext-gmail`
**Endpoint**: Gmail API `users.messages.send`
**Payload (simplified)**:

```json
{
  "to": "rep@company.com",
  "subject": "Your Geofence Route (12 stops)",
  "bodyHtml": "<p>Origin: 1600 Amphitheatre Pkwy • Radius: 5 mi</p>
               <p><a href='SHEET_URL'>Open Google Sheet</a> •
               <a href='CSV_URL'>Download CSV</a></p>
               <ol><li>Acme Hardware — 123 Main St</li> ... </ol>"
}
```

# Control Flow & Error Handling

1. **Parse & validate inputs** (bad radius → message with allowed range).
2. **Geocode** if input is an address (Optional: use Places *Text Search* or Geocoding API via separate extension).
3. **Nearby Search** with pagination (up to 60 results typical: 3 pages × 20).
4. **Filter** by excluded categories; enforce upper cap (e.g., take top 25 by proximity to keep Directions call efficient).
5. **Optimize** route (origin = user location; destination = origin for looped route or last stop if linear).
6. **Format** output; write to Sheet or CSV; obtain link.
7. **Deliver** via available channel:

   * If Slack identity present (Agentspace profile / environment), prefer Slack; else email; if both missing, show in-UI preview with copyable link.
8. **Human-in-the-loop**: show preview & require “Confirm & Send” in Agentspace before delivery. 

**Errors**:

* **Places quota** → message: “Discovery limit reached—reduce radius or try later.”
* **Directions waypoint limit** (25 waypoints incl. origin/destination) → auto-chunk into multiple legs; produce separate sheets (`Route A`, `Route B`).
* **Slack/Gmail failure** → fallback to in-UI preview + links.

# File/Folder Structure (recommendation)

```
/agents
  /geofence-route
    agent.json                 # Agent Designer/Agent Builder config (tools, parameters, HIL settings)
    prompts.md                 # user-facing prompts, examples, guardrails
    router.ts                  # intent routing

/extensions
  places.json                  # Vertex AI Extension: Google Places Nearby Search
  directions.json              # Vertex AI Extension: Google Directions
  sheets.json                  # Vertex AI Extension: Google Sheets
  drive.json                   # Vertex AI Extension: Google Drive (or gcs.json)
  slack.json                   # Vertex AI Extension: Slack Web API
  gmail.json                   # Vertex AI Extension: Gmail API

/services
  getBusinessesInGeofence.ts
  filterByCategory.ts
  optimizeRoute.ts
  formatOutput.ts
  sheetWriter.ts
  csvWriter.ts
  deliverToSlack.ts
  deliverToEmail.ts

/models
  business.ts
  route.ts
  inputs.ts

/utils
  geocode.ts                   # optional
  categories.ts                # synonyms & canonicalization
  coords.ts                    # parsing/validation helpers
  rateLimit.ts                 # retry/backoff
  logging.ts

/test
  fixtures/
    places_nearby_page1.json
    places_nearby_page2.json
    directions_waypoints.json
  testmode.ts                  # injects fixture responses
  demo_scenarios.md

/deployment
  agentspace.md                # how to publish in Agentspace Agent Gallery
  iam.md                       # service accounts, scopes, secrets (Extensions)
/docs
  functional-spec.md           # this spec
  api-scaffolds.md
  runbook.md                   # ops notes
```

# Function Signatures (scaffolds)

```ts
// /services/getBusinessesInGeofence.ts
export async function getBusinessesInGeofence(
  origin: { lat: number; lng: number },
  radiusMiles: number,
  opts?: { typeHint?: string; maxPages?: number }
): Promise<BusinessRecord[]>;

// /services/filterByCategory.ts
export function filterByCategory(
  records: BusinessRecord[],
  excluded: string[]
): BusinessRecord[];

// /services/optimizeRoute.ts
export async function optimizeRoute(
  origin: { lat: number; lng: number },
  stops: BusinessRecord[]
): Promise<RouteList>;

// /services/formatOutput.ts
export function formatOutput(route: RouteList): {
  headers: string[];
  rows: (string | number)[][];
};

// /services/sheetWriter.ts
export async function sheetWriter(
  title: string,
  table: { headers: string[]; rows: (string | number)[][] }
): Promise<{ url: string; spreadsheetId: string }>;

// /services/csvWriter.ts
export async function csvWriter(
  filename: string,
  table: { headers: string[]; rows: (string | number)[][] }
): Promise<{ url: string; fileId: string }>;

// /services/deliverToSlack.ts
export async function deliverToSlack(
  channelOrUser: string,
  summary: string,
  sheetUrl?: string,
  csvUrl?: string,
  previewRows?: (string | number)[][]
): Promise<void>;

// /services/deliverToEmail.ts
export async function deliverToEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void>;
```

# Input Contract

```ts
// /models/inputs.ts
export interface GeofenceInputs {
  location: string;                  // "1600 Amphitheatre Pkwy..." or "37.42,-122.08"
  radius_miles?: number;             // default 5, min 2, max 10
  excluded_categories?: string[];    // ["restaurant", "salon"]
  output?: "sheet" | "csv" | "both"; // default "sheet"
  deliver?: "slack" | "email" | "auto"; // default "auto"
  email?: string;                    // if deliver=email
  slack_recipient?: string;          // user or channel
  test_mode?: boolean;               // use fixtures
}
```

# Non-Functional Requirements

* **Performance**: Keep total stops ≤ 23 for a single Directions call (origin+dest+21 waypoints). If more results, batch into multiple routes.
* **Resilience**: Exponential backoff on 429/5xx; partial success tolerated (e.g., if Sheets fails, still provide CSV).
* **Observability**: Structured logs (request id, user id, counts, durations, errors), redacting PII/secrets.
* **Mobile usability**: Prefer Google Sheet link (renders well on mobile); include CSV as fallback.

# Human-in-the-Loop UX (Agentspace/Agent Designer)

1. **Prompt**: “Create a 5-mile route around 350 5th Ave NYC and exclude restaurants.”
2. **Agent shows preview**: Top 5 stops + map links + choice of output (Sheet/CSV) & delivery (Slack/Email).
3. **User clicks ‘Confirm & Send’** → agent executes delivery.

> This matches Agentspace’s goal of secure, human-approved actions. 

# Deployment & Ops

* **Where**: Publish to **Agentspace Agent Gallery**; editable in Agent Designer; advanced edits in Vertex AI Agent Builder. 
* **Auth**: One service account per environment; grant specific API scopes per Extension; rotate keys via Secret Manager (no plaintext secrets).
* **Quotas**: Track Maps Platform quotas; provide admin doc to request increases if needed.
* **Rollout**: Start with test org unit; gather feedback from sales reps; iterate.

# Appendix A — Example User Flows

**Flow 1 (Slack auto-delivery)**

* Detect user’s Slack handle (Agentspace profile) → deliver to Slack + Sheet link.
  **Flow 2 (Email)**
* If Slack not available, send Gmail to `rep@company.com` with Sheet + CSV links.
  **Flow 3 (Preview only)**
* If neither Slack nor email provided, keep preview in Agentspace and provide links to open/download.

# Appendix B — Category Exclusion Mapping (sample)

* `restaurant` → matches `restaurant`, `meal_takeaway`, `food`
* `salon` → matches `beauty_salon`, `hair_care`
* `bar` → matches `bar`, `night_club`
  (Implement a small synonyms map; allow admin JSON updates.)

---

## What the Developer Agent Needs to Generate

### 1) Functional Specification Doc

You can copy this entire document into `/docs/functional-spec.md`.

### 2) Architecture Diagram

Use the Mermaid block above in `/docs/architecture.mmd`.

### 3) API Call Scaffolds & Payload Structure

* Use the **API sections** above to create Extension configs under `/extensions/*.json` and service function stubs under `/services/*`.
* Include test fixtures under `/test/fixtures/*`.

### 4) File/Folder Structure

Use the **File/Folder Structure** section as your starting scaffold.
