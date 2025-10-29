import { BusinessRecord } from "../models/business";
import { matchesExcluded, normalizeCategory } from "../utils/categories";

export function filterByCategory(
  records: BusinessRecord[],
  excluded: string[]
): BusinessRecord[] {
  if (!excluded || excluded.length === 0) return records;
  const ex = excluded.map(normalizeCategory);
  return records.filter(r => !matchesExcluded(r.types, ex) && !ex.includes(normalizeCategory(r.primaryCategory)));
}

