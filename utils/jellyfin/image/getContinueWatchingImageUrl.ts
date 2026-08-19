import type { Api } from "@jellyfin/sdk";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

/**
 * Landscape (Thumb-preferring, falling back to Primary) image URL used by
 * horizontal/"continue watching"-style cards. Extracted from
 * ContinueWatchingPoster's inline logic (Phase 3) so Home's larger card
 * variant can reuse the exact same resolution rules without duplicating
 * them — behavior is unchanged for existing callers.
 */
export const getContinueWatchingImageUrl = ({
  api,
  item,
  useEpisodePoster = false,
  height = 389,
  quality = 80,
}: {
  api?: Api | null;
  item: BaseItemDto;
  useEpisodePoster?: boolean;
  height?: number;
  quality?: number;
}): string | undefined => {
  if (!api) {
    return undefined;
  }

  if (item.Type === "Episode" && useEpisodePoster) {
    return `${api.basePath}/Items/${item.Id}/Images/Primary?fillHeight=${height}&quality=${quality}`;
  }

  if (item.Type === "Episode") {
    // Matched pair: the parent that owns the Thumb (ParentThumbItemId), not
    // the backdrop owner — otherwise the Thumb tag is requested on the
    // wrong item → black.
    if (item.ParentThumbItemId && item.ParentThumbImageTag) {
      return `${api.basePath}/Items/${item.ParentThumbItemId}/Images/Thumb?fillHeight=${height}&quality=${quality}&tag=${item.ParentThumbImageTag}`;
    }
    return `${api.basePath}/Items/${item.Id}/Images/Primary?fillHeight=${height}&quality=${quality}`;
  }

  if (item.ImageTags?.Thumb) {
    return `${api.basePath}/Items/${item.Id}/Images/Thumb?fillHeight=${height}&quality=${quality}&tag=${item.ImageTags.Thumb}`;
  }

  return `${api.basePath}/Items/${item.Id}/Images/Primary?fillHeight=${height}&quality=${quality}`;
};
