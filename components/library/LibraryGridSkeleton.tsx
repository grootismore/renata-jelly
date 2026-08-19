import { View } from "react-native";
import { Skeleton } from "@/components/common/Skeleton";

interface Props {
  columns: number;
  /** Rows of placeholder cards to show — enough to fill a typical first
   * screen without over-rendering. */
  rows?: number;
}

/**
 * Loading placeholder for Renata's browse grids (individual library,
 * Favorites "See all"), sized to approximate the real `ItemPoster` (10:15
 * portrait) + `ItemCardText` (two lines) geometry so nothing jumps in size
 * once data arrives — replaces the previous spinner→blank→full-grid
 * sequence (Phase 4 §10).
 */
export const LibraryGridSkeleton: React.FC<Props> = ({ columns, rows = 4 }) => {
  const cellCount = columns * rows;

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 12,
      }}
    >
      {Array.from({ length: cellCount }).map((_, i) => (
        <View
          key={i}
          style={{
            width: `${100 / columns}%`,
            paddingHorizontal: 4,
            marginBottom: 16,
          }}
        >
          <Skeleton
            height='auto'
            radius='md'
            style={{ aspectRatio: 10 / 15 }}
          />
          <Skeleton width='80%' height={11} style={{ marginTop: 6 }} />
          <Skeleton width='45%' height={9} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
};
