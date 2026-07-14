import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, PlugZap, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  errorMessage,
  hasApiKey,
  loadSettings,
  saveApiKey,
  saveSettings,
  testConnection,
} from "@/lib/api";

export function ProvidersPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const hasKeyQuery = useQuery({ queryKey: ["hasApiKey"], queryFn: hasApiKey });

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  // Prefill the form once persisted settings arrive.
  useEffect(() => {
    if (settingsQuery.data) {
      setBaseUrl(settingsQuery.data.baseUrl);
      setModel(settingsQuery.data.model);
    }
  }, [settingsQuery.data]);

  const testMutation = useMutation({
    mutationFn: () => testConnection(baseUrl, apiKey.trim() || undefined),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await saveSettings({ baseUrl: baseUrl.trim(), model: model.trim() });
      if (apiKey.trim()) {
        await saveApiKey(apiKey.trim());
      }
    },
    onSuccess: () => {
      setApiKey("");
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["hasApiKey"] });
    },
  });

  const models = testMutation.data?.models ?? [];
  const keySaved = hasKeyQuery.data === true;

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>中转站接入</CardTitle>
            <CardDescription>
              填写中转站地址与 API Key 即可使用。Key 保存在系统安全存储中，不会明文落盘。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="base-url">中转站 baseURL</Label>
              <Input
                id="base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com（带不带 /v1 均可）"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={keySaved ? "已保存（留空保持不变）" : "sk-…"}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="model">默认模型</Label>
              <div className="flex gap-2">
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="例如 gpt-4o-mini"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="flex-1"
                />
                {models.length > 0 && (
                  <Select value={models.includes(model) ? model : ""} onValueChange={setModel}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="从测试结果选择" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !baseUrl.trim()}
            >
              {testMutation.isPending ? <Loader2 className="animate-spin" /> : <PlugZap />}
              测试连接
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !baseUrl.trim()}
            >
              {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              保存
            </Button>
            {saveMutation.isSuccess && (
              <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 /> 已保存
              </Badge>
            )}
            {keySaved && (
              <span className="text-muted-foreground ml-auto text-xs">API Key：已在钥匙串</span>
            )}
          </CardFooter>
        </Card>

        {testMutation.isSuccess && (
          <Alert>
            <CheckCircle2 />
            <AlertTitle>连接成功</AlertTitle>
            <AlertDescription>
              中转站可用，共 {models.length} 个模型
              {models.length > 0 ? "，可在上方「默认模型」里直接选择。" : "。"}
            </AlertDescription>
          </Alert>
        )}
        {testMutation.isError && (
          <Alert variant="destructive">
            <AlertTitle>连接失败</AlertTitle>
            <AlertDescription>{errorMessage(testMutation.error)}</AlertDescription>
          </Alert>
        )}
        {saveMutation.isError && (
          <Alert variant="destructive">
            <AlertTitle>保存失败</AlertTitle>
            <AlertDescription>{errorMessage(saveMutation.error)}</AlertDescription>
          </Alert>
        )}
      </div>
    </ScrollArea>
  );
}
