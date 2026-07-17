import { AppIcon } from "@/components/app-icon";

export function AppIconLoader() {
  return (
    <div className="flex items-center gap-2" role="status" aria-label="铁铁汁正在生成">
      <span className="relative grid size-8 place-items-center">
        <span
          aria-hidden
          className="absolute inset-[-4px] animate-[spin_1.7s_linear_infinite] rounded-full border border-cyan-500/20 border-t-cyan-500/85 motion-reduce:animate-none"
        />
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-cyan-400/15 motion-reduce:animate-none"
        />
        <AppIcon
          size="sm"
          aria-hidden
          alt=""
          className="relative animate-pulse motion-reduce:animate-none"
        />
      </span>
      <span aria-hidden className="text-muted-foreground flex items-center gap-1">
        <span className="size-1 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.24s] motion-reduce:animate-none" />
        <span className="size-1 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.12s] motion-reduce:animate-none" />
        <span className="size-1 rounded-full bg-cyan-500 animate-bounce motion-reduce:animate-none" />
      </span>
      <span className="sr-only">正在生成</span>
    </div>
  );
}
