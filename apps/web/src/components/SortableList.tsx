import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode, useState, useRef, type CSSProperties } from "react";
import { GripVertical } from "lucide-react";

interface SortableItemProps {
  id: string | number;
  children: (handleProps: {
    setNodeRef: (node: HTMLElement | null) => void;
    attributes: any;
    listeners: any;
    style: CSSProperties;
    isDragging: boolean;
  }) => ReactNode;
}

export function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition, // Désactiver la transition pendant le drag
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <>
      {children({
        setNodeRef,
        attributes,
        listeners,
        style,
        isDragging,
      })}
    </>
  );
}

export function DragHandle({
  listeners,
  attributes,
}: {
  listeners: any;
  attributes: any;
}) {
  return (
    <div
      {...listeners}
      {...attributes}
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
      attributes: any;
      listeners: any;
      style: CSSProperties;
      isDragging: boolean;
    }
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
  // État local uniquement pendant un drag actif pour éviter la duplication de mémoire
  const [localItems, setLocalItems] = useState<T[] | null>(null);
  // Ref pour tracker si on est en train de drag (évite les re-renders)
  const isDraggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Délai avant activation pour éviter les drags accidentels
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (_event: DragStartEvent) => {
    isDraggingRef.current = true;
    // Initialiser l'état local seulement au début du drag
    setLocalItems(items);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    isDraggingRef.current = false;

    if (over && active.id !== over.id && localItems) {
      const oldIndex = localItems.findIndex((item) => item.id === active.id);
      const newIndex = localItems.findIndex((item) => item.id === over.id);

      const newOrder = arrayMove(localItems, oldIndex, newIndex);

      // Mettre à jour l'état local immédiatement pour éviter le flash
      setLocalItems(newOrder);

      // Appeler la mutation de manière asynchrone
      setTimeout(() => {
        onReorder(newOrder);
        // Réinitialiser l'état local après un court délai pour libérer la mémoire
        setTimeout(() => {
          setLocalItems(null);
        }, 100);
      }, 0);
    } else {
      // Si pas de changement, réinitialiser immédiatement
      setLocalItems(null);
    }
  };

  const isDisabled = disabled || isPending;
  // Utiliser localItems seulement s'il existe (pendant/après drag), sinon items
  const displayItems = isDisabled || !localItems ? items : localItems;

  if (isDisabled) {
    return (
      <div
        className={`${className} ${
          isPending ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        {displayItems.map((item) =>
          children(item, {
            setNodeRef: () => {},
            attributes: {},
            listeners: {},
            style: {},
            isDragging: false,
          })
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={displayItems}
        strategy={verticalListSortingStrategy}
      >
        <div className={className}>
          {displayItems.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              {(handleProps) => children(item, handleProps)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
