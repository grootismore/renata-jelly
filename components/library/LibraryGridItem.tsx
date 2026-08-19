import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { View } from "react-native";
import { TouchableItemRouter } from "@/components/common/TouchableItemRouter";
import { ItemCardText } from "@/components/ItemCardText";
import { ItemPoster } from "@/components/posters/ItemPoster";
import * as ScreenOrientation from "@/packages/expo-screen-orientation";

interface Props {
  item: BaseItemDto;
  index: number;
  columns: number;
  /** From `useOrientation()`. Portrait uses the flex-end/center/flex-start
   * trick below for even gutters; other orientations just center every
   * card (matches [libraryId].tsx's prior per-screen behavior). */
  orientation: (typeof ScreenOrientation.OrientationLock)[keyof typeof ScreenOrientation.OrientationLock];
}

/**
 * Shared grid card for Renata's browse surfaces (individual library, and
 * Favorites' "See all"). Presentation-only wrapper around the existing
 * `ItemPoster`/`ItemCardText`/`TouchableItemRouter` — extracted so both
 * screens render identically instead of maintaining two near-duplicate
 * `renderItem` implementations (Phase 4 §8).
 *
 * The alignSelf trick (flex-end on the first column, flex-start on the
 * last, center everywhere else) is unchanged from the prior per-screen
 * implementations: each grid cell is `100% / columns` wide and the card
 * itself is 89% of that, so this produces even, intentional gutters
 * without hand-computed margins.
 */
export const LibraryGridItem: React.FC<Props> = ({
  item,
  index,
  columns,
  orientation,
}) => {
  const isPortrait =
    orientation === ScreenOrientation.OrientationLock.PORTRAIT_UP;

  return (
    <TouchableItemRouter
      item={item}
      style={{
        width: "100%",
        marginBottom: 4,
      }}
    >
      <View
        style={{
          alignSelf: isPortrait
            ? index % columns === 0
              ? "flex-end"
              : (index + 1) % columns === 0
                ? "flex-start"
                : "center"
            : "center",
          width: "89%",
        }}
      >
        <ItemPoster item={item} />
        <ItemCardText item={item} />
      </View>
    </TouchableItemRouter>
  );
};
