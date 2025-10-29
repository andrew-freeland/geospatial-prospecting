import { RouteList } from "../models/route";

export function formatOutput(route: RouteList): {
  headers: string[];
  rows: (string | number)[][];
} {
  const headers = ["#", "Business Name", "Address", "Map Link", "ETA to Next", "Distance to Next"];
  const rows: (string | number)[][] = route.stops.map((s) => [
    s.stopNumber,
    s.name,
    s.address,
    s.mapUrl,
    "", // ETA to next - computed from legs if needed in future enhancement
    ""  // Distance to next
  ]);
  return { headers, rows };
}

