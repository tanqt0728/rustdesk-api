package admin

type WebV3ShareCreateResponse struct {
	Id          uint     `json:"id"`
	PeerId      string   `json:"peer_id"`
	ShareToken  string   `json:"share_token"`
	ShareUrl    string   `json:"share_url"`
	ExpiresAt   int64    `json:"expires_at"`
	TokenHint   string   `json:"token_hint"`
	Once        bool     `json:"once"`
	RevokedAt   int64    `json:"revoked_at"`
	Permissions []string `json:"permissions"`
}
