// React Bits Shredder adapted to position ordering; no shredding or deletion.
import type { ReactNode } from "react";
import Shredder from "./Shredder";

export type ReorderItem = { id: string | number };
export function ReorderList<T extends ReorderItem>({
  items,
  onReorder,
  renderItem,
  rowHeight = 56,
  label,
  role = "group",
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  rowHeight?: number;
  label: string;
  role?: "group" | "rowgroup";
}) {
  return (
    <div role={role} aria-label={label} className="lxp-reorder-list">
      <Shredder
        items={items}
        onReorder={onReorder}
        renderItem={renderItem}
        reorderOnly
        dragHandle="[data-reorder-handle]"
        height={items.length * rowHeight}
        width={10000}
        inset={0}
        gap={0}
        fallHeight={0}
        slitHeight={0}
        autoFeed={false}
        lift={1.01}
        dragTilt={2}
      />
    </div>
  );
}
