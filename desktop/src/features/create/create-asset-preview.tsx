import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Clapperboard,
  Image as ImageIcon,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreateMode } from "@/stores/create";

export function CreateAssetPreview({
  mode,
  filePath,
  previewDataUrl,
  alt,
  className,
  controls = false,
}: {
  mode: CreateMode;
  filePath?: string;
  previewDataUrl?: string;
  alt?: string;
  className?: string;
  controls?: boolean;
}) {
  const source = previewDataUrl || (filePath ? convertFileSrc(filePath) : undefined);

  if (source && mode === "video") {
    return (
      <div className={cn("relative overflow-hidden bg-black", className)}>
        <video
          src={source}
          className="size-full object-cover"
          controls={controls}
          muted={!controls}
          playsInline
          preload="metadata"
        />
        {!controls && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/8">
            <span className="grid size-10 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm">
              <Play className="ml-0.5 size-4 fill-current" />
            </span>
          </span>
        )}
      </div>
    );
  }

  if (source) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        <img src={source} alt={alt ?? "生成作品"} className="size-full object-cover" />
      </div>
    );
  }

  const Icon = mode === "image" ? ImageIcon : Clapperboard;
  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden bg-[#17191d] text-white/35",
        className,
      )}
    >
      <span className="absolute -top-12 -left-8 size-36 rounded-full bg-cyan-400/10 blur-3xl" />
      <span className="absolute -right-12 -bottom-10 size-40 rounded-full bg-blue-500/12 blur-3xl" />
      <Icon className="relative size-7" />
      {mode === "video" && (
        <span className="absolute grid size-9 place-items-center rounded-full border border-white/15 bg-black/30 text-white/70">
          <Play className="ml-0.5 size-3.5 fill-current" />
        </span>
      )}
    </div>
  );
}
