import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type AppIconSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AppIconSize, string> = {
  sm: "size-5",
  md: "size-8",
  lg: "size-14",
};

export interface AppIconProps extends Omit<ComponentProps<"img">, "size" | "src"> {
  size?: AppIconSize;
}

export function AppIcon({ size = "md", alt = "铁铁汁", className, ...props }: AppIconProps) {
  return (
    <img
      {...props}
      src="/tietiezhi.png"
      alt={alt}
      draggable={false}
      className={cn("shrink-0 object-contain", SIZE_CLASSES[size], className)}
    />
  );
}
