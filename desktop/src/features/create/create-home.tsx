import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Clapperboard,
  Image as ImageIcon,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CreateMode } from "@/stores/create";
import { useCreateStore } from "@/stores/create";
import { CreateComposer } from "./create-composer";

interface InspirationItem {
  id: string;
  mode: CreateMode;
  title: string;
  prompt: string;
  image: string;
  ratioClass: string;
  tag: string;
}

const INSPIRATIONS: InspirationItem[] = [
  {
    id: "quiet-station",
    mode: "image",
    title: "雨夜车站",
    prompt: "雨夜的未来城市车站，湿润地面倒映霓虹灯，一位撑透明伞的旅人站在画面中央，电影感广角构图",
    image: "/create-showcase/quiet-station.webp",
    ratioClass: "aspect-[4/5]",
    tag: "电影摄影",
  },
  {
    id: "blue-portrait",
    mode: "image",
    title: "海风人像",
    prompt: "海边自然光人像，蓝色针织上衣，微风吹动长发，干净通透的肤色，浅景深，高级时尚杂志质感",
    image: "/create-showcase/blue-portrait.webp",
    ratioClass: "aspect-[3/4]",
    tag: "人像摄影",
  },
  {
    id: "fruit-market",
    mode: "video",
    title: "水果店奇遇",
    prompt: "两只戴着水果帽的小猫在热闹的街边水果店探索，镜头缓慢向前推进，阳光穿过彩色遮阳棚，活泼自然",
    image: "/create-showcase/fruit-market.webp",
    ratioClass: "aspect-[4/3]",
    tag: "动态叙事",
  },
  {
    id: "paper-city",
    mode: "image",
    title: "纸艺城市",
    prompt: "由米白色纸张折叠而成的东方城市建筑群，俯视构图，精细纸艺纹理，柔和棚拍光线，极简背景",
    image: "/create-showcase/paper-city.webp",
    ratioClass: "aspect-square",
    tag: "创意设计",
  },
  {
    id: "little-explorer",
    mode: "video",
    title: "云端探险",
    prompt: "一个圆润可爱的3D小男孩驾驶迷你飞行器穿过柔软云层，镜头环绕角色，阳光明亮，动画电影质感",
    image: "/create-showcase/little-explorer.webp",
    ratioClass: "aspect-[3/4]",
    tag: "3D 动画",
  },
  {
    id: "glass-flower",
    mode: "image",
    title: "玻璃花园",
    prompt: "透明玻璃花朵在黑色背景中盛开，花瓣折射青蓝与金色光线，微距摄影，极致材质细节，奢华但克制",
    image: "/create-showcase/glass-flower.webp",
    ratioClass: "aspect-[4/5]",
    tag: "材质实验",
  },
  {
    id: "desert-train",
    mode: "video",
    title: "沙海列车",
    prompt: "复古列车穿越金色沙漠，远处巨大的月亮从地平线升起，航拍镜头平稳跟随，史诗电影氛围",
    image: "/create-showcase/desert-train.webp",
    ratioClass: "aspect-[16/10]",
    tag: "镜头运动",
  },
  {
    id: "ink-crane",
    mode: "image",
    title: "水墨仙鹤",
    prompt: "白色仙鹤从墨色山水间飞起，传统水墨与现代数字艺术结合，大面积留白，淡青色点缀，东方审美",
    image: "/create-showcase/ink-crane.webp",
    ratioClass: "aspect-[3/4]",
    tag: "东方美学",
  },
];

type InspirationFilter = "all" | CreateMode;

export function CreateHome() {
  const [filter, setFilter] = useState<InspirationFilter>("all");
  const [query, setQuery] = useState("");
  const setMode = useCreateStore((state) => state.setMode);
  const usePrompt = useCreateStore((state) => state.usePrompt);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return INSPIRATIONS.filter((item) => {
      const matchesMode = filter === "all" || item.mode === filter;
      const matchesQuery =
        !normalized ||
        item.title.toLocaleLowerCase().includes(normalized) ||
        item.prompt.toLocaleLowerCase().includes(normalized) ||
        item.tag.toLocaleLowerCase().includes(normalized);
      return matchesMode && matchesQuery;
    });
  }, [filter, query]);

  const chooseMode = (mode: CreateMode) => {
    setMode(mode);
    requestAnimationFrame(() => document.getElementById("create-prompt")?.focus());
  };

  const chooseInspiration = (item: InspirationItem) => {
    usePrompt(item.mode, item.prompt);
    requestAnimationFrame(() => {
      document.getElementById("create-prompt")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      document.getElementById("create-prompt")?.focus();
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0d0e11] text-white">
      <div className="mx-auto w-full max-w-[92rem] px-4 pt-8 pb-14 sm:px-7 lg:px-10 lg:pt-12">
        <header className="text-center">
          <Badge
            variant="outline"
            className="border-cyan-300/15 bg-cyan-300/5 text-cyan-200"
          >
            <Sparkles className="size-3" />
            Create Studio
          </Badge>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            把你的想象，变成
            <span className="ml-2 bg-linear-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent">
              真实作品
            </span>
          </h1>
          <p className="mt-2 text-sm text-white/38">一段描述，一张参考图，开始创作图片与视频。</p>
        </header>

        <div className="mx-auto mt-8 max-w-6xl">
          <CreateComposer />
        </div>

        <section className="mx-auto mt-8 grid max-w-6xl gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => chooseMode("image")}
            className="group relative min-h-24 overflow-hidden rounded-2xl border border-white/7 bg-[#15171b] p-4 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-[#191c21]"
          >
            <span className="absolute -top-10 right-8 size-32 rounded-full bg-cyan-400/15 blur-3xl transition-transform duration-500 group-hover:scale-125" />
            <span className="relative flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-cyan-300 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/10">
                <ImageIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">图片生成</span>
                <span className="mt-1 block text-xs text-white/38">文生图、参考图创作与多图融合</span>
              </span>
              <ArrowUpRight className="size-4 text-white/25 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-200" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => chooseMode("video")}
            className="group relative min-h-24 overflow-hidden rounded-2xl border border-white/7 bg-[#15171b] p-4 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-sky-300/20 hover:bg-[#191c21]"
          >
            <span className="absolute -top-10 right-8 size-32 rounded-full bg-blue-500/16 blur-3xl transition-transform duration-500 group-hover:scale-125" />
            <span className="relative flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-sky-300 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/10">
                <Clapperboard className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">视频生成</span>
                <span className="mt-1 block text-xs text-white/38">文生视频、首帧参考与镜头控制</span>
              </span>
              <ArrowUpRight className="size-4 text-white/25 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-200" />
            </span>
          </button>
        </section>

        <section className="mt-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-1">
              {([
                ["all", "发现"],
                ["image", "图片"],
                ["video", "视频"],
              ] as const).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilter(id)}
                  className={cn(
                    "rounded-xl px-4 text-white/42 hover:bg-white/6 hover:text-white",
                    filter === id && "bg-white/9 text-white hover:bg-white/9",
                  )}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="relative w-full sm:ml-auto sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/28" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索灵感、风格或场景"
                className="h-9 rounded-xl border-white/7 bg-white/4 pl-9 text-xs text-white shadow-none placeholder:text-white/25 focus-visible:border-white/14 focus-visible:ring-0 dark:bg-white/4"
              />
            </div>
          </div>

          {visibleItems.length > 0 ? (
            <div className="mt-5 columns-2 gap-3 md:columns-3 xl:columns-4">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseInspiration(item)}
                  className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-[#17191d] text-left"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className={cn(
                      "w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]",
                      item.ratioClass,
                    )}
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/25 to-transparent px-3 pt-12 pb-3">
                    <span className="flex items-end gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-white">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-[10px] text-white/52">{item.tag}</span>
                      </span>
                      {item.mode === "video" && (
                        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/15 bg-black/40 text-white">
                          <Play className="ml-0.5 size-3 fill-current" />
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-60 place-items-center text-sm text-white/30">
              没有匹配的灵感内容
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
