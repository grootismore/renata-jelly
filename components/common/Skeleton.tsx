import { useEffect } from "react";
import { type DimensionValue, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Radius, Surface as SurfaceTokens } from "@/constants/theme";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: keyof typeof Radius;
  style?: React.ComponentProps<typeof View>["style"];
}

/**
 * Generic pulsing placeholder block for loading states. Several screens
 * currently hand-roll their own static gray boxes for this (e.g.
 * HorizontalScroll's inline placeholder, LoadingSkeleton.tsx, GridSkeleton.tsx)
 * — this is a shared primitive for new/redesigned screens to converge on.
 * Existing skeleton implementations are intentionally left as-is this
 * phase; migrating them is a UI change, not a foundation change.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 16,
  radius = "sm",
  style,
}) => {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.8, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: Radius[radius],
          backgroundColor: SurfaceTokens.elevated,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};
