import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, type TouchableOpacityProps } from "react-native";
import { Colors } from "@/constants/Colors";
import { TextColor } from "@/constants/theme";
import { useFilterReset } from "@/hooks/useFilterReset";

interface Props extends TouchableOpacityProps {
  libraryId: string;
}

export const ResetFiltersButton: React.FC<Props> = ({
  libraryId,
  ...props
}) => {
  const { hasActiveFilters, resetAllFilters } = useFilterReset(libraryId);

  if (!hasActiveFilters) {
    return null;
  }

  return (
    <TouchableOpacity
      style={{
        width: 28,
        height: 28,
        borderRadius: 9999,
        backgroundColor: Colors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 4,
      }}
      {...props}
      // After the spread so a forwarded onPress can't disable the reset.
      onPress={resetAllFilters}
    >
      <Ionicons name='close' size={16} color={TextColor.onAccent} />
    </TouchableOpacity>
  );
};
