import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import {
  PointerActivationConstraints,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/dom";
import type { BoardKanbanStatusApi, BoardTask } from "@hously/shared/types";
import {
  groupTasks,
  normalizeColumns,
  toSyncPayload,
} from "@/pages/board/_utils/columns";
import { useSyncBoardTasks } from "@/pages/board/_hooks/useBoardTasks";

type DragEndPayload = Parameters<DragEndEvent>[0];
type DragOverPayload = Parameters<DragOverEvent>[0];

export function useBoardDragDrop(kanbanTasks: BoardTask[]) {
  const syncMutation = useSyncBoardTasks();

  const groupedFromServer = useMemo(
    () => groupTasks(kanbanTasks),
    [kanbanTasks],
  );

  const [columns, setColumns] =
    useState<Record<BoardKanbanStatusApi, BoardTask[]>>(groupedFromServer);
  const columnsRef = useRef(columns);

  useLayoutEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    setColumns(groupedFromServer);
  }, [groupedFromServer]);

  const snapshotRef = useRef<Record<BoardKanbanStatusApi, BoardTask[]> | null>(
    null,
  );

  const sensors = useMemo(
    () => [
      PointerSensor.configure({
        activationConstraints: [
          new PointerActivationConstraints.Distance({ value: 8 }),
        ],
      }),
      KeyboardSensor,
    ],
    [],
  );

  const handleDragStart = useCallback(() => {
    snapshotRef.current = structuredClone(columnsRef.current);
  }, []);

  const handleDragOver = useCallback((event: DragOverPayload) => {
    setColumns(
      (prev) => move(prev, event) as Record<BoardKanbanStatusApi, BoardTask[]>,
    );
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndPayload) => {
      if (event.canceled) {
        if (snapshotRef.current) setColumns(snapshotRef.current);
        snapshotRef.current = null;
        return;
      }
      snapshotRef.current = null;
      const source = event.operation.source;
      if (source && isSortable(source)) {
        const normalized = normalizeColumns(columnsRef.current);
        setColumns(normalized);
        syncMutation.mutate({ tasks: toSyncPayload(normalized) });
      }
    },
    [syncMutation],
  );

  return {
    columns,
    setColumns,
    columnsRef,
    sensors,
    syncMutation,
    dragHandlers: {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
    },
  };
}
