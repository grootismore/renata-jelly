import { Text } from "@/components/common/Text";
import { TextColor } from "@/constants/theme";

/**
 * Home header wordmark. Typography only, per instruction — no raster/SVG
 * logo asset exists yet (see RENATA_DEVLOG.md Phase 2 §5).
 */
export const RenataWordmark: React.FC = () => {
  return (
    <Text
      style={{
        color: TextColor.primary,
        fontSize: 17,
        fontWeight: "700",
        letterSpacing: 4,
      }}
    >
      RENATA
    </Text>
  );
};
