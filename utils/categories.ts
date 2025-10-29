export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  restaurant: ["restaurant", "meal_takeaway", "food"],
  salon: ["beauty_salon", "hair_care"],
  bar: ["bar", "night_club"]
};

export function normalizeCategory(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesExcluded(types: string[], excluded: string[]): boolean {
  const typeSet = new Set(types.map(normalizeCategory));
  for (const raw of excluded) {
    const key = normalizeCategory(raw);
    const synonyms = new Set([key, ...(CATEGORY_SYNONYMS[key] || [])].map(normalizeCategory));
    for (const t of synonyms) {
      if (typeSet.has(t)) return true;
    }
  }
  return false;
}

