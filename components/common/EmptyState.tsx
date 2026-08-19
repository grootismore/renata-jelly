import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { TextColor } from "@/constants/theme";
import { Text } from "./Text";

interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title?: string;
  message?: string;
}

/**
 * Generic empty-state placeholder (no results / nothing here yet). Several
 * screens currently hand-roll their own "no items" text ad hoc — this is a
 * shared primitive for new/redesigned screens to converge on. Existing
 * per-screen implementations are intentionally left as-is this phase.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "file-tray-outline",
  title = "Nothing here yet",
  message,
}) => {
  return (
    <View className='flex-1 items-center justify-center py-12 px-6'>
      <Ionicons name={icon} size={32} color={TextColor.tertiary} />
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
    </View>
  );
};
