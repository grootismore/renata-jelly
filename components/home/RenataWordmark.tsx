import { Text } from "@/components/common/Text";
import { TextColor } from "@/constants/theme";

/**
 * Home header wordmark. Typography only, per instruction — no raster/SVG
 * logo asset exists yet (see RENATA_DEVLOG.md Phase 2 §5). Sized down and
 * lightened in Phase 3.1: now that the hero's backdrop bleeds up behind
 * the transparent header (see Home.tsx/HeroBanner.tsx), a smaller, less
 * heavy mark reads as an integrated label over the artwork rather than a
 * competing headline sitting on top of it.
 */
export const RenataWordmark: React.FC = () => {
  return (
    <Text
      style={{
        color: TextColor.primary,
        fontSize: 15,
        fontWeight: "600",
        letterSpacing: 3,
      }}
    >
      RENATA
    </Text>
  );
};
