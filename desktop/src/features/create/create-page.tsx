import type { LucideIcon } from "lucide-react";
import { Images, Library, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreateView } from "@/stores/create";
import { useCreateStore } from "@/stores/create";
import { CreateGenerations } from "./create-generations";
import { CreateHome } from "./create-home";
import { CreateLibrary } from "./create-library";

const NAVIGATION: Array<{
  id: CreateView;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "inspiration", label: "灵感", icon: Sparkles },
  { id: "generations", label: "生成", icon: Images },
  { id: "assets", label: "资产", icon: Library },
];

export function CreatePage() {
  const view = useCreateStore((state) => state.view);
  const tasks = useCreateStore((state) => state.tasks);
  const assets = useCreateStore((state) => state.assets);
  const setView = useCreateStore((state) => state.setView);
  const activeTasks = tasks.filter(
    (task) => task.status === "queued" || task.status === "running",
  ).length;

  return (
    <main className="flex h-full min-h-0 bg-[#0d0e11]">
      <aside className="flex w-20 shrink-0 flex-col items-center border-r border-white/6 bg-[#0b0c0f] px-2 py-5 text-white">
        <div className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-cyan-300 via-sky-400 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/10">
          <Sparkles className="size-4" />
        </div>
        <nav className="mt-14 flex w-full flex-col gap-2">
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            const count =
              item.id === "generations"
                ? activeTasks
                : item.id === "assets"
                  ? assets.length
                  : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                aria-current={view === item.id ? "page" : undefined}
                className={cn(
                  "relative flex h-14 w-full flex-col items-center justify-center gap-1 rounded-xl text-[10px] text-white/40 transition-[background-color,color,transform] hover:bg-white/5 hover:text-white/75 active:scale-[0.98]",
                  view === item.id && "bg-white/8 text-white hover:bg-white/8 hover:text-white",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "absolute top-1.5 right-2 min-w-4 rounded-full bg-white/10 px-1 text-center text-[8px] leading-4 text-white/60",
                      item.id === "generations" && "bg-cyan-300 text-slate-950",
                    )}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto h-8 w-px bg-linear-to-b from-transparent via-white/10 to-transparent" />
      </aside>

      <div className="min-w-0 flex-1">
        {view === "assets" ? (
          <CreateLibrary />
        ) : view === "generations" ? (
          <CreateGenerations />
        ) : (
          <CreateHome />
        )}
      </div>
    </main>
  );
}
