export interface LatLng { lat: number; lng: number }

export function parseLatLng(input: string): LatLng | null {
  const parts = input.split(",").map(s => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function radiusMilesToMeters(miles: number): number {
  return Math.round(miles * 1609.34);
}

export function mapUrl({ lat, lng }: LatLng): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

