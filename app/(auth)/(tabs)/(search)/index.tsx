import type {
  BaseItemDto,
  BaseItemKind,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useLocalSearchParams, useNavigation, useSegments } from "expo-router";
import { useAtom } from "jotai";
import { orderBy, uniqBy } from "lodash";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ContinueWatchingPoster from "@/components/ContinueWatchingPoster";
import { EmptyState } from "@/components/common/EmptyState";
import { ItemImage } from "@/components/common/ItemImage";
import { Text } from "@/components/common/Text";
import {
  getItemNavigation,
  TouchableItemRouter,
} from "@/components/common/TouchableItemRouter";
import { ItemCardText } from "@/components/ItemCardText";
import {
  JellyseerrSearchSort,
  JellyserrIndexPage,
} from "@/components/jellyseerr/JellyseerrIndexPage";
import { ItemPoster } from "@/components/posters/ItemPoster";
import { DiscoverFilters } from "@/components/search/DiscoverFilters";
import { LoadingSkeleton } from "@/components/search/LoadingSkeleton";
import { SearchItemWrapper } from "@/components/search/SearchItemWrapper";
import { SearchTabButtons } from "@/components/search/SearchTabButtons";
import { TVSearchPage } from "@/components/search/TVSearchPage";
import { TextColor } from "@/constants/theme";
import useRouter from "@/hooks/useAppRouter";
import { useJellyseerr } from "@/hooks/useJellyseerr";
import { useTVItemActionModal } from "@/hooks/useTVItemActionModal";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { useSettings } from "@/utils/atoms/settings";
import { getIntegrationHeaders } from "@/utils/customHeaders";
import { isAbortLikeError } from "@/utils/errors";
import { eventBus } from "@/utils/eventBus";
import { MediaType } from "@/utils/jellyseerr/server/constants/media";
import type {
  MovieResult,
  PersonResult,
  TvResult,
} from "@/utils/jellyseerr/server/models/Search";
import { logAndCaptureError } from "@/utils/log";
import { buildFallbackSearchTerm } from "@/utils/search/normalizeSearchQuery";
import {
  buildTopResults,
  mergeAndRankCategory,
} from "@/utils/search/rankSearchResults";
import { createStreamystatsApi } from "@/utils/streamystats";

type SearchType = "Library" | "Discover";

// Smart-search tuning (Phase 4.5) — kept together and named so the request
// budget documented in RENATA_DEVLOG.md stays easy to verify against the code.
/** Primary Movie/Series/Episode requests: bumped from the original 10 so
 * local ranking (§6) has enough candidates to work with — still one
 * request per category, unchanged count. */
const PRIMARY_VIDEO_LIMIT = 20;
/** Combined Movie+Series+Episode result count below which the one bounded
 * fallback request (§5) fires. */
const FALLBACK_TRIGGER_THRESHOLD = 3;
/** Result cap for the single fallback request. */
const FALLBACK_LIMIT = 30;
/** Max items shown in the cross-type "Top Results" row (§9). */
const TOP_RESULTS_LIMIT = 5;

const exampleSearches = [
  "Lord of the rings",
  "Avengers",
  "Game of Thrones",
  "Breaking Bad",
  "Stranger Things",
  "The Mandalorian",
];

export default function SearchPage() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showItemActions } = useTVItemActionModal();
  const segments = useSegments();
  const from = (segments as string[])[2] || "(search)";

  const [user] = useAtom(userAtom);

  const { t } = useTranslation();

  const searchFilterId = useId();
  const orderFilterId = useId();

  const { q } = params as { q: string };

  const [searchType, setSearchType] = useState<SearchType>("Library");
  const [search, setSearch] = useState<string>("");

  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timeout);
  }, [search]);

  const [api] = useAtom(apiAtom);

  const { settings } = useSettings();
  const { jellyseerrApi } = useJellyseerr();
  const [jellyseerrOrderBy, setJellyseerrOrderBy] =
    useState<JellyseerrSearchSort>(
      JellyseerrSearchSort[
        JellyseerrSearchSort.DEFAULT
      ] as unknown as JellyseerrSearchSort,
    );
  const [jellyseerrSortOrder, setJellyseerrSortOrder] = useState<
    "asc" | "desc"
  >("desc");

  const searchEngine = useMemo(() => {
    return settings?.searchEngine || "Jellyfin";
  }, [settings]);

  useEffect(() => {
    if (q && q.length > 0) {
      setSearch(q);
    }
  }, [q]);

  const searchFn = useCallback(
    async ({
      types,
      query,
      signal,
      limit = 10,
    }: {
      types: BaseItemKind[];
      query: string;
      signal?: AbortSignal;
      limit?: number;
    }): Promise<BaseItemDto[]> => {
      if (!api || !query) {
        return [];
      }

      try {
        if (searchEngine === "Jellyfin") {
          const searchApi = await getItemsApi(api).getItems(
            {
              searchTerm: query,
              limit,
              includeItemTypes: types,
              recursive: true,
              userId: user?.Id,
            },
            { signal },
          );

          return (searchApi.data.Items as BaseItemDto[]) || [];
        }

        if (searchEngine === "Streamystats") {
          if (!settings?.streamyStatsServerUrl || !api.accessToken) {
            return [];
          }

          const streamyStatsApi = createStreamystatsApi({
            serverUrl: settings.streamyStatsServerUrl,
            jellyfinToken: api.accessToken,
          });

          const typeMap: Record<BaseItemKind, string> = {
            Movie: "movies",
            Series: "series",
            Episode: "episodes",
            Person: "actors",
            BoxSet: "movies",
            Audio: "audio",
          } as Record<BaseItemKind, string>;

          const searchType = types.length === 1 ? typeMap[types[0]] : "media";
          const response = await streamyStatsApi.searchIds(
            query,
            searchType as "movies" | "series" | "episodes" | "actors" | "media",
            limit,
            signal,
          );

          const allIds: string[] = [
            ...(response.data.movies || []),
            ...(response.data.series || []),
            ...(response.data.episodes || []),
            ...(response.data.actors || []),
            ...(response.data.audio || []),
          ];

          if (!allIds.length) {
            return [];
          }

          const itemsResponse = await getItemsApi(api).getItems(
            {
              ids: allIds,
              enableImageTypes: ["Primary", "Backdrop", "Thumb"],
            },
            { signal },
          );

          return (itemsResponse.data.Items as BaseItemDto[]) || [];
        }

        // Marlin search
        if (!settings?.marlinServerUrl) {
          return [];
        }

        const url = `${settings.marlinServerUrl}/search?q=${encodeURIComponent(query)}&includeItemTypes=${types
          .map((type) => encodeURIComponent(type))
          .join("&includeItemTypes=")}`;

        const response1 = await axios.get(url, {
          signal,
          headers: getIntegrationHeaders("marlin"),
        });

        const ids = response1.data.ids;

        if (!ids?.length) {
          return [];
        }

        const response2 = await getItemsApi(api).getItems(
          {
            ids,
            enableImageTypes: ["Primary", "Backdrop", "Thumb"],
          },
          { signal },
        );

        return (response2.data.Items as BaseItemDto[]) || [];
      } catch (error) {
        // Aborted requests are routine; anything else used to render as
        // "no results" with no trace of the failure.
        if (!isAbortLikeError(error)) {
          logAndCaptureError("Search request failed", error);
        }
        return [];
      }
    },
    [api, searchEngine, settings, user?.Id],
  );

  // Separate search function for music types - always uses Jellyfin since Streamystats doesn't support music
  const jellyfinSearchFn = useCallback(
    async ({
      types,
      query,
      signal,
    }: {
      types: BaseItemKind[];
      query: string;
      signal?: AbortSignal;
    }): Promise<BaseItemDto[]> => {
      if (!api || !query) {
        return [];
      }

      try {
        const searchApi = await getItemsApi(api).getItems(
          {
            searchTerm: query,
            limit: 10,
            includeItemTypes: types,
            recursive: true,
            userId: user?.Id,
          },
          { signal },
        );

        return (searchApi.data.Items as BaseItemDto[]) || [];
      } catch (error) {
        if (!isAbortLikeError(error)) {
          logAndCaptureError("Music search request failed", error);
        }
        return [];
      }
    },
    [api, user?.Id],
  );

  type HeaderSearchBarRef = {
    focus: () => void;
    blur: () => void;
    setText: (text: string) => void;
    clearText: () => void;
    cancelSearch: () => void;
  };

  const searchBarRef = useRef<HeaderSearchBarRef>(null);
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        ref: searchBarRef,
        placeholder: t("search.search"),
        onChangeText: (e: any) => {
          router.setParams({ q: "" });
          setSearch(e.nativeEvent.text);
        },
        hideWhenScrolling: false,
        autoFocus: false,
        // Android: color of the user-typed text (was dark and unreadable on the dark header)
        textColor: "#fff",
        // Android: placeholder and icon color
        hintTextColor: "#fff",
        headerIconColor: "#fff",
      },
    });
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = eventBus.on("searchTabPressed", () => {
      // Screen not active
      if (!searchBarRef.current) {
        return;
      }
      // Screen is active, focus search bar
      searchBarRef.current?.focus();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const { data: movies, isFetching: l1 } = useQuery({
    queryKey: ["search", "movies", debouncedSearch],
    queryFn: ({ signal }) =>
      searchFn({
        query: debouncedSearch,
        types: ["Movie"],
        signal,
        limit: PRIMARY_VIDEO_LIMIT,
      }),
    enabled: searchType === "Library" && debouncedSearch.length > 0,
  });

  const { data: series, isFetching: l2 } = useQuery({
    queryKey: ["search", "series", debouncedSearch],
    queryFn: ({ signal }) =>
      searchFn({
        query: debouncedSearch,
        types: ["Series"],
        signal,
        limit: PRIMARY_VIDEO_LIMIT,
      }),
    enabled: searchType === "Library" && debouncedSearch.length > 0,
  });

  const { data: episodes, isFetching: l3 } = useQuery({
    queryKey: ["search", "episodes", debouncedSearch],
    queryFn: ({ signal }) =>
      searchFn({
        query: debouncedSearch,
        types: ["Episode"],
        signal,
        limit: PRIMARY_VIDEO_LIMIT,
      }),
    enabled: searchType === "Library" && debouncedSearch.length > 0,
  });

  // Smart-search fallback (Phase 4.5): Jellyfin's searchTerm is a literal
  // substring match — "spiderman" is never a substring of "Spider-Man" — so
  // a query that comes back sparse gets ONE extra, bounded request using a
  // loosened term (buildFallbackSearchTerm: the longest word of a
  // multi-word query, or a length-scaled prefix of a single compact
  // token/typo). Its candidates are only trusted after a strict local
  // recheck against the *original* query (isConfidentFallbackMatch inside
  // mergeAndRankCategory) — this never bypasses Jellyfin, it only asks it a
  // second, broader question when the first answer looked wrong. Only for
  // the base Jellyfin engine — Streamystats/Marlin already do their own
  // stronger relevance matching (§18), so this would be redundant there.
  const primaryVideoCount =
    (movies?.length ?? 0) + (series?.length ?? 0) + (episodes?.length ?? 0);
  const primaryVideoSettled = !l1 && !l2 && !l3;
  const fallbackTerm = useMemo(
    () => buildFallbackSearchTerm(debouncedSearch),
    [debouncedSearch],
  );
  const shouldTryFallback =
    searchEngine === "Jellyfin" &&
    searchType === "Library" &&
    debouncedSearch.length > 0 &&
    primaryVideoSettled &&
    primaryVideoCount < FALLBACK_TRIGGER_THRESHOLD &&
    !!fallbackTerm &&
    fallbackTerm.toLowerCase() !== debouncedSearch.trim().toLowerCase();

  const { data: fallbackVideoItems } = useQuery({
    queryKey: ["search", "fallback-video", fallbackTerm],
    queryFn: ({ signal }) =>
      searchFn({
        query: fallbackTerm ?? "",
        types: ["Movie", "Series", "Episode"],
        signal,
        limit: FALLBACK_LIMIT,
      }),
    enabled: shouldTryFallback,
  });

  const rankedMovies = useMemo(
    () =>
      mergeAndRankCategory(
        debouncedSearch,
        "Movie",
        movies,
        fallbackVideoItems,
      ),
    [debouncedSearch, movies, fallbackVideoItems],
  );
  const rankedSeries = useMemo(
    () =>
      mergeAndRankCategory(
        debouncedSearch,
        "Series",
        series,
        fallbackVideoItems,
      ),
    [debouncedSearch, series, fallbackVideoItems],
  );
  const rankedEpisodes = useMemo(
    () =>
      mergeAndRankCategory(
        debouncedSearch,
        "Episode",
        episodes,
        fallbackVideoItems,
      ),
    [debouncedSearch, episodes, fallbackVideoItems],
  );
  const rankedMovieItems = useMemo(
    () => rankedMovies.map((s) => s.item),
    [rankedMovies],
  );
  const rankedSeriesItems = useMemo(
    () => rankedSeries.map((s) => s.item),
    [rankedSeries],
  );
  const rankedEpisodeItems = useMemo(
    () => rankedEpisodes.map((s) => s.item),
    [rankedEpisodes],
  );
  const topResults = useMemo(
    () =>
      buildTopResults(
        [rankedMovies, rankedSeries, rankedEpisodes],
        TOP_RESULTS_LIMIT,
      ),
    [rankedMovies, rankedSeries, rankedEpisodes],
  );

  // Shared card renderer for Top Results/Movies/Series/Episodes (Phase
  // 4.5 §10-§12): Movie/Series reuse Library/Favorites' ItemPoster +
  // ItemCardText (Series gets a small label so it reads as a series, not
  // a movie, per §11); Episode uses the existing landscape
  // ContinueWatchingPoster with a parent-context caption ("Breaking Bad /
  // S5 E14 · Ozymandias") built only from real Jellyfin metadata — never
  // fabricated — instead of the episode's own title alone.
  const renderSearchResultCard = useCallback(
    (item: BaseItemDto) => {
      if (item.Type === "Episode") {
        const hasEpisodeNumbers =
          item.ParentIndexNumber != null && item.IndexNumber != null;
        return (
          <TouchableItemRouter
            item={item}
            key={item.Id}
            className='flex flex-col w-44 mr-2'
          >
            <ContinueWatchingPoster item={item} />
            <Text
              numberOfLines={1}
              style={{
                color: TextColor.primary,
                fontWeight: "600",
                marginTop: 8,
              }}
            >
              {item.SeriesName || item.Name}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: TextColor.tertiary, fontSize: 12, marginTop: 2 }}
            >
              {hasEpisodeNumbers
                ? `S${item.ParentIndexNumber} E${item.IndexNumber}${
                    item.Name ? ` · ${item.Name}` : ""
                  }`
                : item.Name}
            </Text>
          </TouchableItemRouter>
        );
      }

      return (
        <TouchableItemRouter key={item.Id} item={item} className='w-28 mr-2'>
          <ItemPoster item={item} />
          <ItemCardText item={item} />
          {item.Type === "Series" && (
            <Text
              style={{
                color: TextColor.tertiary,
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 0.5,
                marginTop: 1,
              }}
            >
              {t("search.series").toUpperCase()}
            </Text>
          )}
        </TouchableItemRouter>
      );
    },
    [t],
  );

  const { data: collections, isFetching: l7 } = useQuery({
    queryKey: ["search", "collections", debouncedSearch],
    queryFn: ({ signal }) =>
      searchFn({
        query: debouncedSearch,
        types: ["BoxSet"],
        signal,
      }),
    enabled: searchType === "Library" && debouncedSearch.length > 0,
  });

  const { data: actors, isFetching: l8 } = useQuery({
    queryKey: ["search", "actors", debouncedSearch],
    queryFn: ({ signal }) =>
      searchFn({
        query: debouncedSearch,
        types: ["Person"],
        signal,
      }),
    enabled: searchType === "Library" && debouncedSearch.length > 0,
  });

  // Music search queries - always use Jellyfin since Streamystats doesn't support music
  const { data: artists, isFetching: l9 } = useQuery({
    queryKey: ["search", "artists", debouncedSearch],
    queryFn: ({ signal }) =>
      jellyfinSearchFn({
        query: debouncedSearch,
        types: ["MusicArtist"],
        signal,
      }),
    enabled: searchType === "Library" && debouncedSearch.length > 0,
  });

  const { data: albums, isFetching: l10 } = useQuery({
    queryKey: ["search", "albums", debouncedSearch],
    queryFn: ({ signal }) =>
      jellyfinSearchFn({
        query: debouncedSearch,
        types: ["MusicAlbum"],
        signal,
      }),
    enabled: searchType === "Library" && debouncedSearch.length > 0,
  });

  const { data: songs, isFetching: l11 } = useQuery({
    queryKey: ["search", "songs", debouncedSearch],
    queryFn: ({ signal }) =>
      jellyfinSearchFn({
        query: debouncedSearch,
        types: ["Audio"],
        signal,
      }),
    enabled: searchType === "Library" && debouncedSearch.length > 0,
  });

  const { data: playlists, isFetching: l12 } = useQuery({
    queryKey: ["search", "playlists", debouncedSearch],
    queryFn: ({ signal }) =>
      jellyfinSearchFn({
        query: debouncedSearch,
        types: ["Playlist"],
        signal,
      }),
    enabled: searchType === "Library" && debouncedSearch.length > 0,
  });

  const noResults = useMemo(() => {
    return !(
      rankedMovieItems.length ||
      rankedEpisodeItems.length ||
      rankedSeriesItems.length ||
      collections?.length ||
      actors?.length ||
      artists?.length ||
      albums?.length ||
      songs?.length ||
      playlists?.length
    );
  }, [
    rankedEpisodeItems,
    rankedMovieItems,
    rankedSeriesItems,
    collections,
    actors,
    artists,
    albums,
    songs,
    playlists,
  ]);

  const loading = useMemo(() => {
    return l1 || l2 || l3 || l7 || l8 || l9 || l10 || l11 || l12;
  }, [l1, l2, l3, l7, l8, l9, l10, l11, l12]);

  // TV item press handler
  const handleItemPress = useCallback(
    (item: BaseItemDto) => {
      const navigation = getItemNavigation(item, from);
      router.push(navigation as any);
    },
    [from, router],
  );

  // Jellyseerr search for TV
  const { data: jellyseerrTVResults, isFetching: jellyseerrTVLoading } =
    useQuery({
      queryKey: ["search", "jellyseerr", "tv", debouncedSearch],
      queryFn: async () => {
        const params = {
          query: new URLSearchParams(debouncedSearch || "").toString(),
        };
        return await Promise.all([
          jellyseerrApi?.search({ ...params, page: 1 }),
          jellyseerrApi?.search({ ...params, page: 2 }),
          jellyseerrApi?.search({ ...params, page: 3 }),
          jellyseerrApi?.search({ ...params, page: 4 }),
        ]).then((all) =>
          uniqBy(
            all.flatMap((v) => v?.results || []),
            "id",
          ),
        );
      },
      enabled:
        Platform.isTV &&
        !!jellyseerrApi &&
        searchType === "Discover" &&
        debouncedSearch.length > 0,
    });

  // Process Jellyseerr results for TV
  const jellyseerrMovieResults = useMemo(
    () =>
      orderBy(
        jellyseerrTVResults?.filter(
          (r) => r.mediaType === MediaType.MOVIE,
        ) as MovieResult[],
        [(m) => m?.title?.toLowerCase() === debouncedSearch.toLowerCase()],
        "desc",
      ),
    [jellyseerrTVResults, debouncedSearch],
  );

  const jellyseerrTvResults = useMemo(
    () =>
      orderBy(
        jellyseerrTVResults?.filter(
          (r) => r.mediaType === MediaType.TV,
        ) as TvResult[],
        [(t) => t?.name?.toLowerCase() === debouncedSearch.toLowerCase()],
        "desc",
      ),
    [jellyseerrTVResults, debouncedSearch],
  );

  const jellyseerrPersonResults = useMemo(
    () =>
      orderBy(
        jellyseerrTVResults?.filter(
          (r) => r.mediaType === "person",
        ) as PersonResult[],
        [(p) => p?.name?.toLowerCase() === debouncedSearch.toLowerCase()],
        "desc",
      ),
    [jellyseerrTVResults, debouncedSearch],
  );

  const jellyseerrTVNoResults = useMemo(() => {
    return (
      !jellyseerrMovieResults?.length &&
      !jellyseerrTvResults?.length &&
      !jellyseerrPersonResults?.length
    );
  }, [jellyseerrMovieResults, jellyseerrTvResults, jellyseerrPersonResults]);

  // Fetch discover settings for TV (when no search query in Discover mode)
  const { data: discoverSliders } = useQuery({
    queryKey: ["search", "jellyseerr", "discoverSettings", "tv"],
    queryFn: async () => jellyseerrApi?.discoverSettings(),
    enabled:
      Platform.isTV &&
      !!jellyseerrApi &&
      searchType === "Discover" &&
      debouncedSearch.length === 0,
  });

  // TV Jellyseerr press handlers
  const handleJellyseerrMoviePress = useCallback(
    (item: MovieResult) => {
      router.push({
        pathname: "/(auth)/(tabs)/(search)/jellyseerr/page",
        params: {
          mediaTitle: item.title,
          releaseYear: String(new Date(item.releaseDate || "").getFullYear()),
          canRequest: "true",
          posterSrc: jellyseerrApi?.imageProxy(item.posterPath) || "",
          mediaType: MediaType.MOVIE,
          id: String(item.id),
          backdropPath: item.backdropPath || "",
          overview: item.overview || "",
        },
      });
    },
    [router, jellyseerrApi],
  );

  const handleJellyseerrTvPress = useCallback(
    (item: TvResult) => {
      router.push({
        pathname: "/(auth)/(tabs)/(search)/jellyseerr/page",
        params: {
          mediaTitle: item.name,
          releaseYear: String(new Date(item.firstAirDate || "").getFullYear()),
          canRequest: "true",
          posterSrc: jellyseerrApi?.imageProxy(item.posterPath) || "",
          mediaType: MediaType.TV,
          id: String(item.id),
          backdropPath: item.backdropPath || "",
          overview: item.overview || "",
        },
      });
    },
    [router, jellyseerrApi],
  );

  const handleJellyseerrPersonPress = useCallback(
    (item: PersonResult) => {
      router.push(`/(auth)/jellyseerr/person/${item.id}` as any);
    },
    [router],
  );

  // Render TV search page
  if (Platform.isTV) {
    return (
      <TVSearchPage
        search={search}
        setSearch={setSearch}
        debouncedSearch={debouncedSearch}
        movies={movies}
        series={series}
        episodes={episodes}
        collections={collections}
        actors={actors}
        artists={artists}
        albums={albums}
        songs={songs}
        playlists={playlists}
        loading={loading}
        noResults={noResults}
        onItemPress={handleItemPress}
        onItemLongPress={showItemActions}
        searchType={searchType}
        setSearchType={setSearchType}
        showDiscover={!!jellyseerrApi}
        jellyseerrMovies={jellyseerrMovieResults}
        jellyseerrTv={jellyseerrTvResults}
        jellyseerrPersons={jellyseerrPersonResults}
        jellyseerrLoading={jellyseerrTVLoading}
        jellyseerrNoResults={jellyseerrTVNoResults}
        onJellyseerrMoviePress={handleJellyseerrMoviePress}
        onJellyseerrTvPress={handleJellyseerrTvPress}
        onJellyseerrPersonPress={handleJellyseerrPersonPress}
        discoverSliders={discoverSliders}
      />
    );
  }

  return (
    <ScrollView
      keyboardDismissMode='on-drag'
      contentInsetAdjustmentBehavior='automatic'
      contentContainerStyle={{
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingBottom: 60,
      }}
    >
      <View
        className='flex flex-col'
        style={{ paddingTop: Platform.OS === "android" ? 10 : 0 }}
      >
        {jellyseerrApi && (
          <View className='pl-4 pr-4 flex flex-row'>
            <SearchTabButtons
              searchType={searchType}
              setSearchType={setSearchType}
              t={t}
            />
            {searchType === "Discover" &&
              !loading &&
              noResults &&
              debouncedSearch.length > 0 && (
                <DiscoverFilters
                  searchFilterId={searchFilterId}
                  orderFilterId={orderFilterId}
                  jellyseerrOrderBy={jellyseerrOrderBy}
                  setJellyseerrOrderBy={setJellyseerrOrderBy}
                  jellyseerrSortOrder={jellyseerrSortOrder}
                  setJellyseerrSortOrder={setJellyseerrSortOrder}
                  t={t}
                />
              )}
          </View>
        )}

        <View className='mt-2'>
          <LoadingSkeleton isLoading={loading} />
        </View>

        {searchType === "Library" ? (
          <View className={l1 || l2 ? "opacity-0" : "opacity-100"}>
            {/* Top Results (Phase 4.5 §9): the highest-ranked items across
                Movies/Series/Episodes, so a strong Series/Movie match (e.g.
                "Breaking Bad" -> the show itself) surfaces immediately
                instead of requiring a scroll past a flood of episodes. */}
            <SearchItemWrapper
              header={t("search.top_results")}
              items={topResults}
              renderItem={renderSearchResultCard}
            />
            {/* Movies/Series/Collections/Actors share Library/Favorites'
                ItemPoster + ItemCardText for visual consistency across
                browse surfaces (Phase 4 §8) instead of separate ad hoc
                poster + caption markup per type. */}
            <SearchItemWrapper
              header={t("search.movies")}
              items={rankedMovieItems}
              renderItem={renderSearchResultCard}
            />
            <SearchItemWrapper
              items={rankedSeriesItems}
              header={t("search.series")}
              renderItem={renderSearchResultCard}
            />
            <SearchItemWrapper
              items={rankedEpisodeItems}
              header={t("search.episodes")}
              renderItem={renderSearchResultCard}
            />
            <SearchItemWrapper
              items={collections}
              header={t("search.collections")}
              renderItem={(item: BaseItemDto) => (
                <TouchableItemRouter
                  key={item.Id}
                  item={item}
                  className='w-28 mr-2'
                >
                  <ItemPoster item={item} />
                  <ItemCardText item={item} />
                </TouchableItemRouter>
              )}
            />
            <SearchItemWrapper
              items={actors}
              header={t("search.actors")}
              renderItem={(item: BaseItemDto) => (
                <TouchableItemRouter
                  item={item}
                  key={item.Id}
                  className='w-28 mr-2'
                >
                  <ItemPoster item={item} />
                  <ItemCardText item={item} />
                </TouchableItemRouter>
              )}
            />
            {/* Music search results: circular avatar for artists (person-
                appropriate), square art for albums/songs/playlists. Reuses
                ItemImage for the image itself so the "no artwork" fallback
                matches the rest of the app's icon-based placeholder instead
                of the previous ad hoc emoji boxes. */}
            <SearchItemWrapper
              items={artists}
              header={t("search.artists")}
              renderItem={(item: BaseItemDto) => (
                <TouchableItemRouter
                  item={item}
                  key={item.Id}
                  className='w-24 mr-2 items-center'
                >
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      overflow: "hidden",
                    }}
                  >
                    <ItemImage item={item} />
                  </View>
                  <Text numberOfLines={2} className='mt-2 text-center'>
                    {item.Name}
                  </Text>
                </TouchableItemRouter>
              )}
            />
            <SearchItemWrapper
              items={albums}
              header={t("search.albums")}
              renderItem={(item: BaseItemDto) => (
                <TouchableItemRouter
                  item={item}
                  key={item.Id}
                  className='w-28 mr-2'
                >
                  <View
                    style={{
                      width: 112,
                      height: 112,
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <ItemImage item={item} />
                  </View>
                  <Text numberOfLines={2} className='mt-2'>
                    {item.Name}
                  </Text>
                  <Text
                    style={{ color: TextColor.tertiary, fontSize: 12 }}
                    numberOfLines={1}
                  >
                    {item.AlbumArtist || item.Artists?.join(", ")}
                  </Text>
                </TouchableItemRouter>
              )}
            />
            <SearchItemWrapper
              items={songs}
              header={t("search.songs")}
              renderItem={(item: BaseItemDto) => (
                <TouchableItemRouter
                  item={item}
                  key={item.Id}
                  className='w-28 mr-2'
                >
                  <View
                    style={{
                      width: 112,
                      height: 112,
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <ItemImage item={item} />
                  </View>
                  <Text numberOfLines={2} className='mt-2'>
                    {item.Name}
                  </Text>
                  <Text
                    style={{ color: TextColor.tertiary, fontSize: 12 }}
                    numberOfLines={1}
                  >
                    {item.Artists?.join(", ") || item.AlbumArtist}
                  </Text>
                </TouchableItemRouter>
              )}
            />
            <SearchItemWrapper
              items={playlists}
              header={t("search.playlists")}
              renderItem={(item: BaseItemDto) => (
                <TouchableItemRouter
                  item={item}
                  key={item.Id}
                  className='w-28 mr-2'
                >
                  <View
                    style={{
                      width: 112,
                      height: 112,
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <ItemImage item={item} />
                  </View>
                  <Text numberOfLines={2} className='mt-2'>
                    {item.Name}
                  </Text>
                  <Text style={{ color: TextColor.tertiary, fontSize: 12 }}>
                    {item.ChildCount} tracks
                  </Text>
                </TouchableItemRouter>
              )}
            />
          </View>
        ) : (
          <JellyserrIndexPage
            searchQuery={debouncedSearch}
            sortType={jellyseerrOrderBy}
            order={jellyseerrSortOrder}
          />
        )}

        {searchType === "Library" &&
          (!loading && noResults && debouncedSearch.length > 0 ? (
            <EmptyState
              icon='search-outline'
              title={t("search.no_results_found_for")}
              message={`"${debouncedSearch}"`}
            />
          ) : debouncedSearch.length === 0 ? (
            <View
              className='mt-4 flex flex-col items-center'
              style={{ gap: 4 }}
            >
              {exampleSearches.map((e) => (
                <TouchableOpacity
                  onPress={() => {
                    setSearch(e);
                    searchBarRef.current?.setText(e);
                  }}
                  key={e}
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={{ color: TextColor.secondary, fontSize: 14 }}>
                    {e}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null)}
      </View>
    </ScrollView>
  );
}
