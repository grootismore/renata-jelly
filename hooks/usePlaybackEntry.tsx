import { useActionSheet } from "@expo/react-native-action-sheet";
import { BottomSheetView } from "@gorhom/bottom-sheet";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, View } from "react-native";
import CastContext, {
  MediaHlsSegmentFormat,
  MediaHlsVideoSegmentFormat,
  MediaStreamType,
  type MediaTrack,
  PlayServicesState,
  useMediaStatus,
  useRemoteMediaClient,
} from "react-native-google-cast";
import { Button } from "@/components/Button";
import { Text } from "@/components/common/Text";
import { useHaptic } from "@/hooks/useHaptic";
import { usePlayMedia } from "@/hooks/usePlayMedia";
import { getDownloadedItemById } from "@/providers/Downloads/database";
import { useGlobalModal } from "@/providers/GlobalModalProvider";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { useOfflineMode } from "@/providers/OfflineModeProvider";
import { useSettings } from "@/utils/atoms/settings";
import { getParentBackdropImageUrl } from "@/utils/jellyfin/image/getParentBackdropImageUrl";
import { getPrimaryImageUrl } from "@/utils/jellyfin/image/getPrimaryImageUrl";
import { getStreamUrl } from "@/utils/jellyfin/media/getStreamUrl";
import {
  getExternalSubtitleUrl,
  isExternalSubtitle,
} from "@/utils/jellyfin/subtitleUtils";
import { logAndCaptureError } from "@/utils/log";
import type { PlayRequest } from "@/utils/nativePlayer/playRequest";
import { chromecast } from "@/utils/profiles/chromecast";
import { chromecasth265 } from "@/utils/profiles/chromecasth265";
import { formatDuration } from "@/utils/time";

export interface PlaybackEntryTrackOptions {
  audioIndex?: number;
  subtitleIndex?: number;
  mediaSourceId?: string;
  bitrateValue?: number;
}

/**
 * The established UI-level playback *decision* flow — resume-vs-restart
 * prompt, downloaded-file online/offline choice, Chromecast device picker —
 * factored out of PlayButton.tsx (Phase 3.1) so callers that can't embed
 * PlayButton's full slide-button UI (e.g. Home's hero) still route through
 * the exact same decisions before handing off to usePlayMedia, the single
 * protected playback entry point every play control in the app uses.
 * PlayButton.tsx itself now calls this hook rather than duplicating the
 * logic — there is exactly one implementation of this flow.
 *
 * Track selection (audio/subtitle/mediaSource/bitrate) is optional: callers
 * without a track-selection UI (like the hero) simply omit it, matching
 * usePlayMedia's own auto-select behavior when those fields are undefined.
 */
export function usePlaybackEntry(
  item: BaseItemDto | null | undefined,
  trackOptions: PlaybackEntryTrackOptions = {},
) {
  const isOffline = useOfflineMode();
  const { showActionSheetWithOptions } = useActionSheet();
  const client = useRemoteMediaClient();
  const mediaStatus = useMediaStatus();
  const { t } = useTranslation();
  const { showModal, hideModal } = useGlobalModal();
  const api = useAtomValue(apiAtom);
  const user = useAtomValue(userAtom);
  const { settings } = useSettings();
  const lightHapticFeedback = useHaptic("light");
  const playMedia = usePlayMedia();

  const { audioIndex, subtitleIndex, mediaSourceId, bitrateValue } =
    trackOptions;

  const handleNormalPlayFlow = useCallback(
    async (positionTicks: number) => {
      if (!item) return;

      const playRequest: PlayRequest = {
        itemId: item.Id!,
        audioIndex,
        subtitleIndex,
        mediaSourceId,
        bitrateValue,
        offline: isOffline,
        playbackPositionTicks: positionTicks,
      };

      if (!client) {
        await playMedia(playRequest, { item });
        return;
      }

      const options = ["Chromecast", "Device", "Cancel"];
      const cancelButtonIndex = 2;
      showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
        },
        async (selectedIndex: number | undefined) => {
          if (!api) return;
          const currentTitle = mediaStatus?.mediaInfo?.metadata?.title;
          const isOpeningCurrentlyPlayingMedia =
            currentTitle && currentTitle === item?.Name;

          switch (selectedIndex) {
            case 0:
              await CastContext.getPlayServicesState().then(async (state) => {
                if (state && state !== PlayServicesState.SUCCESS) {
                  CastContext.showPlayServicesErrorDialog(state);
                } else {
                  // Check if user wants H265 for Chromecast
                  const enableH265 = settings.enableH265ForChromecast;

                  // Validate required parameters before calling getStreamUrl
                  if (!api) {
                    console.warn("API not available for Chromecast streaming");
                    Alert.alert(
                      t("player.client_error"),
                      t("player.missing_parameters"),
                    );
                    return;
                  }
                  if (!user?.Id) {
                    console.warn(
                      "User not authenticated for Chromecast streaming",
                    );
                    Alert.alert(
                      t("player.client_error"),
                      t("player.missing_parameters"),
                    );
                    return;
                  }
                  if (!item?.Id) {
                    console.warn("Item not available for Chromecast streaming");
                    Alert.alert(
                      t("player.client_error"),
                      t("player.missing_parameters"),
                    );
                    return;
                  }

                  // Get a new URL with the Chromecast device profile
                  try {
                    const data = await getStreamUrl({
                      api,
                      item,
                      deviceProfile: enableH265 ? chromecasth265 : chromecast,
                      startTimeTicks: positionTicks,
                      userId: user.Id,
                      audioStreamIndex: audioIndex,
                      maxStreamingBitrate: bitrateValue,
                      mediaSourceId,
                      subtitleStreamIndex: subtitleIndex,
                    });

                    if (!data?.url) {
                      console.warn("No URL returned from getStreamUrl", data);
                      Alert.alert(
                        t("player.client_error"),
                        t("player.could_not_create_stream_for_chromecast"),
                      );
                      return;
                    }

                    // Text subtitles ride along as sidecar VTT tracks the
                    // receiver renders itself (see the chromecast subtitle
                    // profile). The receiver fetches them without auth
                    // headers, so the api key must be in the URL.
                    const subtitleTracks: MediaTrack[] = (
                      data.mediaSource?.MediaStreams ?? []
                    )
                      .filter(
                        (s) => s.Type === "Subtitle" && isExternalSubtitle(s),
                      )
                      .flatMap((s) => {
                        const url = getExternalSubtitleUrl(s, {
                          offline: false,
                          basePath: api.basePath,
                        });
                        if (!url || s.Index == null) return [];
                        // Only server-relative URLs get the token — an
                        // IsExternalUrl sub lives on a third-party host that
                        // must never see the Jellyfin access token.
                        const needsApiKey =
                          !s.IsExternalUrl && !/[?&]api_?key=/i.test(url);
                        return [
                          {
                            id: s.Index,
                            type: "text" as const,
                            subtype: "subtitles" as const,
                            contentId: needsApiKey
                              ? `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(api.accessToken)}`
                              : url,
                            contentType: "text/vtt",
                            language: s.Language ?? "und",
                            name: s.DisplayTitle ?? undefined,
                          },
                        ];
                      });

                    // Calculate start time in seconds from playback position
                    const startTimeSeconds = positionTicks / 10000000;

                    // Calculate stream duration in seconds from runtime
                    const streamDurationSeconds = item.RunTimeTicks
                      ? item.RunTimeTicks / 10000000
                      : undefined;

                    // HLS transcodes must be declared as HLS, otherwise the
                    // receiver tries to parse the m3u8 playlist as an MP4 file
                    // and the cast session dies immediately.
                    const isHls = data.url.includes(".m3u8");
                    // Jellyfin puts the HLS segment container in the URL; the
                    // receiver needs the matching hint (HEVC only works in fMP4).
                    const isFmp4 = data.url.includes("SegmentContainer=mp4");

                    client
                      .loadMedia({
                        mediaInfo: {
                          contentId: item.Id,
                          contentUrl: data?.url,
                          contentType: isHls
                            ? "application/x-mpegURL"
                            : "video/mp4",
                          ...(isHls && {
                            hlsSegmentFormat: isFmp4
                              ? MediaHlsSegmentFormat.FMP4
                              : MediaHlsSegmentFormat.TS,
                            hlsVideoSegmentFormat: isFmp4
                              ? MediaHlsVideoSegmentFormat.FMP4
                              : MediaHlsVideoSegmentFormat.MPEG2_TS,
                          }),
                          ...(subtitleTracks.length > 0 && {
                            mediaTracks: subtitleTracks,
                          }),
                          streamType: MediaStreamType.BUFFERED,
                          streamDuration: streamDurationSeconds,
                          metadata:
                            item.Type === "Episode"
                              ? {
                                  type: "tvShow",
                                  title: item.Name || "",
                                  episodeNumber: item.IndexNumber || 0,
                                  seasonNumber: item.ParentIndexNumber || 0,
                                  seriesTitle: item.SeriesName || "",
                                  images: [
                                    {
                                      url: getParentBackdropImageUrl({
                                        api,
                                        item,
                                        quality: 90,
                                        width: 2000,
                                      })!,
                                    },
                                  ],
                                }
                              : item.Type === "Movie"
                                ? {
                                    type: "movie",
                                    title: item.Name || "",
                                    subtitle: item.Overview || "",
                                    images: [
                                      {
                                        url: getPrimaryImageUrl({
                                          api,
                                          item,
                                          quality: 90,
                                          width: 2000,
                                        })!,
                                      },
                                    ],
                                  }
                                : {
                                    type: "generic",
                                    title: item.Name || "",
                                    subtitle: item.Overview || "",
                                    images: [
                                      {
                                        url: getPrimaryImageUrl({
                                          api,
                                          item,
                                          quality: 90,
                                          width: 2000,
                                        })!,
                                      },
                                    ],
                                  },
                        },
                        startTime: startTimeSeconds,
                      })
                      .then(() => {
                        const activeSubtitle = subtitleTracks.find(
                          (s) => s.id === subtitleIndex,
                        );
                        if (activeSubtitle) {
                          client
                            .setActiveTrackIds([activeSubtitle.id])
                            .catch((e) => {
                              // Subtitles are silently missing on the cast
                              // device when this fails.
                              logAndCaptureError(
                                "Chromecast setActiveTrackIds failed",
                                e,
                              );
                            });
                        }
                        // state is already set when reopening current media, so skip it here.
                        if (isOpeningCurrentlyPlayingMedia) {
                          return;
                        }
                        CastContext.showExpandedControls();
                      })
                      .catch((e) => {
                        logAndCaptureError("Chromecast loadMedia failed", e);
                        Alert.alert(
                          t("player.client_error"),
                          t("player.chromecast_playback_failed"),
                        );
                      });
                  } catch (e) {
                    logAndCaptureError("Chromecast stream setup failed", e);
                    Alert.alert(
                      t("player.client_error"),
                      t("player.could_not_create_stream_for_chromecast"),
                    );
                  }
                }
              });
              break;
            case 1:
              await playMedia(playRequest, { item });
              break;
            case cancelButtonIndex:
              break;
          }
        },
      );
    },
    [
      item,
      client,
      settings,
      api,
      user,
      showActionSheetWithOptions,
      mediaStatus,
      audioIndex,
      subtitleIndex,
      mediaSourceId,
      bitrateValue,
      playMedia,
      isOffline,
      t,
    ],
  );

  const startPlayback = useCallback(
    async (positionTicks: number) => {
      if (!item) return;

      // Check if item is downloaded
      const downloadedItem = item.Id
        ? getDownloadedItemById(item.Id)
        : undefined;

      // If already in offline mode, play downloaded file directly
      if (isOffline && downloadedItem) {
        await playMedia(
          {
            itemId: item.Id!,
            offline: true,
            playbackPositionTicks: positionTicks,
          },
          { item },
        );
        return;
      }

      // If online but file is downloaded, ask user which version to play
      if (downloadedItem) {
        if (Platform.OS === "android") {
          // Show bottom sheet for Android
          showModal(
            <BottomSheetView>
              <View className='px-4 mt-4 mb-12'>
                <View className='pb-6'>
                  <Text className='text-2xl font-bold mb-2'>
                    {t("player.downloaded_file_title")}
                  </Text>
                  <Text className='opacity-70 text-base'>
                    {t("player.downloaded_file_message")}
                  </Text>
                </View>
                <View className='space-y-3'>
                  <Button
                    onPress={() => {
                      hideModal();
                      void playMedia(
                        {
                          itemId: item.Id!,
                          offline: true,
                          playbackPositionTicks: positionTicks,
                        },
                        { item },
                      );
                    }}
                    color='purple'
                  >
                    {Platform.OS === "android"
                      ? "Play downloaded file"
                      : t("player.downloaded_file_yes")}
                  </Button>
                  <Button
                    onPress={() => {
                      hideModal();
                      handleNormalPlayFlow(positionTicks);
                    }}
                    color='white'
                    variant='border'
                  >
                    {Platform.OS === "android"
                      ? "Stream file"
                      : t("player.downloaded_file_no")}
                  </Button>
                </View>
              </View>
            </BottomSheetView>,
            {
              snapPoints: ["35%"],
              enablePanDownToClose: true,
            },
          );
        } else {
          // Show alert for iOS
          Alert.alert(
            t("player.downloaded_file_title"),
            t("player.downloaded_file_message"),
            [
              {
                text: t("player.downloaded_file_yes"),
                onPress: () => {
                  void playMedia(
                    {
                      itemId: item.Id!,
                      offline: true,
                      playbackPositionTicks: positionTicks,
                    },
                    { item },
                  );
                },
                isPreferred: true,
              },
              {
                text: t("player.downloaded_file_no"),
                onPress: () => {
                  handleNormalPlayFlow(positionTicks);
                },
              },
              {
                text: t("player.downloaded_file_cancel"),
                style: "cancel",
              },
            ],
          );
        }
        return;
      }

      // If not downloaded, proceed with normal flow
      handleNormalPlayFlow(positionTicks);
    },
    [item, isOffline, handleNormalPlayFlow, playMedia, t, showModal, hideModal],
  );

  const play = useCallback(() => {
    if (!item) return;

    lightHapticFeedback();

    // Same prompt the TV item page shows: an in-progress item asks whether
    // to resume or restart instead of silently resuming. Users can turn the
    // prompt off in settings, in which case playback resumes right away.
    const progressTicks = item.UserData?.PlaybackPositionTicks ?? 0;
    if (progressTicks > 0 && !settings.showResumeDialog) {
      void startPlayback(progressTicks);
      return;
    }
    if (progressTicks > 0) {
      Alert.alert(
        t("item_card.resume_playback"),
        t("item_card.resume_playback_description"),
        [
          {
            text: t("common.cancel"),
            style: "cancel",
          },
          {
            text: t("item_card.play_from_start"),
            onPress: () => void startPlayback(0),
          },
          {
            text: t("item_card.continue_from", {
              time: formatDuration(progressTicks),
            }),
            onPress: () => void startPlayback(progressTicks),
            isPreferred: true,
          },
        ],
      );
      return;
    }

    void startPlayback(0);
  }, [item, lightHapticFeedback, startPlayback, t, settings.showResumeDialog]);

  return { play };
}
