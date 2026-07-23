import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Network, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDeviceCore, errorMessage } from "@/lib/api";
import type { DeviceCore } from "@/lib/api";

export function AddDeviceCoreDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (core: DeviceCore) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setBaseUrl("");
      setToken("");
      setShowToken(false);
    }
  }, [open]);

  const add = useMutation({
    mutationFn: addDeviceCore,
    onSuccess: (core) => {
      void queryClient.invalidateQueries({ queryKey: ["tietiezhi"] });
      onAdded(core);
      onOpenChange(false);
    },
  });

  const submit = () => {
    if (!name.trim() || !baseUrl.trim()) return;
    add.mutate({ name, baseUrl, accessToken: token });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="bg-muted text-muted-foreground mb-1 flex size-10 items-center justify-center rounded-lg">
            <Network className="size-5" />
          </div>
          <DialogTitle>添加远程 Core</DialogTitle>
          <DialogDescription>
            连接运行在另一台电脑、NAS 或服务器上的 Tietiezhi Core，并聚合它下面的设备。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="device-core-name">名称</Label>
            <Input
              id="device-core-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：家里的 Core"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="device-core-url">连接地址</Label>
            <Input
              id="device-core-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="http://192.168.1.20:8080"
              spellCheck={false}
              autoCapitalize="none"
            />
            <p className="text-muted-foreground text-xs">
              支持局域网、Tailscale、反向代理或公网 HTTPS 地址。
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="device-core-token">访问令牌（可选）</Label>
            <div className="relative">
              <Input
                id="device-core-token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Bearer Token"
                className="pr-10"
                spellCheck={false}
                autoCapitalize="none"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setShowToken((value) => !value)}
                aria-label={showToken ? "隐藏访问令牌" : "显示访问令牌"}
              >
                {showToken ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <ShieldCheck className="size-3.5" />
              令牌保存在系统安全存储中，不写入设备配置文件。
            </p>
          </div>
          {add.isError && (
            <p className="text-destructive rounded-lg bg-destructive/10 px-3 py-2 text-xs">
              {errorMessage(add.error)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={submit}
            disabled={add.isPending || !name.trim() || !baseUrl.trim()}
          >
            {add.isPending ? <Loader2 className="animate-spin" /> : <Network />}
            添加并连接
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
