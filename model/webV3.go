package model

import "github.com/lejianwen/rustdesk-api/v2/model/custom_types"

const (
	WebV3SessionStatusPreparing    = "preparing"
	WebV3SessionStatusConnecting   = "connecting"
	WebV3SessionStatusConnected    = "connected"
	WebV3SessionStatusReconnecting = "reconnecting"
	WebV3SessionStatusDisconnected = "disconnected"
	WebV3SessionStatusExpired      = "expired"
	WebV3SessionStatusRevoked      = "revoked"
)

const (
	WebV3SourceDirect = "direct"
	WebV3SourceShare  = "share"
)

const (
	WebV3AuditSessionCreated      = "session_created"
	WebV3AuditWsTokenIssued       = "ws_token_issued"
	WebV3AuditConnectAttempt      = "connect_attempt"
	WebV3AuditConnected           = "connected"
	WebV3AuditDisconnected        = "disconnected"
	WebV3AuditReconnect           = "reconnect"
	WebV3AuditShareCreated        = "share_created"
	WebV3AuditShareUsed           = "share_used"
	WebV3AuditShareRevoked        = "share_revoked"
	WebV3AuditPermissionDenied    = "permission_denied"
	WebV3AuditTokenExpired        = "token_expired"
	WebV3AuditSessionRevoked      = "session_revoked"
	WebV3AuditFileTransferAttempt = "file_transfer_attempt"
)

type WebV3Session struct {
	IdModel
	SessionId    string                `json:"session_id" gorm:"size:64;default:'';not null;uniqueIndex"`
	UserId       uint                  `json:"user_id" gorm:"default:0;not null;index"`
	ShareId      uint                  `json:"share_id" gorm:"default:0;not null;index"`
	Source       string                `json:"source" gorm:"size:16;default:'';not null;index"`
	PeerId       string                `json:"peer_id" gorm:"size:64;default:'';not null;index"`
	PeerName     string                `json:"peer_name" gorm:"size:255;default:'';not null"`
	PeerPlatform string                `json:"peer_platform" gorm:"size:64;default:'';not null"`
	Permissions  custom_types.AutoJson `json:"permissions" gorm:"type:text;not null" swaggertype:"array,string"`
	Status       string                `json:"status" gorm:"size:32;default:'preparing';not null;index"`
	ExpiresAt    int64                 `json:"expires_at" gorm:"default:0;not null;index"`
	LastSeenAt   int64                 `json:"last_seen_at" gorm:"default:0;not null"`
	RevokedAt    int64                 `json:"revoked_at" gorm:"default:0;not null;index"`
	TimeModel
}

type WebV3SessionList struct {
	WebV3Sessions []*WebV3Session `json:"list"`
	Pagination
}

type WebV3WsToken struct {
	IdModel
	SessionId   string `json:"session_id" gorm:"size:64;default:'';not null;index"`
	PeerId      string `json:"peer_id" gorm:"size:64;default:'';not null;index"`
	TokenDigest string `json:"-" gorm:"size:128;default:'';not null;uniqueIndex"`
	ExpiresAt   int64  `json:"expires_at" gorm:"default:0;not null;index"`
	UsedAt      int64  `json:"used_at" gorm:"default:0;not null;index"`
	RevokedAt   int64  `json:"revoked_at" gorm:"default:0;not null;index"`
	TimeModel
}

type WebV3Share struct {
	IdModel
	UserId       uint                  `json:"user_id" gorm:"default:0;not null;index"`
	PeerId       string                `json:"peer_id" gorm:"size:64;default:'';not null;index"`
	PeerName     string                `json:"peer_name" gorm:"size:255;default:'';not null"`
	PeerPlatform string                `json:"peer_platform" gorm:"size:64;default:'';not null"`
	TokenDigest  string                `json:"-" gorm:"size:128;default:'';not null;uniqueIndex"`
	TokenHint    string                `json:"token_hint" gorm:"size:16;default:'';not null"`
	Permissions  custom_types.AutoJson `json:"permissions" gorm:"type:text;not null" swaggertype:"array,string"`
	Once         bool                  `json:"once" gorm:"default:0;not null"`
	UsedAt       int64                 `json:"used_at" gorm:"default:0;not null;index"`
	ExpiresAt    int64                 `json:"expires_at" gorm:"default:0;not null;index"`
	RevokedAt    int64                 `json:"revoked_at" gorm:"default:0;not null;index"`
	TimeModel
}

type WebV3ShareList struct {
	WebV3Shares []*WebV3Share `json:"list"`
	Pagination
}

type WebV3Audit struct {
	IdModel
	EventType string                `json:"event_type" gorm:"size:64;default:'';not null;index"`
	SessionId string                `json:"session_id" gorm:"size:64;default:'';not null;index"`
	UserId    uint                  `json:"user_id" gorm:"default:0;not null;index"`
	ShareId   uint                  `json:"share_id" gorm:"default:0;not null;index"`
	PeerId    string                `json:"peer_id" gorm:"size:64;default:'';not null;index"`
	Ip        string                `json:"ip" gorm:"size:64;default:'';not null"`
	UserAgent string                `json:"user_agent" gorm:"size:512;default:'';not null"`
	Detail    custom_types.AutoJson `json:"detail" gorm:"type:text;not null" swaggertype:"object"`
	TimeModel
}

type WebV3AuditList struct {
	WebV3Audits []*WebV3Audit `json:"list"`
	Pagination
}

type WebV3Settings struct {
	IdModel
	Enabled                    bool                  `json:"enabled" gorm:"default:1;not null"`
	DefaultShareExpirationSecs int64                 `json:"default_share_expiration_secs" gorm:"default:3600;not null"`
	MaxSessionDurationSecs     int64                 `json:"max_session_duration_secs" gorm:"default:3600;not null"`
	AllowClipboard             bool                  `json:"allow_clipboard" gorm:"default:1;not null"`
	AllowFileTransfer          bool                  `json:"allow_file_transfer" gorm:"default:0;not null"`
	AllowTerminal              bool                  `json:"allow_terminal" gorm:"default:0;not null"`
	RequireLoginForDirectMode  bool                  `json:"require_login_for_direct_mode" gorm:"default:1;not null"`
	AllowAnonymousShareAccess  bool                  `json:"allow_anonymous_share_access" gorm:"default:1;not null"`
	DefaultPermissions         custom_types.AutoJson `json:"default_permissions" gorm:"type:text;not null" swaggertype:"array,string"`
	TimeModel
}
