import { useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { CheckCircle2, Loader2, RefreshCw, RotateCw, Store } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/features/settings/settings-section";
import { useUpdaterStore } from "@/stores/updater";

/** In-app updater: check → download & install → relaunch. */
export function UpdateCard() {
  if (import.meta.env.MODE === "store") {
    return <MicrosoftStoreUpdateCard />;
  }

  return <DirectDownloadUpdateCard />;
}

function MicrosoftStoreUpdateCard() {
  return (
    <SettingsSection description="Microsoft Store 会自动提供经过验证的应用更新。">
      <Badge variant="secondary">
        <Store /> Microsoft Store 管理
      </Badge>
    </SettingsSection>
  );
}

function DirectDownloadUpdateCard() {
  const stage = useUpdaterStore((state) => state.stage);
  const updateVersion = useUpdaterStore((state) => state.version);
  const body = useUpdaterStore((state) => state.body);
  const percent = useUpdaterStore((state) => state.percent);
  const updateError = useUpdaterStore((state) => state.error);
  const checkAndDownload = useUpdaterStore((state) => state.checkAndDownload);
  const applyUpdate = useUpdaterStore((state) => state.applyUpdate);
  const versionQuery = useQuery({
    queryKey: ["appVersion"],
    queryFn: getVersion,
    retry: false,
    staleTime: Infinity,
  });

  const description = [
    `当前版本 v${versionQuery.data ?? "—"}`,
    stage === "checking" ? "正在检查更新。" : "",
    stage === "none" ? "已是最新版本。" : "",
    stage === "downloading" ? `正在后台下载 v${updateVersion}。` : "",
    stage === "ready" ? `v${updateVersion} 已下载完成。` : "",
    stage === "installing" ? `正在安装 v${updateVersion}。` : "",
    stage === "restart" ? `v${updateVersion} 已安装，等待重启。` : "",
  ]
    .filter(Boolean)
    .join("，");

  return (
    <SettingsSection description={description}>
      {body && ["downloading", "ready", "installing", "restart"].includes(stage) && (
        <p className="text-muted-foreground whitespace-pre-wrap text-sm">{body}</p>
      )}
      {(stage === "error" || updateError) && (
        <Alert variant="destructive">
          <AlertTitle>更新失败</AlertTitle>
          <AlertDescription>{updateError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {stage === "downloading" ? (
          <Button disabled>
            <Loader2 className="animate-spin" />
            后台下载中{percent != null ? ` ${percent}%` : "…"}
          </Button>
        ) : stage === "ready" ? (
          <Button onClick={() => void applyUpdate()}>
            <RefreshCw /> 更新到 v{updateVersion}
          </Button>
        ) : stage === "installing" ? (
          <Button disabled>
            <Loader2 className="animate-spin" /> 正在安装
          </Button>
        ) : stage === "restart" ? (
          <Button onClick={() => void applyUpdate()}>
            <RotateCw /> 重启以完成更新
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => void checkAndDownload()}
            disabled={stage === "checking"}
          >
            {stage === "checking" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {stage === "error" ? "重试更新" : "检查更新"}
          </Button>
        )}
        {stage === "none" && (
          <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 /> 已是最新
          </Badge>
        )}
        {stage === "ready" && (
          <span className="text-muted-foreground text-xs">
            安装包已下载完成，点击更新后将重启应用。
          </span>
        )}
      </div>
    </SettingsSection>
  );
}
