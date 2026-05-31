import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function TileCard({
  label,
  to,
  children,
  className,
}: {
  label: string;
  to?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-neutral-700 bg-neutral-800 p-3.5 transition-colors",
        to && "hover:border-neutral-600",
        className,
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </div>
  );
  return to ? (
    <Link to={to} className="min-w-0 flex-1">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 flex-1">{body}</div>
  );
}
