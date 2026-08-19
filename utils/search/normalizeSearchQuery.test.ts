import { describe, expect, test } from "bun:test";
import {
  allowedTypoDistance,
  buildFallbackSearchTerm,
  isConfidentFallbackMatch,
  levenshteinDistance,
  normalizeSearchCompact,
  normalizeSearchWords,
  scoreTitleMatch,
} from "./normalizeSearchQuery";

describe("normalizeSearchCompact", () => {
  test.each([
    ["Spider-Man", "spiderman"],
    ["Spider Man", "spiderman"],
    ["spiderman", "spiderman"],
    ["SPIDER-MAN", "spiderman"],
    ["spider_man", "spiderman"],
    ["Mission: Impossible", "missionimpossible"],
    ["mission impossible", "missionimpossible"],
    ["Wall-E", "walle"],
    ["walle", "walle"],
    ["wall e", "walle"],
    ["X-Men", "xmen"],
    ["xmen", "xmen"],
    ["x men", "xmen"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeSearchCompact(input)).toBe(expected);
  });

  test("strips accents", () => {
    expect(normalizeSearchCompact("Amélie")).toBe("amelie");
  });
});

describe("normalizeSearchWords", () => {
  test("keeps word boundaries, folds punctuation to spaces", () => {
    expect(normalizeSearchWords("Spider-Man")).toBe("spider man");
    expect(normalizeSearchWords("Mission: Impossible")).toBe(
      "mission impossible",
    );
    expect(normalizeSearchWords("  extra   spaces  ")).toBe("extra spaces");
  });
});

describe("levenshteinDistance", () => {
  test("identical strings", () => {
    expect(levenshteinDistance("abc", "abc")).toBe(0);
  });
  test("one substitution/insertion/deletion", () => {
    expect(levenshteinDistance("interstelar", "interstellar")).toBe(1);
    expect(levenshteinDistance("cat", "cot")).toBe(1);
    expect(levenshteinDistance("cat", "cats")).toBe(1);
  });
  test("transposition costs two edits (no transposition shortcut)", () => {
    expect(levenshteinDistance("oppenhiemer", "oppenheimer")).toBe(2);
  });
  test("empty string", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });
});

describe("allowedTypoDistance", () => {
  test("scales with query length", () => {
    expect(allowedTypoDistance(3)).toBe(0);
    expect(allowedTypoDistance(6)).toBe(1);
    expect(allowedTypoDistance(10)).toBe(2);
  });
});

describe("buildFallbackSearchTerm", () => {
  test("multi-word query uses the longest word", () => {
    expect(buildFallbackSearchTerm("mission impossible")).toBe("impossible");
    expect(buildFallbackSearchTerm("x men")).toBe("men");
  });
  test("compact single-token query uses a scaled prefix", () => {
    expect(buildFallbackSearchTerm("spiderman")).toBe("spider");
    expect(buildFallbackSearchTerm("oppenhiemer")).toBe("oppenhi");
  });
  test("too-short query returns null (would match too broadly)", () => {
    expect(buildFallbackSearchTerm("it")).toBeNull();
    expect(buildFallbackSearchTerm("")).toBeNull();
  });
});

describe("scoreTitleMatch — ranking ladder", () => {
  test("normalized exact match beats everything", () => {
    expect(scoreTitleMatch("spiderman", ["Spider-Man"])).toBe(100);
    expect(scoreTitleMatch("Spider Man", ["Spider-Man"])).toBe(100);
    expect(scoreTitleMatch("SPIDER-MAN", ["Spider-Man"])).toBe(100);
  });

  test("mission: impossible variants all resolve to a strong match", () => {
    expect(scoreTitleMatch("mission impossible", ["Mission: Impossible"])).toBe(
      100,
    );
  });

  test("wall-e variants all resolve to a strong match", () => {
    expect(scoreTitleMatch("walle", ["Wall-E"])).toBe(100);
    expect(scoreTitleMatch("wall e", ["Wall-E"])).toBe(100);
  });

  test("x-men variants all resolve to a strong match", () => {
    expect(scoreTitleMatch("xmen", ["X-Men"])).toBe(100);
    expect(scoreTitleMatch("x men", ["X-Men"])).toBe(100);
  });

  test("exact series match ranks above a sequel/spinoff title", () => {
    const alien = scoreTitleMatch("alien", ["Alien"]);
    const covenant = scoreTitleMatch("alien", ["Alien: Covenant"]);
    expect(alien).toBeGreaterThan(covenant);
    expect(covenant).toBeGreaterThan(0);
  });

  test("prefix match ranks above a weaker substring match", () => {
    const startsWith = scoreTitleMatch("Interstellar", [
      "Interstellar: Nolan Retrospective",
    ]);
    const substring = scoreTitleMatch("Stellar", ["Interstellar"]);
    expect(startsWith).toBeGreaterThan(substring);
  });

  test("unrelated titles do not falsely match", () => {
    expect(scoreTitleMatch("spiderman", ["The Amazing World of Gumball"])).toBe(
      0,
    );
    expect(scoreTitleMatch("breaking bad", ["Better Call Saul"])).toBe(0);
  });

  test("an episode title unrelated to its series name doesn't inherit the series' score", () => {
    // Ozymandias (Breaking Bad S05E14) — searching "breaking bad" should not
    // rank the episode highly off its own Name alone.
    expect(scoreTitleMatch("breaking bad", ["Ozymandias"])).toBe(0);
  });

  test("lightweight typo tolerance", () => {
    expect(scoreTitleMatch("spidrman", ["Spider-Man"])).toBeGreaterThan(0);
    expect(scoreTitleMatch("interstelar", ["Interstellar"])).toBeGreaterThan(0);
    expect(scoreTitleMatch("oppenhiemer", ["Oppenheimer"])).toBeGreaterThan(0);
  });

  test("checks every provided name variant and keeps the best score", () => {
    expect(scoreTitleMatch("spiderman", [null, undefined, "Spider-Man"])).toBe(
      100,
    );
  });

  test("empty query never matches", () => {
    expect(scoreTitleMatch("", ["Spider-Man"])).toBe(0);
    expect(scoreTitleMatch("   ", ["Spider-Man"])).toBe(0);
  });
});

describe("isConfidentFallbackMatch", () => {
  test("accepts a real match found via a loosened fallback term", () => {
    expect(isConfidentFallbackMatch("spiderman", ["Spider-Man"])).toBe(true);
  });
  test("rejects an unrelated title that happened to share the fallback prefix", () => {
    expect(isConfidentFallbackMatch("spiderman", ["Spider Baby (1967)"])).toBe(
      false,
    );
  });
});
