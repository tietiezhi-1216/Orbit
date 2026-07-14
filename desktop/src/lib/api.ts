import { Channel, invoke } from "@tauri-apps/api/core";

export interface AppSettings {
  baseUrl: string;
  model: string;
}

export interface ConnectionResult {
  models: string[];
}

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type ChatEvent =
  | { type: "delta"; content: string }
  | { type: "done"; cancelled: boolean }
  | { type: "error"; message: string };

export function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("load_settings");
}

export function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export function saveApiKey(value: string): Promise<void> {
  return invoke("save_api_key", { value });
}

export function hasApiKey(): Promise<boolean> {
  return invoke<boolean>("has_api_key");
}

export function deleteApiKey(): Promise<void> {
  return invoke("delete_api_key");
}

export function testConnection(
  baseUrl: string,
  apiKey?: string,
): Promise<ConnectionResult> {
  return invoke<ConnectionResult>("test_connection", {
    baseUrl,
    apiKey: apiKey ?? null,
  });
}

export interface ChatStreamArgs {
  requestId: number;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  onEvent: (event: ChatEvent) => void;
}

export function chatStream(args: ChatStreamArgs): Promise<void> {
  const channel = new Channel<ChatEvent>();
  channel.onmessage = args.onEvent;
  return invoke("chat_stream", {
    requestId: args.requestId,
    baseUrl: args.baseUrl,
    model: args.model,
    messages: args.messages,
    onEvent: channel,
  });
}

export function chatCancel(requestId: number): Promise<void> {
  return invoke("chat_cancel", { requestId });
}

/** Normalize command rejections (Rust returns plain strings). */
export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}
