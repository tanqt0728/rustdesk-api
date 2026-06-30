package admin

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	jwtlib "github.com/lejianwen/rustdesk-api/v2/lib/jwt"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/service"

	"github.com/spf13/viper"
)

type Config struct {
}

// ServerConfig RUSTDESK服务配置
// @Tags ADMIN
// @Summary RUSTDESK服务配置
// @Description 服务配置,给webclient提供api-server
// @Accept  json
// @Produce  json
// @Success 200 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /admin/config/server [get]
// @Security token
func (co *Config) ServerConfig(c *gin.Context) {
	mountedKey := global.Config.Rustdesk.ReadKeyFile()
	if strings.TrimSpace(global.Config.Rustdesk.Key) == "" && mountedKey != "" {
		global.Config.Rustdesk.Key = mountedKey
	}
	cf := &response.ServerConfigResponse{
		IdServer:    global.Config.Rustdesk.IdServer,
		Key:         global.Config.Rustdesk.Key,
		MountedKey:  mountedKey,
		RelayServer: global.Config.Rustdesk.RelayServer,
		ApiServer:   global.Config.Rustdesk.ApiServer,
		MustLogin:   currentMustLogin(),
		TokenExpire: global.Config.App.TokenExpire.String(),
		JwtExpire:   global.Config.Jwt.ExpireDuration.String(),
	}
	response.Success(c, cf)
}

// AppConfig APP服务配置
// @Tags ADMIN
// @Summary APP服务配置
// @Description APP服务配置
// @Accept  json
// @Produce  json
// @Success 200 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /admin/config/app [get]
// @Security token
// SaveServerConfig updates the RustDesk connection endpoints used by the API.
func (co *Config) SaveServerConfig(c *gin.Context) {
	req := &response.ServerConfigResponse{}
	if err := c.ShouldBindJSON(req); err != nil {
		response.Fail(c, 101, response.TranslateMsg(c, "ParamsError")+err.Error())
		return
	}
	req.IdServer = strings.TrimSpace(req.IdServer)
	req.RelayServer = strings.TrimSpace(req.RelayServer)
	req.ApiServer = strings.TrimSpace(req.ApiServer)
	req.Key = strings.TrimSpace(req.Key)
	req.ServerPrivateKey = strings.TrimSpace(req.ServerPrivateKey)
	req.TokenExpire = strings.TrimSpace(req.TokenExpire)
	req.JwtExpire = strings.TrimSpace(req.JwtExpire)
	if req.IdServer == "" || req.RelayServer == "" {
		response.Fail(c, 101, "id_server and relay_server are required")
		return
	}
	tokenExpire, err := parsePositiveDuration(req.TokenExpire, global.Config.App.TokenExpire)
	if err != nil {
		response.Fail(c, 101, "invalid token expiry duration: "+err.Error())
		return
	}
	jwtExpire, err := parsePositiveDuration(req.JwtExpire, global.Config.Jwt.ExpireDuration)
	if err != nil {
		response.Fail(c, 101, "invalid JWT expiry duration: "+err.Error())
		return
	}
	mountedKey := global.Config.Rustdesk.ReadKeyFile()
	if req.Key == "" {
		req.Key = mountedKey
	}
	if req.Key == "" {
		response.Fail(c, 101, "public key is required. Put id_ed25519.pub in /root/data or paste the 32-byte RustDesk public key.")
		return
	}
	if !validRustdeskPublicKey(req.Key) {
		response.Fail(c, 101, "invalid public key. Use the content of id_ed25519.pub only, not id_ed25519 or a config string.")
		return
	}
	keypairChanged := false
	if req.ServerPrivateKey != "" {
		if !validRustdeskPrivateKey(req.ServerPrivateKey) {
			response.Fail(c, 101, "invalid private key. Paste the matching 64-byte RustDesk private key from id_ed25519.")
			return
		}
		if !matchingRustdeskKeypair(req.Key, req.ServerPrivateKey) {
			response.Fail(c, 101, "public key and private key do not match.")
			return
		}
		if err := writeServerKeypair(req.Key, req.ServerPrivateKey); err != nil {
			response.Fail(c, 101, "failed to write server keypair: "+err.Error())
			return
		}
		keypairChanged = true
	} else if mountedKey != "" && req.Key != mountedKey {
		response.Fail(c, 101, "to change the server public key from Admin, paste the matching private key too. Public key alone cannot secure connections.")
		return
	}

	global.Config.Rustdesk.IdServer = req.IdServer
	global.Config.Rustdesk.RelayServer = req.RelayServer
	global.Config.Rustdesk.ApiServer = req.ApiServer
	global.Config.Rustdesk.Key = req.Key
	global.Config.App.TokenExpire = tokenExpire
	global.Config.Jwt.ExpireDuration = jwtExpire
	global.Jwt = jwtlib.NewJwt(global.Config.Jwt.Key, global.Config.Jwt.ExpireDuration)
	service.Jwt = global.Jwt

	v := viper.GetViper()
	v.Set("rustdesk.id-server", req.IdServer)
	v.Set("rustdesk.relay-server", req.RelayServer)
	v.Set("rustdesk.api-server", req.ApiServer)
	v.Set("rustdesk.key", req.Key)
	v.Set("app.token-expire", tokenExpire.String())
	v.Set("jwt.expire-duration", jwtExpire.String())
	v.Set("server.must-login", req.MustLogin)
	serverEnvPersisted := true
	serverEnvError := ""
	if err := persistServerRuntimeEnv(req.MustLogin); err != nil {
		serverEnvPersisted = false
		serverEnvError = err.Error()
	}
	persisted := true
	persistError := ""
	if err := v.WriteConfig(); err != nil {
		persisted = false
		persistError = err.Error()
	}
	liveApplyAttempted := true
	liveApplyError := ""
	if err := applyMustLoginLive(req.MustLogin); err != nil {
		liveApplyError = err.Error()
	}
	restartAttempted := false
	restartError := ""
	if keypairChanged && req.AutoRestart {
		restartAttempted = true
		if err := restartRustdeskServerContainer(); err != nil {
			restartError = err.Error()
		}
	}

	response.Success(c, gin.H{
		"config": &response.ServerConfigResponse{
			IdServer:    global.Config.Rustdesk.IdServer,
			Key:         global.Config.Rustdesk.Key,
			MountedKey:  global.Config.Rustdesk.ReadKeyFile(),
			RelayServer: global.Config.Rustdesk.RelayServer,
			ApiServer:   global.Config.Rustdesk.ApiServer,
			MustLogin:   currentMustLogin(),
			TokenExpire: global.Config.App.TokenExpire.String(),
			JwtExpire:   global.Config.Jwt.ExpireDuration.String(),
		},
		"persisted":        persisted,
		"persist_error":    persistError,
		"restart_required": keypairChanged,
		"restart_attempted": restartAttempted,
		"restart_error":    restartError,
		"live_apply_attempted": liveApplyAttempted,
		"live_apply_error":    liveApplyError,
		"server_env_persisted": serverEnvPersisted,
		"server_env_error":    serverEnvError,
	})
}

func (co *Config) GenerateServerKeypair(c *gin.Context) {
	publicKey, privateKey, err := generateRustdeskKeypair()
	if err != nil {
		response.Fail(c, 101, "failed to generate server keypair: "+err.Error())
		return
	}
	if err := writeServerKeypair(publicKey, privateKey); err != nil {
		response.Fail(c, 101, "failed to write server keypair: "+err.Error())
		return
	}
	global.Config.Rustdesk.Key = publicKey
	v := viper.GetViper()
	v.Set("rustdesk.key", publicKey)
	persisted := true
	persistError := ""
	if err := v.WriteConfig(); err != nil {
		persisted = false
		persistError = err.Error()
	}
	restartError := ""
	if err := restartRustdeskServerContainer(); err != nil {
		restartError = err.Error()
	}
	response.Success(c, gin.H{
		"config": &response.ServerConfigResponse{
			IdServer:    global.Config.Rustdesk.IdServer,
			Key:         publicKey,
			MountedKey:  publicKey,
			RelayServer: global.Config.Rustdesk.RelayServer,
			ApiServer:   global.Config.Rustdesk.ApiServer,
			MustLogin:   currentMustLogin(),
			TokenExpire: global.Config.App.TokenExpire.String(),
			JwtExpire:   global.Config.Jwt.ExpireDuration.String(),
		},
		"persisted":        persisted,
		"persist_error":    persistError,
		"restart_required": true,
		"restart_attempted": true,
		"restart_error":    restartError,
	})
}

func (co *Config) RestartServer(c *gin.Context) {
	if err := restartRustdeskServerContainer(); err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	response.Success(c, gin.H{"restarted": true})
}

func writeServerKeypair(publicKey string, privateKey string) error {
	pubPath := strings.TrimSpace(global.Config.Rustdesk.KeyFile)
	if pubPath == "" {
		pubPath = "/server-data/id_ed25519.pub"
	}
	if _, err := os.Stat(filepath.Dir(pubPath)); err != nil {
		pubPath = "/server-data/id_ed25519.pub"
	}
	privPath := filepath.Join(filepath.Dir(pubPath), "id_ed25519")
	if err := os.WriteFile(pubPath, []byte(publicKey), 0600); err != nil {
		return err
	}
	if err := os.WriteFile(privPath, []byte(privateKey), 0600); err != nil {
		return err
	}
	return nil
}

func validRustdeskPublicKey(key string) bool {
	return validBase64KeyBytes(key, 32)
}

func validRustdeskPrivateKey(key string) bool {
	return validBase64KeyBytes(key, 64)
}

func validBase64KeyBytes(key string, wantLen int) bool {
	_, ok := decodeBase64KeyBytes(key, wantLen)
	return ok
}

func decodeBase64KeyBytes(key string, wantLen int) ([]byte, bool) {
	if strings.ContainsAny(key, "\r\n\t ") {
		return nil, false
	}
	for _, enc := range []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	} {
		decoded, err := enc.DecodeString(key)
		if err == nil && len(decoded) == wantLen {
			return decoded, true
		}
	}
	return nil, false
}

func matchingRustdeskKeypair(publicKey string, privateKey string) bool {
	pub, ok := decodeBase64KeyBytes(publicKey, ed25519.PublicKeySize)
	if !ok {
		return false
	}
	priv, ok := decodeBase64KeyBytes(privateKey, ed25519.PrivateKeySize)
	if !ok {
		return false
	}
	derived, ok := ed25519.PrivateKey(priv).Public().(ed25519.PublicKey)
	if !ok {
		return false
	}
	return bytes.Equal(pub, derived)
}

func generateRustdeskKeypair() (string, string, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", err
	}
	return base64.StdEncoding.EncodeToString(publicKey), base64.StdEncoding.EncodeToString(privateKey), nil
}

func restartRustdeskServerContainer() error {
	socket := "/var/run/docker.sock"
	if _, err := os.Stat(socket); err != nil {
		return errors.New("docker socket is not mounted; enable docker-compose.admin-restart.yml or restart rustdesk-server manually")
	}
	client := &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, "unix", socket)
			},
		},
	}
	req, err := http.NewRequest(http.MethodPost, "http://docker/containers/rustdesk-server/restart?t=10", nil)
	if err != nil {
		return err
	}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNoContent || res.StatusCode == http.StatusNotModified {
		return nil
	}
	return errors.New("docker restart failed: " + res.Status)
}

func parsePositiveDuration(raw string, fallback time.Duration) (time.Duration, error) {
	if raw == "" {
		if fallback > 0 {
			return fallback, nil
		}
		return 168 * time.Hour, nil
	}
	duration, err := time.ParseDuration(raw)
	if err != nil {
		return 0, err
	}
	if duration <= 0 {
		return 0, errors.New("duration must be greater than zero")
	}
	return duration, nil
}

func currentMustLogin() bool {
	v := viper.GetViper()
	if v.IsSet("server.must-login") {
		return v.GetBool("server.must-login")
	}
	envValue := strings.EqualFold(os.Getenv("MUST_LOGIN"), "Y") || strings.EqualFold(os.Getenv("MUST_LOGIN"), "true")
	return envValue
}

func applyMustLoginLive(enabled bool) error {
	addrs := []string{
		"127.0.0.1:21115",
		"host.docker.internal:21115",
		"rustdesk-server:21115",
	}
	var conn net.Conn
	var err error
	for _, addr := range addrs {
		conn, err = net.DialTimeout("tcp", addr, 3*time.Second)
		if err == nil {
			break
		}
	}
	if conn == nil {
		return errors.New("could not reach hbbs command port on 127.0.0.1, host.docker.internal, or rustdesk-server; restart rustdesk-server to apply MUST_LOGIN")
	}
	defer conn.Close()
	value := "N"
	if enabled {
		value = "Y"
	}
	if _, err := conn.Write([]byte("must-login " + value)); err != nil {
		return err
	}
	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, _ = io.ReadAll(conn)
	return nil
}

func persistServerRuntimeEnv(mustLogin bool) error {
	pubPath := strings.TrimSpace(global.Config.Rustdesk.KeyFile)
	if pubPath == "" {
		pubPath = "/server-data/id_ed25519.pub"
	}
	dir := filepath.Dir(pubPath)
	if _, err := os.Stat(dir); err != nil {
		dir = "/server-data"
	}
	value := "N"
	if mustLogin {
		value = "Y"
	}
	path := filepath.Join(dir, "server.env")
	content := "MUST_LOGIN=" + value + "\n"
	return os.WriteFile(path, []byte(content), 0600)
}

func (co *Config) AppConfig(c *gin.Context) {
	response.Success(c, &gin.H{
		"web_client": global.Config.App.WebClient,
	})
}

// AdminConfig ADMIN服务配置
// @Tags ADMIN
// @Summary ADMIN服务配置
// @Description ADMIN服务配置
// @Accept  json
// @Produce  json
// @Success 200 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /admin/config/admin [get]
// @Security token
func (co *Config) AdminConfig(c *gin.Context) {

	u := &model.User{}
	token := c.GetHeader("api-token")
	if token != "" {
		u, _ = service.AllService.UserService.InfoByAccessToken(token)
		if !service.AllService.UserService.CheckUserEnable(u) {
			u.Id = 0
		}
	}

	if u.Id == 0 {
		response.Success(c, &gin.H{
			"title": global.Config.Admin.Title,
		})
		return
	}

	hello := global.Config.Admin.Hello
	if hello == "" {
		helloFile := global.Config.Admin.HelloFile
		if helloFile != "" {
			b, err := os.ReadFile(helloFile)
			if err == nil && len(b) > 0 {
				hello = string(b)
			}
		}
	}

	//replace {{username}} to username
	hello = strings.Replace(hello, "{{username}}", u.Username, -1)
	response.Success(c, &gin.H{
		"title": global.Config.Admin.Title,
		"hello": hello,
	})
}
