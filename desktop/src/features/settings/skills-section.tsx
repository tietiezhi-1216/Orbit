import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderInput, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteSkill,
  errorMessage,
  importSkill,
  listSkills,
  pickWorkspaceDir,
  readSkill,
  setSkillEnabled,
  upsertSkill,
} from "@/lib/api";
import { SettingsSection } from "@/features/settings/settings-section";

interface SkillDraft {
  name: string;
  description: string;
  body: string;
  /** True when editing an existing skill (name locked = folder name). */
  existing: boolean;
}

/** 智能体 → 技能：folder-per-skill SKILL.md manager. */
export function SkillsSection() {
  const queryClient = useQueryClient();
  const skillsQuery = useQuery({ queryKey: ["skills"], queryFn: listSkills });
  const skills = skillsQuery.data ?? [];

  const [draft, setDraft] = useState<SkillDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["skills"] });

  const save = useMutation({
    mutationFn: (d: SkillDraft) => upsertSkill(d.name.trim(), d.description.trim(), d.body),
    onSuccess: () => {
      refresh();
      setDraft(null);
      setError("");
    },
    onError: (err: unknown) => setError(errorMessage(err)),
  });

  const toggle = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      setSkillEnabled(name, enabled),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: deleteSkill,
    onSuccess: refresh,
  });

  const doImport = async () => {
    setError("");
    try {
      const dir = await pickWorkspaceDir();
      if (!dir) return;
      await importSkill(dir);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const edit = async (name: string, description: string) => {
    setError("");
    try {
      const content = await readSkill(name);
      // Strip the frontmatter; the editor manages name/description separately.
      const body = content.replace(/^---[\s\S]*?---\s*/, "");
      setDraft({ name, description, body, existing: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (draft) {
    return (
      <SettingsSection>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="skill-name">名称（英文/数字/横线）</Label>
              <Input
                id="skill-name"
                value={draft.name}
                disabled={draft.existing}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="pdf-tools"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="skill-desc">描述（模型据此决定何时加载）</Label>
              <Input
                id="skill-desc"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="处理 PDF：拆分、合并、抽取文本"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="skill-body">技能说明（Markdown）</Label>
            <Textarea
              id="skill-body"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              spellCheck={false}
              className="min-h-72 font-mono text-xs leading-relaxed"
            />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => save.mutate(draft)}
              disabled={!draft.name.trim() || save.isPending}
            >
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              保存
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              <X /> 取消
            </Button>
          </div>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() =>
              setDraft({ name: "", description: "", body: "", existing: false })
            }
          >
            <Plus /> 新建技能
          </Button>
          <Button size="sm" variant="outline" onClick={() => void doImport()}>
            <FolderInput /> 从文件夹导入
          </Button>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          技能是带说明的 Markdown 文档（Anthropic Skills 规范）：模型看到名称和描述，任务相关时才加载全文，不额外占用上下文。
        </p>
        {error && <p className="text-destructive text-xs">{error}</p>}

        {skills.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">还没有技能。</p>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border">
            {skills.map((skill) => (
              <div key={skill.name} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-mono text-sm font-medium">
                    {skill.name}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {skill.description || "（无描述）"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => void edit(skill.name, skill.description)}
                  aria-label="编辑技能"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive size-7"
                  onClick={() => setPendingDelete(skill.name)}
                  aria-label="删除技能"
                >
                  <Trash2 className="size-3.5" />
                </Button>
                <Switch
                  checked={skill.enabled}
                  onCheckedChange={(enabled) =>
                    toggle.mutate({ name: skill.name, enabled })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除技能「{pendingDelete}」？</AlertDialogTitle>
            <AlertDialogDescription>
              技能文件夹将被永久删除，无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
