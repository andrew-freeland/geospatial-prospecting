import { parseLatLng } from "./coords";

export interface GeocodeResult { lat: number; lng: number; label?: string }

// Optional: If input is already lat,lng returns coordinates; otherwise placeholder to use an Extension
export async function geocode(input: string): Promise<GeocodeResult> {
  const parsed = parseLatLng(input);
  if (parsed) return { ...parsed, label: input };
  // Placeholder: in production, call a Geocoding/Text Search extension to resolve address
  throw new Error("Geocoding not implemented: expected lat,lng for MVP scaffold");
}

