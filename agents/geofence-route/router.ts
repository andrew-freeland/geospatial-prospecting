import { GeofenceInputs } from "../../models/inputs";
import { geocode } from "../../utils/geocode";
import { getBusinessesInGeofence } from "../../services/getBusinessesInGeofence";
import { filterByCategory } from "../../services/filterByCategory";
import { optimizeRoute } from "../../services/optimizeRoute";
import { formatOutput } from "../../services/formatOutput";
import { sheetWriter } from "../../services/sheetWriter";
import { csvWriter } from "../../services/csvWriter";
import { deliverToSlack } from "../../services/deliverToSlack";
import { deliverToEmail } from "../../services/deliverToEmail";

export async function RoutePlan(inputs: GeofenceInputs): Promise<{ preview: { headers: string[]; rows: (string | number)[][] }, links: { sheetUrl?: string; csvUrl?: string } }> {
  const radius = Math.max(2, Math.min(10, inputs.radius_miles ?? 5));
  const { lat, lng, label } = await geocode(inputs.location);

  let records = await getBusinessesInGeofence({ lat, lng }, radius, { maxPages: 3 });
  if (inputs.excluded_categories?.length) {
    records = filterByCategory(records, inputs.excluded_categories);
  }

  // Cap to keep Directions efficient (origin+dest+waypoints limit)
  records = records.slice(0, 23);

  const route = await optimizeRoute({ lat, lng, label }, records);
  const table = formatOutput(route);

  const wantSheet = (inputs.output ?? "sheet") === "sheet" || inputs.output === "both";
  const wantCsv = (inputs.output ?? "sheet") === "csv" || inputs.output === "both";

  const links: { sheetUrl?: string; csvUrl?: string } = {};
  if (wantSheet) {
    const res = await sheetWriter(`Geofence Route - ${label ?? `${lat},${lng}`}`, table);
    links.sheetUrl = res.url;
  }
  if (wantCsv) {
    const res = await csvWriter(`geofence_route.csv`, table);
    links.csvUrl = res.url;
  }

  // Delivery preference
  const deliverPref = inputs.deliver ?? "auto";
  const summary = `Origin: ${label ?? `${lat},${lng}`} • Radius: ${radius} mi • Stops: ${route.stops.length}`;
  if (deliverPref === "slack" && inputs.slack_recipient) {
    await deliverToSlack(inputs.slack_recipient, summary, links.sheetUrl, links.csvUrl, table.rows.slice(0, 1));
  } else if (deliverPref === "email" && inputs.email) {
    const html = `<p>${summary}</p><p>${links.sheetUrl ? `<a href='${links.sheetUrl}'>Open Google Sheet</a>` : ""} ${links.csvUrl ? ` • <a href='${links.csvUrl}'>Download CSV</a>` : ""}</p>`;
    await deliverToEmail(inputs.email, `Your Geofence Route (${route.stops.length} stops)`, html);
  }

  return { preview: table, links };
}

