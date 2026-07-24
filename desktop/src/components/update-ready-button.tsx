import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdaterStore } from "@/stores/updater";

export function UpdateReadyButton() {
  const stage = useUpdaterStore((state) => state.stage);
  const version = useUpdaterStore((state) => state.version);
  const applyUpdate = useUpdaterStore((state) => state.applyUpdate);

  if (stage !== "ready" && stage !== "restart") return null;

  const restarting = stage === "restart";
  const label = restarting ? "重启" : "更新";
  const title = restarting
    ? "重启以完成更新"
    : `新版本 v${version} 已下载，点击更新`;

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="bg-primary/35 absolute inset-0 animate-ping rounded-md motion-reduce:animate-none"
      />
      <Button
        type="button"
        size="sm"
        className="relative h-8 gap-1.5 px-2.5"
        title={title}
        aria-label={title}
        onClick={() => void applyUpdate()}
      >
        <RefreshCw />
        {label}
      </Button>
    </div>
  );
}
