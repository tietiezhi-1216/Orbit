import { useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import {
  Info,
  Keyboard,
  Mic,
  MessageSquareQuote,
  Monitor,
  Moon,
  Palette,
  Plug,
  RefreshCw,
  ScrollText,
  Server,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { AppIcon } from "@/components/app-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme-provider";
import type { Theme } from "@/components/theme-provider";
import { DictationModelSection } from "@/features/settings/dictation-card";
import { DictationHotkeySection } from "@/features/settings/dictation-hotkey";
import { DictationPromptSection } from "@/features/settings/dictation-prompt";
import { McpSection } from "@/features/settings/mcp-section";
import { PermissionSection } from "@/features/settings/permission-section";
import { ProviderManager } from "@/features/settings/provider-manager";
import { SkillsSection } from "@/features/settings/skills-section";
import { SystemPromptSection } from "@/features/settings/system-prompt-section";
import { SettingsSection } from "@/features/settings/settings-section";
import { UpdateCard } from "@/features/settings/update-card";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";
import type { SettingsCategory } from "@/stores/ui";

interface CategoryDef {
  key: SettingsCategory;
  label: string;
  icon: typeof Server;
}

interface CategoryGroup {
  label: string;
  items: CategoryDef[];
}

const GROUPS: CategoryGroup[] = [
  {
    label: "模型",
    items: [{ key: "providers", label: "供应商", icon: Server }],
  },
  {
    label: "智能体",
    items: [
      { key: "systemPrompt", label: "系统提示词", icon: ScrollText },
      { key: "skills", label: "技能", icon: Sparkles },
      { key: "mcp", label: "MCP 服务器", icon: Plug },
      { key: "permissions", label: "权限", icon: ShieldCheck },
    ],
  },
  {
    label: "语音听写",
    items: [
      { key: "dictationModel", label: "模型", icon: Mic },
      { key: "dictationHotkey", label: "快捷键", icon: Keyboard },
      { key: "dictationPrompt", label: "提示词", icon: MessageSquareQuote },
    ],
  },
  {
    label: "通用",
    items: [
      { key: "appearance", label: "外观", icon: Palette },
      { key: "update", label: "软件更新", icon: RefreshCw },
      { key: "about", label: "关于", icon: Info },
    ],
  },
];

function categoryLabel(category: SettingsCategory): string {
  for (const group of GROUPS) {
    const item = group.items.find((c) => c.key === category);
    // Prefix generic item labels with their group (e.g. 语音听写 · 模型).
    if (item) return group.label === "语音听写" ? `${group.label} · ${item.label}` : item.label;
  }
  return "设置";
}

export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const category = useUiStore((s) => s.settingsCategory);
  const setCategory = useUiStore((s) => s.setSettingsCategory);
  const closeSettings = useUiStore((s) => s.closeSettings);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeSettings()}>
      <DialogContent
        showCloseButton
        className="flex h-[760px] max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <nav className="bg-muted/30 flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r p-3">
          <DialogTitle className="px-2 pt-1 text-sm font-semibold">设置</DialogTitle>
          {GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <span className="text-muted-foreground px-2 pb-0.5 text-[11px] font-medium">
                {group.label}
              </span>
              {group.items.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    category === c.key
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <c.icon className="size-4 shrink-0" />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center border-b px-7">
            <h2 className="text-base font-semibold">{categoryLabel(category)}</h2>
          </header>
          <div className="flex-1 overflow-y-auto px-7 py-6">
            {category === "providers" && <ProviderManager />}
            {category === "systemPrompt" && <SystemPromptSection />}
            {category === "skills" && <SkillsSection />}
            {category === "mcp" && <McpSection />}
            {category === "permissions" && <PermissionSection />}
            {category === "dictationModel" && <DictationModelSection />}
            {category === "dictationHotkey" && <DictationHotkeySection />}
            {category === "dictationPrompt" && <DictationPromptSection />}
            {category === "appearance" && <AppearanceSection />}
            {category === "update" && <UpdateCard />}
            {category === "about" && <AboutSection />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ThemeOption {
  value: Theme;
  label: string;
  icon: typeof Sun;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
];

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <SettingsSection>
      <div className="flex gap-2">
        {THEME_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={theme === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme(opt.value)}
          >
            <opt.icon /> {opt.label}
          </Button>
        ))}
      </div>
    </SettingsSection>
  );
}

function AboutSection() {
  const versionQuery = useQuery({
    queryKey: ["appVersion"],
    queryFn: getVersion,
    retry: false,
    staleTime: Infinity,
  });

  return (
    <SettingsSection>
      <div className="flex items-center gap-4">
        <AppIcon size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold">铁铁汁 Tietiezhi</span>
          <span className="text-muted-foreground text-sm">
            连接各家模型的智能体终端 · v{versionQuery.data ?? "—"}
          </span>
          <Separator className="my-1" />
          <span className="text-muted-foreground text-xs">
            com.tietiezhi.tietiezhi · © 2026 Tietiezhi · 闭源软件，保留所有权利
          </span>
        </div>
      </div>
    </SettingsSection>
  );
}
