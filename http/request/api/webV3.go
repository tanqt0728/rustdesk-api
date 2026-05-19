package api

type WebV3SessionCreateRequest struct {
	PeerId     string `json:"peer_id"`
	ShareToken string `json:"share_token"`
}

type WebV3WsTokenRequest struct {
	SessionId string `json:"session_id" validate:"required"`
}

type WebV3SharedPeerRequest struct {
	ShareToken string `json:"share_token" validate:"required"`
}
