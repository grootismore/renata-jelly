import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { TouchableOpacity, View, type ViewProps } from "react-native";
import { Text } from "@/components/common/Text";
import { Colors } from "@/constants/Colors";
import { Radius, Surface, TextColor } from "@/constants/theme";
import { useGlobalModal } from "@/providers/GlobalModalProvider";
import { FilterSheetContent } from "./FilterSheetContent";

interface FilterButtonProps<T> extends ViewProps {
  id: string;
  queryKey: string;
  values: T[];
  title: string;
  set: (value: T[]) => void;
  queryFn: (params: any) => Promise<any>;
  renderItemLabel: (item: T) => string;
  multiple?: boolean;
  icon?: "filter" | "sort";
}

export const FilterButton = <T,>({
  id,
  queryFn,
  queryKey,
  set,
  values, // selected values
  title,
  renderItemLabel,
  multiple = false,
  icon = "filter",
  ...props
}: FilterButtonProps<T>) => {
  const { showModal, hideModal } = useGlobalModal();

  const { data: filters } = useQuery<T[]>({
    queryKey: ["filters", title, queryKey, id],
    queryFn,
    staleTime: 0,
    enabled: !!id && !!queryFn && !!queryKey,
  });

  const openSheet = () => {
    if (!filters?.length) return;
    showModal(
      <FilterSheetContent<T>
        title={title}
        data={filters}
        initialValues={values}
        set={set}
        renderItemLabel={renderItemLabel}
        multiple={multiple}
        onClose={hideModal}
      />,
      // No snap points: the sheet grows with its options and stops at the
      // shared ceiling, so a two-entry sort order opens small.
    );
  };

  const isActive = values.length > 0;

  return (
    <TouchableOpacity onPress={openSheet}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: Radius.full,
          backgroundColor: isActive ? Colors.primary : Surface.elevated,
          borderWidth: 1,
          borderColor: isActive ? Colors.primary : Surface.border,
          opacity: filters?.length === 0 ? 0.5 : 1,
        }}
        {...props}
      >
        <Text
          style={{
            color: isActive ? TextColor.onAccent : TextColor.secondary,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {title}
        </Text>
        {icon === "filter" ? (
          <Ionicons
            name='filter'
            size={12}
            color={isActive ? TextColor.onAccent : TextColor.secondary}
          />
        ) : (
          <FontAwesome
            name='sort'
            size={12}
            color={isActive ? TextColor.onAccent : TextColor.secondary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};
