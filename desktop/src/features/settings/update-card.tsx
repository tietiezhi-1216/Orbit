import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import { CheckCircle2, Download, Loader2, RefreshCw, RotateCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { SettingsSection } from "@/features/settings/settings-section";

type UpdateStage =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "none" }
  | { kind: "available"; update: Update }
  | { kind: "downloading"; percent: number | null }
  | { kind: "ready" }
  | { kind: "error"; message: string };

/** In-app updater: check → download & install → relaunch. */
export function UpdateCard() {
  const [stage, setStage] = useState<UpdateStage>({ kind: "idle" });
  const versionQuery = useQuery({
    queryKey: ["appVersion"],
    queryFn: getVersion,
    retry: false,
    staleTime: Infinity,
  });

  const runCheck = async () => {
    setStage({ kind: "checking" });
    try {
      const update = await check();
      setStage(update ? { kind: "available", update } : { kind: "none" });
    } catch (err) {
      setStage({ kind: "error", message: errorMessage(err) });
    }
  };

  const install = async (update: Update) => {
    setStage({ kind: "downloading", percent: null });
    try {
      let total = 0;
      let received = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          received += event.data.chunkLength;
          setStage({
            kind: "downloading",
            percent: total > 0 ? Math.min(100, Math.round((received / total) * 100)) : null,
          });
        }
      });
      setStage({ kind: "ready" });
    } catch (err) {
      setStage({ kind: "error", message: errorMessage(err) });
    }
  };

  const description =
    `当前版本 v${versionQuery.data ?? "—"}` +
    (stage.kind === "available" ? `，发现新版本 v${stage.update.version}` : "") +
    (stage.kind === "none" ? "，已是最新版本。" : "");

  return (
    <SettingsSection description={description}>
      {stage.kind === "available" && stage.update.body && (
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">
          {stage.update.body}
        </p>
      )}
      {stage.kind === "error" && (
        <Alert variant="destructive">
          <AlertTitle>更新失败</AlertTitle>
          <AlertDescription>{stage.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {stage.kind === "available" ? (
          <Button onClick={() => void install(stage.update)}>
            <Download /> 下载并安装 v{stage.update.version}
          </Button>
        ) : stage.kind === "downloading" ? (
          <Button disabled>
            <Loader2 className="animate-spin" />
            下载中{stage.percent != null ? ` ${stage.percent}%` : "…"}
          </Button>
        ) : stage.kind === "ready" ? (
          <Button onClick={() => void relaunch()}>
            <RotateCw /> 重启以完成更新
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => void runCheck()}
            disabled={stage.kind === "checking"}
          >
            {stage.kind === "checking" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            检查更新
          </Button>
        )}
        {stage.kind === "none" && (
          <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 /> 已是最新
          </Badge>
        )}
        {stage.kind === "ready" && (
          <span className="text-muted-foreground text-xs">
            更新已安装，重启后生效。
          </span>
        )}
      </div>
    </SettingsSection>
  );
}
