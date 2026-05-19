package router

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/controller/web"
)

func WebInit(g *gin.Engine, serveAdmin bool) {
	i := &web.Index{}
	g.GET("/", i.Index)

	if global.Config.App.WebClient == 1 {
		g.GET("/webclient-config/index.js", i.ConfigJs)
	}

	if global.Config.App.WebClient == 1 {
		g.StaticFS("/webclient", http.Dir(global.Config.Gin.ResourcesPath+"/web"))
		g.StaticFS("/webclient2", http.Dir(global.Config.Gin.ResourcesPath+"/web2"))
	}
	g.Use(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/web3") {
			c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
			c.Header("Pragma", "no-cache")
			c.Header("Expires", "0")
		}
		c.Next()
	})
	g.StaticFS("/web3", http.Dir(global.Config.Gin.ResourcesPath+"/web3"))
	if serveAdmin {
		g.StaticFS("/_admin", http.Dir(global.Config.Gin.ResourcesPath+"/admin"))
	}
}
