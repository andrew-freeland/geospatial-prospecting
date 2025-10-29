export interface GeofenceInputs {
  location: string; // "1600 Amphitheatre Pkwy..." or "37.42,-122.08"
  radius_miles?: number; // default 5, min 2, max 10
  excluded_categories?: string[]; // ["restaurant", "salon"]
  output?: "sheet" | "csv" | "both"; // default "sheet"
  deliver?: "slack" | "email" | "auto"; // default "auto"
  email?: string; // if deliver=email
  slack_recipient?: string; // user or channel
  test_mode?: boolean; // use fixtures
}

