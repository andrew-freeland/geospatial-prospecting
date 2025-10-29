import axios from "axios";
import { BusinessRecord } from "../models/business";
import { radiusMilesToMeters, mapUrl } from "../utils/coords";

interface PlacesNearbyResponse {
  results: Array<{
    place_id: string;
    name: string;
    vicinity?: string;
    formatted_address?: string;
    geometry: { location: { lat: number; lng: number } };
    types?: string[];
  }>;
  next_page_token?: string;
}

export async function getBusinessesInGeofence(
  origin: { lat: number; lng: number },
  radiusMiles: number,
  opts?: { typeHint?: string; maxPages?: number }
): Promise<BusinessRecord[]> {
  const maxPages = opts?.maxPages ?? 3;
  const radiusMeters = radiusMilesToMeters(radiusMiles);
  const collected: BusinessRecord[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const params: Record<string, string | number | boolean> = {
      location: `${origin.lat},${origin.lng}`,
      radius: radiusMeters,
      opennow: false,
      key: process.env.GOOGLE_PLACES_API_KEY || ""
    };
    if (opts?.typeHint) params.type = opts.typeHint;
    if (pageToken) params.pagetoken = pageToken;

    // Placeholder: call via Vertex AI Extension named ext-google-places
    const url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
    const { data } = await axios.get<PlacesNearbyResponse>(url, { params });

    for (const r of data.results) {
      const address = r.formatted_address ?? r.vicinity ?? "";
      const types = r.types ?? [];
      const coords = r.geometry.location;
      collected.push({
        placeId: r.place_id,
        name: r.name,
        address,
        coordinates: coords,
        primaryCategory: types[0] ?? "unknown",
        types,
        mapUrl: mapUrl(coords)
      });
    }

    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }

  // Dedupe by placeId
  const seen = new Set<string>();
  return collected.filter(b => (seen.has(b.placeId) ? false : (seen.add(b.placeId), true)));
}

