import { Ionicons } from "@expo/vector-icons";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { LinearGradient } from "expo-linear-gradient";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Image } from "@/components/common/ServerImage";
import { Text } from "@/components/common/Text";
import { TouchableItemRouter } from "@/components/common/TouchableItemRouter";
import { TextColor } from "@/constants/theme";
import { useFavorite } from "@/hooks/useFavorite";
import { useHaptic } from "@/hooks/useHaptic";
import { usePlaybackEntry } from "@/hooks/usePlaybackEntry";
import { apiAtom } from "@/providers/JellyfinProvider";
import { getBackdropUrl } from "@/utils/jellyfin/image/getBackdropUrl";
import { getLogoImageUrlById } from "@/utils/jellyfin/image/getLogoImageUrlById";
import { runtimeTicksToMinutes } from "@/utils/time";

interface Props {
  item: BaseItemDto;
  /**
   * Extra height rendered above the hero's own designed height, kept out of
   * document flow via a matching negative margin — lets the backdrop bleed
   * up behind a transparent header on notch/Dynamic Island devices instead
   * of stopping short and leaving a flat gap between header and artwork.
   * Home.tsx passes `insets.top + 44` on iOS (0 elsewhere); 0 by default so
   * every other caller/behavior is unaffected.
   */
  headerOverlayHeight?: number;
}

/**
 * Height reserved for the hero's own content below the header — a fraction
 * of window *height* (not width), clamped so it reads as a deliberate
 * cinematic frame rather than either a thin strip or "almost the entire
 * first screen" (the real-device Phase 3 finding this tunes for). Exported
 * so Home.tsx's loading skeleton reserves the identical space and nothing
 * jumps when the hero resolves.
 */
export const getHeroHeight = (windowHeight: number): number =>
  Math.round(Math.min(Math.max(windowHeight * 0.46, 300), 460));

/**
 * Home's cinematic hero. Presentation-only: the item comes from data Home
 * is already fetching (see Home.tsx's heroItem selection — Continue
 * Watching → Next Up → Recently Added → none, with no extra network
 * query). The Favorite action calls the same protected `useFavorite` every
 * other favorite control in the app uses; the primary action now goes
 * through `usePlaybackEntry` (Phase 3.1) — the same resume-dialog /
 * downloaded-file / Chromecast-picker decision flow PlayButton.tsx uses on
 * the item details page — so playing from the hero behaves identically to
 * playing anywhere else, rather than jumping straight to usePlayMedia.
 */
export const HeroBanner: React.FC<Props> = ({
  item,
  headerOverlayHeight = 0,
}) => {
  const { t } = useTranslation();
  const api = useAtomValue(apiAtom);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { isFavorite, toggleFavorite } = useFavorite(item);
  const lightHaptic = useHaptic("light");
  const { play } = usePlaybackEntry(item);

  // Retina-sharp without fetching arbitrarily large source art.
  const backdropWidth = Math.min(Math.round(windowWidth * 2), 1200);
  const backdropUrl = useMemo(
    () => getBackdropUrl({ api, item, quality: 85, width: backdropWidth }),
    [api, item, backdropWidth],
  );
  const logoUrl = useMemo(
    () => getLogoImageUrlById({ api, item, height: 100 }),
    [api, item],
  );

  const isEpisode = item.Type === "Episode";
  const hasProgress = (item.UserData?.PlaybackPositionTicks ?? 0) > 0;

  const contentHeight = getHeroHeight(windowHeight);
  const totalHeight = contentHeight + headerOverlayHeight;

  return (
    <TouchableItemRouter
      item={item}
      style={{ width: "100%", marginTop: -headerOverlayHeight }}
    >
      <View style={{ width: "100%", height: totalHeight, overflow: "hidden" }}>
        {backdropUrl ? (
          <Image
            source={{ uri: backdropUrl }}
            cachePolicy='memory-disk'
            contentFit='cover'
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          // Elegant fallback when no backdrop exists — a flat surface
          // rather than a stretched poster.
          <View
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#1c1e1f",
            }}
          />
        )}

        {/* Top scrim: keeps the header wordmark/controls legible over
            arbitrary backdrop art now that the image bleeds up behind
            them, and visually welds header + hero into one dark plate
            instead of two competing zones. */}
        <LinearGradient
          colors={["rgba(0,0,0,0.65)", "rgba(0,0,0,0)"]}
          locations={[0, 1]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: headerOverlayHeight + 56,
          }}
          pointerEvents='none'
        />

        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.95)"]}
          locations={[0, 0.5, 1]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "70%",
          }}
          pointerEvents='none'
        />

        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 20,
          }}
        >
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              contentFit='contain'
              style={{ width: "72%", height: 64, marginBottom: 10 }}
            />
          ) : (
            <Text
              numberOfLines={2}
              style={{
                color: TextColor.primary,
                fontSize: 30,
                fontWeight: "800",
                marginBottom: 10,
              }}
            >
              {isEpisode ? item.SeriesName : item.Name}
            </Text>
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {item.ProductionYear ? (
              <Text
                style={{
                  color: TextColor.secondary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {item.ProductionYear}
              </Text>
            ) : null}
            {item.RunTimeTicks ? (
              <Text
                style={{
                  color: TextColor.secondary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {item.ProductionYear ? "  ·  " : ""}
                {runtimeTicksToMinutes(item.RunTimeTicks)}
              </Text>
            ) : null}
            {isEpisode ? (
              <Text
                style={{
                  color: TextColor.secondary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {item.ProductionYear || item.RunTimeTicks ? "  ·  " : ""}
                {`S${item.ParentIndexNumber ?? "-"} E${item.IndexNumber ?? "-"}`}
              </Text>
            ) : null}
          </View>

          {item.Overview ? (
            <Text
              numberOfLines={2}
              style={{
                color: TextColor.secondary,
                fontSize: 13,
                marginTop: 8,
                lineHeight: 18,
              }}
            >
              {item.Overview}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 16,
              gap: 10,
            }}
          >
            <TouchableOpacity
              onPress={play}
              accessibilityRole='button'
              accessibilityLabel={
                hasProgress
                  ? t("home.continue_watching")
                  : t("item_card.play", { defaultValue: "Play" })
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#ffffff",
                borderRadius: 9999,
                paddingVertical: 11,
                paddingHorizontal: 22,
                minHeight: 46,
              }}
            >
              <Ionicons name='play' size={19} color='#000000' />
              <Text
                style={{
                  color: "#000000",
                  fontWeight: "700",
                  marginLeft: 8,
                  fontSize: 15,
                }}
              >
                {hasProgress
                  ? t("home.continue_watching")
                  : t("item_card.play", { defaultValue: "Play" })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                lightHaptic();
                toggleFavorite();
              }}
              accessibilityRole='button'
              accessibilityLabel={t(
                isFavorite
                  ? "item_card.remove_from_favorites"
                  : "item_card.add_to_favorites",
                {
                  defaultValue: isFavorite
                    ? "Remove from Favorites"
                    : "Add to Favorites",
                },
              )}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.16)",
                borderRadius: 9999,
                paddingVertical: 11,
                paddingHorizontal: 16,
                minHeight: 46,
                minWidth: 46,
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={19}
                color='#ffffff'
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableItemRouter>
  );
};
