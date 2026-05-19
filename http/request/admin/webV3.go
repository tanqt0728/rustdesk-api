package admin

type WebV3ShareCreateRequest struct {
	PeerId           string   `json:"peer_id" validate:"required"`
	ExpiresInSeconds int64    `json:"expires_in_seconds"`
	Once             bool     `json:"once"`
	Permissions      []string `json:"permissions"`
}

type WebV3RevokeRequest struct {
	Id        uint   `json:"id"`
	SessionId string `json:"session_id"`
}

type WebV3SessionCleanupRequest struct {
	StaleSeconds int64 `json:"stale_seconds"`
}

type WebV3ShareQuery struct {
	PeerId string `json:"peer_id" form:"peer_id"`
	PageQuery
}

type WebV3SessionQuery struct {
	PeerId string `json:"peer_id" form:"peer_id"`
	Status string `json:"status" form:"status"`
	PageQuery
}

type WebV3AuditQuery struct {
	PeerId    string `json:"peer_id" form:"peer_id"`
	SessionId string `json:"session_id" form:"session_id"`
	EventType string `json:"event_type" form:"event_type"`
	PageQuery
}

type WebV3SettingsForm struct {
	Enabled                    bool     `json:"enabled"`
	DefaultShareExpirationSecs int64    `json:"default_share_expiration_secs"`
	MaxSessionDurationSecs     int64    `json:"max_session_duration_secs"`
	AllowClipboard             bool     `json:"allow_clipboard"`
	AllowFileTransfer          bool     `json:"allow_file_transfer"`
	AllowTerminal              bool     `json:"allow_terminal"`
	RequireLoginForDirectMode  bool     `json:"require_login_for_direct_mode"`
	AllowAnonymousShareAccess  bool     `json:"allow_anonymous_share_access"`
	DefaultPermissions         []string `json:"default_permissions"`
}
