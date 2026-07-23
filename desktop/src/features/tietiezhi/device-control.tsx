import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Server, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddDeviceCoreDialog } from "@/features/tietiezhi/add-device-core-dialog";
import { DeviceSelector } from "@/features/tietiezhi/device-selector";
import {
  listConnectedDevices,
  listDeviceCores,
  removeDeviceCore,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTietiezhiStore } from "@/stores/tietiezhi";

export function TietiezhiDeviceControl() {
  const queryClient = useQueryClient();
  const selectedDeviceId = useTietiezhiStore((state) => state.selectedDeviceId);
  const setSelectedDeviceId = useTietiezhiStore((state) => state.setSelectedDeviceId);
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const devicesQuery = useQuery({
    queryKey: ["tietiezhi", "devices"],
    queryFn: listConnectedDevices,
    refetchInterval: 15_000,
  });
  const coresQuery = useQuery({
    queryKey: ["tietiezhi", "cores"],
    queryFn: listDeviceCores,
    refetchInterval: 15_000,
  });
  const devices = devicesQuery.data ?? [];
  const selected = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];

  useEffect(() => {
    if (devices.length > 0 && !devices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId, setSelectedDeviceId]);

  const remove = useMutation({
    mutationFn: removeDeviceCore,
    onSuccess: () => {
      setSelectedDeviceId("local");
      void queryClient.invalidateQueries({ queryKey: ["tietiezhi"] });
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["tietiezhi"] });
  };

  return (
    <>
      <DeviceSelector
        devices={devices}
        selected={selected}
        onSelect={setSelectedDeviceId}
        onAdd={() => setAddOpen(true)}
        onManage={() => setManageOpen(true)}
        onRefresh={refresh}
        refreshing={devicesQuery.isFetching || coresQuery.isFetching}
      />

      <AddDeviceCoreDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={(core) => setSelectedDeviceId(`core:${core.id}`)}
      />

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>设备连接</DialogTitle>
            <DialogDescription>管理铁铁汁连接的远程 Core。</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {(coresQuery.data ?? []).map((core) => (
              <div key={core.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <Server className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{core.name}</p>
                  <p className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        core.online ? "bg-emerald-500" : "bg-muted-foreground/50",
                      )}
                    />
                    {core.online ? `${core.deviceCount} 台设备` : "离线"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(core.id)}
                  disabled={remove.isPending}
                  aria-label={`移除 ${core.name}`}
                >
                  {remove.isPending && remove.variables === core.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                </Button>
              </div>
            ))}
            {(coresQuery.data ?? []).length === 0 && (
              <p className="text-muted-foreground py-5 text-center text-sm">还没有远程 Core</p>
            )}
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <Plus /> 添加远程 Core
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
