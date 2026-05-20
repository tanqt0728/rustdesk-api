package config

import (
	"os"
	"strings"
)

const (
	DefaultIdServerPort    = 21116
	DefaultRelayServerPort = 21117
)

type Rustdesk struct {
	IdServer        string `mapstructure:"id-server"`
	IdServerPort    int    `mapstructure:"-"`
	RelayServer     string `mapstructure:"relay-server"`
	RelayServerPort int    `mapstructure:"-"`
	ApiServer       string `mapstructure:"api-server"`
	Key             string `mapstructure:"key"`
	KeyFile         string `mapstructure:"key-file"`
	Personal        int    `mapstructure:"personal"`
	//webclient-magic-queryonline
	WebclientMagicQueryonline int    `mapstructure:"webclient-magic-queryonline"`
	WsHost                    string `mapstructure:"ws-host"`
}

func (rd *Rustdesk) LoadKeyFile() {
	// Load key file
	rd.Key = strings.TrimSpace(rd.Key)
	if rd.Key != "" {
		return
	}
	if key := rd.ReadKeyFile(); key != "" {
		rd.Key = key
	}
}

func (rd *Rustdesk) ReadKeyFile() string {
	for _, path := range []string{rd.KeyFile, "/server-data/id_ed25519.pub", "/data/id_ed25519.pub"} {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		b, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		if key := strings.TrimSpace(string(b)); key != "" {
			return key
		}
	}
	return ""
}
