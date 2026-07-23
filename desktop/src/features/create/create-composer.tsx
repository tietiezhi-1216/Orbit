import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  Clapperboard,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { loadSettings, pickChatFiles } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  CreateAspectRatio,
  CreateDraft,
  CreateMode,
  CreateQuality,
} from "@/stores/create";
import { useCreateStore } from "@/stores/create";
import { CreateModelSelect } from "./create-model-select";

const MODE_META: Record<
  CreateMode,
  { label: string; placeholder: string; icon: typeof ImageIcon }
> = {
  image: {
    label: "图片生成",
    placeholder: "上传参考图或输入文字，描述你想生成的图片。",
    icon: ImageIcon,
  },
  video: {
    label: "视频生成",
    placeholder: "上传首帧参考图或输入文字，描述画面、动作和镜头运动。",
    icon: Clapperboard,
  },
};

const IMAGE_RATIOS: CreateAspectRatio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const VIDEO_RATIOS: CreateAspectRatio[] = ["16:9", "9:16", "1:1", "21:9"];

export function CreateComposer({ compact = false }: { compact?: boolean }) {
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const mode = useCreateStore((state) => state.mode);
  const draft = useCreateStore((state) => state.drafts[state.mode]);
  const tasks = useCreateStore((state) => state.tasks);
  const composerError = useCreateStore((state) => state.composerError);
  const setMode = useCreateStore((state) => state.setMode);
  const updateDraft = useCreateStore((state) => state.updateDraft);
  const addReferences = useCreateStore((state) => state.addReferences);
  const removeReference = useCreateStore((state) => state.removeReference);
  const generate = useCreateStore((state) => state.generate);
  const running = tasks.some(
    (task) => task.status === "queued" || task.status === "running",
  );
  const meta = MODE_META[mode];
  const Icon = meta.icon;

  const pickReferences = async () => {
    const attachments = await pickChatFiles(true);
    addReferences(mode, attachments);
  };

  return (
    <form
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#17191d] text-white shadow-[0_22px_80px_-38px_rgba(0,0,0,0.8)]",
        compact ? "p-3" : "p-4 sm:p-5",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        void generate();
      }}
    >
      <div className="pointer-events-none absolute -top-24 left-1/3 size-60 rounded-full bg-cyan-400/8 blur-3xl" />
      {draft.references.length > 0 && (
        <div className="relative mb-3 flex gap-2 overflow-x-auto pb-1">
          {draft.references.map((reference, index) => (
            <div
              key={reference.id}
              className="group relative size-18 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5"
            >
              {reference.dataUrl ? (
                <img
                  src={reference.dataUrl}
                  alt={reference.name}
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="absolute inset-0 m-auto size-5 text-white/40" />
              )}
              <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80">
                参考 {index + 1}
              </span>
              <button
                type="button"
                aria-label={`移除${reference.name}`}
                onClick={() => removeReference(mode, reference.id)}
                className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/65 text-white/70 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => void pickReferences()}
            className="grid size-18 shrink-0 place-items-center rounded-xl border border-dashed border-white/15 text-white/40 transition-colors hover:border-white/25 hover:text-white/70"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}

      <div className="relative flex min-h-28 items-start gap-3">
        {draft.references.length === 0 && (
          <button
            type="button"
            onClick={() => void pickReferences()}
            className="mt-1 grid size-12 shrink-0 rotate-[-7deg] place-items-center rounded-xl border border-white/10 bg-white/6 text-white/40 transition-[transform,color,background-color] hover:rotate-0 hover:bg-white/10 hover:text-white/75"
            aria-label={mode === "image" ? "添加参考图" : "添加视频首帧"}
            title={mode === "image" ? "添加参考图" : "添加视频首帧"}
          >
            <Upload className="size-4" />
          </button>
        )}
        <Textarea
          id="create-prompt"
          value={draft.prompt}
          onChange={(event) => updateDraft(mode, { prompt: event.target.value })}
          placeholder={meta.placeholder}
          className="min-h-28 flex-1 resize-none border-0 bg-transparent px-0 py-1 text-[15px] leading-7 text-white shadow-none placeholder:text-white/30 focus-visible:ring-0 dark:bg-transparent"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void generate();
            }
          }}
        />
      </div>

      {composerError && (
        <p role="alert" className="mb-2 text-xs text-rose-300">
          {composerError}
        </p>
      )}

      <div className="relative flex flex-wrap items-center gap-2 border-t border-white/7 pt-3">
        <Select value={mode} onValueChange={(value) => setMode(value as CreateMode)}>
          <SelectTrigger className="h-9 w-auto gap-2 rounded-xl border-0 bg-white/7 px-3 text-white shadow-none hover:bg-white/10 focus-visible:ring-0 dark:bg-white/7">
            <Icon className="size-3.5 text-cyan-300" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="image">图片生成</SelectItem>
            <SelectItem value="video">视频生成</SelectItem>
          </SelectContent>
        </Select>

        <CreateModelSelect
          mode={mode}
          providers={settingsQuery.data?.providers ?? []}
          providerId={draft.modelProviderId}
          model={draft.model}
          onChange={(modelProviderId, model) =>
            updateDraft(mode, { modelProviderId, model })
          }
        />

        <CreateParameters mode={mode} draft={draft} />

        <span className="ml-auto hidden text-[10px] text-white/25 sm:inline">
          {mode === "image" ? "最多 4 张参考图" : "支持文生视频和图生视频"}
        </span>
        <Button
          type="submit"
          size="icon"
          disabled={running || !draft.prompt.trim()}
          className="ml-auto size-10 rounded-full bg-white text-black hover:bg-cyan-100 disabled:bg-white/10 disabled:text-white/30 sm:ml-0"
          aria-label={running ? "正在生成" : meta.label}
          title={running ? "正在生成" : `${meta.label}（⌘/Ctrl + Enter）`}
        >
          {running ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4 stroke-[2.5]" />
          )}
        </Button>
      </div>
    </form>
  );
}

function CreateParameters({
  mode,
  draft,
}: {
  mode: CreateMode;
  draft: CreateDraft;
}) {
  const updateDraft = useCreateStore((state) => state.updateDraft);
  const ratios = mode === "image" ? IMAGE_RATIOS : VIDEO_RATIOS;
  const summary =
    mode === "image"
      ? `${draft.aspectRatio} · ${draft.quality === "high" ? "2K" : "1K"} · ${draft.resultCount}`
      : `${draft.aspectRatio} · ${draft.quality === "high" ? "高清" : "720P"} · ${draft.durationSeconds}s`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 rounded-xl bg-white/6 px-3 text-white hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10"
        >
          <SlidersHorizontal className="size-3.5 text-white/55" />
          <span className="text-xs">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-76 p-4">
        <div>
          <p className="text-xs font-semibold">画面比例</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {ratios.map((ratio) => (
              <Button
                key={ratio}
                type="button"
                variant={draft.aspectRatio === ratio ? "secondary" : "outline"}
                size="sm"
                onClick={() => updateDraft(mode, { aspectRatio: ratio })}
              >
                {ratio}
              </Button>
            ))}
          </div>
        </div>
        <ParameterSelect
          label={mode === "image" ? "清晰度" : "视频质量"}
          value={draft.quality}
          options={
            mode === "image"
              ? [
                  { value: "standard", label: "1K 标准" },
                  { value: "high", label: "2K 高清" },
                ]
              : [
                  { value: "standard", label: "720P" },
                  { value: "high", label: "高清" },
                ]
          }
          onChange={(value) => updateDraft(mode, { quality: value as CreateQuality })}
        />
        {mode === "image" ? (
          <ParameterSelect
            label="生成数量"
            value={String(draft.resultCount)}
            options={[
              { value: "1", label: "1 张" },
              { value: "2", label: "2 张" },
              { value: "4", label: "4 张" },
            ]}
            onChange={(value) => updateDraft(mode, { resultCount: Number(value) })}
          />
        ) : (
          <ParameterSelect
            label="视频时长"
            value={String(draft.durationSeconds)}
            options={[
              { value: "4", label: "4 秒" },
              { value: "5", label: "5 秒" },
              { value: "8", label: "8 秒" },
              { value: "10", label: "10 秒" },
              { value: "12", label: "12 秒" },
            ]}
            onChange={(value) => updateDraft(mode, { durationSeconds: Number(value) })}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function ParameterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-semibold">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
