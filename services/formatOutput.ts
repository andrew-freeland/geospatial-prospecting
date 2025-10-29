import { RouteList } from "../models/route";

export function formatOutput(route: RouteList): {
  headers: string[];
  rows: (string | number)[][];
} {
  const headers = [
    "#",
    "Business Name",
    "Address",
    "Phone",
    "Website",
    "Map URL",
    "ETA to Next",
    "Distance to Next"
  ];
  const rows: (string | number)[][] = route.stops.map((s) => [
    s.stopNumber,
    s.name,
    s.address,
    s.formattedPhoneNumber || s.internationalPhoneNumber || "",
    s.website || "",
    s.mapUrl,
    "", // ETA to next - placeholder
    ""  // Distance to next - placeholder
  ]);
  return { headers, rows };
}

