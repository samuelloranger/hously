import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
} from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { PointerActivationConstraints, type DragEndEvent } from "@dnd-kit/dom";
import { ReactNode, useState, type CSSProperties, type Ref } from "react";
import { GripVertical } from "lucide-react";

type DragEndPayload = Parameters<DragEndEvent>[0];

interface SortableItemProps {
  id: string | number;
  index: number;
  children: (handleProps: {
    setNodeRef: (node: HTMLElement | null) => void;
    handleRef: (node: Element | null) => void;
    style: CSSProperties;
    isDragging: boolean;
  }) => ReactNode;
}

function SortableItem({ id, index, children }: SortableItemProps) {
  const { ref, handleRef, isDragging } = useSortable({ id, index });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  const setNodeRef = (node: HTMLElement | null) => {
    ref(node);
  };

  return (
    <>
      {children({
        setNodeRef,
        handleRef,
        style,
        isDragging,
      })}
    </>
  );
}

export function DragHandle({
  handleRef,
}: {
  handleRef: (element: Element | null) => void;
}) {
  return (
    <div
      ref={handleRef as Ref<HTMLDivElement>}
      className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 p-1 -ml-1"
      aria-label="Drag to reorder"
    >
      <GripVertical size={16} />
    </div>
  );
}

interface SortableListProps<T extends { id: number | string }> {
  items: T[];
  onReorder: (newOrder: T[]) => void;
  children: (
    item: T,
    handleProps: {
      setNodeRef: (node: HTMLElement | null) => void;
      handleRef: (node: Element | null) => void;
      style: CSSProperties;
      isDragging: boolean;
    },
  ) => ReactNode;
  className?: string;
  disabled?: boolean;
  isPending?: boolean;
}

export function SortableList<T extends { id: number | string }>({
  items,
  onReorder,
  children,
  className,
  disabled = false,
  isPending = false,
}: SortableListProps<T>) {
  const [localItems, setLocalItems] = useState<T[] | null>(null);

  const sensors = [
    PointerSensor.configure({
      activationConstraints: [
        new PointerActivationConstraints.Distance({ value: 8 }),
      ],
    }),
    KeyboardSensor,
  ];

  const handleDragStart = () => {
    setLocalItems(items);
  };

  const handleDragEnd = (event: DragEndPayload) => {
    const { canceled, operation } = event;

    if (canceled) {
      setLocalItems(null);
      return;
    }

    const source = operation.source;
    if (!isSortable(source) || localItems == null) {
      setLocalItems(null);
      return;
    }

    const { initialIndex, index } = source.sortable;
    if (initialIndex === index) {
      setLocalItems(null);
      return;
    }

    const next = [...localItems];
    const [removed] = next.splice(initialIndex, 1);
    next.splice(index, 0, removed);

    setLocalItems(next);
    onReorder(next);
    setTimeout(() => {
      setLocalItems(null);
    }, 100);
  };

  const isDisabled = disabled || isPending;
  const displayItems = isDisabled || !localItems ? items : localItems;

  if (isDisabled) {
    return (
      <div
        className={`${className} ${isPending ? "opacity-60 pointer-events-none" : ""}`}
      >
        {displayItems.map((item) =>
          children(item, {
            setNodeRef: () => {},
            handleRef: () => {},
            style: {},
            isDragging: false,
          }),
        )}
      </div>
    );
  }

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={className}>
        {displayItems.map((item, index) => (
          <SortableItem key={item.id} id={item.id} index={index}>
            {(handleProps) => children(item, handleProps)}
          </SortableItem>
        ))}
      </div>
    </DragDropProvider>
  );
}
