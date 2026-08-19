import type { ViewProps } from "react-native";
import { View } from "react-native";
import { Radius, Surface as SurfaceTokens } from "@/constants/theme";

interface SurfaceProps extends ViewProps {
  /** Corner radius token. Defaults to `md` (matches poster/card convention). */
  radius?: keyof typeof Radius;
}

/**
 * Solid elevated surface (card/sheet background) using the Phase 2 design
 * tokens. Use this for opaque elevated content; use `GlassSurface` instead
 * when a translucent/blur backdrop is wanted.
 */
export const Surface: React.FC<SurfaceProps> = ({
  style,
  radius = "md",
  children,
  ...props
}) => {
  return (
    <View
      style={[
        {
          backgroundColor: SurfaceTokens.elevated,
          borderRadius: Radius[radius],
          borderWidth: 1,
          borderColor: SurfaceTokens.border,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};
