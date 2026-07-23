import { Gauge, Shrink } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const commands = [
  {
    value: "/compact",
    aliases: "/summarize · /压缩",
    title: "立即压缩上下文",
    description: "生成锚定摘要，完整聊天记录仍保留在本地",
    icon: Shrink,
  },
  {
    value: "/context",
    aliases: "/上下文",
    title: "查看上下文占用",
    description: "估算当前 Token 用量和 256K 窗口占比",
    icon: Gauge,
  },
] as const;

export function ContextCommandMenu({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (command: string) => void;
}) {
  const normalized = query.trim().toLocaleLowerCase();
  const visible = commands.filter((command) =>
    [command.value, command.aliases, command.title].some((value) =>
      value.toLocaleLowerCase().includes(normalized),
    ),
  );

  return (
    <div className="bg-popover absolute inset-x-0 bottom-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-xl border shadow-lg">
      <Command shouldFilter={false}>
        <CommandList>
          <CommandEmpty>没有匹配的指令</CommandEmpty>
          <CommandGroup heading="上下文指令">
            {visible.map((command) => (
              <CommandItem
                key={command.value}
                value={command.value}
                onSelect={() => onSelect(command.value)}
                className="items-start py-2"
              >
                <command.icon className="mt-0.5 size-4" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {command.value} · {command.title}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {command.description}
                  </span>
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {command.aliases}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
