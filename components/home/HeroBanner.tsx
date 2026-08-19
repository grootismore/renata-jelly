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
import { Radius, TextColor } from "@/constants/theme";
import { useFavorite } from "@/hooks/useFavorite";
import { useHaptic } from "@/hooks/useHaptic";
import { usePlayMedia } from "@/hooks/usePlayMedia";
import { apiAtom } from "@/providers/JellyfinProvider";
import { useOfflineMode } from "@/providers/OfflineModeProvider";
import { getBackdropUrl } from "@/utils/jellyfin/image/getBackdropUrl";
import { getLogoImageUrlById } from "@/utils/jellyfin/image/getLogoImageUrlById";
import type { PlayRequest } from "@/utils/nativePlayer/playRequest";
import { runtimeTicksToMinutes } from "@/utils/time";

interface Props {
  item: BaseItemDto;
}

/**
 * Height scales with width like a cinematic ~2:3 backdrop crop, capped so it
 * stays proportionate on wider iPad screens instead of growing huge. Exported
 * so Home.tsx's loading skeleton can reserve the exact same space and avoid a
 * layout jump when the hero resolves.
 */
export const getHeroHeight = (windowWidth: number): number =>
  Math.round(Math.min(windowWidth * 1.05, 520));

/**
 * Home's cinematic hero. Presentation-only: the item comes from data Home
 * is already fetching (see Home.tsx's heroItem selection — Continue
 * Watching → Next Up → Recently Added → none, with no extra network
 * query), and both the "Continue/Play" and Favorite actions call the same
 * protected entry points every other play/favorite button in the app uses
 * (usePlayMedia, useFavorite) — this component adds no new playback or
 * Jellyfin-API logic of its own.
 *
 * The primary action intentionally skips PlayButton's Chromecast picker and
 * downloaded-file/resume-dialog prompts (see RENATA_DEVLOG.md Phase 3) —
 * those are UX embellishments layered on top of usePlayMedia, not part of
 * protected playback infrastructure, and a home-hero "quick continue"
 * resuming immediately (rather than asking first) matches the common
 * pattern of this kind of control in other media apps.
 */
export const HeroBanner: React.FC<Props> = ({ item }) => {
  const { t } = useTranslation();
  const api = useAtomValue(apiAtom);
  const { width: windowWidth } = useWindowDimensions();
  const isOffline = useOfflineMode();
  const playMedia = usePlayMedia();
  const { isFavorite, toggleFavorite } = useFavorite(item);
  const lightHaptic = useHaptic("light");

  const backdropUrl = useMemo(
    () => getBackdropUrl({ api, item, quality: 80, width: 800 }),
    [api, item],
  );
  const logoUrl = useMemo(
    () => getLogoImageUrlById({ api, item, height: 100 }),
    [api, item],
  );

  const isEpisode = item.Type === "Episode";
  const hasProgress = (item.UserData?.PlaybackPositionTicks ?? 0) > 0;

  const handlePlay = () => {
    lightHaptic();
    const playRequest: PlayRequest = {
      itemId: item.Id!,
      offline: isOffline,
      playbackPositionTicks: item.UserData?.PlaybackPositionTicks ?? 0,
    };
    void playMedia(playRequest, { item });
  };

  const heroHeight = getHeroHeight(windowWidth);

  return (
    <TouchableItemRouter item={item} style={{ width: "100%" }}>
      <View
        style={{
          width: "100%",
          height: heroHeight,
          borderRadius: Radius.lg,
          overflow: "hidden",
        }}
      >
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

        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
          locations={[0, 0.55, 1]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "75%",
          }}
          pointerEvents='none'
        />

        <View
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 20,
          }}
        >
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              contentFit='contain'
              style={{ width: "70%", height: 60, marginBottom: 8 }}
            />
          ) : (
            <Text
              numberOfLines={2}
              style={{
                color: TextColor.primary,
                fontSize: 28,
                fontWeight: "800",
                marginBottom: 8,
              }}
            >
              {isEpisode ? item.SeriesName : item.Name}
            </Text>
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {item.ProductionYear ? (
              <Text style={{ color: TextColor.secondary, fontSize: 13 }}>
                {item.ProductionYear}
              </Text>
            ) : null}
            {item.RunTimeTicks ? (
              <Text style={{ color: TextColor.secondary, fontSize: 13 }}>
                {item.ProductionYear ? " · " : ""}
                {runtimeTicksToMinutes(item.RunTimeTicks)}
              </Text>
            ) : null}
            {isEpisode ? (
              <Text style={{ color: TextColor.secondary, fontSize: 13 }}>
                {item.ProductionYear || item.RunTimeTicks ? " · " : ""}
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
                marginTop: 6,
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
              marginTop: 14,
              gap: 10,
            }}
          >
            <TouchableOpacity
              onPress={handlePlay}
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
                borderRadius: Radius.full,
                paddingVertical: 10,
                paddingHorizontal: 20,
                minHeight: 44,
              }}
            >
              <Ionicons name='play' size={18} color='#000000' />
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
                borderRadius: Radius.full,
                paddingVertical: 10,
                paddingHorizontal: 16,
                minHeight: 44,
                minWidth: 44,
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={18}
                color='#ffffff'
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableItemRouter>
  );
};
