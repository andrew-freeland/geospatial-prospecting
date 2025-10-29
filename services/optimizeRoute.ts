import axios from "axios";
import { BusinessRecord } from "../models/business";
import { RouteList } from "../models/route";

interface DirectionsResponse {
  routes: Array<{
    waypoint_order?: number[];
    legs?: Array<{ distance?: { value: number }; duration?: { value: number } }>;
  }>;
}

export async function optimizeRoute(
  origin: { lat: number; lng: number },
  stops: BusinessRecord[]
): Promise<RouteList> {
  if (stops.length === 0) {
    return { origin, stops: [], totalDistanceMeters: 0, totalDurationSeconds: 0 };
  }

  const waypoints = stops.map(s => `${s.coordinates.lat},${s.coordinates.lng}`);
  const params = {
    origin: `${origin.lat},${origin.lng}`,
    destination: `${origin.lat},${origin.lng}`,
    waypoints: `optimize:true|${waypoints.join("|")}`,
    mode: "driving",
    departure_time: "now",
    key: process.env.GOOGLE_DIRECTIONS_API_KEY || ""
  };

  // Placeholder: call via Vertex AI Extension named ext-google-directions
  const url = "https://maps.googleapis.com/maps/api/directions/json";
  const { data } = await axios.get<DirectionsResponse>(url, { params });
  const route = data.routes?.[0];
  const order = route?.waypoint_order ?? stops.map((_, i) => i);

  const orderedStops = order.map((idx, i) => ({ ...stops[idx], stopNumber: i + 1 }));

  const legs = route?.legs ?? [];
  const totalDistanceMeters = legs.reduce((a, l) => a + (l.distance?.value ?? 0), 0);
  const totalDurationSeconds = legs.reduce((a, l) => a + (l.duration?.value ?? 0), 0);

  return {
    origin,
    stops: orderedStops,
    totalDistanceMeters,
    totalDurationSeconds
  };
}

