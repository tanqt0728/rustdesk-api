package http

import (
	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/middleware"
	"github.com/lejianwen/rustdesk-api/v2/http/router"
	"github.com/sirupsen/logrus"
	"net/http"
	"strings"
)

func ApiInit() {
	gin.SetMode(global.Config.Gin.Mode)
	if global.Config.Gin.AdminAddr != "" {
		public := newEngine()
		router.WebInit(public, false)
		router.ApiInit(public)

		admin := newEngine()
		router.WebInit(admin, true)
		router.ApiInit(admin)
		router.Init(admin)
		go func() {
			global.Logger.Infof("ADMIN SERVER START (%s)", global.Config.Gin.AdminAddr)
			Run(admin, global.Config.Gin.AdminAddr)
		}()

		global.Logger.Infof("PUBLIC API SERVER START (%s), admin is split", global.Config.Gin.ApiAddr)
		Run(public, global.Config.Gin.ApiAddr)
		return
	}

	g := newEngine()
	router.WebInit(g, true)
	router.Init(g)
	router.ApiInit(g)
	Run(g, global.Config.Gin.ApiAddr)
}

func newEngine() *gin.Engine {
	g := gin.New()

	// Empty trust-proxy means "trust no proxy": ClientIP() is the socket peer, so
	// X-Forwarded-For cannot be spoofed to dodge the login ban. gin's default
	// (nil config) trusts every proxy. Set trust-proxy to the reverse proxy's
	// address when one sits in front of the API.
	var trusted []string
	if global.Config.Gin.TrustProxy != "" {
		trusted = strings.Split(global.Config.Gin.TrustProxy, ",")
	}
	if err := g.SetTrustedProxies(trusted); err != nil {
		panic(err)
	}

	if global.Config.Gin.Mode == gin.ReleaseMode {
		//修改gin Recovery日志 输出为logger的输出点
		if global.Logger != nil {
			gin.DefaultErrorWriter = global.Logger.WriterLevel(logrus.ErrorLevel)
		}
	}
	g.NoRoute(func(c *gin.Context) {
		c.String(http.StatusNotFound, "404 not found")
	})
	g.Use(middleware.Logger(), middleware.Limiter(), gin.Recovery())
	return g
}
