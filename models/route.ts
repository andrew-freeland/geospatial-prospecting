import { BusinessRecord } from "./business";

export interface RouteList {
  origin: { lat: number; lng: number; label?: string };
  stops: Array<BusinessRecord & { stopNumber: number }>;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

