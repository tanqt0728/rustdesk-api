package api

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	apiReq "github.com/lejianwen/rustdesk-api/v2/http/request/api"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	apiResp "github.com/lejianwen/rustdesk-api/v2/http/response/api"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/service"
)

type WebV3 struct {
}

func (w *WebV3) Config(c *gin.Context) {
	settings := service.AllService.WebV3Service.Settings()
	response.Success(c, apiResp.WebV3ConfigResponse{
		Enabled:               settings.Enabled,
		RendezvousServer:      global.Config.Rustdesk.IdServer,
		RelayServer:           global.Config.Rustdesk.RelayServer,
		PublicKey:             global.Config.Rustdesk.Key,
		DefaultPermissions:    service.WebV3PermissionsList(settings.DefaultPermissions),
		DefaultSessionSeconds: settings.MaxSessionDurationSecs,
		DefaultWsTokenSeconds: service.WebV3DefaultWsTokenSeconds,
	})
}

func (w *WebV3) CreateSession(c *gin.Context) {
	req := &apiReq.WebV3SessionCreateRequest{}
	if err := c.ShouldBindJSON(req); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	req.PeerId = strings.TrimSpace(req.PeerId)
	req.ShareToken = strings.TrimSpace(req.ShareToken)
	if req.PeerId == "" && req.ShareToken == "" {
		response.Fail(c, 101, "peer_id or share_token is required")
		return
	}
	if !service.AllService.WebV3Service.Settings().Enabled {
		response.Fail(c, 101, "web v3 is disabled")
		return
	}

	var session *model.WebV3Session
	var wsToken string
	var err error

	if req.ShareToken != "" {
		session, wsToken, err = w.createShareSession(c, req.ShareToken)
	} else {
		session, wsToken, err = w.createDirectSession(c, req.PeerId)
	}
	if err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	response.Success(c, webV3SessionPayload(session, wsToken))
}

func (w *WebV3) Session(c *gin.Context) {
	session := service.AllService.WebV3Service.SessionBySessionId(c.Param("session_id"))
	if session.Id == 0 {
		response.Fail(c, 101, "session not found")
		return
	}
	response.Success(c, webV3SessionPayload(session, ""))
}

func (w *WebV3) Refresh(c *gin.Context) {
	session := service.AllService.WebV3Service.SessionBySessionId(c.Param("session_id"))
	if session.Id == 0 {
		response.Fail(c, 101, "session not found")
		return
	}
	if !webV3SessionUsable(session) {
		response.Success(c, webV3SessionPayload(session, ""))
		return
	}
	if err := service.AllService.WebV3Service.RefreshSession(session); err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	wsToken, _, err := service.AllService.WebV3Service.IssueWsToken(session)
	if err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	_ = service.AllService.WebV3Service.CreateAudit(model.WebV3AuditWsTokenIssued, session.SessionId, session.UserId, session.ShareId, session.PeerId, c.ClientIP(), c.Request.UserAgent(), gin.H{"source": "refresh"})
	response.Success(c, webV3SessionPayload(session, wsToken))
}

func (w *WebV3) Revoke(c *gin.Context) {
	session := service.AllService.WebV3Service.SessionBySessionId(c.Param("session_id"))
	if session.Id == 0 {
		response.Fail(c, 101, "session not found")
		return
	}
	if err := service.AllService.WebV3Service.RevokeSession(session); err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	_ = service.AllService.WebV3Service.CreateAudit(model.WebV3AuditSessionRevoked, session.SessionId, session.UserId, session.ShareId, session.PeerId, c.ClientIP(), c.Request.UserAgent(), gin.H{"source": "public"})
	response.Success(c, webV3SessionPayload(session, ""))
}

func (w *WebV3) WsToken(c *gin.Context) {
	req := &apiReq.WebV3WsTokenRequest{}
	if err := c.ShouldBindJSON(req); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	session := service.AllService.WebV3Service.SessionBySessionId(strings.TrimSpace(req.SessionId))
	if session.Id == 0 {
		response.Fail(c, 101, "session not found")
		return
	}
	if !webV3SessionUsable(session) {
		response.Fail(c, 101, "session is not active")
		return
	}
	wsToken, _, err := service.AllService.WebV3Service.IssueWsToken(session)
	if err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	_ = service.AllService.WebV3Service.CreateAudit(model.WebV3AuditWsTokenIssued, session.SessionId, session.UserId, session.ShareId, session.PeerId, c.ClientIP(), c.Request.UserAgent(), gin.H{"source": "ws-token"})
	response.Success(c, webV3SessionPayload(session, wsToken))
}

func (w *WebV3) SharedPeer(c *gin.Context) {
	if !service.AllService.WebV3Service.Settings().AllowAnonymousShareAccess {
		response.Fail(c, 101, "anonymous share access is disabled")
		return
	}
	req := &apiReq.WebV3SharedPeerRequest{}
	if err := c.ShouldBindJSON(req); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	req.ShareToken = strings.TrimSpace(req.ShareToken)
	if req.ShareToken == "" {
		response.Fail(c, 101, "share_token is required")
		return
	}
	if share := service.AllService.WebV3Service.ShareByRawToken(req.ShareToken); share.Id > 0 {
		if !webV3ShareUsable(share) {
			response.Fail(c, 101, "share expired or revoked")
			return
		}
		response.Success(c, apiResp.WebV3SharedPeerResponse{
			PeerId:       share.PeerId,
			PeerName:     share.PeerName,
			PeerPlatform: share.PeerPlatform,
			Permissions:  service.WebV3PermissionsList(share.Permissions),
			ExpiresAt:    share.ExpiresAt,
		})
		return
	}
	if sr := service.AllService.AddressBookService.SharedPeer(req.ShareToken); sr != nil && sr.Id > 0 {
		if legacyShareExpired(sr) {
			response.Fail(c, 101, "share expired")
			return
		}
		ab := service.AllService.AddressBookService.InfoByUserIdAndId(sr.UserId, sr.PeerId)
		response.Success(c, apiResp.WebV3SharedPeerResponse{
			PeerId:       sr.PeerId,
			PeerName:     addressBookPeerName(ab),
			PeerPlatform: ab.Platform,
			Permissions:  service.WebV3DefaultPermissions(),
			ExpiresAt:    legacyShareExpiresAt(sr),
		})
		return
	}
	response.Fail(c, 101, "share not found")
}

func (w *WebV3) createDirectSession(c *gin.Context, peerId string) (*model.WebV3Session, string, error) {
	settings := service.AllService.WebV3Service.Settings()
	user := webV3CurrentUserFromBearer(c)
	if settings.RequireLoginForDirectMode && (user == nil || user.Id == 0) {
		return nil, "", errWebV3("login required")
	}
	peer := service.AllService.PeerService.FindById(peerId)
	if peer.RowId == 0 {
		return nil, "", errWebV3("peer not found")
	}
	userId := uint(0)
	if user != nil {
		userId = user.Id
	}
	if userId > 0 && !service.AllService.UserService.IsAdmin(user) && peer.UserId != user.Id {
		return nil, "", errWebV3("no access to peer")
	}
	session, wsToken, err := service.AllService.WebV3Service.CreateSession(userId, 0, model.WebV3SourceDirect, peer.Id, peerDisplayName(peer), peer.Os, service.WebV3PermissionsList(settings.DefaultPermissions))
	if err != nil {
		return nil, "", err
	}
	_ = service.AllService.WebV3Service.CreateAudit(model.WebV3AuditSessionCreated, session.SessionId, userId, 0, peer.Id, c.ClientIP(), c.Request.UserAgent(), gin.H{"source": model.WebV3SourceDirect})
	return session, wsToken, nil
}

func (w *WebV3) createShareSession(c *gin.Context, rawToken string) (*model.WebV3Session, string, error) {
	if !service.AllService.WebV3Service.Settings().AllowAnonymousShareAccess {
		return nil, "", errWebV3("anonymous share access is disabled")
	}
	if share := service.AllService.WebV3Service.ShareByRawToken(rawToken); share.Id > 0 {
		if !webV3ShareUsable(share) {
			return nil, "", errWebV3("share expired or revoked")
		}
		session, wsToken, err := service.AllService.WebV3Service.CreateSession(0, share.Id, model.WebV3SourceShare, share.PeerId, share.PeerName, share.PeerPlatform, service.WebV3PermissionsList(share.Permissions))
		if err != nil {
			return nil, "", err
		}
		if share.Once {
			_ = service.AllService.WebV3Service.MarkShareUsed(share)
		}
		_ = service.AllService.WebV3Service.CreateAudit(model.WebV3AuditShareUsed, session.SessionId, 0, share.Id, share.PeerId, c.ClientIP(), c.Request.UserAgent(), gin.H{"source": model.WebV3SourceShare})
		return session, wsToken, nil
	}

	sr := service.AllService.AddressBookService.SharedPeer(rawToken)
	if sr == nil || sr.Id == 0 {
		return nil, "", errWebV3("share not found")
	}
	if legacyShareExpired(sr) {
		return nil, "", errWebV3("share expired")
	}
	ab := service.AllService.AddressBookService.InfoByUserIdAndId(sr.UserId, sr.PeerId)
	if ab.RowId == 0 {
		return nil, "", errWebV3("peer not found")
	}
	session, wsToken, err := service.AllService.WebV3Service.CreateSession(0, 0, model.WebV3SourceShare, sr.PeerId, addressBookPeerName(ab), ab.Platform, service.WebV3DefaultPermissions())
	if err != nil {
		return nil, "", err
	}
	_ = service.AllService.WebV3Service.CreateAudit(model.WebV3AuditShareUsed, session.SessionId, 0, 0, sr.PeerId, c.ClientIP(), c.Request.UserAgent(), gin.H{"source": "legacy-share"})
	return session, wsToken, nil
}

func webV3SessionPayload(session *model.WebV3Session, wsToken string) apiResp.WebV3SessionResponse {
	return apiResp.WebV3SessionResponse{
		SessionId:        session.SessionId,
		PeerId:           session.PeerId,
		PeerName:         session.PeerName,
		PeerPlatform:     session.PeerPlatform,
		RendezvousServer: global.Config.Rustdesk.IdServer,
		RelayServer:      global.Config.Rustdesk.RelayServer,
		PublicKey:        global.Config.Rustdesk.Key,
		WsToken:          wsToken,
		Permissions:      service.WebV3PermissionsList(session.Permissions),
		ExpiresAt:        session.ExpiresAt,
		Status:           session.Status,
		IceOrRelayPolicy: "rustdesk-relay",
	}
}

func webV3CurrentUserFromBearer(c *gin.Context) *model.User {
	token := strings.TrimSpace(c.GetHeader("Authorization"))
	token = strings.TrimSpace(strings.TrimPrefix(token, "Bearer "))
	if token == "" || token == c.GetHeader("Authorization") {
		return nil
	}
	if len(global.Jwt.Key) > 0 {
		if uid, _ := service.AllService.UserService.VerifyJWT(token); uid == 0 {
			return nil
		}
	}
	user, userToken := service.AllService.UserService.InfoByAccessToken(token)
	if user.Id == 0 || !service.AllService.UserService.CheckUserEnable(user) {
		return nil
	}
	service.AllService.UserService.AutoRefreshAccessToken(userToken)
	return user
}

func webV3SessionUsable(session *model.WebV3Session) bool {
	return session.RevokedAt == 0 && (session.ExpiresAt == 0 || session.ExpiresAt >= time.Now().Unix())
}

func webV3ShareUsable(share *model.WebV3Share) bool {
	if share.RevokedAt > 0 {
		return false
	}
	if share.ExpiresAt > 0 && share.ExpiresAt < time.Now().Unix() {
		return false
	}
	if share.Once && share.UsedAt > 0 {
		return false
	}
	return true
}

func legacyShareExpired(sr *model.ShareRecord) bool {
	return sr.Expire > 0 && time.Time(sr.CreatedAt).Add(time.Second*time.Duration(sr.Expire)).Before(time.Now())
}

func legacyShareExpiresAt(sr *model.ShareRecord) int64 {
	if sr.Expire <= 0 {
		return 0
	}
	return time.Time(sr.CreatedAt).Add(time.Second * time.Duration(sr.Expire)).Unix()
}

func peerDisplayName(peer *model.Peer) string {
	if peer.Alias != "" {
		return peer.Alias
	}
	if peer.Hostname != "" {
		return peer.Hostname
	}
	return peer.Username
}

func addressBookPeerName(ab *model.AddressBook) string {
	if ab.Alias != "" {
		return ab.Alias
	}
	if ab.Hostname != "" {
		return ab.Hostname
	}
	return ab.Username
}

type webV3Error string

func (e webV3Error) Error() string {
	return string(e)
}

func errWebV3(message string) error {
	return webV3Error(message)
}
