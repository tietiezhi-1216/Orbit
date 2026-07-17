import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Keyboard, Loader2, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { dictationHotkey, errorMessage, setDictationHotkey } from "@/lib/api";
import { formatShortcut, shortcutFromEvent } from "@/lib/shortcut";
import { cn } from "@/lib/utils";
import { SettingsSection } from "@/features/settings/settings-section";

const DEFAULT_HOTKEY = "Alt+Space";

/** Dictation → 快捷键：the global trigger, plus what each gesture does. */
export function DictationHotkeySection() {
  const queryClient = useQueryClient();
  const hotkeyQuery = useQuery({ queryKey: ["dictationHotkey"], queryFn: dictationHotkey });
  const [recording, setRecording] = useState(false);
  const boxRef = useRef<HTMLButtonElement>(null);

  const save = useMutation({
    mutationFn: (shortcut: string) => setDictationHotkey(shortcut),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dictationHotkey"] });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  // While recording, swallow every keystroke and turn the first real combo into
  // the new binding.
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const shortcut = shortcutFromEvent(e);
      if (!shortcut) return; // modifiers only so far
      setRecording(false);
      save.mutate(shortcut);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, save]);

  const current = hotkeyQuery.data ?? DEFAULT_HOTKEY;

  return (
    <SettingsSection>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label>听写触发键</Label>
          <div className="flex items-center gap-2">
            <button
              ref={boxRef}
              onClick={() => setRecording((r) => !r)}
              className={cn(
                "flex h-9 min-w-40 items-center justify-center gap-2 rounded-md border px-3 text-sm transition-colors",
                recording
                  ? "border-primary text-primary animate-pulse"
                  : "hover:bg-accent/50",
              )}
            >
              {save.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Keyboard className="size-3.5" />
              )}
              {recording ? "请按下新的组合键…" : formatShortcut(current)}
            </button>
            {current !== DEFAULT_HOTKEY && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => save.mutate(DEFAULT_HOTKEY)}
                disabled={save.isPending}
              >
                <RotateCcw /> 恢复默认
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            需要至少一个修饰键（⌘ / ⌃ / ⌥ / ⇧）。按 Esc 取消录制。
          </p>
        </div>

        {save.isError && (
          <Alert variant="destructive">
            <AlertTitle>无法绑定该快捷键</AlertTitle>
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Label>两种用法</Label>
          <div className="text-muted-foreground flex flex-col gap-2 text-xs leading-relaxed">
            <p>
              <span className="text-foreground font-medium">轻按一下</span>
              ：开始免手持录音，说完再按一下结束 —— 识别后走润色。
            </p>
            <p>
              <span className="text-foreground font-medium">按住不放</span>
              ：按住说话，松手即结束 —— 只识别、不润色，直接给原话。
            </p>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
