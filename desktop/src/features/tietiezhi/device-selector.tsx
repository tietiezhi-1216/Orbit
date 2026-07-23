import {
  Check,
  ChevronDown,
  Laptop,
  Plus,
  RefreshCw,
  Server,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TietiezhiDevice } from "@/lib/api";
import { cn } from "@/lib/utils";
import { deviceIcon } from "@/features/tietiezhi/device-ui";

export function DeviceSelector({
  devices,
  selected,
  onSelect,
  onAdd,
  onManage,
  onRefresh,
  refreshing,
}: {
  devices: TietiezhiDevice[];
  selected?: TietiezhiDevice;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onManage: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const local = devices.filter((device) => device.coreId === "local");
  const remote = devices.filter((device) => device.coreId !== "local");
  const SelectedIcon = selected ? deviceIcon(selected) : Laptop;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-56 justify-start gap-2 px-2.5 font-normal"
        >
          <span className="relative flex size-5 shrink-0 items-center justify-center">
            <SelectedIcon className="size-3.5" />
            <span
              className={cn(
                "absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-background",
                selected?.online ? "bg-emerald-500" : "bg-muted-foreground",
              )}
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-left">
            {selected?.name ?? "选择设备"}
          </span>
          <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs">
          <Laptop className="size-3.5" /> 当前设备
        </DropdownMenuLabel>
        {local.map((device) => (
          <DeviceItem
            key={device.id}
            device={device}
            active={selected?.id === device.id}
            onSelect={onSelect}
          />
        ))}
        {remote.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 text-xs">
              <Server className="size-3.5" /> 远程设备
            </DropdownMenuLabel>
            {remote.map((device) => (
              <DeviceItem
                key={device.id}
                device={device}
                active={selected?.id === device.id}
                onSelect={onSelect}
              />
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAdd}>
          <Plus /> 添加远程 Core
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onManage}>
          <Settings2 /> 管理设备
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={cn(refreshing && "animate-spin")} /> 刷新设备
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeviceItem({
  device,
  active,
  onSelect,
}: {
  device: TietiezhiDevice;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = deviceIcon(device);
  return (
    <DropdownMenuItem onClick={() => onSelect(device.id)} className="gap-2.5 py-2">
      <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{device.name}</span>
        <span className="text-muted-foreground block truncate text-[10px]">
          {device.role === "core" ? "Core 主机" : device.platform} · {device.coreName}
        </span>
      </span>
      {active ? (
        <Check className="size-3.5" />
      ) : (
        <span
          className={cn(
            "size-2 rounded-full",
            device.online ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        />
      )}
    </DropdownMenuItem>
  );
}
