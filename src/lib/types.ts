// Mirrors the Rust `config` module (serde JSON shapes).

export type ModelType = "asr" | "llm";
export type Transport = "http" | "realtime_ws";

export interface Provider {
  id: string;
  name: string;
  kind: string;
  base_url: string;
  api_key: string;
}

export interface Model {
  id: string;
  provider_id: string;
  name: string;
  model: string;
  type: ModelType;
  transport: Transport;
  language?: string | null;
}

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
}

export interface Settings {
  providers: Provider[];
  models: Model[];
  templates: PromptTemplate[];
  hotkey: string;
  asr_model_id?: string | null;
  llm_model_id?: string | null;
  active_template_id?: string | null;
  llm_polish_enabled: boolean;
  auto_insert: boolean;
  insert_position: string;
}

/** Payload for the `dictation://state` event driving the recording pill. */
export interface DictState {
  status: string;
  text: string;
  level: number;
}
