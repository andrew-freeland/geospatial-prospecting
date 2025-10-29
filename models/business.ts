export interface BusinessRecord {
  placeId: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  primaryCategory: string;
  types: string[];
  mapUrl: string;
}

