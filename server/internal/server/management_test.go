package server

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"tietiezhi/internal/config"
)

func TestUpdateConfigKeepsMaskedSecrets(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	cfg := &config.Config{
		ConfigPath: filepath.Join(dir, "config.yaml"),
		AppDir:     filepath.Join(dir, ".tietiezhi"),
		LLM: config.LLMConfig{
			Provider: "openai",
			BaseURL:  "https://api.example.com/v1",
			APIKey:   "secret-main-key",
			Model:    "old-model",
		},
		Agent: config.AgentConfig{
			MaxToolCalls: 20,
		},
		Channels: config.ChannelsConfig{
			Feishu: &config.FeishuConfig{
				AppID:     "old-app",
				AppSecret: "secret-feishu-key",
			},
		},
	}

	api := &ManagementAPI{cfg: cfg}
	body := `{
		"llm": {
			"api_key": "secr****-key",
			"model": "new-model"
		},
		"agent": {
			"max_tool_calls": 7
		},
		"channels": {
			"feishu": {
				"app_id": "new-app",
				"app_secret": "****"
			}
		}
	}`

	req := httptest.NewRequest(http.MethodPut, "/v1/config", strings.NewReader(body))
	rec := httptest.NewRecorder()
	api.updateConfig(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("updateConfig status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if cfg.LLM.Model != "new-model" {
		t.Fatalf("model = %q, want new-model", cfg.LLM.Model)
	}
	if cfg.Agent.MaxToolCalls != 7 {
		t.Fatalf("max_tool_calls = %d, want 7", cfg.Agent.MaxToolCalls)
	}
	if cfg.LLM.APIKey != "secret-main-key" {
		t.Fatalf("masked llm api key was overwritten: %q", cfg.LLM.APIKey)
	}
	if cfg.Channels.Feishu == nil {
		t.Fatal("feishu config is nil")
	}
	if cfg.Channels.Feishu.AppID != "new-app" {
		t.Fatalf("feishu app_id = %q, want new-app", cfg.Channels.Feishu.AppID)
	}
	if cfg.Channels.Feishu.AppSecret != "secret-feishu-key" {
		t.Fatalf("masked feishu app secret was overwritten: %q", cfg.Channels.Feishu.AppSecret)
	}
}

func TestMaskKeyLeavesEmptySecretEmpty(t *testing.T) {
	t.Parallel()

	if got := maskKey(""); got != "" {
		t.Fatalf("maskKey(\"\") = %q, want empty string", got)
	}
}
