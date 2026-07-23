import type { LucideIcon } from "lucide-react";
import { Bot, Laptop, Server, Smartphone } from "lucide-react";
import type { TietiezhiDevice } from "@/lib/api";

export function deviceIcon(device: TietiezhiDevice): LucideIcon {
  if (device.role === "core") return Server;
  switch (device.platform.toLowerCase()) {
    case "android":
    case "ios":
      return Smartphone;
    case "macos":
    case "windows":
    case "linux":
      return Laptop;
    default:
      return Bot;
  }
}
