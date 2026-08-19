import { describe, expect, test } from "bun:test";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { buildTopResults, mergeAndRankCategory } from "./rankSearchResults";

const item = (patch: Partial<BaseItemDto>): BaseItemDto =>
  ({
    Id: patch.Name,
    Type: "Movie",
    ...patch,
  }) as BaseItemDto;

describe("mergeAndRankCategory", () => {
  test("ranks primary results by relevance", () => {
    const primary = [
      item({ Id: "1", Name: "Alien: Covenant" }),
      item({ Id: "2", Name: "Alien" }),
    ];
    const ranked = mergeAndRankCategory("alien", "Movie", primary, undefined);
    expect(ranked.map((s) => s.item.Id)).toEqual(["2", "1"]);
  });

  test("dedupes an item that appears in both primary and fallback", () => {
    const primary = [item({ Id: "1", Name: "Spider-Man" })];
    const fallback = [
      item({ Id: "1", Name: "Spider-Man", Type: "Movie" }),
      item({ Id: "2", Name: "Spider-Man 2", Type: "Movie" }),
    ];
    const ranked = mergeAndRankCategory(
      "spiderman",
      "Movie",
      primary,
      fallback,
    );
    expect(ranked).toHaveLength(2);
    expect(ranked.map((s) => s.item.Id).sort()).toEqual(["1", "2"]);
  });

  test("rescues a real match the primary Jellyfin request missed", () => {
    // Primary Jellyfin search for "spiderman" (no punctuation) returns
    // nothing — the literal substring match fails against "Spider-Man".
    const fallback = [item({ Id: "1", Name: "Spider-Man", Type: "Movie" })];
    const ranked = mergeAndRankCategory(
      "spiderman",
      "Movie",
      undefined,
      fallback,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].item.Id).toBe("1");
    expect(ranked[0].score).toBe(100);
  });

  test("rejects a fallback candidate that only shares the loosened prefix", () => {
    const fallback = [
      item({ Id: "1", Name: "Spider Baby (1967)", Type: "Movie" }),
    ];
    const ranked = mergeAndRankCategory(
      "spiderman",
      "Movie",
      undefined,
      fallback,
    );
    expect(ranked).toHaveLength(0);
  });

  test("only keeps fallback candidates matching the requested type", () => {
    const fallback = [
      item({ Id: "1", Name: "Spider-Man", Type: "Series" }), // wrong bucket
    ];
    const ranked = mergeAndRankCategory(
      "spiderman",
      "Movie",
      undefined,
      fallback,
    );
    expect(ranked).toHaveLength(0);
  });

  test("an episode never inherits its series' relevance score", () => {
    const episodes = [
      item({
        Id: "e1",
        Name: "Ozymandias",
        Type: "Episode",
        SeriesName: "Breaking Bad",
      }),
      item({
        Id: "e2",
        Name: "Felina",
        Type: "Episode",
        SeriesName: "Breaking Bad",
      }),
    ];
    const ranked = mergeAndRankCategory(
      "breaking bad",
      "Episode",
      episodes,
      undefined,
    );
    expect(ranked.every((s) => s.score === 0)).toBe(true);
  });

  test("an episode title search still finds the episode by its own name", () => {
    const episodes = [
      item({
        Id: "e1",
        Name: "Ozymandias",
        Type: "Episode",
        SeriesName: "Breaking Bad",
      }),
    ];
    const ranked = mergeAndRankCategory(
      "Ozymandias",
      "Episode",
      episodes,
      undefined,
    );
    expect(ranked[0].score).toBe(100);
  });
});

describe("buildTopResults", () => {
  test("merges and ranks across categories, capped and non-matches excluded", () => {
    const movies = mergeAndRankCategory(
      "breaking bad",
      "Movie",
      [
        item({
          Id: "m1",
          Name: "El Camino: A Breaking Bad Movie",
          Type: "Movie",
        }),
      ],
      undefined,
    );
    const series = mergeAndRankCategory(
      "breaking bad",
      "Series",
      [item({ Id: "s1", Name: "Breaking Bad", Type: "Series" })],
      undefined,
    );
    const episodes = mergeAndRankCategory(
      "breaking bad",
      "Episode",
      [
        item({ Id: "e1", Name: "Ozymandias", Type: "Episode" }),
        item({ Id: "e2", Name: "Felina", Type: "Episode" }),
      ],
      undefined,
    );

    const top = buildTopResults([movies, series, episodes], 5);

    // The Series itself ranks first (exact normalized match), the movie
    // second (starts-with match) — the unrelated episodes (score 0) are
    // excluded entirely rather than flooding the row.
    expect(top.map((i) => i.Id)).toEqual(["s1", "m1"]);
  });

  test("respects the limit", () => {
    const movies = mergeAndRankCategory(
      "man",
      "Movie",
      [
        item({ Id: "1", Name: "Man" }),
        item({ Id: "2", Name: "Man of Steel" }),
        item({ Id: "3", Name: "Iron Man" }),
      ],
      undefined,
    );
    const top = buildTopResults([movies], 2);
    expect(top).toHaveLength(2);
  });
});
