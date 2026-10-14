// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { HTMLAttributes, ReactNode } from "react";

interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function ButtonGroup({ className, children, ...props }: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={[
        "inline-flex overflow-hidden rounded-lg border border-border bg-background",
        "[&>button]:rounded-none [&>button]:border-0 [&>button]:shadow-none",
        "[&>button:not(:last-child)]:border-r [&>button:not(:last-child)]:border-border",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
