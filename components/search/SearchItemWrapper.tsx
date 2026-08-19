import { FlashList } from "@shopify/flash-list";
import { useAtom } from "jotai";
import type React from "react";
import type { PropsWithChildren } from "react";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { SectionHeader } from "../common/SectionHeader";

type SearchItemWrapperProps<T> = {
  items?: T[];
  renderItem: (item: any) => React.ReactElement | null;
  header?: string;
  onEndReached?: (() => void) | null | undefined;
};

export const SearchItemWrapper = <T,>({
  items,
  renderItem,
  header,
  onEndReached,
}: PropsWithChildren<SearchItemWrapperProps<T>>) => {
  const [_api] = useAtom(apiAtom);
  const [_user] = useAtom(userAtom);

  if (!items || items.length === 0) return null;

  return (
    <>
      <SectionHeader title={header || ""} />
      <FlashList
        horizontal
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, index) => index.toString()}
        data={items}
        onEndReachedThreshold={1}
        onEndReached={onEndReached}
        renderItem={({ item }) => (item ? renderItem(item) : null)}
      />
    </>
  );
};
