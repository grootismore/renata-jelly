import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import { ProgressBar } from "@/components/common/ProgressBar";
import { Image } from "@/components/common/ServerImage";
import { Text } from "@/components/common/Text";
import { WatchedIndicator } from "@/components/WatchedIndicator";
import { Radius, Surface, TextColor } from "@/constants/theme";
import { apiAtom } from "@/providers/JellyfinProvider";
import { useSettings } from "@/utils/atoms/settings";
import { getContinueWatchingImageUrl } from "@/utils/jellyfin/image/getContinueWatchingImageUrl";

interface Props {
  item: BaseItemDto;
}

/**
 * Home's Continue Watching card — large landscape artwork, title, episode
 * context, and a thin progress indicator. Presentation-only: reuses the
 * same image-URL resolution, ProgressBar, and WatchedIndicator as the
 * classic ContinueWatchingPoster, just at a bigger, responsive size (~1.5–2.5
 * cards visible per screen, per the approved direction) instead of the
 * fixed w-44 used elsewhere in the app. Passed to
 * InfiniteScrollingCollectionList's `renderItem` — the query/pagination/
 * navigation logic that renders it is untouched.
 */
export const ContinueWatchingCardLarge: React.FC<Props> = ({ item }) => {
  const api = useAtomValue(apiAtom);
  const { settings } = useSettings();
  const { width: windowWidth } = useWindowDimensions();

  // ~62% of screen width gives ~1.5 cards visible on an iPhone-width
  // screen (inviting the next card to peek in), capped so iPad doesn't get
  // an oversized card — responsive, not a fixed phone-width assumption.
  const cardWidth = Math.round(Math.min(windowWidth * 0.62, 280));

  const url = useMemo(
    () =>
      getContinueWatchingImageUrl({
        api,
        item,
        useEpisodePoster: settings?.useEpisodeImagesForNextUp,
      }),
    [api, item, settings?.useEpisodeImagesForNextUp],
  );

  const isEpisode = item.Type === "Episode";

  return (
    <View style={{ width: cardWidth }}>
      <View
        style={{
          width: cardWidth,
          aspectRatio: 16 / 9,
          borderRadius: Radius.md,
          overflow: "hidden",
          backgroundColor: Surface.elevated,
          borderWidth: 1,
          borderColor: Surface.border,
        }}
      >
        {url ? (
          <Image
            key={item.Id}
            id={item.Id}
            source={{ uri: url }}
            cachePolicy='memory-disk'
            contentFit='cover'
            style={{ width: "100%", height: "100%" }}
          />
        ) : null}
        {!item.UserData?.Played && <WatchedIndicator item={item} />}
        <ProgressBar item={item} />
      </View>
      <View className='mt-2'>
        <Text
          numberOfLines={1}
          style={{ color: TextColor.primary, fontWeight: "600" }}
        >
          {isEpisode ? item.SeriesName : item.Name}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: TextColor.secondary, fontSize: 12, marginTop: 2 }}
        >
          {isEpisode
            ? `S${item.ParentIndexNumber ?? "-"} E${item.IndexNumber ?? "-"}${
                item.Name ? ` · ${item.Name}` : ""
              }`
            : item.ProductionYear}
        </Text>
      </View>
    </View>
  );
};
