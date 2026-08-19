import { View } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Skeleton } from "../common/Skeleton";

interface Props {
  isLoading: boolean;
}

/**
 * Search's loading placeholder — three rows of poster-shaped `Skeleton`
 * blocks (Renata's shared placeholder primitive) instead of hand-rolled
 * gray boxes, so it matches Library/Favorites' loading treatment.
 */
export const LoadingSkeleton: React.FC<Props> = ({ isLoading }) => {
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  useAnimatedReaction(
    () => isLoading,
    (loading) => {
      if (loading) {
        opacity.value = withTiming(1, { duration: 200 });
      } else {
        opacity.value = withTiming(0, { duration: 200 });
      }
    },
  );

  return (
    <Animated.View style={animatedStyle} className='mt-2 absolute w-full'>
      {[1, 2, 3].map((s) => (
        <View className='px-4 mb-4' key={s}>
          <Skeleton
            width='40%'
            height={18}
            radius='sm'
            style={{ marginBottom: 10 }}
          />
          <View className='flex flex-row gap-2'>
            {[1, 2, 3].map((i) => (
              <View className='w-28' key={i}>
                <Skeleton height={168} radius='md' />
                <Skeleton width='90%' height={12} style={{ marginTop: 6 }} />
                <Skeleton width='50%' height={10} style={{ marginTop: 4 }} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </Animated.View>
  );
};
