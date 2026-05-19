package web

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"strings"
)

type Index struct {
}

func (i *Index) Index(c *gin.Context) {
	c.Redirect(302, "/_admin/")
}

func (i *Index) ConfigJs(c *gin.Context) {
	apiServer := publicApiServer(c)
	magicQueryonline := global.Config.Rustdesk.WebclientMagicQueryonline
	wsHost := global.Config.Rustdesk.WsHost
	idServer := strings.TrimSpace(global.Config.Rustdesk.IdServer)
	key := strings.TrimSpace(global.Config.Rustdesk.Key)
	apiServerJs, _ := json.Marshal(apiServer)
	wsHostJs, _ := json.Marshal(wsHost)
	idServerJs, _ := json.Marshal(idServer)
	keyJs, _ := json.Marshal(key)
	tmp := fmt.Sprintf(`localStorage.setItem('api-server', %s);
localStorage.setItem('custom-rendezvous-server', %s);
localStorage.setItem('key', %s);
const ws2_prefix = 'wc-';
localStorage.setItem(ws2_prefix+'api-server', %s);

window.webclient_magic_queryonline = %d;
window.ws_host = %s;
`, apiServerJs, idServerJs, keyJs, apiServerJs, magicQueryonline, wsHostJs)
	//	tmp := `
	//localStorage.setItem('api-server', "` + apiServer + `")
	//const ws2_prefix = 'wc-'
	//localStorage.setItem(ws2_prefix+'api-server', "` + apiServer + `")
	//
	//window.webclient_magic_queryonline = ` + magicQueryonline + ``

	c.Header("Content-Type", "application/javascript")
	c.String(200, tmp)
}

func publicApiServer(c *gin.Context) string {
	proto := c.GetHeader("X-Forwarded-Proto")
	if proto == "" {
		proto = "http"
		if c.Request.TLS != nil {
			proto = "https"
		}
	}
	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}
	if host == "" {
		return strings.TrimRight(global.Config.Rustdesk.ApiServer, "/")
	}
	return proto + "://" + host
}
