package admin

import (
	"archive/zip"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/response"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"gorm.io/gorm/clause"
)

type Backup struct {
}

type BackupManifest struct {
	Version    int      `json:"version"`
	CreatedAt  string   `json:"created_at"`
	Components []string `json:"components"`
}

type BackupFileInfo struct {
	Name string `json:"name"`
	Size uint64 `json:"size"`
}

type BackupUserRecord struct {
	model.User
	Password string `json:"password"`
}

type BackupUsersData struct {
	Users        []BackupUserRecord `json:"users"`
	Groups       []model.Group      `json:"groups"`
	DeviceGroups []model.DeviceGroup `json:"device_groups"`
	UserThirds   []model.UserThird  `json:"user_thirds"`
	Oauth        []model.Oauth      `json:"oauth"`
}

type BackupAddressBookData struct {
	AddressBooks       []model.AddressBook               `json:"address_books"`
	Collections        []model.AddressBookCollection     `json:"collections"`
	CollectionRules    []model.AddressBookCollectionRule `json:"collection_rules"`
	Tags               []model.Tag                       `json:"tags"`
}

type BackupConfigData struct {
	WebV3Settings []model.WebV3Settings `json:"web_v3_settings"`
}

type BackupDevicesData struct {
	Peers []model.Peer `json:"peers"`
}

type BackupLogsData struct {
	LoginLogs    []model.LoginLog    `json:"login_logs"`
	AuditConn    []model.AuditConn    `json:"audit_conn"`
	AuditFile    []model.AuditFile    `json:"audit_file"`
	ShareRecords []model.ShareRecord `json:"share_records"`
	WebV3Sessions []model.WebV3Session `json:"web_v3_sessions"`
	WebV3Shares   []model.WebV3Share   `json:"web_v3_shares"`
	WebV3Audit    []model.WebV3Audit   `json:"web_v3_audit"`
}

func (b *Backup) Export(c *gin.Context) {
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", `attachment; filename="rustdesk-api-backup.zip"`)
	c.Status(http.StatusOK)

	zw := zip.NewWriter(c.Writer)
	defer zw.Close()

	files := []struct {
		name string
		path string
	}{
		{name: "rustdeskapi.db", path: filepath.Clean("./data/rustdeskapi.db")},
		{name: "config.yaml", path: filepath.Clean("./conf/config.yaml")},
		{name: "server/id_ed25519", path: filepath.Clean("/server-data/id_ed25519")},
		{name: "server/id_ed25519.pub", path: filepath.Clean("/server-data/id_ed25519.pub")},
	}

	for _, file := range files {
		_ = addBackupFile(zw, file.name, file.path)
	}
}

func (b *Backup) ExportSelective(c *gin.Context) {
	components := parseBackupComponents(c.Query("components"))
	if len(components) == 0 {
		components = []string{"database", "config", "server_keys"}
	}
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", `attachment; filename="rustdesk-selective-backup.zip"`)
	c.Status(http.StatusOK)

	zw := zip.NewWriter(c.Writer)
	defer zw.Close()

	manifest := BackupManifest{Version: 1, CreatedAt: time.Now().UTC().Format(time.RFC3339), Components: components}
	_ = addJSONFile(zw, "manifest.json", manifest)
	componentSet := backupComponentSet(components)

	if componentSet["database"] {
		_ = addBackupFile(zw, "rustdeskapi.db", filepath.Clean("./data/rustdeskapi.db"))
	}
	if componentSet["config"] {
		_ = addBackupFile(zw, "config.yaml", filepath.Clean("./conf/config.yaml"))
		_ = addJSONFile(zw, "data/web_v3_settings.json", collectBackupConfig())
	}
	if componentSet["server_keys"] {
		_ = addBackupFile(zw, "server/id_ed25519", filepath.Clean("/server-data/id_ed25519"))
		_ = addBackupFile(zw, "server/id_ed25519.pub", filepath.Clean("/server-data/id_ed25519.pub"))
	}
	if componentSet["users"] {
		_ = addJSONFile(zw, "data/users.json", collectBackupUsers())
	}
	if componentSet["address_book"] {
		_ = addJSONFile(zw, "data/address_book.json", collectBackupAddressBook())
	}
	if componentSet["devices"] {
		_ = addJSONFile(zw, "data/devices.json", collectBackupDevices())
	}
	if componentSet["logs"] {
		_ = addJSONFile(zw, "data/logs.json", collectBackupLogs())
	}
}

func (b *Backup) Import(c *gin.Context) {
	file, err := c.FormFile("backup")
	if err != nil {
		response.Fail(c, 101, "backup file is required")
		return
	}

	src, err := file.Open()
	if err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	defer src.Close()

	tmpPath := filepath.Join(os.TempDir(), "rustdesk-api-import-"+time.Now().Format("20060102150405")+".zip")
	tmp, err := os.Create(tmpPath)
	if err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	if _, err = io.Copy(tmp, src); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		response.Fail(c, 101, err.Error())
		return
	}
	tmp.Close()
	defer os.Remove(tmpPath)

	zr, err := zip.OpenReader(tmpPath)
	if err != nil {
		response.Fail(c, 101, "invalid backup zip")
		return
	}
	defer zr.Close()

	restored := []string{}
	for _, zf := range zr.File {
		switch backupEntryKind(zf.Name) {
		case "database":
			if err := restoreZipFile(zf, filepath.Clean("./data/rustdeskapi.db")); err != nil {
				response.Fail(c, 101, err.Error())
				return
			}
			restored = append(restored, "database")
		case "config":
			if err := restoreZipFile(zf, filepath.Clean("./conf/config.yaml")); err != nil {
				response.Fail(c, 101, err.Error())
				return
			}
			restored = append(restored, "config")
		case "server_private_key":
			if err := restoreZipFile(zf, filepath.Clean("/server-data/id_ed25519")); err != nil {
				response.Fail(c, 101, err.Error())
				return
			}
			restored = append(restored, "server_private_key")
		case "server_public_key":
			if err := restoreZipFile(zf, filepath.Clean("/server-data/id_ed25519.pub")); err != nil {
				response.Fail(c, 101, err.Error())
				return
			}
			restored = append(restored, "server_public_key")
		}
	}

	if len(restored) == 0 {
		response.Fail(c, 101, "backup does not contain rustdeskapi.db or config.yaml")
		return
	}
	response.Success(c, gin.H{"restored": restored, "restart_required": true, "restart_services": []string{"rustdesk-api", "rustdesk-server"}})
}

func (b *Backup) Inspect(c *gin.Context) {
	file, err := c.FormFile("backup")
	if err != nil {
		response.Fail(c, 101, "backup file is required")
		return
	}
	tmpPath, err := saveUploadedBackup(file)
	if err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	defer os.Remove(tmpPath)

	zr, err := zip.OpenReader(tmpPath)
	if err != nil {
		response.Fail(c, 101, "invalid backup zip")
		return
	}
	defer zr.Close()

	manifest := readBackupManifest(zr.File)
	components := manifest.Components
	manifestFound := len(components) > 0
	if len(components) == 0 {
		components = detectBackupComponents(zr.File)
	}
	files := []BackupFileInfo{}
	for _, zf := range zr.File {
		files = append(files, BackupFileInfo{Name: filepath.ToSlash(zf.Name), Size: zf.UncompressedSize64})
	}
	componentSet := backupComponentSet(components)
	response.Success(c, gin.H{
		"manifest_found": manifestFound,
		"manifest": manifest,
		"components": components,
		"counts": inspectBackupCounts(zr.File),
		"files": files,
		"restart_required": componentSet["database"] || componentSet["config"] || componentSet["server_keys"],
		"sensitive": componentSet["users"] || componentSet["address_book"] || componentSet["server_keys"] || componentSet["config"] || componentSet["database"],
	})
}

func (b *Backup) ImportSelective(c *gin.Context) {
	file, err := c.FormFile("backup")
	if err != nil {
		response.Fail(c, 101, "backup file is required")
		return
	}
	components := parseBackupComponents(c.PostForm("components"))

	tmpPath, err := saveUploadedBackup(file)
	if err != nil {
		response.Fail(c, 101, err.Error())
		return
	}
	defer os.Remove(tmpPath)

	zr, err := zip.OpenReader(tmpPath)
	if err != nil {
		response.Fail(c, 101, "invalid backup zip")
		return
	}
	defer zr.Close()

	if len(components) == 0 {
		components = manifestComponents(zr.File)
	}
	componentSet := backupComponentSet(components)
	restored := []string{}
	restartRequired := false

	for _, zf := range zr.File {
		switch backupEntryKind(zf.Name) {
		case "database":
			if componentSet["database"] {
				if err := restoreZipFile(zf, filepath.Clean("./data/rustdeskapi.db")); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				restored = append(restored, "database")
				restartRequired = true
			}
		case "config":
			if componentSet["config"] {
				if err := restoreZipFile(zf, filepath.Clean("./conf/config.yaml")); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				restored = append(restored, "config")
				restartRequired = true
			}
		case "server_private_key":
			if componentSet["server_keys"] {
				if err := restoreZipFile(zf, filepath.Clean("/server-data/id_ed25519")); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				restored = append(restored, "server_private_key")
				restartRequired = true
			}
		case "server_public_key":
			if componentSet["server_keys"] {
				if err := restoreZipFile(zf, filepath.Clean("/server-data/id_ed25519.pub")); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				restored = append(restored, "server_public_key")
				restartRequired = true
			}
		case "data/users.json":
			if componentSet["users"] {
				data := BackupUsersData{}
				if err := readZipJSON(zf, &data); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				if err := restoreBackupUsers(data); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				restored = append(restored, "users")
			}
		case "data/address_book.json":
			if componentSet["address_book"] {
				data := BackupAddressBookData{}
				if err := readZipJSON(zf, &data); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				if err := restoreBackupAddressBook(data); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				restored = append(restored, "address_book")
			}
		case "data/web_v3_settings.json":
			if componentSet["config"] {
				data := BackupConfigData{}
				if err := readZipJSON(zf, &data); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				if err := restoreBackupConfig(data); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				restored = append(restored, "web_v3_settings")
			}
		case "data/devices.json":
			if componentSet["devices"] {
				data := BackupDevicesData{}
				if err := readZipJSON(zf, &data); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				if err := upsert(data.Peers); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				restored = append(restored, "devices")
			}
		case "data/logs.json":
			if componentSet["logs"] {
				data := BackupLogsData{}
				if err := readZipJSON(zf, &data); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				if err := restoreBackupLogs(data); err != nil {
					response.Fail(c, 101, err.Error())
					return
				}
				restored = append(restored, "logs")
			}
		}
	}

	if len(restored) == 0 {
		response.Fail(c, 101, "selected backup components were not found")
		return
	}
	response.Success(c, gin.H{"restored": restored, "restart_required": restartRequired, "restart_services": []string{"rustdesk-api", "rustdesk-server"}})
}

func addBackupFile(zw *zip.Writer, name string, path string) error {
	src, err := os.Open(path)
	if err != nil {
		return err
	}
	defer src.Close()

	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, src)
	return err
}

func addJSONFile(zw *zip.Writer, name string, value interface{}) error {
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(value)
}

func restoreZipFile(zf *zip.File, target string) error {
	src, err := zf.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return err
	}
	tmp := target + ".importing"
	dst, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	if _, err = io.Copy(dst, src); err != nil {
		dst.Close()
		os.Remove(tmp)
		return err
	}
	if err = dst.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, target)
}

func saveUploadedBackup(file *multipart.FileHeader) (string, error) {
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	tmpPath := filepath.Join(os.TempDir(), "rustdesk-api-import-"+time.Now().Format("20060102150405")+".zip")
	tmp, err := os.Create(tmpPath)
	if err != nil {
		return "", err
	}
	if _, err = io.Copy(tmp, src); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return "", err
	}
	return tmpPath, tmp.Close()
}

func parseBackupComponents(raw string) []string {
	parts := strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == ' ' || r == ';' })
	out := []string{}
	seen := map[string]bool{}
	for _, part := range parts {
		name := strings.TrimSpace(part)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, name)
	}
	return out
}

func backupComponentSet(components []string) map[string]bool {
	set := map[string]bool{}
	for _, component := range components {
		set[component] = true
	}
	return set
}

func readBackupManifest(files []*zip.File) BackupManifest {
	for _, file := range files {
		if filepath.ToSlash(file.Name) != "manifest.json" {
			continue
		}
		manifest := BackupManifest{}
		if err := readZipJSON(file, &manifest); err == nil {
			return manifest
		}
	}
	return BackupManifest{}
}

func manifestComponents(files []*zip.File) []string {
	if manifest := readBackupManifest(files); len(manifest.Components) > 0 {
		return manifest.Components
	}
	return detectBackupComponents(files)
}

func detectBackupComponents(files []*zip.File) []string {
	seen := map[string]bool{}
	for _, file := range files {
		switch backupEntryKind(file.Name) {
		case "database":
			seen["database"] = true
		case "config":
			seen["config"] = true
		case "server_private_key", "server_public_key":
			seen["server_keys"] = true
		case "users":
			seen["users"] = true
		case "address_book":
			seen["address_book"] = true
		case "devices":
			seen["devices"] = true
		case "logs":
			seen["logs"] = true
		}
	}
	order := []string{"database", "config", "server_keys", "users", "address_book", "devices", "logs"}
	components := []string{}
	for _, item := range order {
		if seen[item] {
			components = append(components, item)
		}
	}
	return components
}

func backupEntryKind(name string) string {
	clean := strings.TrimPrefix(filepath.ToSlash(filepath.Clean(name)), "./")
	base := filepath.Base(clean)
	dir := filepath.Base(filepath.Dir(clean))
	switch {
	case base == "rustdeskapi.db":
		return "database"
	case base == "config.yaml":
		return "config"
	case base == "id_ed25519" && (dir == "server" || dir == "server-data" || dir == "." || dir == ""):
		return "server_private_key"
	case base == "id_ed25519.pub" && (dir == "server" || dir == "server-data" || dir == "." || dir == ""):
		return "server_public_key"
	case clean == "data/users.json":
		return "users"
	case clean == "data/address_book.json":
		return "address_book"
	case clean == "data/web_v3_settings.json":
		return "config"
	case clean == "data/devices.json":
		return "devices"
	case clean == "data/logs.json":
		return "logs"
	default:
		return ""
	}
}

func inspectBackupCounts(files []*zip.File) map[string]int {
	counts := map[string]int{}
	for _, file := range files {
		switch filepath.ToSlash(file.Name) {
		case "data/users.json":
			data := BackupUsersData{}
			if readZipJSON(file, &data) == nil {
				counts["users"] = len(data.Users)
				counts["groups"] = len(data.Groups)
				counts["device_groups"] = len(data.DeviceGroups)
				counts["oauth"] = len(data.Oauth)
				counts["oauth_links"] = len(data.UserThirds)
			}
		case "data/address_book.json":
			data := BackupAddressBookData{}
			if readZipJSON(file, &data) == nil {
				counts["address_book"] = len(data.AddressBooks)
				counts["collections"] = len(data.Collections)
				counts["collection_rules"] = len(data.CollectionRules)
				counts["tags"] = len(data.Tags)
			}
		case "data/web_v3_settings.json":
			data := BackupConfigData{}
			if readZipJSON(file, &data) == nil {
				counts["web_v3_settings"] = len(data.WebV3Settings)
			}
		case "data/devices.json":
			data := BackupDevicesData{}
			if readZipJSON(file, &data) == nil {
				counts["devices"] = len(data.Peers)
			}
		case "data/logs.json":
			data := BackupLogsData{}
			if readZipJSON(file, &data) == nil {
				counts["login_logs"] = len(data.LoginLogs)
				counts["connection_audit"] = len(data.AuditConn)
				counts["file_audit"] = len(data.AuditFile)
				counts["share_records"] = len(data.ShareRecords)
				counts["web_v3_sessions"] = len(data.WebV3Sessions)
				counts["web_v3_shares"] = len(data.WebV3Shares)
				counts["web_v3_audit"] = len(data.WebV3Audit)
			}
		}
	}
	return counts
}

func readZipJSON(zf *zip.File, value interface{}) error {
	src, err := zf.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	return json.NewDecoder(src).Decode(value)
}

func collectBackupUsers() BackupUsersData {
	data := BackupUsersData{}
	users := []model.User{}
	global.DB.Find(&users)
	for _, user := range users {
		data.Users = append(data.Users, BackupUserRecord{User: user, Password: user.Password})
	}
	global.DB.Find(&data.Groups)
	global.DB.Find(&data.DeviceGroups)
	global.DB.Find(&data.UserThirds)
	global.DB.Find(&data.Oauth)
	return data
}

func collectBackupAddressBook() BackupAddressBookData {
	data := BackupAddressBookData{}
	global.DB.Find(&data.AddressBooks)
	global.DB.Find(&data.Collections)
	global.DB.Find(&data.CollectionRules)
	global.DB.Find(&data.Tags)
	return data
}

func collectBackupConfig() BackupConfigData {
	data := BackupConfigData{}
	global.DB.Find(&data.WebV3Settings)
	return data
}

func collectBackupDevices() BackupDevicesData {
	data := BackupDevicesData{}
	global.DB.Find(&data.Peers)
	return data
}

func collectBackupLogs() BackupLogsData {
	data := BackupLogsData{}
	global.DB.Find(&data.LoginLogs)
	global.DB.Find(&data.AuditConn)
	global.DB.Find(&data.AuditFile)
	global.DB.Find(&data.ShareRecords)
	global.DB.Find(&data.WebV3Sessions)
	global.DB.Find(&data.WebV3Shares)
	global.DB.Find(&data.WebV3Audit)
	return data
}

func restoreBackupUsers(data BackupUsersData) error {
	if err := upsert(data.Groups); err != nil {
		return err
	}
	if err := upsert(data.DeviceGroups); err != nil {
		return err
	}
	users := make([]model.User, 0, len(data.Users))
	for _, item := range data.Users {
		user := item.User
		user.Password = item.Password
		users = append(users, user)
	}
	if err := upsert(users); err != nil {
		return err
	}
	if err := upsert(data.UserThirds); err != nil {
		return err
	}
	return upsert(data.Oauth)
}

func restoreBackupAddressBook(data BackupAddressBookData) error {
	if err := upsert(data.Collections); err != nil {
		return err
	}
	if err := upsert(data.CollectionRules); err != nil {
		return err
	}
	if err := upsert(data.Tags); err != nil {
		return err
	}
	return upsert(data.AddressBooks)
}

func restoreBackupConfig(data BackupConfigData) error {
	return upsert(data.WebV3Settings)
}

func restoreBackupLogs(data BackupLogsData) error {
	if err := upsert(data.LoginLogs); err != nil {
		return err
	}
	if err := upsert(data.AuditConn); err != nil {
		return err
	}
	if err := upsert(data.AuditFile); err != nil {
		return err
	}
	if err := upsert(data.ShareRecords); err != nil {
		return err
	}
	if err := upsert(data.WebV3Sessions); err != nil {
		return err
	}
	if err := upsert(data.WebV3Shares); err != nil {
		return err
	}
	return upsert(data.WebV3Audit)
}

func upsert[T any](items []T) error {
	if len(items) == 0 {
		return nil
	}
	return global.DB.Clauses(clause.OnConflict{UpdateAll: true}).Create(&items).Error
}
