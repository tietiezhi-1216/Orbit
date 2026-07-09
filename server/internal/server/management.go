package server

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"tietiezhi/internal/config"
	"tietiezhi/internal/cron"
	"tietiezhi/internal/hook"
	"tietiezhi/internal/mcp"
	"tietiezhi/internal/memory"
	"tietiezhi/internal/session"
	"tietiezhi/internal/skill"
	"tietiezhi/internal/subagent"
)

// ManagementAPI 管理接口依赖
type ManagementAPI struct {
	cfg         *config.Config
	skillLoader *skill.Loader
	mcpManager  *mcp.MCPManager
	hookManager *hook.HookManager
	subAgentMgr *subagent.SubAgentManager
	cronMgr     *cron.CronManager
	memoryMgr   *memory.MemoryManager
	sessionMgr  *session.SessionManager
}

// NewManagementAPI 创建管理 API
func NewManagementAPI(
	cfg *config.Config,
	skillLoader *skill.Loader,
	mcpManager *mcp.MCPManager,
	hookManager *hook.HookManager,
	subAgentMgr *subagent.SubAgentManager,
	cronMgr *cron.CronManager,
	memoryMgr *memory.MemoryManager,
	sessionMgr *session.SessionManager,
) *ManagementAPI {
	return &ManagementAPI{
		cfg:         cfg,
		skillLoader: skillLoader,
		mcpManager:  mcpManager,
		hookManager: hookManager,
		subAgentMgr: subAgentMgr,
		cronMgr:     cronMgr,
		memoryMgr:   memoryMgr,
		sessionMgr:  sessionMgr,
	}
}

// RegisterRoutes 注册管理路由到 mux
func (m *ManagementAPI) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/v1/config", m.handleConfig)
	mux.HandleFunc("/v1/skills", m.handleSkills)
	mux.HandleFunc("/v1/skills/load", m.handleSkillLoad)
	mux.HandleFunc("/v1/mcp", m.handleMCP)
	mux.HandleFunc("/v1/agents", m.handleAgents)
	mux.HandleFunc("/v1/agents/", m.handleAgentAction)
	mux.HandleFunc("/v1/hooks", m.handleHooks)
	mux.HandleFunc("/v1/cron", m.handleCron)
	mux.HandleFunc("/v1/cron/", m.handleCronAction)
	mux.HandleFunc("/v1/workspace", m.handleWorkspace)
	mux.HandleFunc("/v1/workspace/file", m.handleWorkspaceFile)
	mux.HandleFunc("/v1/status", m.handleStatus)
	mux.HandleFunc("/v1/sessions", m.handleSessions)
}

// ==================== Config ====================

func (m *ManagementAPI) handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		m.getConfig(w, r)
	case http.MethodPut:
		m.updateConfig(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (m *ManagementAPI) getConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m.configSnapshot())
}

func (m *ManagementAPI) updateConfig(w http.ResponseWriter, r *http.Request) {
	var req configUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	applyConfigUpdate(m.cfg, &req)

	if err := m.cfg.Save(); err != nil {
		http.Error(w, fmt.Sprintf("保存配置失败: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "配置已更新并保存（部分配置需重启生效）",
		"config":  m.configSnapshot(),
	})
}

type configUpdateRequest struct {
	Server        *serverConfigPatch        `json:"server"`
	LLM           *llmConfigPatch           `json:"llm"`
	Agent         *agentConfigPatch         `json:"agent"`
	Channels      *channelsConfigPatch      `json:"channels"`
	Scheduler     *schedulerConfigPatch     `json:"scheduler"`
	Heartbeat     *heartbeatConfigPatch     `json:"heartbeat"`
	Log           *logConfigPatch           `json:"log"`
	Session       *sessionConfigPatch       `json:"session"`
	Hooks         *hooksConfigPatch         `json:"hooks"`
	SubAgent      *subAgentConfigPatch      `json:"subagent"`
	Tools         *toolsConfigPatch         `json:"tools"`
	Approval      *approvalConfigPatch      `json:"approval"`
	Observability *observabilityConfigPatch `json:"observability"`
	Sandbox       *sandboxConfigPatch       `json:"sandbox"`
}

type serverConfigPatch struct {
	Host *string `json:"host"`
	Port *int    `json:"port"`
}

type llmConfigPatch struct {
	Provider     *string `json:"provider"`
	BaseURL      *string `json:"base_url"`
	APIKey       *string `json:"api_key"`
	Model        *string `json:"model"`
	CheapModel   *string `json:"cheap_model"`
	CheapBaseURL *string `json:"cheap_base_url"`
	CheapAPIKey  *string `json:"cheap_api_key"`
}

type agentConfigPatch struct {
	MaxToolCalls  *int                    `json:"max_tool_calls"`
	SystemPrompt  *string                 `json:"system_prompt"`
	LoopDetection *bool                   `json:"loop_detection"`
	Compression   *compressionConfigPatch `json:"compression"`
	LoopDetector  *loopDetectorPatch      `json:"loop_detector"`
}

type compressionConfigPatch struct {
	Enabled       *bool   `json:"enabled"`
	MaxChars      *int    `json:"max_chars"`
	KeepRecent    *int    `json:"keep_recent"`
	SummaryPrompt *string `json:"summary_prompt"`
}

type loopDetectorPatch struct {
	GenericRepeatThreshold    *int     `json:"generic_repeat_threshold"`
	GenericRepeatSimilarity   *float64 `json:"generic_repeat_similarity"`
	NoProgressThreshold       *int     `json:"no_progress_threshold"`
	PingPongWindow            *int     `json:"ping_pong_window"`
	GlobalCircuitBreakerLimit *int     `json:"global_circuit_breaker_limit"`
}

type channelsConfigPatch struct {
	Feishu   *feishuConfigPatch   `json:"feishu"`
	Telegram *telegramConfigPatch `json:"telegram"`
}

type feishuConfigPatch struct {
	Enabled           *bool   `json:"enabled"`
	AppID             *string `json:"app_id"`
	AppSecret         *string `json:"app_secret"`
	VerificationToken *string `json:"verification_token"`
	EncryptKey        *string `json:"encrypt_key"`
	Streaming         *bool   `json:"streaming"`
	BotOpenID         *string `json:"bot_open_id"`
}

type telegramConfigPatch struct {
	Enabled  *bool    `json:"enabled"`
	BotToken *string  `json:"bot_token"`
	AdminIDs *[]int64 `json:"admin_ids"`
}

type schedulerConfigPatch struct {
	Enabled     *bool `json:"enabled"`
	ExecTimeout *int  `json:"exec_timeout"`
}

type heartbeatConfigPatch struct {
	Enabled  *bool   `json:"enabled"`
	Interval *int    `json:"interval"`
	ChatID   *string `json:"chat_id"`
}

type logConfigPatch struct {
	Level  *string `json:"level"`
	Format *string `json:"format"`
}

type sessionConfigPatch struct {
	MaxHistoryTurns *int `json:"max_history_turns"`
	AutoSaveSeconds *int `json:"auto_save_seconds"`
}

type hooksConfigPatch struct {
	Enabled *bool `json:"enabled"`
}

type subAgentConfigPatch struct {
	Enabled *bool `json:"enabled"`
	Timeout *int  `json:"timeout"`
}

type toolsConfigPatch struct {
	Terminal  *terminalConfigPatch  `json:"terminal"`
	WebSearch *webSearchConfigPatch `json:"web_search"`
}

type terminalConfigPatch struct {
	BlockedCmds *[]string `json:"blocked_cmds"`
}

type webSearchConfigPatch struct {
	Provider *string `json:"provider"`
	APIKey   *string `json:"api_key"`
	BaseURL  *string `json:"base_url"`
}

type approvalConfigPatch struct {
	Enabled         *bool     `json:"enabled"`
	RequireApproval *[]string `json:"require_approval"`
	AutoApprove     *[]string `json:"auto_approve"`
}

type observabilityConfigPatch struct {
	Enabled    *bool                `json:"enabled"`
	AuditLog   *auditLogConfigPatch `json:"audit_log"`
	TokenTrack *bool                `json:"token_track"`
}

type auditLogConfigPatch struct {
	Enabled *bool `json:"enabled"`
}

type sandboxConfigPatch struct {
	Enabled     *bool    `json:"enabled"`
	Image       *string  `json:"image"`
	NetworkMode *string  `json:"network_mode"`
	MemoryLimit *string  `json:"memory_limit"`
	CPULimit    *float64 `json:"cpu_limit"`
	WorkDir     *string  `json:"work_dir"`
}

func (m *ManagementAPI) configSnapshot() map[string]interface{} {
	feishu := map[string]interface{}{
		"enabled":            false,
		"app_id":             "",
		"app_secret":         "",
		"verification_token": "",
		"encrypt_key":        "",
		"streaming":          false,
		"bot_open_id":        "",
	}
	if m.cfg.Channels.Feishu != nil {
		feishu["enabled"] = m.cfg.Channels.Feishu.Enabled
		feishu["app_id"] = m.cfg.Channels.Feishu.AppID
		feishu["app_secret"] = maskKey(m.cfg.Channels.Feishu.AppSecret)
		feishu["verification_token"] = maskKey(m.cfg.Channels.Feishu.VerificationToken)
		feishu["encrypt_key"] = maskKey(m.cfg.Channels.Feishu.EncryptKey)
		feishu["streaming"] = m.cfg.Channels.Feishu.Streaming
		feishu["bot_open_id"] = m.cfg.Channels.Feishu.BotOpenID
	}

	telegram := map[string]interface{}{
		"enabled":   false,
		"bot_token": "",
		"admin_ids": []int64{},
	}
	if m.cfg.Channels.Telegram != nil {
		telegram["enabled"] = m.cfg.Channels.Telegram.Enabled
		telegram["bot_token"] = maskKey(m.cfg.Channels.Telegram.BotToken)
		telegram["admin_ids"] = m.cfg.Channels.Telegram.AdminIDs
	}

	return map[string]interface{}{
		"runtime": map[string]interface{}{
			"config_path":     m.cfg.ConfigPath,
			"app_dir":         m.cfg.AppDir,
			"workspace":       m.cfg.Memory.Path,
			"skills_path":     m.cfg.Skills.Path,
			"scheduler_path":  m.cfg.Scheduler.Path,
			"sessions_path":   m.cfg.Session.PersistPath,
			"subagents_path":  m.cfg.SubAgent.Path,
			"audit_log_path":  m.cfg.Observability.AuditLog.Path,
			"allowed_dirs":    m.cfg.Tools.AllowedDirs,
			"sandbox_volumes": m.cfg.Sandbox.Volumes,
		},
		"server": map[string]interface{}{
			"host": m.cfg.Server.Host,
			"port": m.cfg.Server.Port,
		},
		"llm": map[string]interface{}{
			"provider":           m.cfg.LLM.Provider,
			"base_url":           m.cfg.LLM.BaseURL,
			"api_key":            maskKey(m.cfg.LLM.APIKey),
			"model":              m.cfg.LLM.Model,
			"cheap_model":        m.cfg.LLM.CheapModel,
			"cheap_base_url":     m.cfg.LLM.CheapBaseURL,
			"cheap_api_key":      maskKey(m.cfg.LLM.CheapAPIKey),
			"model_capabilities": m.cfg.LLM.ModelCapabilities,
		},
		"agent": map[string]interface{}{
			"max_tool_calls": m.cfg.Agent.MaxToolCalls,
			"system_prompt":  m.cfg.Agent.SystemPrompt,
			"loop_detection": m.cfg.Agent.LoopDetection,
			"compression": map[string]interface{}{
				"enabled":        m.cfg.Agent.Compression.Enabled,
				"max_chars":      m.cfg.Agent.Compression.MaxChars,
				"keep_recent":    m.cfg.Agent.Compression.KeepRecent,
				"summary_prompt": m.cfg.Agent.Compression.SummaryPrompt,
			},
			"loop_detector": map[string]interface{}{
				"generic_repeat_threshold":     m.cfg.Agent.LoopDetector.GenericRepeatThreshold,
				"generic_repeat_similarity":    m.cfg.Agent.LoopDetector.GenericRepeatSimilarity,
				"no_progress_threshold":        m.cfg.Agent.LoopDetector.NoProgressThreshold,
				"ping_pong_window":             m.cfg.Agent.LoopDetector.PingPongWindow,
				"global_circuit_breaker_limit": m.cfg.Agent.LoopDetector.GlobalCircuitBreakerLimit,
			},
		},
		"channels": map[string]interface{}{
			"feishu":   feishu,
			"telegram": telegram,
		},
		"memory": map[string]interface{}{
			"type": m.cfg.Memory.Type,
			"path": m.cfg.Memory.Path,
		},
		"scheduler": map[string]interface{}{
			"enabled":      m.cfg.Scheduler.Enabled,
			"exec_timeout": m.cfg.Scheduler.ExecTimeout,
		},
		"heartbeat": map[string]interface{}{
			"enabled":  m.cfg.Heartbeat.Enabled,
			"interval": m.cfg.Heartbeat.Interval,
			"chat_id":  m.cfg.Heartbeat.ChatID,
		},
		"log": map[string]interface{}{
			"level":  m.cfg.Log.Level,
			"format": m.cfg.Log.Format,
		},
		"session": map[string]interface{}{
			"max_history_turns": m.cfg.Session.MaxHistoryTurns,
			"auto_save_seconds": m.cfg.Session.AutoSaveSeconds,
		},
		"hooks": map[string]interface{}{
			"enabled": m.cfg.Hooks.Enabled,
			"rules":   m.cfg.Hooks.Rules,
		},
		"subagent": map[string]interface{}{
			"enabled": m.cfg.SubAgent.Enabled,
			"timeout": m.cfg.SubAgent.Timeout,
		},
		"tools": map[string]interface{}{
			"terminal": map[string]interface{}{
				"blocked_cmds": m.cfg.Tools.Terminal.BlockedCmds,
			},
			"web_search": map[string]interface{}{
				"provider": m.cfg.Tools.WebSearch.Provider,
				"api_key":  maskKey(m.cfg.Tools.WebSearch.APIKey),
				"base_url": m.cfg.Tools.WebSearch.BaseURL,
			},
		},
		"approval": map[string]interface{}{
			"enabled":          m.cfg.Approval.Enabled,
			"require_approval": m.cfg.Approval.RequireApproval,
			"auto_approve":     m.cfg.Approval.AutoApprove,
		},
		"observability": map[string]interface{}{
			"enabled":     m.cfg.Observability.Enabled,
			"token_track": m.cfg.Observability.TokenTrack,
			"audit_log": map[string]interface{}{
				"enabled": m.cfg.Observability.AuditLog.Enabled,
				"path":    m.cfg.Observability.AuditLog.Path,
			},
		},
		"sandbox": map[string]interface{}{
			"enabled":      m.cfg.Sandbox.Enabled,
			"image":        m.cfg.Sandbox.Image,
			"network_mode": m.cfg.Sandbox.NetworkMode,
			"memory_limit": m.cfg.Sandbox.MemoryLimit,
			"cpu_limit":    m.cfg.Sandbox.CPULimit,
			"work_dir":     m.cfg.Sandbox.WorkDir,
			"volumes":      m.cfg.Sandbox.Volumes,
		},
	}
}

func applyConfigUpdate(cfg *config.Config, req *configUpdateRequest) {
	if req.Server != nil {
		setString(&cfg.Server.Host, req.Server.Host)
		setInt(&cfg.Server.Port, req.Server.Port)
	}
	if req.LLM != nil {
		setString(&cfg.LLM.Provider, req.LLM.Provider)
		setString(&cfg.LLM.BaseURL, req.LLM.BaseURL)
		setSecretString(&cfg.LLM.APIKey, req.LLM.APIKey)
		setString(&cfg.LLM.Model, req.LLM.Model)
		setString(&cfg.LLM.CheapModel, req.LLM.CheapModel)
		setString(&cfg.LLM.CheapBaseURL, req.LLM.CheapBaseURL)
		setSecretString(&cfg.LLM.CheapAPIKey, req.LLM.CheapAPIKey)
	}
	if req.Agent != nil {
		setInt(&cfg.Agent.MaxToolCalls, req.Agent.MaxToolCalls)
		setString(&cfg.Agent.SystemPrompt, req.Agent.SystemPrompt)
		setBool(&cfg.Agent.LoopDetection, req.Agent.LoopDetection)
		if req.Agent.Compression != nil {
			setBool(&cfg.Agent.Compression.Enabled, req.Agent.Compression.Enabled)
			setInt(&cfg.Agent.Compression.MaxChars, req.Agent.Compression.MaxChars)
			setInt(&cfg.Agent.Compression.KeepRecent, req.Agent.Compression.KeepRecent)
			setString(&cfg.Agent.Compression.SummaryPrompt, req.Agent.Compression.SummaryPrompt)
		}
		if req.Agent.LoopDetector != nil {
			setInt(&cfg.Agent.LoopDetector.GenericRepeatThreshold, req.Agent.LoopDetector.GenericRepeatThreshold)
			setFloat64(&cfg.Agent.LoopDetector.GenericRepeatSimilarity, req.Agent.LoopDetector.GenericRepeatSimilarity)
			setInt(&cfg.Agent.LoopDetector.NoProgressThreshold, req.Agent.LoopDetector.NoProgressThreshold)
			setInt(&cfg.Agent.LoopDetector.PingPongWindow, req.Agent.LoopDetector.PingPongWindow)
			setInt(&cfg.Agent.LoopDetector.GlobalCircuitBreakerLimit, req.Agent.LoopDetector.GlobalCircuitBreakerLimit)
		}
	}
	if req.Channels != nil {
		if req.Channels.Feishu != nil {
			if cfg.Channels.Feishu == nil {
				cfg.Channels.Feishu = &config.FeishuConfig{}
			}
			setBool(&cfg.Channels.Feishu.Enabled, req.Channels.Feishu.Enabled)
			setString(&cfg.Channels.Feishu.AppID, req.Channels.Feishu.AppID)
			setSecretString(&cfg.Channels.Feishu.AppSecret, req.Channels.Feishu.AppSecret)
			setSecretString(&cfg.Channels.Feishu.VerificationToken, req.Channels.Feishu.VerificationToken)
			setSecretString(&cfg.Channels.Feishu.EncryptKey, req.Channels.Feishu.EncryptKey)
			setBool(&cfg.Channels.Feishu.Streaming, req.Channels.Feishu.Streaming)
			setString(&cfg.Channels.Feishu.BotOpenID, req.Channels.Feishu.BotOpenID)
		}
		if req.Channels.Telegram != nil {
			if cfg.Channels.Telegram == nil {
				cfg.Channels.Telegram = &config.TelegramConfig{}
			}
			setBool(&cfg.Channels.Telegram.Enabled, req.Channels.Telegram.Enabled)
			setSecretString(&cfg.Channels.Telegram.BotToken, req.Channels.Telegram.BotToken)
			setInt64Slice(&cfg.Channels.Telegram.AdminIDs, req.Channels.Telegram.AdminIDs)
		}
	}
	if req.Scheduler != nil {
		setBool(&cfg.Scheduler.Enabled, req.Scheduler.Enabled)
		setInt(&cfg.Scheduler.ExecTimeout, req.Scheduler.ExecTimeout)
	}
	if req.Heartbeat != nil {
		setBool(&cfg.Heartbeat.Enabled, req.Heartbeat.Enabled)
		setInt(&cfg.Heartbeat.Interval, req.Heartbeat.Interval)
		setString(&cfg.Heartbeat.ChatID, req.Heartbeat.ChatID)
	}
	if req.Log != nil {
		setString(&cfg.Log.Level, req.Log.Level)
		setString(&cfg.Log.Format, req.Log.Format)
	}
	if req.Session != nil {
		setInt(&cfg.Session.MaxHistoryTurns, req.Session.MaxHistoryTurns)
		setInt(&cfg.Session.AutoSaveSeconds, req.Session.AutoSaveSeconds)
	}
	if req.Hooks != nil {
		setBool(&cfg.Hooks.Enabled, req.Hooks.Enabled)
	}
	if req.SubAgent != nil {
		setBool(&cfg.SubAgent.Enabled, req.SubAgent.Enabled)
		setInt(&cfg.SubAgent.Timeout, req.SubAgent.Timeout)
	}
	if req.Tools != nil {
		if req.Tools.Terminal != nil {
			setStringSlice(&cfg.Tools.Terminal.BlockedCmds, req.Tools.Terminal.BlockedCmds)
		}
		if req.Tools.WebSearch != nil {
			setString(&cfg.Tools.WebSearch.Provider, req.Tools.WebSearch.Provider)
			setSecretString(&cfg.Tools.WebSearch.APIKey, req.Tools.WebSearch.APIKey)
			setString(&cfg.Tools.WebSearch.BaseURL, req.Tools.WebSearch.BaseURL)
		}
	}
	if req.Approval != nil {
		setBool(&cfg.Approval.Enabled, req.Approval.Enabled)
		setStringSlice(&cfg.Approval.RequireApproval, req.Approval.RequireApproval)
		setStringSlice(&cfg.Approval.AutoApprove, req.Approval.AutoApprove)
	}
	if req.Observability != nil {
		setBool(&cfg.Observability.Enabled, req.Observability.Enabled)
		setBool(&cfg.Observability.TokenTrack, req.Observability.TokenTrack)
		if req.Observability.AuditLog != nil {
			setBool(&cfg.Observability.AuditLog.Enabled, req.Observability.AuditLog.Enabled)
		}
	}
	if req.Sandbox != nil {
		setBool(&cfg.Sandbox.Enabled, req.Sandbox.Enabled)
		setString(&cfg.Sandbox.Image, req.Sandbox.Image)
		setString(&cfg.Sandbox.NetworkMode, req.Sandbox.NetworkMode)
		setString(&cfg.Sandbox.MemoryLimit, req.Sandbox.MemoryLimit)
		setFloat64(&cfg.Sandbox.CPULimit, req.Sandbox.CPULimit)
		setString(&cfg.Sandbox.WorkDir, req.Sandbox.WorkDir)
	}
}

func setString(dst *string, src *string) {
	if src != nil {
		*dst = *src
	}
}

func setSecretString(dst *string, src *string) {
	if src != nil && !isMaskedSecret(*src) {
		*dst = *src
	}
}

func setBool(dst *bool, src *bool) {
	if src != nil {
		*dst = *src
	}
}

func setInt(dst *int, src *int) {
	if src != nil {
		*dst = *src
	}
}

func setFloat64(dst *float64, src *float64) {
	if src != nil {
		*dst = *src
	}
}

func setStringSlice(dst *[]string, src *[]string) {
	if src != nil {
		*dst = append([]string(nil), (*src)...)
	}
}

func setInt64Slice(dst *[]int64, src *[]int64) {
	if src != nil {
		*dst = append([]int64(nil), (*src)...)
	}
}

func isMaskedSecret(value string) bool {
	value = strings.TrimSpace(value)
	return value == "****" || strings.Contains(value, "****")
}

// ==================== Skills ====================

func (m *ManagementAPI) handleSkills(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var skills []map[string]interface{}
	if m.skillLoader != nil {
		for _, s := range m.skillLoader.GetAllSkills() {
			mcpNames := make([]string, 0)
			for name := range s.MCPServers {
				mcpNames = append(mcpNames, name)
			}
			skills = append(skills, map[string]interface{}{
				"name":          s.Name,
				"description":   s.Description,
				"dir_path":      s.DirPath,
				"mcp_servers":   mcpNames,
				"has_mcp":       len(s.MCPServers) > 0,
				"allowed_tools": s.AllowedTools,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"skills": skills,
		"total":  len(skills),
	})
}

func (m *ManagementAPI) handleSkillLoad(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if m.skillLoader == nil {
		http.Error(w, "skill loader not available", http.StatusServiceUnavailable)
		return
	}

	s := m.skillLoader.GetSkill(req.Name)
	if s == nil {
		http.Error(w, fmt.Sprintf("skill %s not found", req.Name), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"name":        s.Name,
		"description": s.Description,
	})
}

// ==================== MCP ====================

func (m *ManagementAPI) handleMCP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	servers := make([]map[string]interface{}, 0)
	if m.mcpManager != nil {
		for name, client := range m.mcpManager.GetClients() {
			tools := make([]map[string]string, 0)
			for _, t := range client.GetTools() {
				tools = append(tools, map[string]string{
					"name":        t.Name,
					"description": t.Description,
				})
			}
			servers = append(servers, map[string]interface{}{
				"name":  name,
				"tools": tools,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"servers": servers,
		"total":   len(servers),
	})
}

// ==================== Agents ====================

func (m *ManagementAPI) handleAgents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	agents := make([]map[string]interface{}, 0)
	if m.subAgentMgr != nil {
		for _, s := range m.subAgentMgr.ListSpawns() {
			agents = append(agents, map[string]interface{}{
				"spawn_id":    s.SpawnID,
				"session_key": s.SessionKey,
				"status":      s.Status,
				"label":       s.Label,
				"started_at":  s.StartedAt,
				"ended_at":    s.EndedAt,
				"error":       s.Error,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"agents": agents,
		"total":  len(agents),
	})
}

func (m *ManagementAPI) handleAgentAction(w http.ResponseWriter, r *http.Request) {
	spawnID := strings.TrimPrefix(r.URL.Path, "/v1/agents/")
	if spawnID == "" {
		http.Error(w, "agent id required", http.StatusBadRequest)
		return
	}

	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if m.subAgentMgr == nil {
		http.Error(w, "sub-agent manager not available", http.StatusServiceUnavailable)
		return
	}

	if err := m.subAgentMgr.KillSpawn(spawnID); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"spawn_id": spawnID,
	})
}

// ==================== Hooks ====================

func (m *ManagementAPI) handleHooks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rules := make([]map[string]interface{}, 0)
	if m.hookManager != nil {
		for i, r := range m.hookManager.GetRules() {
			rules = append(rules, map[string]interface{}{
				"index":   i,
				"event":   r.Event,
				"matcher": r.Matcher,
				"type":    r.Type,
				"command": r.Command,
				"script":  r.ScriptName,
				"timeout": r.Timeout,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rules":   rules,
		"total":   len(rules),
		"enabled": m.hookManager != nil && m.hookManager.IsEnabled(),
	})
}

// ==================== Cron ====================

func (m *ManagementAPI) handleCron(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		m.listCronJobs(w, r)
	case http.MethodPost:
		m.createCronJob(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (m *ManagementAPI) listCronJobs(w http.ResponseWriter, r *http.Request) {
	jobs := make([]map[string]interface{}, 0)
	if m.cronMgr != nil {
		for _, j := range m.cronMgr.ListJobs() {
			jobs = append(jobs, map[string]interface{}{
				"id":               j.ID,
				"name":             j.Name,
				"message":          j.Message,
				"schedule":         j.Schedule,
				"enabled":          j.Enabled,
				"delete_after_run": j.DeleteAfterRun,
				"created_at":       j.CreatedAt,
				"last_run_at":      j.LastRunAt,
				"next_run_at":      j.NextRunAt,
				"run_count":        j.RunCount,
				"mode":             j.Mode,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"jobs":  jobs,
		"total": len(jobs),
	})
}

func (m *ManagementAPI) createCronJob(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name    string `json:"name"`
		Message string `json:"message"`
		Kind    string `json:"kind"`
		At      string `json:"at"`
		EveryMs int64  `json:"every_ms"`
		Expr    string `json:"expr"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if m.cronMgr == nil {
		http.Error(w, "cron manager not available", http.StatusServiceUnavailable)
		return
	}

	job := &cron.CronJob{
		Name:    req.Name,
		Message: req.Message,
		Schedule: cron.Schedule{
			Kind:    req.Kind,
			At:      req.At,
			EveryMs: req.EveryMs,
			Expr:    req.Expr,
			TZ:      "Asia/Shanghai",
		},
		Enabled:        true,
		DeleteAfterRun: req.Kind == "at",
		CreatedAt:      time.Now(),
		Mode:           "isolated",
	}

	if err := m.cronMgr.CreateJob(job); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"job_id":  job.ID,
	})
}

func (m *ManagementAPI) handleCronAction(w http.ResponseWriter, r *http.Request) {
	jobID := strings.TrimPrefix(r.URL.Path, "/v1/cron/")
	if jobID == "" {
		http.Error(w, "job id required", http.StatusBadRequest)
		return
	}

	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if m.cronMgr == nil {
		http.Error(w, "cron manager not available", http.StatusServiceUnavailable)
		return
	}

	if err := m.cronMgr.DeleteJob(jobID); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"job_id":  jobID,
	})
}

// ==================== Workspace ====================

func (m *ManagementAPI) handleWorkspace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	workspacePath := m.workspacePath()

	files := make([]map[string]interface{}, 0)
	filepath.WalkDir(workspacePath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		relPath, _ := filepath.Rel(workspacePath, path)
		if relPath == "." {
			return nil
		}
		if strings.HasPrefix(relPath, "uploads") {
			if d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		info, _ := d.Info()
		files = append(files, map[string]interface{}{
			"path":     relPath,
			"is_dir":   d.IsDir(),
			"size":     info.Size(),
			"modified": info.ModTime(),
		})
		return nil
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"files":     files,
		"total":     len(files),
		"base_path": workspacePath,
	})
}

func (m *ManagementAPI) handleWorkspaceFile(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		m.getWorkspaceFile(w, r)
	case http.MethodPut:
		m.updateWorkspaceFile(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (m *ManagementAPI) getWorkspaceFile(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		http.Error(w, "path parameter required", http.StatusBadRequest)
		return
	}

	workspacePath := m.workspacePath()

	fullPath := filepath.Join(workspacePath, filePath)
	if !strings.HasPrefix(filepath.Clean(fullPath), filepath.Clean(workspacePath)) {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	data, err := os.ReadFile(fullPath)
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"path":    filePath,
		"content": string(data),
		"size":    len(data),
	})
}

func (m *ManagementAPI) updateWorkspaceFile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	workspacePath := m.workspacePath()

	fullPath := filepath.Join(workspacePath, req.Path)
	if !strings.HasPrefix(filepath.Clean(fullPath), filepath.Clean(workspacePath)) {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	os.MkdirAll(filepath.Dir(fullPath), 0755)

	if err := os.WriteFile(fullPath, []byte(req.Content), 0644); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"path":    req.Path,
	})
}

func (m *ManagementAPI) workspacePath() string {
	if m.memoryMgr != nil {
		return m.memoryMgr.GetWorkspacePath()
	}
	if m.cfg != nil && m.cfg.Memory.Path != "" {
		return m.cfg.Memory.Path
	}
	appDir, err := config.AppHomeDir()
	if err != nil {
		return filepath.Join(".", config.AppDirName, "workspace")
	}
	return filepath.Join(appDir, "workspace")
}

// ==================== Status ====================

func (m *ManagementAPI) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	skillCount := 0
	mcpCount := 0
	agentCount := 0
	hookCount := 0
	cronCount := 0

	if m.skillLoader != nil {
		skillCount = len(m.skillLoader.GetAllSkills())
	}
	if m.mcpManager != nil {
		mcpCount = len(m.mcpManager.GetClients())
	}
	if m.subAgentMgr != nil {
		agentCount = len(m.subAgentMgr.ListSpawns())
	}
	if m.hookManager != nil {
		hookCount = len(m.hookManager.GetRules())
	}
	if m.cronMgr != nil {
		cronCount = len(m.cronMgr.ListJobs())
	}

	status := map[string]interface{}{
		"timestamp": time.Now().Unix(),
		"model":     m.cfg.LLM.Model,
		"features": map[string]bool{
			"scheduler": m.cfg.Scheduler.Enabled,
			"heartbeat": m.cfg.Heartbeat.Enabled,
			"hooks":     m.cfg.Hooks.Enabled,
			"subagent":  m.cfg.SubAgent.Enabled,
			"sandbox":   m.cfg.Sandbox.Enabled,
			"feishu":    m.cfg.Channels.Feishu != nil && m.cfg.Channels.Feishu.Enabled,
			"telegram":  m.cfg.Channels.Telegram != nil && m.cfg.Channels.Telegram.Enabled,
		},
		"counts": map[string]int{
			"skills":      skillCount,
			"mcp_servers": mcpCount,
			"agents":      agentCount,
			"hooks":       hookCount,
			"cron_jobs":   cronCount,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// ==================== Sessions ====================

func (m *ManagementAPI) handleSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessions := make([]map[string]interface{}, 0)
	if m.sessionMgr != nil {
		for _, s := range m.sessionMgr.ListSessions() {
			sessions = append(sessions, map[string]interface{}{
				"key":      s.Key,
				"messages": s.Messages,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sessions": sessions,
		"total":    len(sessions),
	})
}

// ==================== Helpers ====================

func maskKey(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}
