import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { Button } from "@/components/Button";
import { TextColor } from "@/constants/theme";
import { Text } from "./Text";

interface ErrorStateProps {
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

/**
 * Generic error-state placeholder (fetch failed, unreachable, etc.) with an
 * optional retry action. Several screens currently hand-roll their own
 * error copy/layout ad hoc — this is a shared primitive for new/redesigned
 * screens to converge on. Existing per-screen implementations are
 * intentionally left as-is this phase.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message,
  retryLabel = "Retry",
  onRetry,
}) => {
  return (
    <View className='flex-1 items-center justify-center py-12 px-6'>
      <Ionicons
        name='alert-circle-outline'
        size={32}
        color={TextColor.tertiary}
      />
      <Text
        className='mt-3 text-base font-semibold text-center'
        style={{ color: TextColor.secondary }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          className='mt-1 text-sm text-center'
          style={{ color: TextColor.tertiary }}
        >
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <Button onPress={onRetry} color='black' className='mt-4 px-6'>
          {retryLabel}
        </Button>
      ) : null}
    </View>
  );
};
