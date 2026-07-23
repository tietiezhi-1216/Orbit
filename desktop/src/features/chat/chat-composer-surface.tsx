import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const CHAT_COMPOSER_TEXTAREA_CLASS =
  "max-h-40 min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:bg-transparent focus-visible:ring-0 focus-visible:shadow-none dark:bg-transparent dark:focus-visible:bg-transparent dark:focus-visible:shadow-none";

export function ChatComposerSurface({
  children,
  dragActive = false,
  className,
}: {
  children: ReactNode;
  dragActive?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted/70 relative z-20 flex flex-col rounded-2xl border-0 px-2 pt-1.5 pb-1.5 shadow-none transition-colors dark:bg-muted/65",
        dragActive && "bg-muted/90 dark:bg-muted/85",
        className,
      )}
    >
      {children}
    </div>
  );
}
