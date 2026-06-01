import { useDroppable } from "@dnd-kit/react";
import type { BoardTaskStatusApi } from "@hously/shared/types";
interface BoardColumnProps {
  status: BoardTaskStatusApi;
  children: React.ReactNode;
}

export function BoardColumn({ status, children }: BoardColumnProps) {
  const { ref } = useDroppable({ id: status });
  return (
    <div
      ref={ref as React.RefCallback<HTMLDivElement>}
      className="flex min-h-[min(70vh,520px)] flex-1 min-w-[260px] flex-col rounded-xl border border-neutral-700/60 bg-neutral-900/40"
    >
      {children}
    </div>
  );
}
