package admin

import (
	"net/url"

	"github.com/gin-gonic/gin"
	adminReq "github.com/lejianwen/rustdesk-api/v2/http/request/admin"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	adminResp "github.com/lejianwen/rustdesk-api/v2/http/response/admin"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/service"
	"gorm.io/gorm"
)

type WebV3 struct {
}

func (w *WebV3) Share(c *gin.Context) {
	req := &adminReq.WebV3ShareCreateRequest{}
	if err := c.ShouldBindJSON(req); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	if req.PeerId == "" {
		response.Fail(c, 101, "peer_id is required")
		return
	}
	user := service.AllService.UserService.CurUser(c)
	peer := service.AllService.PeerService.FindById(req.PeerId)
	if peer.RowId == 0 {
		response.Fail(c, 101, "peer not found")
		return
	}
	share, rawToken, err := service.AllService.WebV3Service.CreateShare(user.Id, peer.Id, adminPeerDisplayName(peer), peer.Os, req.ExpiresInSeconds, req.Once, req.Permissions)
	if err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	_ = service.AllService.WebV3Service.CreateAudit(model.WebV3AuditShareCreated, "", user.Id, share.Id, share.PeerId, c.ClientIP(), c.Request.UserAgent(), gin.H{"once": share.Once})
	response.Success(c, adminResp.WebV3ShareCreateResponse{
		Id:          share.Id,
		PeerId:      share.PeerId,
		ShareToken:  rawToken,
		ShareUrl:    "/web3/#/?share_token=" + url.QueryEscape(rawToken),
		ExpiresAt:   share.ExpiresAt,
		TokenHint:   share.TokenHint,
		Once:        share.Once,
		RevokedAt:   share.RevokedAt,
		Permissions: service.WebV3PermissionsList(share.Permissions),
	})
}

func (w *WebV3) ShareList(c *gin.Context) {
	query := &adminReq.WebV3ShareQuery{}
	if err := c.ShouldBindQuery(query); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	res := service.AllService.WebV3Service.ListShares(query.Page, query.PageSize, func(tx *gorm.DB) {
		if query.PeerId != "" {
			tx.Where("peer_id = ?", query.PeerId)
		}
	})
	response.Success(c, res)
}

func (w *WebV3) ShareRevoke(c *gin.Context) {
	req := &adminReq.WebV3RevokeRequest{}
	if err := c.ShouldBindJSON(req); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	if req.Id == 0 {
		response.Fail(c, 101, "id is required")
		return
	}
	share := service.AllService.WebV3Service.ShareById(req.Id)
	if share.Id == 0 {
		response.Fail(c, 101, "share not found")
		return
	}
	if err := service.AllService.WebV3Service.RevokeShare(share); err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	user := service.AllService.UserService.CurUser(c)
	_ = service.AllService.WebV3Service.CreateAudit(model.WebV3AuditShareRevoked, "", user.Id, share.Id, share.PeerId, c.ClientIP(), c.Request.UserAgent(), gin.H{"source": "admin"})
	response.Success(c, share)
}

func (w *WebV3) SessionList(c *gin.Context) {
	query := &adminReq.WebV3SessionQuery{}
	if err := c.ShouldBindQuery(query); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	res := service.AllService.WebV3Service.ListSessions(query.Page, query.PageSize, func(tx *gorm.DB) {
		if query.PeerId != "" {
			tx.Where("peer_id = ?", query.PeerId)
		}
		if query.Status != "" {
			tx.Where("status = ?", query.Status)
		}
	})
	response.Success(c, res)
}

func (w *WebV3) SessionRevoke(c *gin.Context) {
	req := &adminReq.WebV3RevokeRequest{}
	if err := c.ShouldBindJSON(req); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	session := &model.WebV3Session{}
	if req.SessionId != "" {
		session = service.AllService.WebV3Service.SessionBySessionId(req.SessionId)
	} else if req.Id > 0 {
		session = service.AllService.WebV3Service.SessionById(req.Id)
	}
	if session.Id == 0 {
		response.Fail(c, 101, "session not found")
		return
	}
	if err := service.AllService.WebV3Service.RevokeSession(session); err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	user := service.AllService.UserService.CurUser(c)
	_ = service.AllService.WebV3Service.CreateAudit(model.WebV3AuditSessionRevoked, session.SessionId, user.Id, session.ShareId, session.PeerId, c.ClientIP(), c.Request.UserAgent(), gin.H{"source": "admin"})
	response.Success(c, session)
}

func (w *WebV3) SessionCleanup(c *gin.Context) {
	req := &adminReq.WebV3SessionCleanupRequest{StaleSeconds: 300}
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(req); err != nil {
			response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
			return
		}
	}
	count, err := service.AllService.WebV3Service.CleanupStaleSessions(req.StaleSeconds)
	if err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	user := service.AllService.UserService.CurUser(c)
	_ = service.AllService.WebV3Service.CreateAudit(model.WebV3AuditSessionRevoked, "", user.Id, 0, "", c.ClientIP(), c.Request.UserAgent(), gin.H{"source": "admin-cleanup", "stale_seconds": req.StaleSeconds, "count": count})
	response.Success(c, gin.H{"cleaned": count, "stale_seconds": req.StaleSeconds})
}

func (w *WebV3) AuditList(c *gin.Context) {
	query := &adminReq.WebV3AuditQuery{}
	if err := c.ShouldBindQuery(query); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	res := service.AllService.WebV3Service.ListAudits(query.Page, query.PageSize, func(tx *gorm.DB) {
		if query.PeerId != "" {
			tx.Where("peer_id = ?", query.PeerId)
		}
		if query.SessionId != "" {
			tx.Where("session_id = ?", query.SessionId)
		}
		if query.EventType != "" {
			tx.Where("event_type = ?", query.EventType)
		}
	})
	response.Success(c, res)
}

func (w *WebV3) Settings(c *gin.Context) {
	response.Success(c, webV3SettingsPayload(service.AllService.WebV3Service.Settings()))
}

func (w *WebV3) SaveSettings(c *gin.Context) {
	req := &adminReq.WebV3SettingsForm{}
	if err := c.ShouldBindJSON(req); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	settings := &model.WebV3Settings{
		Enabled:                    req.Enabled,
		DefaultShareExpirationSecs: req.DefaultShareExpirationSecs,
		MaxSessionDurationSecs:     req.MaxSessionDurationSecs,
		AllowClipboard:             req.AllowClipboard,
		AllowFileTransfer:          req.AllowFileTransfer,
		AllowTerminal:              req.AllowTerminal,
		RequireLoginForDirectMode:  req.RequireLoginForDirectMode,
		AllowAnonymousShareAccess:  req.AllowAnonymousShareAccess,
		DefaultPermissions:         service.WebV3PermissionsJSON(req.DefaultPermissions),
	}
	if err := service.AllService.WebV3Service.SaveSettings(settings); err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	response.Success(c, gin.H{"settings": webV3SettingsPayload(service.AllService.WebV3Service.Settings()), "persisted": true})
}

func adminPeerDisplayName(peer *model.Peer) string {
	if peer.Alias != "" {
		return peer.Alias
	}
	if peer.Hostname != "" {
		return peer.Hostname
	}
	return peer.Username
}

func webV3SettingsPayload(settings *model.WebV3Settings) adminReq.WebV3SettingsForm {
	return adminReq.WebV3SettingsForm{
		Enabled:                    settings.Enabled,
		DefaultShareExpirationSecs: settings.DefaultShareExpirationSecs,
		MaxSessionDurationSecs:     settings.MaxSessionDurationSecs,
		AllowClipboard:             settings.AllowClipboard,
		AllowFileTransfer:          settings.AllowFileTransfer,
		AllowTerminal:              settings.AllowTerminal,
		RequireLoginForDirectMode:  settings.RequireLoginForDirectMode,
		AllowAnonymousShareAccess:  settings.AllowAnonymousShareAccess,
		DefaultPermissions:         service.WebV3PermissionsList(settings.DefaultPermissions),
	}
}
