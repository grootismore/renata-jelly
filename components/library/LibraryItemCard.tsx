import { Ionicons } from "@expo/vector-icons";
import type {
  BaseItemDto,
  BaseItemKind,
  CollectionType,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useAtom } from "jotai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type TouchableOpacityProps, View } from "react-native";
import { Image } from "@/components/common/ServerImage";
import { Text } from "@/components/common/Text";
import { Radius, Surface, TextColor } from "@/constants/theme";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { useSettings } from "@/utils/atoms/settings";
import { getPrimaryImageUrl } from "@/utils/jellyfin/image/getPrimaryImageUrl";
import { TouchableItemRouter } from "../common/TouchableItemRouter";

interface Props extends TouchableOpacityProps {
  library: BaseItemDto;
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const icons: Record<CollectionType, IconName> = {
  movies: "film",
  tvshows: "tv",
  music: "musical-notes",
  books: "book",
  homevideos: "videocam",
  boxsets: "albums",
  playlists: "list",
  folders: "folder",
  livetv: "tv",
  musicvideos: "musical-notes",
  photos: "images",
  trailers: "videocam",
  unknown: "help-circle",
} as const;
export const LibraryItemCard: React.FC<Props> = ({ library, ...props }) => {
  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);
  const { settings } = useSettings();

  const { t } = useTranslation();

  const url = useMemo(
    () =>
      getPrimaryImageUrl({
        api,
        item: library,
      }),
    [api, library],
  );

  const itemType = useMemo(() => {
    let _itemType: BaseItemKind | undefined;

    if (library.CollectionType === "movies") {
      _itemType = "Movie";
    } else if (library.CollectionType === "tvshows") {
      _itemType = "Series";
    } else if (library.CollectionType === "boxsets") {
      _itemType = "BoxSet";
    } else if (library.CollectionType === "homevideos") {
      _itemType = "Video";
    } else if (library.CollectionType === "musicvideos") {
      _itemType = "MusicVideo";
    }

    return _itemType;
  }, [library.CollectionType]);

  const itemTypeName = useMemo(() => {
    let nameStr: string;

    if (library.CollectionType === "movies") {
      nameStr = t("library.item_types.movies");
    } else if (library.CollectionType === "tvshows") {
      nameStr = t("library.item_types.series");
    } else if (library.CollectionType === "boxsets") {
      nameStr = t("library.item_types.boxsets");
    } else {
      nameStr = t("library.item_types.items");
    }

    return nameStr;
  }, [library.CollectionType]);

  const { data: itemsCount } = useQuery({
    queryKey: ["library-count", library.Id],
    queryFn: async () => {
      const response = await getItemsApi(api!).getItems({
        userId: user?.Id,
        parentId: library.Id,
        recursive: true,
        limit: 0,
        includeItemTypes: itemType ? [itemType] : undefined,
      });
      return response.data.TotalRecordCount;
    },
  });

  const hasImage = Boolean(url);

  if (settings?.libraryOptions?.display === "row") {
    return (
      <TouchableItemRouter item={library} className='w-full px-4'>
        <View className='flex flex-row items-center w-full relative '>
          <Ionicons
            name={icons[library.CollectionType!] || "folder"}
            size={22}
            color={"#e5e5e5"}
          />
          <Text className='text-start px-4 text-neutral-200'>
            {library.Name}
          </Text>
          {settings?.libraryOptions?.showStats && (
            <Text className='font-bold text-xs text-neutral-500 text-start ml-auto'>
              {itemsCount} {itemTypeName}
            </Text>
          )}
        </View>
      </TouchableItemRouter>
    );
  }

  if (settings?.libraryOptions?.imageStyle === "cover") {
    return (
      <TouchableItemRouter item={library} className='w-full'>
        <View
          style={{
            width: "100%",
            height: 112,
            borderRadius: Radius.lg,
            overflow: "hidden",
            backgroundColor: Surface.elevated,
            borderWidth: 1,
            borderColor: Surface.border,
            justifyContent: "flex-end",
          }}
        >
          {url ? (
            <Image
              source={{ uri: url }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
              cachePolicy={"memory-disk"}
              contentFit='cover'
            />
          ) : (
            // Elegant fallback for libraries with no representative artwork
            // (e.g. a freshly created library) instead of rendering nothing.
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={icons[library.CollectionType!] || "folder"}
                size={28}
                color={TextColor.tertiary}
              />
            </View>
          )}
          {hasImage && (
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.75)"]}
              locations={[0.3, 1]}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "70%",
              }}
              pointerEvents='none'
            />
          )}
          {(settings?.libraryOptions?.showTitles ||
            settings?.libraryOptions?.showStats) && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              {settings?.libraryOptions?.showTitles && (
                <Text
                  numberOfLines={1}
                  style={{
                    color: TextColor.primary,
                    fontSize: 17,
                    fontWeight: "700",
                  }}
                >
                  {library.Name}
                </Text>
              )}
              {settings?.libraryOptions?.showStats && (
                <Text
                  style={{
                    color: TextColor.secondary,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {itemsCount} {itemTypeName}
                </Text>
              )}
            </View>
          )}
        </View>
      </TouchableItemRouter>
    );
  }

  return (
    <TouchableItemRouter item={library} {...props}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          borderRadius: Radius.lg,
          backgroundColor: Surface.elevated,
          borderWidth: 1,
          borderColor: Surface.border,
          height: 80,
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: TextColor.primary,
              fontSize: 17,
              fontWeight: "700",
              paddingHorizontal: 16,
            }}
          >
            {library.Name}
          </Text>
          {settings?.libraryOptions?.showStats && (
            <Text
              style={{
                color: TextColor.secondary,
                fontSize: 12,
                paddingHorizontal: 16,
                marginTop: 2,
              }}
            >
              {itemsCount} {itemTypeName}
            </Text>
          )}
        </View>
        <View className='p-2'>
          {url ? (
            <Image
              source={{ uri: url }}
              style={{
                height: "100%",
                aspectRatio: 2 / 1,
                borderRadius: Radius.md,
                overflow: "hidden",
              }}
              cachePolicy={"memory-disk"}
              contentFit='cover'
            />
          ) : (
            <View
              style={{
                height: "100%",
                aspectRatio: 2 / 1,
                borderRadius: Radius.md,
                backgroundColor: Surface.page,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={icons[library.CollectionType!] || "folder"}
                size={20}
                color={TextColor.tertiary}
              />
            </View>
          )}
        </View>
      </View>
    </TouchableItemRouter>
  );
};
