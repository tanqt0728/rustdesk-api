package api

type WebV3SessionResponse struct {
	SessionId        string   `json:"session_id"`
	PeerId           string   `json:"peer_id"`
	PeerName         string   `json:"peer_name"`
	PeerPlatform     string   `json:"peer_platform"`
	RendezvousServer string   `json:"rendezvous_server"`
	RelayServer      string   `json:"relay_server"`
	PublicKey        string   `json:"public_key"`
	WsToken          string   `json:"ws_token,omitempty"`
	Permissions      []string `json:"permissions"`
	ExpiresAt        int64    `json:"expires_at"`
	Status           string   `json:"status"`
	IceOrRelayPolicy string   `json:"ice_or_relay_policy"`
}

type WebV3ConfigResponse struct {
	Enabled               bool     `json:"enabled"`
	RendezvousServer      string   `json:"rendezvous_server"`
	RelayServer           string   `json:"relay_server"`
	PublicKey             string   `json:"public_key"`
	DefaultPermissions    []string `json:"default_permissions"`
	DefaultSessionSeconds int64    `json:"default_session_seconds"`
	DefaultWsTokenSeconds int64    `json:"default_ws_token_seconds"`
}

type WebV3SharedPeerResponse struct {
	PeerId       string   `json:"peer_id"`
	PeerName     string   `json:"peer_name"`
	PeerPlatform string   `json:"peer_platform"`
	Permissions  []string `json:"permissions"`
	ExpiresAt    int64    `json:"expires_at"`
}
