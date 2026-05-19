package admin

import (
	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/service"
	"os"
	"strings"

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
	cf := &response.ServerConfigResponse{
		IdServer:    global.Config.Rustdesk.IdServer,
		Key:         global.Config.Rustdesk.Key,
		RelayServer: global.Config.Rustdesk.RelayServer,
		ApiServer:   global.Config.Rustdesk.ApiServer,
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
	if req.IdServer == "" || req.RelayServer == "" {
		response.Fail(c, 101, "id_server and relay_server are required")
		return
	}

	global.Config.Rustdesk.IdServer = req.IdServer
	global.Config.Rustdesk.RelayServer = req.RelayServer
	global.Config.Rustdesk.ApiServer = req.ApiServer
	global.Config.Rustdesk.Key = req.Key

	v := viper.GetViper()
	v.Set("rustdesk.id-server", req.IdServer)
	v.Set("rustdesk.relay-server", req.RelayServer)
	v.Set("rustdesk.api-server", req.ApiServer)
	v.Set("rustdesk.key", req.Key)
	persisted := true
	persistError := ""
	if err := v.WriteConfig(); err != nil {
		persisted = false
		persistError = err.Error()
	}

	response.Success(c, gin.H{
		"config": &response.ServerConfigResponse{
			IdServer:    global.Config.Rustdesk.IdServer,
			Key:         global.Config.Rustdesk.Key,
			RelayServer: global.Config.Rustdesk.RelayServer,
			ApiServer:   global.Config.Rustdesk.ApiServer,
		},
		"persisted":     persisted,
		"persist_error": persistError,
	})
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
