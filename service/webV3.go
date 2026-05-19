package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/model/custom_types"
	"gorm.io/gorm"
)

const (
	WebV3DefaultSessionSeconds = int64(3600)
	WebV3DefaultWsTokenSeconds = int64(300)
	WebV3DefaultShareSeconds   = int64(3600)
)

type WebV3Service struct {
}

func WebV3DefaultPermissions() []string {
	return []string{"view", "control_mouse", "control_keyboard"}
}

func WebV3DefaultSettings() *model.WebV3Settings {
	return &model.WebV3Settings{
		IdModel:                    model.IdModel{Id: 1},
		Enabled:                    true,
		DefaultShareExpirationSecs: WebV3DefaultShareSeconds,
		MaxSessionDurationSecs:     WebV3DefaultSessionSeconds,
		AllowClipboard:             true,
		AllowFileTransfer:          false,
		AllowTerminal:              false,
		RequireLoginForDirectMode:  true,
		AllowAnonymousShareAccess:  true,
		DefaultPermissions:         WebV3PermissionsJSON(WebV3DefaultPermissions()),
	}
}

func (s *WebV3Service) Settings() *model.WebV3Settings {
	settings := &model.WebV3Settings{}
	DB.Where("id = ?", 1).First(settings)
	if settings.Id == 0 {
		return WebV3DefaultSettings()
	}
	if settings.DefaultShareExpirationSecs <= 0 {
		settings.DefaultShareExpirationSecs = WebV3DefaultShareSeconds
	}
	if settings.MaxSessionDurationSecs <= 0 {
		settings.MaxSessionDurationSecs = WebV3DefaultSessionSeconds
	}
	if len(WebV3PermissionsList(settings.DefaultPermissions)) == 0 {
		settings.DefaultPermissions = WebV3PermissionsJSON(WebV3DefaultPermissions())
	}
	return settings
}

func (s *WebV3Service) SaveSettings(settings *model.WebV3Settings) error {
	if settings.DefaultShareExpirationSecs <= 0 {
		settings.DefaultShareExpirationSecs = WebV3DefaultShareSeconds
	}
	if settings.MaxSessionDurationSecs <= 0 {
		settings.MaxSessionDurationSecs = WebV3DefaultSessionSeconds
	}
	if len(WebV3PermissionsList(settings.DefaultPermissions)) == 0 {
		settings.DefaultPermissions = WebV3PermissionsJSON(WebV3DefaultPermissions())
	}
	settings.Id = 1
	existing := &model.WebV3Settings{}
	DB.Where("id = ?", 1).First(existing)
	if existing.Id == 0 {
		return DB.Create(settings).Error
	}
	return DB.Model(existing).Updates(map[string]interface{}{
		"enabled":                       settings.Enabled,
		"default_share_expiration_secs": settings.DefaultShareExpirationSecs,
		"max_session_duration_secs":     settings.MaxSessionDurationSecs,
		"allow_clipboard":               settings.AllowClipboard,
		"allow_file_transfer":           settings.AllowFileTransfer,
		"allow_terminal":                settings.AllowTerminal,
		"require_login_for_direct_mode": settings.RequireLoginForDirectMode,
		"allow_anonymous_share_access":  settings.AllowAnonymousShareAccess,
		"default_permissions":           settings.DefaultPermissions,
	}).Error
}

func WebV3PermissionsJSON(permissions []string) custom_types.AutoJson {
	if len(permissions) == 0 {
		permissions = WebV3DefaultPermissions()
	}
	b, err := json.Marshal(permissions)
	if err != nil {
		b = []byte(`["view","control_mouse","control_keyboard"]`)
	}
	return custom_types.AutoJson(b)
}

func WebV3PermissionsList(v custom_types.AutoJson) []string {
	res := []string{}
	if err := json.Unmarshal([]byte(v.String()), &res); err != nil || len(res) == 0 {
		return WebV3DefaultPermissions()
	}
	return res
}

func WebV3TokenDigest(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func WebV3NewRawToken() string {
	return uuid.NewString() + uuid.NewString()
}

func (s *WebV3Service) CreateSession(userId uint, shareId uint, source string, peerId string, peerName string, peerPlatform string, permissions []string) (*model.WebV3Session, string, error) {
	now := time.Now().Unix()
	settings := s.Settings()
	if len(permissions) == 0 {
		permissions = WebV3PermissionsList(settings.DefaultPermissions)
	}
	session := &model.WebV3Session{
		SessionId:    uuid.NewString(),
		UserId:       userId,
		ShareId:      shareId,
		Source:       source,
		PeerId:       peerId,
		PeerName:     peerName,
		PeerPlatform: peerPlatform,
		Permissions:  WebV3PermissionsJSON(permissions),
		Status:       model.WebV3SessionStatusPreparing,
		ExpiresAt:    now + settings.MaxSessionDurationSecs,
		LastSeenAt:   now,
	}
	if err := DB.Create(session).Error; err != nil {
		return nil, "", err
	}
	rawToken, _, err := s.IssueWsToken(session)
	if err != nil {
		return nil, "", err
	}
	return session, rawToken, nil
}

func (s *WebV3Service) IssueWsToken(session *model.WebV3Session) (string, *model.WebV3WsToken, error) {
	rawToken := WebV3NewRawToken()
	token := &model.WebV3WsToken{
		SessionId:   session.SessionId,
		PeerId:      session.PeerId,
		TokenDigest: WebV3TokenDigest(rawToken),
		ExpiresAt:   time.Now().Unix() + WebV3DefaultWsTokenSeconds,
	}
	err := DB.Create(token).Error
	return rawToken, token, err
}

func (s *WebV3Service) SessionBySessionId(sessionId string) *model.WebV3Session {
	session := &model.WebV3Session{}
	DB.Where("session_id = ?", sessionId).First(session)
	if session.Id == 0 {
		return session
	}
	if session.RevokedAt > 0 {
		session.Status = model.WebV3SessionStatusRevoked
	} else if session.ExpiresAt > 0 && session.ExpiresAt < time.Now().Unix() {
		session.Status = model.WebV3SessionStatusExpired
	}
	return session
}

func (s *WebV3Service) SessionById(id uint) *model.WebV3Session {
	session := &model.WebV3Session{}
	DB.Where("id = ?", id).First(session)
	if session.Id == 0 {
		return session
	}
	if session.RevokedAt > 0 {
		session.Status = model.WebV3SessionStatusRevoked
	} else if session.ExpiresAt > 0 && session.ExpiresAt < time.Now().Unix() {
		session.Status = model.WebV3SessionStatusExpired
	}
	return session
}

func (s *WebV3Service) RefreshSession(session *model.WebV3Session) error {
	session.LastSeenAt = time.Now().Unix()
	return DB.Model(session).Updates(map[string]interface{}{
		"last_seen_at": session.LastSeenAt,
	}).Error
}

func (s *WebV3Service) RevokeSession(session *model.WebV3Session) error {
	now := time.Now().Unix()
	session.RevokedAt = now
	session.Status = model.WebV3SessionStatusRevoked
	return DB.Model(session).Updates(map[string]interface{}{
		"revoked_at": now,
		"status":     model.WebV3SessionStatusRevoked,
	}).Error
}

func (s *WebV3Service) ExpireOldSessions() {
	now := time.Now().Unix()
	DB.Model(&model.WebV3Session{}).
		Where("revoked_at = 0 AND expires_at > 0 AND expires_at < ? AND status <> ?", now, model.WebV3SessionStatusExpired).
		Updates(map[string]interface{}{
			"status": model.WebV3SessionStatusExpired,
		})
}

func (s *WebV3Service) CleanupStaleSessions(staleSeconds int64) (int64, error) {
	if staleSeconds <= 0 {
		staleSeconds = 300
	}
	now := time.Now().Unix()
	cutoff := now - staleSeconds
	tx := DB.Model(&model.WebV3Session{}).
		Where("revoked_at = 0 AND status NOT IN ?", []string{model.WebV3SessionStatusExpired, model.WebV3SessionStatusRevoked}).
		Where("(expires_at > 0 AND expires_at < ?) OR last_seen_at = 0 OR last_seen_at < ?", now, cutoff).
		Updates(map[string]interface{}{
			"revoked_at": now,
			"status":     model.WebV3SessionStatusDisconnected,
		})
	return tx.RowsAffected, tx.Error
}

func (s *WebV3Service) ListSessions(page, pageSize uint, where func(tx *gorm.DB)) (res *model.WebV3SessionList) {
	res = &model.WebV3SessionList{}
	res.Page = int64(page)
	res.PageSize = int64(pageSize)
	s.ExpireOldSessions()
	tx := DB.Model(&model.WebV3Session{})
	if where != nil {
		where(tx)
	}
	tx.Count(&res.Total)
	tx = tx.Scopes(Paginate(page, pageSize)).Order("id desc")
	tx.Find(&res.WebV3Sessions)
	return
}

func (s *WebV3Service) CreateShare(userId uint, peerId string, peerName string, peerPlatform string, expiresInSeconds int64, once bool, permissions []string) (*model.WebV3Share, string, error) {
	settings := s.Settings()
	if expiresInSeconds <= 0 {
		expiresInSeconds = settings.DefaultShareExpirationSecs
	}
	if len(permissions) == 0 {
		permissions = WebV3PermissionsList(settings.DefaultPermissions)
	}
	rawToken := WebV3NewRawToken()
	share := &model.WebV3Share{
		UserId:       userId,
		PeerId:       peerId,
		PeerName:     peerName,
		PeerPlatform: peerPlatform,
		TokenDigest:  WebV3TokenDigest(rawToken),
		TokenHint:    rawToken[:8],
		Permissions:  WebV3PermissionsJSON(permissions),
		Once:         once,
		ExpiresAt:    time.Now().Unix() + expiresInSeconds,
	}
	err := DB.Create(share).Error
	return share, rawToken, err
}

func (s *WebV3Service) ShareByRawToken(rawToken string) *model.WebV3Share {
	share := &model.WebV3Share{}
	DB.Where("token_digest = ?", WebV3TokenDigest(rawToken)).First(share)
	return share
}

func (s *WebV3Service) ListShares(page, pageSize uint, where func(tx *gorm.DB)) (res *model.WebV3ShareList) {
	res = &model.WebV3ShareList{}
	res.Page = int64(page)
	res.PageSize = int64(pageSize)
	tx := DB.Model(&model.WebV3Share{})
	if where != nil {
		where(tx)
	}
	tx.Count(&res.Total)
	tx = tx.Scopes(Paginate(page, pageSize)).Order("id desc")
	tx.Find(&res.WebV3Shares)
	return
}

func (s *WebV3Service) ShareById(id uint) *model.WebV3Share {
	share := &model.WebV3Share{}
	DB.Where("id = ?", id).First(share)
	return share
}

func (s *WebV3Service) RevokeShare(share *model.WebV3Share) error {
	now := time.Now().Unix()
	share.RevokedAt = now
	return DB.Model(share).Update("revoked_at", now).Error
}

func (s *WebV3Service) MarkShareUsed(share *model.WebV3Share) error {
	now := time.Now().Unix()
	share.UsedAt = now
	return DB.Model(share).Update("used_at", now).Error
}

func (s *WebV3Service) CreateAudit(eventType string, sessionId string, userId uint, shareId uint, peerId string, ip string, userAgent string, detail map[string]interface{}) error {
	b, err := json.Marshal(detail)
	if err != nil {
		b = []byte(`{}`)
	}
	audit := &model.WebV3Audit{
		EventType: eventType,
		SessionId: sessionId,
		UserId:    userId,
		ShareId:   shareId,
		PeerId:    peerId,
		Ip:        ip,
		UserAgent: userAgent,
		Detail:    custom_types.AutoJson(b),
	}
	return DB.Create(audit).Error
}

func (s *WebV3Service) ListAudits(page, pageSize uint, where func(tx *gorm.DB)) (res *model.WebV3AuditList) {
	res = &model.WebV3AuditList{}
	res.Page = int64(page)
	res.PageSize = int64(pageSize)
	tx := DB.Model(&model.WebV3Audit{})
	if where != nil {
		where(tx)
	}
	tx.Count(&res.Total)
	tx = tx.Scopes(Paginate(page, pageSize)).Order("id desc")
	tx.Find(&res.WebV3Audits)
	return
}
