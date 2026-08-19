/**
 * Punctuation/spacing-insensitive search matching (Phase 4.5).
 *
 * Jellyfin's own `searchTerm` matching is a literal, case-insensitive
 * substring match against item metadata — it does not strip or normalize
 * punctuation. "spiderman" is never a literal substring of "Spider-Man"
 * (the hyphen breaks the run of characters), so a query typed without the
 * server's exact punctuation can silently return nothing. Nothing here
 * replaces Jellyfin's own search — these are pure, local functions used to
 * (a) build one bounded fallback query when the primary Jellyfin request
 * comes back sparse, and (b) rank/filter the bounded candidate set Jellyfin
 * returns. No full-library scan, no external search service.
 */

/** Lowercase, Unicode-decompose, strip diacritics — shared first step for
 * both normalization variants below. */
const COMBINING_DIACRITICS_RE = /[\u0300-\u036f]/g;

const foldCase = (input: string): string =>
  input.normalize("NFKD").replace(COMBINING_DIACRITICS_RE, "").toLowerCase();

/**
 * Collapses a title down to a bare run of letters/digits — the
 * representation used to decide whether two titles are "the same query"
 * regardless of punctuation or spacing.
 *
 * "Spider-Man" / "Spider Man" / "SPIDER_MAN" / "spiderman" all normalize to
 * "spiderman".
 */
export const normalizeSearchCompact = (input: string): string =>
  foldCase(input).replace(/[^a-z0-9]+/g, "");

/**
 * Collapses punctuation to single spaces instead of removing it, so word
 * boundaries survive — used for "starts with a word" scoring, where
 * "spider-man" and "spider man" should both count as starting with the
 * word "spider" (mission-impossible : "starts with 'mission'").
 */
export const normalizeSearchWords = (input: string): string =>
  foldCase(input)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

/**
 * Bounded (no recursion, string lengths here are always short titles/
 * queries) Levenshtein edit distance — used only to score candidates
 * Jellyfin already returned, never to search a whole library.
 */
export const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 0; i < a.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const insertCost = currentRow[j] + 1;
      const deleteCost = previousRow[j + 1] + 1;
      const substituteCost = previousRow[j] + (a[i] === b[j] ? 0 : 1);
      currentRow.push(Math.min(insertCost, deleteCost, substituteCost));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length];
};

/**
 * How many edits are tolerated as "still probably a typo of this query,"
 * scaled to query length so a 4-letter query doesn't match half the
 * library and a 12-letter query still tolerates a couple of slips
 * ("interstelar" -> "interstellar" is 1 edit, "oppenhiemer" -> "oppenheimer"
 * is 2 edits via transposition).
 */
export const allowedTypoDistance = (queryLength: number): number => {
  if (queryLength < 5) return 0;
  if (queryLength < 8) return 1;
  return 2;
};

/**
 * A single title/query pick used to compute a fallback searchTerm to send
 * to Jellyfin when the primary query returns too little: the longest word
 * in a multi-word query (a broader net than the full AND-of-all-words
 * query Jellyfin would otherwise run), or a length-scaled prefix of a
 * single compact token (a query with no separators at all, like
 * "spiderman" or a typo like "oppenhiemer") — long enough to stay specific,
 * short enough to still be a literal substring of the real (punctuated)
 * title even though the query itself doesn't have the punctuation.
 *
 * Returns null when the query is too short to safely prefix (would match
 * too broadly) — callers should skip the fallback request in that case.
 */
export const buildFallbackSearchTerm = (rawQuery: string): string | null => {
  const words = rawQuery.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.reduce((longest, word) =>
      word.length > longest.length ? word : longest,
    );
  }

  const compact = normalizeSearchCompact(rawQuery);
  if (compact.length < 4) return null;

  const prefixLength = Math.min(
    compact.length,
    Math.max(3, Math.ceil(compact.length * 0.6)),
  );
  return compact.slice(0, prefixLength);
};

/**
 * Relevance score for one candidate against the user's query, checked
 * against every provided name variant (e.g. an item's Name and
 * OriginalTitle) and the best score kept. Higher is better; 0 means "no
 * meaningful match" (the ranking ladder from Phase 4.5 §6, plus the
 * lightweight typo tolerance from §7 folded into the same pass so a
 * caller doesn't need a second scoring function).
 *
 * This never decides whether Jellyfin returns an item — it only orders
 * (and, for fallback candidates, filters — see filterFallbackCandidates
 * below) items Jellyfin already returned from a bounded request.
 */
export const scoreTitleMatch = (
  query: string,
  candidateNames: Array<string | null | undefined>,
): number => {
  const rawQuery = query.trim();
  if (!rawQuery) return 0;

  const normalizedQuery = normalizeSearchCompact(rawQuery);
  if (!normalizedQuery) return 0;

  let best = 0;

  for (const name of candidateNames) {
    if (!name) continue;
    const normalizedName = normalizeSearchCompact(name);
    if (!normalizedName) continue;

    if (normalizedName === normalizedQuery) {
      return 100; // Normalized exact match — nothing beats this.
    }
    if (name.trim().toLowerCase() === rawQuery.toLowerCase()) {
      best = Math.max(best, 95); // Literal case-insensitive exact match.
    }
    if (normalizedName.startsWith(normalizedQuery)) {
      best = Math.max(best, 80); // Title starts with the query.
    }
    if (
      normalizeSearchWords(name)
        .split(" ")
        .some((word) => word.startsWith(normalizeSearchWords(rawQuery)))
    ) {
      best = Math.max(best, 65); // A whole word starts with the query.
    }
    if (normalizedName.includes(normalizedQuery)) {
      best = Math.max(best, 50); // Query appears anywhere in the title.
    }

    // Lightweight typo tolerance: compare the query against a same-length
    // window of the candidate rather than the whole title, so a short
    // query doesn't get penalized for a long, otherwise-irrelevant tail.
    const window = normalizedName.slice(0, normalizedQuery.length + 2);
    const distance = levenshteinDistance(normalizedQuery, window);
    if (distance <= allowedTypoDistance(normalizedQuery.length)) {
      best = Math.max(best, 42 - distance * 8); // Weaker than a real substring match.
    }
  }

  return best;
};

/**
 * Strict filter applied only to candidates retrieved via the fallback
 * searchTerm (§5) — that request used a shortened/loosened term, so its
 * results need confirming against the *original* full query before being
 * trusted, otherwise a short prefix like "spid" could pull in unrelated
 * titles that happen to share it.
 */
export const isConfidentFallbackMatch = (
  query: string,
  candidateNames: Array<string | null | undefined>,
): boolean => scoreTitleMatch(query, candidateNames) >= 40;
