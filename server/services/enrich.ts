import axios from "axios";

// Enriches business records with Google Places Details (phone, website).
// Input: array of objects that each contain a placeId.
// Output: new array with the same objects plus optional fields:
// - formattedPhoneNumber
// - internationalPhoneNumber
// - website
export async function enrichBusinesses(businesses: any[]) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
  if (!apiKey) return businesses;

  const results = [];
  for (const b of businesses) {
    const enriched = { ...b };
    try {
      if (b.placeId) {
        const url = "https://maps.googleapis.com/maps/api/place/details/json";
        const params = {
          place_id: b.placeId,
          fields: "formatted_phone_number,international_phone_number,website",
          key: apiKey
        };
        const { data } = await axios.get(url, { params, timeout: 10000 });
        const details = data?.result || {};
        if (details.formatted_phone_number) enriched.formattedPhoneNumber = details.formatted_phone_number;
        if (details.international_phone_number) enriched.internationalPhoneNumber = details.international_phone_number;
        if (details.website) enriched.website = details.website;
        console.log("Details API ok:", b.placeId, {
          phone: details.formatted_phone_number || details.international_phone_number || null,
          website: details.website || null
        });
      }
    } catch (err: any) {
      console.warn("Details API failed:", b.placeId, err?.message || err);
    }

    results.push(enriched);

    // Gentle pacing to reduce quota errors
    await new Promise((r) => setTimeout(r, 200));
  }
  return results;
}


