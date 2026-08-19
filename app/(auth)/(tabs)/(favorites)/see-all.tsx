import type { Api } from "@jellyfin/sdk";
import type {
  BaseItemDto,
  BaseItemKind,
} from "@jellyfin/sdk/lib/generated-client";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { t } from "i18next";
import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Loader } from "@/components/Loader";
import { LibraryGridItem } from "@/components/library/LibraryGridItem";
import { LibraryGridSkeleton } from "@/components/library/LibraryGridSkeleton";
import { useOrientation } from "@/hooks/useOrientation";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { getResponsiveGridColumns } from "@/utils/getResponsiveGridColumns";

type FavoriteTypes =
  | "Series"
  | "Movie"
  | "Episode"
  | "Video"
  | "BoxSet"
  | "Playlist";

const favoriteTypes: readonly FavoriteTypes[] = [
  "Series",
  "Movie",
  "Episode",
  "Video",
  "BoxSet",
  "Playlist",
] as const;

function isFavoriteType(value: unknown): value is FavoriteTypes {
  return (
    typeof value === "string" &&
    (favoriteTypes as readonly string[]).includes(value)
  );
}

export default function FavoritesSeeAllScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);

  const searchParams = useLocalSearchParams<{
    type?: string;
    title?: string;
  }>();
  const typeParam = searchParams.type;
  const titleParam = searchParams.title;

  const itemType = useMemo(() => {
    if (!isFavoriteType(typeParam)) return null;
    return typeParam as BaseItemKind;
  }, [typeParam]);

  const headerTitle = useMemo(() => {
    if (typeof titleParam === "string" && titleParam.trim().length > 0)
      return titleParam;
    return "";
  }, [titleParam]);

  const pageSize = 50;

  const fetchItems = useCallback(
    async ({ pageParam }: { pageParam: number }): Promise<BaseItemDto[]> => {
      if (!api || !user?.Id || !itemType) return [];

      const response = await getItemsApi(api as Api).getItems({
        userId: user.Id,
        sortBy: ["SeriesSortName", "SortName"],
        sortOrder: ["Ascending"],
        filters: ["IsFavorite"],
        recursive: true,
        fields: ["PrimaryImageAspectRatio"],
        collapseBoxSetItems: false,
        excludeLocationTypes: ["Virtual"],
        enableTotalRecordCount: true,
        startIndex: pageParam,
        limit: pageSize,
        includeItemTypes: [itemType],
      });

      return response.data.Items || [];
    },
    [api, itemType, user?.Id],
  );

  const {
    data,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["favorites", "see-all", itemType],
    queryFn: ({ pageParam = 0 }) => fetchItems({ pageParam }),
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      return pages.reduce((acc, page) => acc + page.length, 0);
    },
    initialPageParam: 0,
    enabled: !!api && !!user?.Id && !!itemType,
  });

  const flatData = useMemo(() => data?.pages.flat() ?? [], [data]);

  const { orientation } = useOrientation();
  const nrOfCols = useMemo(
    () => getResponsiveGridColumns(screenWidth),
    [screenWidth],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: BaseItemDto; index: number }) => (
      <LibraryGridItem
        item={item}
        index={index}
        columns={nrOfCols}
        orientation={orientation}
      />
    ),
    [nrOfCols, orientation],
  );

  const keyExtractor = useCallback((item: BaseItemDto) => item.Id || "", []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage]);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: headerTitle,
          headerBlurEffect: "none",
          headerTransparent: true,
          headerShadowVisible: false,
        }}
      />
      {!itemType ? (
        <EmptyState icon='heart-outline' title={t("favorites.noData")} />
      ) : isError ? (
        <ErrorState
          title={t("home.oops")}
          message={t("home.error_message")}
          retryLabel={t("home.retry")}
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <LibraryGridSkeleton columns={nrOfCols} />
      ) : (
        <FlashList
          data={flatData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={nrOfCols}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.8}
          contentInsetAdjustmentBehavior='automatic'
          contentContainerStyle={{
            paddingBottom: 24,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
          ItemSeparatorComponent={() => (
            <View
              style={{
                width: 10,
                height: 10,
              }}
            />
          )}
          ListEmptyComponent={
            <EmptyState icon='heart-outline' title={t("home.no_items")} />
          }
          ListFooterComponent={
            isFetching ? (
              <View style={{ paddingVertical: 16 }}>
                <Loader />
              </View>
            ) : null
          }
        />
      )}
    </>
  );
}
