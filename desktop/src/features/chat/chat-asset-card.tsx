import {
  File,
  FileArchive,
  FileCode2,
  Film,
  Folder,
  ImageIcon,
  Music2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatAttachment } from "@/lib/api";
import { cn } from "@/lib/utils";

export function attachmentKind(asset: ChatAttachment): "image" | "file" | "folder" {
  if (asset.kind) return asset.kind;
  return asset.dataUrl?.startsWith("data:image/") ? "image" : "file";
}

export function formatAssetSize(size = 0): string {
  if (size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function fileLabel(asset: ChatAttachment): string {
  if (attachmentKind(asset) === "folder") {
    const entries = asset.textContent?.split("\n").filter(Boolean).length ?? 0;
    return entries > 0 ? `文件夹 · ${entries}${asset.truncated ? "+" : ""} 项` : "文件夹";
  }
  const extension = asset.name.split(".").pop()?.toUpperCase();
  return [extension && extension !== asset.name.toUpperCase() ? extension : "文件", formatAssetSize(asset.size)]
    .filter(Boolean)
    .join(" · ");
}

function AssetIcon({ asset }: { asset: ChatAttachment }) {
  const kind = attachmentKind(asset);
  if (kind === "folder") return <Folder className="size-5" />;
  if (kind === "image") return <ImageIcon className="size-5" />;
  if (asset.mimeType.startsWith("video/")) return <Film className="size-5" />;
  if (asset.mimeType.startsWith("audio/")) return <Music2 className="size-5" />;
  if (/zip|archive|compressed/.test(asset.mimeType)) return <FileArchive className="size-5" />;
  if (asset.textContent) return <FileCode2 className="size-5" />;
  return <File className="size-5" />;
}

export function ChatAssetCard({
  asset,
  onRemove,
  className,
}: {
  asset: ChatAttachment;
  onRemove?: () => void;
  className?: string;
}) {
  const kind = attachmentKind(asset);
  if (kind === "image" && asset.dataUrl) {
    return (
      <div
        title={asset.path || asset.name}
        className={cn("group relative size-16 shrink-0", className)}
      >
        <img
          src={asset.dataUrl}
          alt={asset.name}
          className="size-full rounded-xl border bg-muted object-cover"
        />
        {onRemove && (
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            aria-label={`移除 ${asset.name}`}
            className="absolute -top-1.5 -right-1.5 size-5 rounded-full shadow-sm"
            onClick={onRemove}
          >
            <X className="size-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      title={asset.path || asset.name}
      className={cn(
        "bg-muted/55 relative flex h-16 w-48 shrink-0 items-center gap-2.5 rounded-xl border px-2.5 pr-7",
        className,
      )}
    >
      <span className="bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border">
        <AssetIcon asset={asset} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-xs font-medium">{asset.name}</span>
        <span className="text-muted-foreground mt-0.5 block truncate text-[10px] uppercase">
          {fileLabel(asset)}{asset.truncated ? " · 已截断" : ""}
        </span>
      </span>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`移除 ${asset.name}`}
          className="absolute top-1 right-1 size-5 rounded-full"
          onClick={onRemove}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}
