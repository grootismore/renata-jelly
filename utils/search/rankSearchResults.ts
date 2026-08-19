import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import {
  isConfidentFallbackMatch,
  scoreTitleMatch,
} from "./normalizeSearchQuery";

export interface ScoredSearchItem {
  item: BaseItemDto;
  score: number;
}

/**
 * Name variants checked for a relevance score. Deliberately excludes
 * SeriesName for episodes: an episode should rank on its *own* title
 * ("Ozymandias" -> the Ozymandias episode), never inherit its parent
 * series' score, or a search for "Breaking Bad" would flood the results
 * with every episode of the show ahead of the series itself (Phase 4.5
 * §11/§14).
 */
const nameVariants = (item: BaseItemDto): Array<string | null | undefined> => [
  item.Name,
  item.OriginalTitle,
];

/**
 * Merges a primary Jellyfin result set with a bounded fallback result set
 * (see buildFallbackSearchTerm) for one item type, dedupes by item Id, and
 * scores everything by relevance to the *original* query. Primary results
 * are always kept — Jellyfin already decided they matched the literal
 * query. Fallback results came from a loosened searchTerm, so each one is
 * only kept if it passes a strict recheck against the real query first
 * (isConfidentFallbackMatch) — otherwise a short fallback prefix like
 * "spid" could pull in unrelated titles that merely share it.
 */
export const mergeAndRankCategory = (
  query: string,
  type: BaseItemDto["Type"],
  primary: BaseItemDto[] | undefined,
  fallback: BaseItemDto[] | undefined,
): ScoredSearchItem[] => {
  const seen = new Set<string>();
  const scored: ScoredSearchItem[] = [];

  for (const item of primary ?? []) {
    if (!item.Id || seen.has(item.Id)) continue;
    seen.add(item.Id);
    scored.push({ item, score: scoreTitleMatch(query, nameVariants(item)) });
  }

  for (const item of fallback ?? []) {
    if (item.Type !== type || !item.Id || seen.has(item.Id)) continue;
    if (!isConfidentFallbackMatch(query, nameVariants(item))) continue;
    seen.add(item.Id);
    scored.push({ item, score: scoreTitleMatch(query, nameVariants(item)) });
  }

  return scored.sort((a, b) => b.score - a.score);
};

/**
 * Builds the cross-type "Top Results" row from already-ranked per-type
 * lists — the highest-scoring items across every provided category,
 * capped, excluding non-matches (score 0). A strong Series/Movie match
 * naturally sorts above episode results here because episodes never score
 * on their series' name (see nameVariants above) — no special-casing
 * needed to keep a Series search from being flooded by its own episodes.
 */
export const buildTopResults = (
  categories: ScoredSearchItem[][],
  limit: number,
): BaseItemDto[] =>
  categories
    .flat()
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
