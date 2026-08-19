import {
  getUserLibraryApi,
  getUserViewsApi,
} from "@jellyfin/sdk/lib/utils/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/common/Skeleton";
import { LibraryItemCard } from "@/components/library/LibraryItemCard";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { useSettings } from "@/utils/atoms/settings";

export const Libraries: React.FC = () => {
  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);
  const queryClient = useQueryClient();
  const { settings } = useSettings();

  const { t } = useTranslation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["user-views", user?.Id],
    queryFn: async () => {
      const response = await getUserViewsApi(api!).getUserViews({
        userId: user?.Id,
      });

      return response.data.Items || null;
    },
    staleTime: 60,
  });

  const libraries = useMemo(
    () =>
      data
        ?.filter((l) => !settings?.hiddenLibraries?.includes(l.Id!))
        .filter((l) => l.CollectionType !== "books") || [],
    [data, settings?.hiddenLibraries],
  );

  useEffect(() => {
    for (const item of data || []) {
      queryClient.prefetchQuery({
        queryKey: ["library", item.Id],
        queryFn: async () => {
          if (!item.Id || !user?.Id || !api) return null;
          const response = await getUserLibraryApi(api).getItem({
            itemId: item.Id,
            userId: user?.Id,
          });
          return response.data;
        },
        staleTime: 60 * 1000,
      });
    }
  }, [data, api, queryClient, user?.Id]);

  const insets = useSafeAreaInsets();

  if (isError)
    return (
      <ErrorState
        title={t("home.oops")}
        message={t("home.error_message")}
        retryLabel={t("home.retry")}
        onRetry={() => refetch()}
      />
    );

  if (isLoading)
    return (
      <View style={{ paddingTop: 17, paddingHorizontal: 17, gap: 16 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={112} radius='lg' />
        ))}
      </View>
    );

  if (libraries.length === 0)
    return (
      <EmptyState
        icon='folder-outline'
        title={t("library.no_libraries_found")}
      />
    );

  return (
    <FlashList
      extraData={settings}
      contentInsetAdjustmentBehavior='automatic'
      contentContainerStyle={{
        paddingTop: Platform.OS === "android" ? 17 : 0,
        paddingHorizontal: settings?.libraryOptions?.display === "row" ? 0 : 17,
        paddingBottom: 150,
        paddingLeft: insets.left + 17,
        paddingRight: insets.right + 17,
      }}
      data={libraries}
      renderItem={({ item }) => <LibraryItemCard library={item} />}
      keyExtractor={(item) => item.Id || ""}
      ItemSeparatorComponent={() =>
        settings?.libraryOptions?.display === "row" ? (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
            }}
            className='bg-neutral-800 mx-2 my-4'
          />
        ) : (
          <View className='h-4' />
        )
      }
    />
  );
};
