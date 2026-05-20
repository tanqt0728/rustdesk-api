const state = {
  token: localStorage.getItem("rd_admin_token") || "",
  user: localStorage.getItem("rd_admin_user") || "",
  devices: [],
  myDevices: [],
  addressBook: [],
  allAddressBook: [],
  users: [],
  audit: [],
  config: {},
  app: {},
  webV3Config: {},
  webV3Settings: {},
  webV3Sessions: [],
  webV3Shares: [],
  isAdmin: localStorage.getItem("rd_admin_is_admin") === "1",
  currentUserId: 0,
  addressBookMode: "mine",
  loginOptions: { ops: [], disable_pwd: false },
  captcha: null,
  activeWebV3SharePeer: null,
};

const $ = (id) => document.getElementById(id);
let activeResource = "";
let activeRows = [];
let editingRow = null;

const viewTitles = {
  dashboard: "Dashboard",
  devices: "Devices",
  mydevices: "My devices",
  addressbook: "Address book",
  web: "Web Access",
  customclients: "Custom Clients",
  logs: "Logs",
  settings: "Settings",
  deployment: "Deployment",
  backup: "Backup",
};

const resourceConfigs = {
  myInfo: {
    title: "Userinfo",
    hint: "Current account profile and password tools.",
    list: async () => ({ list: [await api("/api/admin/user/current")], total: 1 }),
    columns: ["id", "username", "email", "nickname", "status"],
    create: null,
    update: "/api/admin/user/changeCurPwd",
    delete: null,
    template: () => ({ old_password: "", new_password: "" }),
    saveLabel: "Change password",
  },
  myCollections: crud("AddressBookName", "/api/admin/my/address_book_collection", ["id", "name", "created_at"], () => ({ name: "" })),
  myTags: crud("Tags", "/api/admin/my/tag", ["id", "name", "color", "created_at"], () => ({ name: "", color: 1, collection_id: 0 })),
  myShareRecords: listDelete("ShareRecord", "/api/admin/my/share_record", ["id", "peer_id", "password_type", "share_token", "created_at"]),
  myLoginLogs: listDelete("LoginLog", "/api/admin/my/login_log", ["id", "client", "device_id", "ip", "platform", "created_at"]),
  users: {
    ...crud("UserManage", "/api/admin/user", ["id", "username", "email", "nickname", "is_admin", "status", "group_id"], () => ({
      username: "",
      email: "",
      nickname: "",
      group_id: 1,
      is_admin: false,
      status: 1,
      remark: "",
    })),
    password: "/api/admin/user/changePwd",
  },
  peers: crud("PeerManage", "/api/admin/peer", ["row_id", "id", "hostname", "username", "cpu", "memory", "os", "version", "last_online_ip"], () => ({
    id: "",
    hostname: "",
    username: "",
    cpu: "",
    memory: "",
    os: "",
    version: "",
    group_id: 0,
    alias: "",
  })),
  groups: crud("GroupManage", "/api/admin/group", ["id", "name", "type", "created_at"], () => ({ name: "", type: 1 })),
  deviceGroups: crud("DeviceGroupManage", "/api/admin/device_group", ["id", "name", "created_at"], () => ({ name: "" })),
  collections: crud("AddressBookNameManage", "/api/admin/address_book_collection", ["id", "user_id", "name", "created_at"], () => ({ user_id: 1, name: "" })),
  addressBooks: crud("AddressBookManage", "/api/admin/address_book", ["row_id", "id", "user_id", "alias", "hostname", "username", "platform"], () => ({
    id: "",
    user_id: 1,
    username: "",
    password: "",
    hostname: "",
    alias: "",
    platform: "",
    tags: [],
    collection_id: 0,
  })),
  tags: crud("TagsManage", "/api/admin/tag", ["id", "user_id", "name", "color", "collection_id"], () => ({ user_id: 1, name: "", color: 1, collection_id: 0 })),
  oauth: crud("OAuth / WebAuth", "/api/admin/oauth", ["id", "oauth_type", "op", "issuer", "auto_register", "pkce_enable"], () => ({
    op: "google",
    oauth_type: "google",
    issuer: "",
    scopes: "",
    client_id: "",
    client_secret: "",
    auto_register: false,
    pkce_enable: true,
    pkce_method: "S256",
  })),
  userTokens: listDelete("UserToken", "/api/admin/user_token", ["id", "user_id", "device_id", "uuid", "created_at"]),
  loginLogs: listDelete("LoginLog", "/api/admin/login_log", ["id", "user_id", "client", "device_id", "ip", "platform", "created_at"]),
  auditConn: listDelete("AuditConnLog", "/api/admin/audit_conn", ["id", "peer_id", "from_peer", "from_name", "action", "ip", "created_at"]),
  auditFile: listDelete("AuditFileLog", "/api/admin/audit_file", ["id", "peer_id", "from_peer", "from_name", "path", "ip", "created_at"]),
  shareRecords: listDelete("ShareRecord", "/api/admin/share_record", ["id", "user_id", "peer_id", "password_type", "share_token", "created_at"]),
  webV3Shares: {
    ...listDelete("Web v3 Shares", "/api/admin/web-v3/share", ["id", "peer_id", "peer_name", "token_hint", "once", "used_at", "expires_at", "revoked_at", "created_at"]),
    delete: "/api/admin/web-v3/share/revoke",
  },
  webV3Sessions: {
    ...listDelete("Web v3 Sessions", "/api/admin/web-v3/session", ["id", "session_id", "peer_id", "peer_name", "source", "status", "expires_at", "revoked_at", "created_at"]),
    delete: "/api/admin/web-v3/session/revoke",
  },
  webV3Audit: {
    title: "Web v3 Audit",
    hint: "Session, share and token events emitted by the Web v3 backend.",
    listUrl: "/api/admin/web-v3/audit/list",
    delete: null,
    columns: ["id", "event_type", "session_id", "peer_id", "ip", "created_at"],
    template: null,
  },
  serverCmd: {
    title: "ServerCmd",
    hint: "Send built-in hbbs/hbbr commands or save custom command templates. Be careful: these commands affect the running server.",
    listUrl: "/api/admin/rustdesk/cmdList",
    create: "/api/admin/rustdesk/cmdCreate",
    delete: "/api/admin/rustdesk/cmdDelete",
    send: "/api/admin/rustdesk/sendCmd",
    columns: ["id", "cmd", "alias", "target", "option", "explain"],
    template: () => ({ cmd: "", alias: "", target: "21115", option: "", explain: "" }),
  },
};

const fieldSchemas = {
  myInfo: [
    field("old_password", "Current password", "password"),
    field("new_password", "New password", "password"),
  ],
  users: [
    field("id", "ID", "number", { readonlyOnCreate: true }),
    field("username", "Username"),
    field("email", "Email", "email"),
    field("nickname", "Nickname"),
    field("group_id", "Group ID", "number"),
    field("is_admin", "Admin", "checkbox"),
    field("status", "Status", "number"),
    field("remark", "Remark", "textarea", { full: true }),
  ],
  peers: [
    field("row_id", "Row ID", "number", { readonlyOnCreate: true }),
    field("id", "RustDesk ID"),
    field("hostname", "Hostname"),
    field("username", "Username"),
    field("cpu", "CPU"),
    field("memory", "Memory"),
    field("os", "OS"),
    field("version", "Version"),
    field("group_id", "Group ID", "number"),
    field("alias", "Alias"),
  ],
  groups: [field("id", "ID", "number", { readonlyOnCreate: true }), field("name", "Name"), field("type", "Type", "number")],
  deviceGroups: [field("id", "ID", "number", { readonlyOnCreate: true }), field("name", "Name")],
  myCollections: [field("id", "ID", "number", { readonlyOnCreate: true }), field("name", "Name")],
  collections: [field("id", "ID", "number", { readonlyOnCreate: true }), field("user_id", "User ID", "number"), field("name", "Name")],
  myTags: [field("id", "ID", "number", { readonlyOnCreate: true }), field("name", "Name"), field("color", "Color", "number"), field("collection_id", "Collection ID", "number")],
  tags: [field("id", "ID", "number", { readonlyOnCreate: true }), field("user_id", "User ID", "number"), field("name", "Name"), field("color", "Color", "number"), field("collection_id", "Collection ID", "number")],
  addressBooks: [
    field("row_id", "Row ID", "number", { readonlyOnCreate: true }),
    field("id", "RustDesk ID"),
    field("user_id", "User ID", "number"),
    field("alias", "Alias"),
    field("hostname", "Hostname"),
    field("username", "Remote username"),
    field("password", "Remote password", "password"),
    field("platform", "Platform"),
    field("collection_id", "Collection ID", "number"),
    field("tags", "Tags, comma separated"),
  ],
  oauth: [
    field("id", "ID", "number", { readonlyOnCreate: true }),
    field("oauth_type", "Type: google, github, oidc, webauth, linuxdo"),
    field("op", "Provider key"),
    field("issuer", "Issuer URL"),
    field("scopes", "Scopes, comma separated"),
    field("client_id", "Client ID"),
    field("client_secret", "Client Secret", "password"),
    field("auto_register", "Auto register", "checkbox"),
    field("pkce_enable", "PKCE", "checkbox"),
    field("pkce_method", "PKCE method"),
  ],
  serverCmd: [field("id", "ID", "number", { readonlyOnCreate: true }), field("cmd", "Command"), field("alias", "Alias"), field("target", "Target port"), field("option", "Default option"), field("explain", "Description", "textarea", { full: true })],
};

Object.entries(fieldSchemas).forEach(([key, fields]) => {
  if (resourceConfigs[key]) resourceConfigs[key].fields = fields;
});

function field(name, label, type = "text", options = {}) {
  return { name, label, type, ...options };
}

function crud(title, base, columns, template) {
  return { title, hint: "Create, edit and delete records using the original API endpoints.", listUrl: `${base}/list`, create: `${base}/create`, update: `${base}/update`, delete: `${base}/delete`, columns, template };
}

function listDelete(title, base, columns) {
  return { title, hint: "List and delete records from the original API endpoints.", listUrl: `${base}/list`, delete: `${base}/delete`, columns, template: null };
}

function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) headers["api-token"] = state.token;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  return fetch(path, { ...options, headers }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("application/json")) return res;
    const body = await res.json();
    if (body.code && body.code !== 0) throw new Error(body.message || "Request failed");
    return body.data;
  });
}

function formatTime(value) {
  if (!value) return "-";
  if (typeof value === "number") {
    const date = value > 1000000000000 ? new Date(value) : new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  }
  return String(value);
}

function timestampSeconds(value) {
  if (!value) return 0;
  if (typeof value === "number") return value > 1000000000000 ? Math.floor(value / 1000) : value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

function normalizeList(data, keys) {
  if (!data) return { list: [], total: 0 };
  for (const key of keys) {
    if (Array.isArray(data[key])) return { list: data[key], total: data.total || data[key].length };
  }
  if (Array.isArray(data.list)) return { list: data.list, total: data.total || data.list.length };
  return { list: [], total: 0 };
}

async function login(event) {
  event.preventDefault();
  $("loginError").textContent = "";
  try {
    const payload = {
      username: $("username").value.trim(),
      password: $("password").value,
      platform: navigator.platform || "web",
    };
    if (state.captcha?.id) {
      payload.captcha_id = state.captcha.id;
      payload.captcha = $("captchaInput").value.trim();
    }
    const data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.token = data.token;
    state.user = data.username || $("username").value.trim();
    state.isAdmin = Array.isArray(data.route_names) && data.route_names.includes("*");
    localStorage.setItem("rd_admin_token", state.token);
    localStorage.setItem("rd_admin_user", state.user);
    localStorage.setItem("rd_admin_is_admin", state.isAdmin ? "1" : "0");
    await boot();
  } catch (error) {
    $("loginError").textContent = error.message;
    await refreshCaptchaIfNeeded(true);
  }
}

async function loadLoginOptions() {
  try {
    const data = await api("/api/admin/login-options");
    state.loginOptions = data || { ops: [], disable_pwd: false };
    renderLoginOptions();
    await refreshCaptchaIfNeeded(Boolean(state.loginOptions.need_captcha));
    if (state.loginOptions.auto_oidc && state.loginOptions.ops?.[0] && !state.token) {
      startOauthLogin(state.loginOptions.ops[0]);
    }
  } catch {
    state.loginOptions = { ops: [], disable_pwd: false };
    renderLoginOptions();
    renderCaptcha();
  }
}

function renderLoginOptions() {
  const ops = state.loginOptions.ops || [];
  $("oauthPanel").classList.toggle("hidden", ops.length === 0);
  $("oauthButtons").innerHTML = ops.map((op) => (
    `<button class="button secondary" type="button" data-oauth-op="${escapeHtml(op)}">Continue with ${escapeHtml(providerLabel(op))}</button>`
  )).join("");
  $("username").disabled = Boolean(state.loginOptions.disable_pwd);
  $("password").disabled = Boolean(state.loginOptions.disable_pwd);
  document.querySelector("#loginForm .button.primary").style.display = state.loginOptions.disable_pwd ? "none" : "";
}

async function refreshCaptchaIfNeeded(force = false) {
  if (!force && !state.loginOptions.need_captcha) {
    state.captcha = null;
    renderCaptcha();
    return;
  }
  try {
    const data = await api("/api/admin/captcha");
    state.captcha = data?.captcha || null;
  } catch {
    state.captcha = null;
  }
  renderCaptcha();
}

function renderCaptcha() {
  const panel = $("captchaPanel");
  if (!panel) return;
  panel.classList.toggle("hidden", !state.captcha?.id);
  $("captchaInput").value = "";
  if (state.captcha?.b64) {
    $("captchaImage").src = state.captcha.b64;
  } else {
    $("captchaImage").removeAttribute("src");
  }
}

function providerLabel(op) {
  const labels = { google: "Google", github: "GitHub", oidc: "OIDC", webauth: "WebAuth", linuxdo: "Linux.do" };
  return labels[String(op).toLowerCase()] || op;
}

function browserUuid() {
  const existing = localStorage.getItem("rd_admin_browser_uuid");
  if (existing) return existing;
  const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem("rd_admin_browser_uuid", value);
  return value;
}

async function startOauthLogin(op) {
  $("loginError").textContent = "";
  try {
    const data = await api("/api/admin/oidc/auth", {
      method: "POST",
      body: JSON.stringify({
        op,
        id: "webadmin",
        uuid: browserUuid(),
        deviceInfo: {
          name: navigator.userAgent || "Browser",
          os: navigator.platform || "web",
          type: "webadmin",
        },
      }),
    });
    window.open(data.url, "_blank", "noopener,noreferrer");
    await pollOauthLogin(data.code);
  } catch (error) {
    $("loginError").textContent = error.message;
  }
}

async function pollOauthLogin(code) {
  const started = Date.now();
  const uuid = encodeURIComponent(browserUuid());
  while (Date.now() - started < 5 * 60 * 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const res = await fetch(`/api/admin/oidc/auth-query?code=${encodeURIComponent(code)}&id=webadmin&uuid=${uuid}`);
    const body = await res.json().catch(() => null);
    if (!body || body.code !== 0) continue;
    const data = body.data || {};
    state.token = data.token;
    state.user = data.username || data.user?.username || state.user;
    state.isAdmin = Array.isArray(data.route_names) && data.route_names.includes("*");
    localStorage.setItem("rd_admin_token", state.token);
    localStorage.setItem("rd_admin_user", state.user);
    localStorage.setItem("rd_admin_is_admin", state.isAdmin ? "1" : "0");
    await boot();
    return;
  }
  $("loginError").textContent = "OAuth login timed out.";
}

function logout() {
  state.token = "";
  state.user = "";
  state.isAdmin = false;
  state.currentUserId = 0;
  localStorage.removeItem("rd_admin_token");
  localStorage.removeItem("rd_admin_user");
  localStorage.removeItem("rd_admin_is_admin");
  renderAuth();
}

function renderAuth() {
  $("sessionUser").textContent = state.user ? state.user : "Not signed in";
  $("loginPanel").classList.toggle("hidden", Boolean(state.token));
  $("contentPanel").classList.toggle("hidden", !state.token);
  document.querySelectorAll(".admin-only").forEach((item) => {
    item.style.display = state.isAdmin ? "" : "none";
  });
}

async function loadData() {
  const [current, config, app, myPeers, myAddressBook, webV3Config, webV3Settings] = await Promise.all([
    api("/api/admin/user/current"),
    api("/api/admin/config/server"),
    api("/api/admin/config/app"),
    api("/api/admin/my/peer/list?page=1&page_size=100"),
    api("/api/admin/my/address_book/list?page=1&page_size=200"),
    api("/api/web-v3/config").catch(() => null),
    api("/api/admin/web-v3/settings").catch(() => null),
  ]);
  state.user = current?.username || state.user;
  state.isAdmin = state.isAdmin || Boolean(current?.is_admin);
  state.currentUserId = current?.id || 0;
  state.config = config || {};
  state.app = app || {};
  state.webV3Config = webV3Config || {};
  state.webV3Settings = webV3Settings || {};
  state.myDevices = normalizeList(myPeers, ["peers", "list"]).list;
  state.addressBook = normalizeList(myAddressBook, ["address_books", "addressBooks", "list"]).list;
  if (state.isAdmin) {
    const [peers, users, audit, allAddressBook, webV3Sessions, webV3Shares] = await Promise.all([
      api("/api/admin/peer/list?page=1&page_size=200"),
      api("/api/admin/user/list?page=1&page_size=100"),
      api("/api/admin/audit_conn/list?page=1&page_size=50"),
      api("/api/admin/address_book/list?page=1&page_size=300"),
      api("/api/admin/web-v3/session/list?page=1&page_size=200").catch(() => null),
      api("/api/admin/web-v3/share/list?page=1&page_size=200").catch(() => null),
    ]);
    state.devices = normalizeList(peers, ["peers", "list"]).list;
    state.users = normalizeList(users, ["users", "list"]).list;
    state.audit = normalizeList(audit, ["audit_conns", "list"]).list;
    state.allAddressBook = normalizeList(allAddressBook, ["address_books", "addressBooks", "list"]).list;
    state.webV3Sessions = normalizeList(webV3Sessions, ["list"]).list;
    state.webV3Shares = normalizeList(webV3Shares, ["list"]).list;
  } else {
    state.devices = state.myDevices;
    state.users = [];
    state.audit = [];
    state.allAddressBook = [];
    state.webV3Sessions = [];
    state.webV3Shares = [];
  }
  localStorage.setItem("rd_admin_user", state.user || "");
  localStorage.setItem("rd_admin_is_admin", state.isAdmin ? "1" : "0");
  renderAuth();
  render();
}

function render() {
  $("metricDevices").textContent = state.devices.length;
  $("metricUsers").textContent = state.users.length;
  $("metricAddressBook").textContent = state.addressBook.length;
  $("metricWebClient").textContent = state.app.web_client === 1 ? "On" : "Off";
  $("cfgIdServer").textContent = state.config.id_server || "-";
  $("cfgRelayServer").textContent = state.config.relay_server || "-";
  $("cfgApiServer").textContent = state.config.api_server || "-";
  $("cfgKey").textContent = state.config.key || "-";
  $("settingsIdServer").value = state.config.id_server || "";
  $("settingsRelayServer").value = state.config.relay_server || "";
  $("settingsApiServer").value = state.config.api_server || "";
  $("settingsKey").value = state.config.key || "";
  $("settingsPrivateKey").value = "";
  $("webV3SettingEnabled").checked = state.webV3Settings.enabled ?? state.webV3Config.enabled ?? true;
  $("webV3DefaultShareExpiry").value = state.webV3Settings.default_share_expiration_secs || 3600;
  $("webV3MaxSessionDuration").value = state.webV3Settings.max_session_duration_secs || state.webV3Config.default_session_seconds || 3600;
  $("webV3SettingClipboard").checked = state.webV3Settings.allow_clipboard ?? true;
  $("webV3SettingFileTransfer").checked = state.webV3Settings.allow_file_transfer ?? false;
  $("webV3SettingTerminal").checked = state.webV3Settings.allow_terminal ?? false;
  $("webV3SettingRequireLogin").checked = state.webV3Settings.require_login_for_direct_mode ?? true;
  $("webV3SettingAnonymousShare").checked = state.webV3Settings.allow_anonymous_share_access ?? true;
  const defaultPermissions = new Set(state.webV3Settings.default_permissions || state.webV3Config.default_permissions || ["view", "control_mouse", "control_keyboard"]);
  document.querySelectorAll("[data-webv3-setting-permission]").forEach((item) => {
    item.checked = defaultPermissions.has(item.dataset.webv3SettingPermission);
  });
  renderOverview();
  renderWebAccess();
  renderRecent();
  renderDevices();
  renderMyDevices();
  renderAddressBook();
  renderUsers();
  renderAudit();
  renderCustomClientBuilder();
  renderDeployment();
}

function renderOverview() {
  const endpoints = currentEndpoints();
  const ready = [
    { label: "API server", value: endpoints.apiServer, ok: Boolean(endpoints.apiServer) },
    { label: "ID server", value: endpoints.idServer, ok: Boolean(endpoints.idServer) },
    { label: "Relay server", value: endpoints.relayServer, ok: Boolean(endpoints.relayServer) },
    { label: "Public key", value: endpoints.publicKey ? "Configured" : "Missing", ok: Boolean(endpoints.publicKey) },
    { label: "Web v3", value: state.webV3Config.enabled === false ? "Disabled" : "Enabled", ok: state.webV3Config.enabled !== false },
  ];
  const okCount = ready.filter((item) => item.ok).length;
  $("dashboardSummary").textContent = `${okCount}/${ready.length} checks ready. Signed in as ${state.user || "unknown"}${state.isAdmin ? " with admin access" : ""}.`;
  $("quickWebState").textContent = state.webV3Config.enabled === false ? "Off" : "Ready";
  $("quickDeviceState").textContent = `${state.devices.length || state.myDevices.length} ready`;
  $("quickLoginState").textContent = (state.loginOptions.ops || []).length ? "OAuth" : "Password";
  $("readinessList").innerHTML = ready.map((item) => statusItem(item.label, item.value || "-", item.ok)).join("");
}

function renderWebAccess() {
  const endpoints = currentEndpoints();
  const activeSessions = activeWebSessions();
  const openShares = openWebShares();
  const defaultExpiry = state.webV3Settings.default_share_expiration_secs
    || state.webV3Config.default_session_seconds
    || 3600;
  const permissions = state.webV3Settings.default_permissions || state.webV3Config.default_permissions || [];
  $("webAccessSummary").textContent = state.webV3Config.enabled === false
    ? "Web v3 is disabled in the current API config."
    : `Web v3 is available through ${endpoints.idServer || "the configured ID server"} and ${endpoints.relayServer || "the configured relay"}.`;
  $("metricWebSessions").textContent = activeSessions.length;
  $("metricWebShares").textContent = openShares.length;
  $("metricWebExpiry").textContent = formatDuration(defaultExpiry);
  $("metricWebDirect").textContent = state.webV3Settings.require_login_for_direct_mode === false ? "Open" : "Login";
  $("webPolicyEnabled").textContent = yesNo(state.webV3Settings.enabled ?? state.webV3Config.enabled ?? true);
  $("webPolicyPermissions").textContent = permissions.length ? permissions.join(", ") : "view";
  $("webPolicyClipboard").textContent = yesNo(state.webV3Settings.allow_clipboard ?? true);
  $("webPolicyFiles").textContent = yesNo(state.webV3Settings.allow_file_transfer ?? false);
  $("webCfgIdServer").textContent = endpoints.idServer || "-";
  $("webCfgRelayServer").textContent = endpoints.relayServer || "-";
  $("webCfgApiServer").textContent = endpoints.apiServer || "-";
  $("webCfgKey").textContent = endpoints.publicKey || "-";
}

function currentEndpoints() {
  return {
    idServer: state.webV3Config.rendezvous_server || state.config.id_server || "",
    relayServer: state.webV3Config.relay_server || state.config.relay_server || "",
    apiServer: state.config.api_server || window.location.origin,
    publicKey: state.webV3Config.public_key || state.config.key || "",
  };
}

function renderDeployment() {
  const endpoints = currentEndpoints();
  const host = window.location.hostname || "127.0.0.1";
  const publicOrigin = endpoints.apiServer || `${window.location.protocol}//${host}:21114`;
  const adminOrigin = `${window.location.protocol}//${host}:21124`;
  const isPrivateAdmin = window.location.port === "21124" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const hasIdRelay = Boolean(endpoints.idServer && endpoints.relayServer);
  const hasPublicKey = Boolean(endpoints.publicKey);
  const webReady = state.webV3Config.enabled !== false;
  const sessionsReasonable = activeWebSessions().length < 20;
  const checks = [
    { label: "Admin split", value: isPrivateAdmin ? `Admin at ${adminOrigin}` : "Keep /_admin off the public port", ok: isPrivateAdmin },
    { label: "Public API", value: publicOrigin, ok: Boolean(publicOrigin) },
    { label: "ID and relay", value: hasIdRelay ? `${endpoints.idServer} / ${endpoints.relayServer}` : "Set both before publishing clients", ok: hasIdRelay },
    { label: "Public key", value: hasPublicKey ? "Configured" : "Missing", ok: hasPublicKey },
    { label: "Web v3", value: webReady ? "Enabled" : "Disabled", ok: webReady },
    { label: "Active sessions", value: `${activeWebSessions().length} live / recent`, ok: sessionsReasonable },
  ];

  $("deployPublicApi").textContent = publicOrigin.replace(/^https?:\/\//, "");
  $("deployPrivateAdmin").textContent = adminOrigin.replace(/^https?:\/\//, "");
  $("deployIdServer").textContent = endpoints.idServer || "-";
  $("deployRelayServer").textContent = endpoints.relayServer || "-";
  $("deploymentChecklist").innerHTML = checks.map((item) => statusItem(item.label, item.value, item.ok)).join("");
  $("deploySplitCommand").value = "docker compose --env-file .env -f docker-compose.yml -f docker-compose.windows.yml -f docker-compose.admin-split.yml up -d --build";
  $("deploySshTunnelCommand").value = `ssh -L 21124:127.0.0.1:21124 user@${host === "127.0.0.1" || host === "localhost" ? "your-server" : host}`;
  $("deployPublicCheckCommand").value = "powershell -ExecutionPolicy Bypass -File tools\\check-public-ready.ps1";
  $("deployImageEnv").value = [
    "SERVER_IMAGE=ghcr.io/<github-owner>/rustdesk-selfhost-qt-server:latest",
    "API_IMAGE=ghcr.io/<github-owner>/rustdesk-selfhost-qt-api:latest",
    "",
    "# Docker Hub alternative:",
    "SERVER_IMAGE=tanqt11/rustdesk-selfhost-qt-server:latest",
    "API_IMAGE=tanqt11/rustdesk-selfhost-qt-api:latest",
  ].join("\n");
}

function activeWebSessions() {
  const now = Math.floor(Date.now() / 1000);
  const liveStatuses = new Set(["connecting", "connected", "reconnecting"]);
  return state.webV3Sessions.filter((item) => {
    const status = String(item.status || "").toLowerCase();
    const expires = Number(item.expires_at || 0);
    const lastSeen = timestampSeconds(item.last_seen_at);
    const recent = lastSeen > 0 && now - lastSeen < 300;
    return !item.revoked_at
      && status !== "revoked"
      && status !== "expired"
      && (!expires || expires > now)
      && (liveStatuses.has(status) || recent);
  });
}

function openWebShares() {
  const now = Math.floor(Date.now() / 1000);
  return state.webV3Shares.filter((item) => {
    const expires = Number(item.expires_at || 0);
    return !item.revoked_at && (!expires || expires > now);
  });
}

function statusItem(label, value, ok) {
  const cls = ok ? "ok" : "warn";
  return `
    <div class="status-item">
      <span class="status-dot ${cls}"></span>
      <div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>
      <span class="status-badge ${cls}">${ok ? "Ready" : "Check"}</span>
    </div>
  `;
}

function yesNo(value) {
  return value ? "On" : "Off";
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (!value) return "-";
  if (value % 86400 === 0) return `${value / 86400}d`;
  if (value % 3600 === 0) return `${value / 3600}h`;
  if (value % 60 === 0) return `${value / 60}m`;
  return `${value}s`;
}

function renderRecent() {
  const connectable = connectableDevices();
  const html = connectable.slice(0, 6).map((peer) => `
    <div class="compact-item device-summary">
      <div>
        <strong>${escapeHtml(deviceTitle(peer))}</strong>
        <span>${deviceStatusBadge(peer)} ${escapeHtml(deviceSubtitle(peer))}</span>
      </div>
      <button class="mini-button primary" type="button" data-open-web-v3="${escapeHtml(peer.id || "")}" data-row-id="${escapeHtml(peer.row_id || "")}">Web v3</button>
    </div>
  `).join("");
  $("recentDevices").innerHTML = html || "<p class=\"hint\">No connectable devices yet.</p>";
}

function connectableDevices() {
  const merged = new Map();
  [state.devices, state.myDevices, state.addressBook, state.allAddressBook].forEach((list) => {
    (list || []).forEach((peer) => {
      const id = String(peer.id || peer.peer_id || "").trim();
      if (!id) return;
      const existing = merged.get(id) || {};
      merged.set(id, { ...existing, ...peer, id });
    });
  });
  return Array.from(merged.values()).sort((a, b) => timestampSeconds(b.last_online_time) - timestampSeconds(a.last_online_time));
}

function deviceTitle(peer) {
  return peer.alias || peer.hostname || peer.id || "Unknown";
}

function deviceSubtitle(peer) {
  return [peer.username, peer.platform || peer.os, peer.last_online_ip].filter(Boolean).join(" / ");
}

function deviceOnlineState(peer) {
  const lastSeen = timestampSeconds(peer.last_online_time);
  const online = lastSeen > 0 && Math.floor(Date.now() / 1000) - lastSeen < 600;
  return {
    online,
    label: online ? "Online" : lastSeen ? "Seen" : "Unknown",
  };
}

function deviceStatusBadge(peer) {
  const status = deviceOnlineState(peer);
  return `<span class="device-status ${status.online ? "online" : "offline"}"><span class="status-dot ${status.online ? "ok" : "warn"}"></span>${status.label}</span>`;
}

function renderDevices() {
  const q = $("deviceSearch").value.trim().toLowerCase();
  const rows = state.devices.filter((peer) => {
    const text = [peer.id, peer.hostname, peer.username, peer.alias].join(" ").toLowerCase();
    return !q || text.includes(q);
  }).map((peer) => `
    <tr>
      <td>${escapeHtml(peer.id || "")}</td>
      <td><div class="device-cell"><strong>${escapeHtml(deviceTitle(peer))}</strong><span>${deviceStatusBadge(peer)} ${escapeHtml(deviceSubtitle(peer))}</span></div></td>
      <td>${escapeHtml(peer.username || "")}</td>
      <td>${escapeHtml(peer.version || "")}</td>
      <td>${escapeHtml(peer.last_online_ip || "")}</td>
      <td>${formatTime(peer.last_online_time)}</td>
      <td><div class="row-actions">${webClientButtons(peer)}</div></td>
    </tr>
  `).join("");
  $("devicesTable").innerHTML = rows || `<tr><td colspan="7">No devices found.</td></tr>`;
}

function renderMyDevices() {
  const q = $("myDeviceSearch").value.trim().toLowerCase();
  const rows = state.myDevices.filter((peer) => {
    const text = [peer.id, peer.hostname, peer.username, peer.alias].join(" ").toLowerCase();
    return !q || text.includes(q);
  }).map((peer) => `
    <tr>
      <td>${escapeHtml(peer.id || "")}</td>
      <td><div class="device-cell"><strong>${escapeHtml(deviceTitle(peer))}</strong><span>${deviceStatusBadge(peer)} ${escapeHtml(deviceSubtitle(peer))}</span></div></td>
      <td>${escapeHtml(peer.username || "")}</td>
      <td>${escapeHtml(peer.version || "")}</td>
      <td>${escapeHtml(peer.last_online_ip || "")}</td>
      <td>${formatTime(peer.last_online_time)}</td>
      <td><div class="row-actions">${webClientButtons(peer)}</div></td>
    </tr>
  `).join("");
  $("myDevicesTable").innerHTML = rows || `<tr><td colspan="7">No devices found.</td></tr>`;
}

function renderAddressBook() {
  const list = state.addressBookMode === "all" && state.isAdmin ? state.allAddressBook : state.addressBook;
  $("showAllAddressBook").style.display = state.isAdmin ? "" : "none";
  $("showMyAddressBook").classList.toggle("active", state.addressBookMode === "mine");
  $("showAllAddressBook").classList.toggle("active", state.addressBookMode === "all");
  const rows = list.map((item) => `
    <tr>
      <td>${escapeHtml(item.id || "")}</td>
      <td>${escapeHtml(item.alias || "")}</td>
      <td>${escapeHtml(item.hostname || "")}</td>
      <td>${escapeHtml(item.username || "")}</td>
      <td>${escapeHtml(item.platform || "")}</td>
      <td>${escapeHtml(item.collection?.name || "Default")}</td>
      <td><div class="row-actions">${webClientButtons(item, true)}</div></td>
    </tr>
  `).join("");
  $("addressBookTable").innerHTML = rows || `<tr><td colspan="7">No address-book entries found.</td></tr>`;
}

function renderUsers() {
  const rows = state.users.map((user) => `
    <tr>
      <td>${escapeHtml(user.username || "")}</td>
      <td>${escapeHtml(user.email || "")}</td>
      <td>${user.is_admin ? "Yes" : "No"}</td>
      <td>${user.status === 1 ? "Enabled" : "Disabled"}</td>
      <td>${formatTime(user.updated_at)}</td>
    </tr>
  `).join("");
  $("usersTable").innerHTML = rows || `<tr><td colspan="5">No users found.</td></tr>`;
}

function renderAudit() {
  const rows = state.audit.map((item) => `
    <tr>
      <td>${escapeHtml(item.peer_id || "")}</td>
      <td>${escapeHtml(item.from_name || item.from_peer || "")}</td>
      <td>${escapeHtml(item.action || "")}</td>
      <td>${escapeHtml(item.ip || "")}</td>
      <td>${formatTime(item.created_at)}</td>
    </tr>
  `).join("");
  $("auditTable").innerHTML = rows || `<tr><td colspan="5">No audit records.</td></tr>`;
}

function renderCustomClientBuilder(reset = false) {
  const endpoints = currentEndpoints();
  const saved = reset ? null : readCustomClientDraft();
  const draft = saved || {
    name: "QT Edition Windows",
    appName: "RustDesk Selfhost QT",
    platform: "windows",
    connectionType: "bidirectional",
    idServer: endpoints.idServer,
    relayServer: endpoints.relayServer,
    apiServer: endpoints.apiServer,
    publicKey: endpoints.publicKey,
    note: "",
    disableInstall: false,
    disableSettings: false,
    disableAddressBook: false,
    forceRelay: true,
    disableAccount: false,
    disableFileTransfer: true,
    disableClipboard: false,
    allowWebSocket: true,
    defaultSettings: "allow-websocket=Y",
    overrideSettings: "enable-file-transfer=N",
  };
  setCustomClientForm(draft);
  generateCustomClientOutput();
}

function readCustomClientDraft() {
  try {
    return JSON.parse(localStorage.getItem("rd_admin_custom_client_draft") || "null");
  } catch {
    return null;
  }
}

function setCustomClientForm(draft) {
  $("ccName").value = draft.name || "";
  $("ccAppName").value = draft.appName || "";
  $("ccPlatform").value = draft.platform || "windows";
  $("ccConnectionType").value = draft.connectionType || "bidirectional";
  $("ccIdServer").value = draft.idServer || "";
  $("ccRelayServer").value = draft.relayServer || "";
  $("ccApiServer").value = draft.apiServer || "";
  $("ccPublicKey").value = draft.publicKey || "";
  $("ccNote").value = draft.note || "";
  $("ccDisableInstall").checked = Boolean(draft.disableInstall);
  $("ccDisableSettings").checked = Boolean(draft.disableSettings);
  $("ccDisableAddressBook").checked = Boolean(draft.disableAddressBook);
  $("ccForceRelay").checked = draft.forceRelay !== false;
  $("ccDisableAccount").checked = Boolean(draft.disableAccount);
  $("ccDisableFileTransfer").checked = draft.disableFileTransfer !== false;
  $("ccDisableClipboard").checked = Boolean(draft.disableClipboard);
  $("ccAllowWebSocket").checked = draft.allowWebSocket !== false;
  $("ccDefaultSettings").value = draft.defaultSettings || "";
  $("ccOverrideSettings").value = draft.overrideSettings || "";
}

function readCustomClientForm() {
  return {
    name: $("ccName").value.trim(),
    appName: $("ccAppName").value.trim(),
    platform: $("ccPlatform").value,
    connectionType: $("ccConnectionType").value,
    idServer: $("ccIdServer").value.trim(),
    relayServer: $("ccRelayServer").value.trim(),
    apiServer: $("ccApiServer").value.trim(),
    publicKey: $("ccPublicKey").value.trim(),
    note: $("ccNote").value.trim(),
    disableInstall: $("ccDisableInstall").checked,
    disableSettings: $("ccDisableSettings").checked,
    disableAddressBook: $("ccDisableAddressBook").checked,
    forceRelay: $("ccForceRelay").checked,
    disableAccount: $("ccDisableAccount").checked,
    disableFileTransfer: $("ccDisableFileTransfer").checked,
    disableClipboard: $("ccDisableClipboard").checked,
    allowWebSocket: $("ccAllowWebSocket").checked,
    defaultSettings: $("ccDefaultSettings").value.trim(),
    overrideSettings: $("ccOverrideSettings").value.trim(),
  };
}

function generateCustomClientOutput() {
  const draft = readCustomClientForm();
  const profile = buildCustomClientProfile(draft);
  localStorage.setItem("rd_admin_custom_client_draft", JSON.stringify(draft));
  $("ccProfileJson").value = JSON.stringify(profile, null, 2);
  $("ccConfigString").value = profile.rustdesk_config_string;
  $("ccWindowsScript").value = buildWindowsDeploymentScript(profile);
  $("customClientStatus").textContent = `${profile.name || "Profile"} generated for ${profile.platform}. Binary rebrand/build is a later step.`;
}

function currentCustomClientProfile() {
  try {
    const existing = JSON.parse($("ccProfileJson").value || "null");
    if (existing?.rustdesk_config_string) return existing;
  } catch {}
  generateCustomClientOutput();
  return JSON.parse($("ccProfileJson").value);
}

function downloadCustomClientPackage() {
  try {
    const profile = currentCustomClientProfile();
    const files = buildCustomClientPackageFiles(profile);
    const zip = createZip(files);
    const filename = `${safeFilename(profile.name || "rustdesk-client-profile")}.zip`;
    downloadBlob(zip, filename, "application/zip");
    $("customClientStatus").textContent = `Downloaded ${filename}. Put RustDesk.exe next to install-windows.ps1 when deploying.`;
  } catch (error) {
    $("customClientStatus").textContent = error.message;
  }
}

function buildCustomClientPackageFiles(profile) {
  return [
    {
      name: "README.txt",
      content: [
        `${profile.app_name || "Managed RustDesk client"} deployment package`,
        "",
        "This package was generated by the self-host admin Custom Clients page.",
        "It contains configuration material only. It does not include a RustDesk binary.",
        "",
        "Windows quick start:",
        "1. Put your trusted RustDesk.exe next to install-windows.ps1.",
        "2. Review profile.json and rustdesk-config.txt.",
        "3. Run PowerShell from this folder:",
        "   powershell -ExecutionPolicy Bypass -File .\\install-windows.ps1",
        "",
        "Security notes:",
        "- The config string may include your self-host public key and endpoint policy.",
        "- Do not publish private server keys or OAuth secrets in a client package.",
        "- Real binary rebranding/building is a later build-farm phase.",
        "",
      ].join("\n"),
    },
    { name: "profile.json", content: JSON.stringify(profile, null, 2) + "\n" },
    { name: "rustdesk-config.txt", content: profile.rustdesk_config_string + "\n" },
    { name: "install-windows.ps1", content: buildWindowsDeploymentScript(profile) + "\n" },
    { name: "settings-default.txt", content: settingsObjectToText(profile.default_settings) },
    { name: "settings-override.txt", content: settingsObjectToText(profile.override_settings) },
  ];
}

function settingsObjectToText(settings) {
  return Object.entries(settings || {}).map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
}

function safeFilename(value) {
  return String(value || "package").trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "package";
}

function buildCustomClientProfile(draft) {
  const defaultSettings = parseSettingsText(draft.defaultSettings);
  const overrideSettings = parseSettingsText(draft.overrideSettings);
  if (draft.allowWebSocket) defaultSettings["allow-websocket"] = defaultSettings["allow-websocket"] || "Y";
  if (draft.disableFileTransfer) overrideSettings["enable-file-transfer"] = "N";
  if (draft.disableClipboard) overrideSettings["enable-clipboard"] = "N";
  if (draft.forceRelay) overrideSettings["direct-server"] = "N";
  return {
    version: 1,
    name: draft.name,
    app_name: draft.appName,
    platform: draft.platform,
    connection_type: draft.connectionType,
    generated_at: new Date().toISOString(),
    server: {
      id_server: draft.idServer,
      relay_server: draft.relayServer,
      api_server: draft.apiServer,
      public_key: draft.publicKey,
    },
    lockdown: {
      disable_installation: draft.disableInstall,
      disable_settings: draft.disableSettings,
      disable_address_book: draft.disableAddressBook,
      force_relay: draft.forceRelay,
      disable_user_account: draft.disableAccount,
      disable_file_transfer: draft.disableFileTransfer,
      disable_clipboard: draft.disableClipboard,
      allow_websocket: draft.allowWebSocket,
    },
    default_settings: defaultSettings,
    override_settings: overrideSettings,
    note: draft.note,
    rustdesk_config_string: buildRustDeskConfigString(draft, defaultSettings, overrideSettings),
  };
}

function parseSettingsText(text) {
  const settings = {};
  String(text || "").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index <= 0) return;
    settings[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  });
  return settings;
}

function buildRustDeskConfigString(draft, defaultSettings, overrideSettings) {
  const config = {
    "custom-rendezvous-server": draft.idServer,
    "relay-server": draft.relayServer,
    "api-server": draft.apiServer,
    key: draft.publicKey,
    "connection-type": draft.connectionType,
    "default-settings": defaultSettings,
    "override-settings": overrideSettings,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(config))));
}

function buildWindowsDeploymentScript(profile) {
  const exe = "RustDesk.exe";
  const config = profile.rustdesk_config_string;
  const lines = [
    "# Generated by RustDesk Selfhost QT admin",
    "$ErrorActionPreference = \"Stop\"",
    `$Config = "${config}"`,
    `$Exe = Join-Path $PSScriptRoot "${exe}"`,
    "if (!(Test-Path $Exe)) { throw \"Put RustDesk.exe next to this script before running it.\" }",
    "& $Exe --config $Config",
    "",
    "# Profile summary",
    `# Name: ${profile.name || "-"}`,
    `# App label: ${profile.app_name || "-"}`,
    `# Platform: ${profile.platform}`,
    `# Connection type: ${profile.connection_type}`,
    `# ID server: ${profile.server.id_server || "-"}`,
    `# Relay server: ${profile.server.relay_server || "-"}`,
    `# API server: ${profile.server.api_server || "-"}`,
    "",
    "# Later build-farm phase will create branded MSI/EXE artifacts from this profile.",
  ];
  return lines.join("\n");
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function downloadBlob(blob, filename, type = "application/octet-stream") {
  const url = URL.createObjectURL(type && blob.type !== type ? new Blob([blob], { type }) : blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function switchView(name) {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  $(`${name}View`).classList.add("active");
  $("pageTitle").textContent = viewTitles[name] || name[0].toUpperCase() + name.slice(1);
}

async function switchResource(name) {
  activeResource = name;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.resource === name));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  $("manageView").classList.add("active");
  const cfg = resourceConfigs[name];
  $("pageTitle").textContent = cfg.title;
  $("manageTitle").textContent = cfg.title;
  $("manageHint").textContent = cfg.hint || "";
  $("manageCreateBtn").style.display = cfg.create || cfg.update && name === "myInfo" ? "" : "none";
  $("manageCreateBtn").textContent = name === "myInfo" ? (cfg.saveLabel || "Edit") : "Create";
  $("manageSearch").value = "";
  await loadResource(name);
}

async function loadResource(name = activeResource) {
  if (!name) return;
  const cfg = resourceConfigs[name];
  let data;
  if (cfg.list) {
    data = await cfg.list();
  } else {
    data = await api(`${cfg.listUrl}?page=1&page_size=300`);
  }
  activeRows = normalizeList(data, ["server_cmds", "serverCmds", "users", "groups", "device_groups", "tags", "address_books", "address_book_collection", "address_book_collection_rule", "oauths", "user_tokens", "login_logs", "audit_conns", "audit_files", "share_records", "list"]).list;
  renderResourceTable();
}

function renderResourceTable() {
  const cfg = resourceConfigs[activeResource];
  const q = $("manageSearch").value.trim().toLowerCase();
  const rows = activeRows.filter((row) => !q || JSON.stringify(row).toLowerCase().includes(q));
  $("manageHead").innerHTML = `<tr>${cfg.columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}<th>Actions</th></tr>`;
  $("manageTable").innerHTML = rows.map((row, index) => `
    <tr>
      ${cfg.columns.map((col) => `<td>${escapeHtml(displayValue(row, col))}</td>`).join("")}
      <td><div class="row-actions">${resourceActions(row, index)}</div></td>
    </tr>
  `).join("") || `<tr><td colspan="${cfg.columns.length + 1}">No records found.</td></tr>`;
}

function resourceActions(row, index) {
  const cfg = resourceConfigs[activeResource];
  const actions = [];
  if (activeResource === "users") actions.push(`<button class="mini-button" type="button" data-password-row="${index}">Password</button>`);
  if (activeResource === "serverCmd") actions.push(`<button class="mini-button primary" type="button" data-send-cmd-row="${index}">Send</button>`);
  if (cfg.update || activeResource === "myInfo") actions.push(`<button class="mini-button" type="button" data-edit-row="${index}">Edit</button>`);
  if (cfg.delete) {
    const label = activeResource === "webV3Shares" || activeResource === "webV3Sessions" ? "Revoke" : "Delete";
    actions.push(`<button class="mini-button" type="button" data-delete-row="${index}">${label}</button>`);
  }
  return actions.join("");
}

function displayValue(row, key) {
  const value = row?.[key];
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function openEditor(row = null, mode = "edit") {
  const cfg = resourceConfigs[activeResource];
  editingRow = row;
  $("editorError").textContent = "";
  $("editorDeleteBtn").style.display = cfg.delete && row ? "" : "none";
  $("editorTitle").textContent = `${mode === "create" ? "Create" : "Edit"} ${cfg.title}`;
  const payload = mode === "create" ? cfg.template?.() || {} : row || cfg.template?.() || {};
  const clean = stripReadonly(payload);
  $("editorJson").value = JSON.stringify(clean, null, 2);
  renderEditorFields(clean, mode);
  $("editorModal").classList.remove("hidden");
}

function renderEditorFields(payload, mode) {
  const cfg = resourceConfigs[activeResource];
  const fields = cfg.fields || [];
  $("editorFields").innerHTML = fields.map((item) => {
    const value = payload[item.name];
    const readonly = item.readonlyOnCreate && mode === "create";
    const cls = item.full || item.type === "textarea" ? "full" : "";
    if (item.type === "textarea") {
      return `<label class="${cls}">${escapeHtml(item.label)}<textarea data-field="${escapeHtml(item.name)}" ${readonly ? "readonly" : ""}>${escapeHtml(value || "")}</textarea></label>`;
    }
    if (item.type === "checkbox") {
      return `<label class="${cls}">${escapeHtml(item.label)}<input data-field="${escapeHtml(item.name)}" type="checkbox" ${value ? "checked" : ""} ${readonly ? "disabled" : ""}></label>`;
    }
    const inputValue = Array.isArray(value) ? value.join(", ") : value ?? "";
    return `<label class="${cls}">${escapeHtml(item.label)}<input data-field="${escapeHtml(item.name)}" type="${item.type}" value="${escapeHtml(inputValue)}" ${readonly ? "readonly" : ""}></label>`;
  }).join("") || `<p class="hint">This item has no custom form yet. Use Advanced JSON.</p>`;
  $("editorAdvanced").open = fields.length === 0;
}

function stripReadonly(row) {
  const copy = JSON.parse(JSON.stringify(row || {}));
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.user;
  delete copy.collection;
  return copy;
}

function closeEditor() {
  $("editorModal").classList.add("hidden");
  editingRow = null;
}

async function saveEditor(event) {
  event.preventDefault();
  const cfg = resourceConfigs[activeResource];
  try {
    const payload = collectEditorPayload();
    const path = editingRow ? cfg.update : cfg.create;
    if (!path) throw new Error("This record cannot be saved here.");
    await api(path, { method: "POST", body: JSON.stringify(payload) });
    closeEditor();
    if (activeResource === "myInfo") {
      alert("Password updated.");
    } else {
      await loadResource();
      await loadData();
    }
  } catch (error) {
    $("editorError").textContent = error.message;
  }
}

function collectEditorPayload() {
  const cfg = resourceConfigs[activeResource];
  let payload = {};
  try {
    payload = JSON.parse($("editorJson").value || "{}");
  } catch {
    payload = {};
  }
  const fields = cfg.fields || [];
  for (const item of fields) {
    const el = document.querySelector(`[data-field="${CSS.escape(item.name)}"]`);
    if (!el || el.hasAttribute("readonly") && !el.value) continue;
    if (item.type === "checkbox") {
      payload[item.name] = el.checked;
    } else if (item.type === "number") {
      payload[item.name] = el.value === "" ? 0 : Number(el.value);
    } else if (item.name === "tags") {
      payload[item.name] = el.value.split(",").map((v) => v.trim()).filter(Boolean);
    } else {
      payload[item.name] = el.value;
    }
  }
  return payload;
}

async function deleteResourceRow(row) {
  const cfg = resourceConfigs[activeResource];
  if (!cfg.delete) return;
  const isRevoke = activeResource === "webV3Shares" || activeResource === "webV3Sessions";
  if (!confirm(isRevoke ? "Revoke this item?" : "Delete this record?")) return;
  await api(cfg.delete, { method: "POST", body: JSON.stringify(row) });
  closeEditor();
  await loadResource();
  await loadData();
}

async function changeUserPassword(row) {
  const password = prompt(`New password for ${row.username || row.id}`);
  if (!password) return;
  await api(resourceConfigs.users.password, { method: "POST", body: JSON.stringify({ id: row.id, password }) });
  alert("Password updated.");
}

async function sendServerCmd(row) {
  const option = prompt(`${row.cmd} option`, row.option || "");
  if (option === null) return;
  const payload = { ...row, option };
  const data = await api(resourceConfigs.serverCmd.send, { method: "POST", body: JSON.stringify(payload) });
  alert(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

function webClientButtons(peer, addressBookEntry = false) {
  const id = escapeHtml(peer.id || "");
  if (!id) return "";
  const rowId = escapeHtml(peer.row_id || "");
  const canSave = !addressBookEntry && rowId;
  const share = state.isAdmin ? `<button class="mini-button primary" type="button" data-share-web-v3="${id}" data-row-id="${rowId}">Share Web</button>` : "";
  const save = !addressBookEntry && rowId ? `<button class="mini-button" type="button" data-save-address-book="${rowId}">Save AB</button>` : "";
  const copy = state.isAdmin ? `<button class="mini-button" type="button" data-copy-web-v3-share="${id}" data-row-id="${rowId}">Copy Link</button>` : "";
  return `<button class="mini-button primary" type="button" data-open-rustdesk="${id}">Open App</button><button class="mini-button" type="button" data-open-web-v3="${id}" data-row-id="${rowId}">Web v3</button>${share}${copy}${canSave ? save : ""}`;
}

function openWebClient(id, shareToken = "") {
  const url = shareToken
    ? `/webclient/#/?share_token=${encodeURIComponent(shareToken)}`
    : `/webclient/#/?id=${encodeURIComponent(id)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function openWebV3(id, shareToken = "", sessionId = "") {
  let query = "";
  if (shareToken) query = `share_token=${encodeURIComponent(shareToken)}`;
  else if (sessionId) query = `session_id=${encodeURIComponent(sessionId)}`;
  else query = `id=${encodeURIComponent(id)}`;
  window.open(`/web3/#/?${query}`, "_blank", "noopener,noreferrer");
}

function openRustDeskApp(id) {
  window.location.href = `rustdesk://connection/new/${encodeURIComponent(id)}`;
}

async function shareWebClient(id, copyOnly = false, rowId = "") {
  const ownEntry = state.addressBook.find((item) => item.id === id);
  const anyEntry = ownEntry || state.allAddressBook.find((item) => item.id === id);
  let password = anyEntry?.password || "";
  if (!password) {
    password = window.prompt(`Password for ${id}`);
  }
  if (!password) {
    openWebClient(id);
    return;
  }
  if (!ownEntry && rowId) {
    await api("/api/admin/my/address_book/batchCreateFromPeers", {
      method: "POST",
      body: JSON.stringify({
        peer_ids: [Number(rowId)],
        collection_id: 0,
        tags: [],
      }),
    });
    await loadData();
  }
  const data = await api("/api/admin/address_book/shareByWebClient", {
    method: "POST",
    body: JSON.stringify({
      id,
      password,
      password_type: "once",
      expire: 3600,
    }),
  });
  const url = `${window.location.origin}/webclient/#/?share_token=${encodeURIComponent(data.share_token)}`;
  if (copyOnly) {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
    else window.prompt("Copy share link", url);
    alert("Share link copied.");
  } else {
    openWebClient(id, data.share_token);
  }
}

async function savePeerToAddressBook(rowId) {
  const peer = [...state.myDevices, ...state.devices].find((item) => String(item.row_id) === String(rowId));
  const path = state.isAdmin && peer?.user_id
    ? "/api/admin/address_book/batchCreateFromPeers"
    : "/api/admin/my/address_book/batchCreateFromPeers";
  const body = {
    peer_ids: [Number(rowId)],
    collection_id: 0,
    tags: [],
  };
  if (path.includes("/api/admin/address_book/")) {
    body.user_id = peer.user_id;
  }
  await api(path, { method: "POST", body: JSON.stringify(body) });
  await loadData();
}

function findPeerForShare(id, rowId = "") {
  const pools = [state.addressBook, state.allAddressBook, state.devices, state.myDevices];
  for (const list of pools) {
    const peer = list.find((item) => String(item.id) === String(id) && (!rowId || String(item.row_id || "") === String(rowId) || !item.row_id));
    if (peer) return peer;
  }
  return { id, row_id: rowId };
}

function openWebV3ShareModal(id, rowId = "") {
  const peer = findPeerForShare(id, rowId);
  state.activeWebV3SharePeer = peer;
  $("webV3ShareError").textContent = "";
  $("webV3ShareResult").classList.add("hidden");
  $("webV3ShareUrl").value = "";
  $("webV3ShareExpire").value = "3600";
  $("webV3ShareOnce").checked = true;
  document.querySelectorAll("[data-webv3-permission]").forEach((item) => {
    item.checked = ["view", "control_mouse", "control_keyboard"].includes(item.dataset.webv3Permission);
  });
  $("webV3SharePeer").textContent = `${peer.alias || peer.hostname || peer.id || "Unknown"} (${peer.id || id})`;
  $("webV3ShareModal").classList.remove("hidden");
}

function closeWebV3ShareModal() {
  $("webV3ShareModal").classList.add("hidden");
  state.activeWebV3SharePeer = null;
}

function collectWebV3Permissions() {
  const permissions = Array.from(document.querySelectorAll("[data-webv3-permission]"))
    .filter((item) => item.checked)
    .map((item) => item.dataset.webv3Permission);
  return permissions.length ? permissions : ["view"];
}

function absoluteShareUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${window.location.origin}${value.startsWith("/") ? value : `/${value}`}`;
}

async function createWebV3Share(peer, options = {}) {
  const data = await api("/api/admin/web-v3/share", {
    method: "POST",
    body: JSON.stringify({
      peer_id: peer.id,
      expires_in_seconds: options.expiresInSeconds ?? 3600,
      once: options.once ?? true,
      permissions: options.permissions || ["view", "control_mouse", "control_keyboard"],
    }),
  });
  return { ...data, share_url: absoluteShareUrl(data.share_url) };
}

async function submitWebV3Share(event) {
  event.preventDefault();
  const peer = state.activeWebV3SharePeer;
  if (!peer?.id) return;
  $("webV3ShareError").textContent = "";
  $("webV3ShareCreateBtn").disabled = true;
  try {
    const data = await createWebV3Share(peer, {
      expiresInSeconds: Number($("webV3ShareExpire").value || 3600),
      once: $("webV3ShareOnce").checked,
      permissions: collectWebV3Permissions(),
    });
    $("webV3ShareUrl").value = data.share_url;
    $("webV3ShareResult").classList.remove("hidden");
    await copyText(data.share_url);
    await loadResource(activeResource === "webV3Shares" ? activeResource : "");
  } catch (error) {
    $("webV3ShareError").textContent = error.message;
  } finally {
    $("webV3ShareCreateBtn").disabled = false;
  }
}

async function copyWebV3Share(id, rowId = "") {
  const peer = findPeerForShare(id, rowId);
  const data = await createWebV3Share(peer);
  await copyText(data.share_url);
  alert("Web v3 share link copied.");
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
  } else {
    window.prompt("Copy link", value);
  }
}

async function exportBackup() {
  await downloadBackup("/api/admin/backup/export", "rustdesk-api-backup.zip");
}

async function exportSelectiveBackup() {
  const components = selectedBackupComponents();
  if (!components.length) {
    $("backupStatus").textContent = "Choose at least one backup component.";
    return;
  }
  await downloadBackup(`/api/admin/backup/export-selective?components=${encodeURIComponent(components.join(","))}`, "rustdesk-selected-backup.zip");
}

async function downloadBackup(urlPath, filename) {
  if (!state.token) return;
  try {
    $("backupStatus").textContent = "Preparing backup...";
    const res = await fetch(urlPath, { headers: { "api-token": state.token } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    $("backupStatus").textContent = `Downloaded ${filename}.`;
  } catch (error) {
    $("backupStatus").textContent = error.message;
  }
}

async function importBackup(event) {
  event.preventDefault();
  const mode = event.submitter?.dataset.importMode || "smart";
  const file = $("backupFile").files[0];
  if (!file) {
    $("backupStatus").textContent = "Choose a backup zip first.";
    return;
  }
  const components = selectedBackupComponents();
  if (mode === "selective" && !components.length) {
    $("backupStatus").textContent = "Choose at least one restore component.";
    return;
  }
  try {
    $("backupStatus").textContent = "Inspecting backup before import...";
    const preview = await inspectBackupFile(file);
    renderBackupInspect(preview);
    if (!confirmBackupImport(mode, preview, components)) {
      $("backupStatus").textContent = "Import cancelled.";
      return;
    }
    const form = new FormData();
    form.append("backup", file);
    if (mode === "selective") form.append("components", components.join(","));
    $("backupStatus").textContent = mode === "smart" ? "Smart importing backup..." : "Importing backup...";
    const endpoint = mode === "full" ? "/api/admin/backup/import" : "/api/admin/backup/import-selective";
    const data = await api(endpoint, { method: "POST", body: form });
    const services = data.restart_services?.join(", ") || "rustdesk-api";
    const restart = data.restart_required ? ` Restart ${services} before using restored data.` : "";
    const source = mode === "smart" ? "Smart imported" : "Imported";
    $("backupStatus").textContent = `${source} ${data.restored.join(", ")}.${restart}`;
  } catch (error) {
    $("backupStatus").textContent = error.message;
  }
}

async function inspectBackup() {
  const file = $("backupFile").files[0];
  if (!file) {
    $("backupStatus").textContent = "Choose a backup zip first.";
    setBackupInspect("");
    return;
  }
  try {
    $("backupStatus").textContent = "Inspecting backup...";
    renderBackupInspect(await inspectBackupFile(file));
    $("backupStatus").textContent = "Backup inspected. Use Smart import unless you want to force a subset.";
  } catch (error) {
    setBackupInspect("");
    $("backupStatus").textContent = error.message;
  }
}

async function inspectBackupFile(file) {
  const form = new FormData();
  form.append("backup", file);
  return api("/api/admin/backup/inspect", { method: "POST", body: form });
}

function renderBackupInspect(data) {
  const components = data.components?.join(", ") || "none detected";
  const restart = data.restart_required ? "yes" : "no";
  const sensitive = data.sensitive ? "yes" : "no";
  const manifest = data.manifest_found ? "found" : "not found, detected by files";
  const counts = formatBackupCounts(data.counts || {});
  const files = (data.files || []).map((fileInfo) => `- ${fileInfo.name} (${formatBytes(fileInfo.size || 0)})`).join("\n");
  setBackupInspect(`Manifest: ${manifest}\nComponents: ${components}\nSensitive data: ${sensitive}\nRestart required: ${restart}\n\nCounts:\n${counts || "- no countable JSON data"}\n\nFiles:\n${files || "- none"}`);
}

function confirmBackupImport(mode, preview, selectedComponents) {
  const components = mode === "selective" ? selectedComponents : (preview.components || []);
  const risky = mode === "full" || preview.sensitive || preview.restart_required;
  if (!risky) return true;
  const summary = [
    `Import mode: ${mode}`,
    `Components: ${components.join(", ") || "none detected"}`,
    `Sensitive data: ${preview.sensitive ? "yes" : "no"}`,
    `Restart required: ${preview.restart_required ? "yes" : "no"}`,
    "",
    "Continue import?"
  ].join("\n");
  return window.confirm(summary);
}

function setBackupInspect(text) {
  const box = $("backupInspect");
  box.textContent = text;
  box.classList.toggle("has-content", Boolean(text));
}

function formatBackupCounts(counts) {
  return Object.entries(counts)
    .filter(([, value]) => Number.isFinite(value))
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function selectedBackupComponents() {
  return Array.from(document.querySelectorAll("[data-backup-component]:checked")).map((item) => item.dataset.backupComponent);
}

async function saveServerSettings() {
  $("settingsStatus").textContent = "Saving server settings...";
  $("settingsSaveBtn").disabled = true;
  try {
    const key = $("settingsKey").value.trim();
    const privateKey = $("settingsPrivateKey").value.trim();
    if (key && !isLikelyRustdeskPublicKey(key)) {
      throw new Error("Invalid public key. Use id_ed25519.pub, not id_ed25519 or a config string.");
    }
    if (privateKey && !isLikelyRustdeskPublicKey(privateKey)) {
      throw new Error("Invalid private key. Paste the matching id_ed25519 value.");
    }
    const data = await api("/api/admin/config/server", {
      method: "POST",
      body: JSON.stringify({
        id_server: $("settingsIdServer").value.trim(),
        relay_server: $("settingsRelayServer").value.trim(),
        api_server: $("settingsApiServer").value.trim(),
        key,
        server_private_key: privateKey,
      }),
    });
    state.config = data.config || state.config;
    renderConfig();
    $("settingsStatus").textContent = data.persisted
      ? "Saved. If you changed the server keypair, restart rustdesk-server and reconnect clients."
      : "Applied for this API process, but the config file was not updated. Check container permissions or Docker env overrides.";
    render();
  } catch (error) {
    $("settingsStatus").textContent = error.message;
  } finally {
    $("settingsSaveBtn").disabled = false;
  }
}

async function useMountedServerKey() {
  $("settingsStatus").textContent = "Loading mounted server key...";
  try {
    const config = await api("/api/admin/config/server");
    state.config = config || state.config;
    renderConfig();
    if (state.config.key) {
      $("settingsKey").value = state.config.key;
      $("settingsStatus").textContent = "Loaded the public key currently used by the mounted server keypair.";
    } else {
      $("settingsStatus").textContent = "No mounted server public key was found. Check /root/data/id_ed25519.pub in the API container mount.";
    }
  } catch (error) {
    $("settingsStatus").textContent = error.message;
  }
}

function isLikelyRustdeskPublicKey(key) {
  return /^[A-Za-z0-9+/=_-]{40,48}$/.test(key) && !/[\s]/.test(key);
}

function selectedWebV3DefaultPermissions() {
  return Array.from(document.querySelectorAll("[data-webv3-setting-permission]:checked")).map((item) => item.dataset.webv3SettingPermission);
}

async function saveWebV3Settings() {
  $("webV3SettingsStatus").textContent = "Saving Web v3 policy...";
  $("webV3SettingsSaveBtn").disabled = true;
  try {
    const permissions = selectedWebV3DefaultPermissions();
    if (!permissions.includes("view")) permissions.unshift("view");
    const data = await api("/api/admin/web-v3/settings", {
      method: "POST",
      body: JSON.stringify({
        enabled: $("webV3SettingEnabled").checked,
        default_share_expiration_secs: Number($("webV3DefaultShareExpiry").value || 3600),
        max_session_duration_secs: Number($("webV3MaxSessionDuration").value || 3600),
        allow_clipboard: $("webV3SettingClipboard").checked,
        allow_file_transfer: $("webV3SettingFileTransfer").checked,
        allow_terminal: $("webV3SettingTerminal").checked,
        require_login_for_direct_mode: $("webV3SettingRequireLogin").checked,
        allow_anonymous_share_access: $("webV3SettingAnonymousShare").checked,
        default_permissions: permissions,
      }),
    });
    state.webV3Settings = data.settings || state.webV3Settings;
    $("webV3SettingsStatus").textContent = data.persisted
      ? "Saved. New Web v3 sessions and shares will use this policy."
      : "Applied response received, but the server did not report persistence.";
    render();
  } catch (error) {
    $("webV3SettingsStatus").textContent = error.message;
  } finally {
    $("webV3SettingsSaveBtn").disabled = false;
  }
}

async function cleanupWebV3Sessions() {
  $("webV3CleanupStatus").textContent = "Cleaning stale sessions...";
  $("webV3CleanupSessionsBtn").disabled = true;
  try {
    const data = await api("/api/admin/web-v3/session/cleanup", {
      method: "POST",
      body: JSON.stringify({ stale_seconds: 300 }),
    });
    $("webV3CleanupStatus").textContent = `Cleaned ${data.cleaned || 0} stale sessions.`;
    await loadData();
  } catch (error) {
    $("webV3CleanupStatus").textContent = error.message;
  } finally {
    $("webV3CleanupSessionsBtn").disabled = false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[ch]));
}

async function boot() {
  renderAuth();
  if (!state.token) {
    await loadLoginOptions();
    return;
  }
  try {
    await loadData();
  } catch (error) {
    logout();
    $("loginError").textContent = error.message;
  }
}

$("loginForm").addEventListener("submit", login);
$("captchaRefresh").addEventListener("click", () => refreshCaptchaIfNeeded(true));
$("logoutBtn").addEventListener("click", logout);
$("refreshBtn").addEventListener("click", loadData);
$("deviceSearch").addEventListener("input", renderDevices);
$("myDeviceSearch").addEventListener("input", renderMyDevices);
$("manageSearch").addEventListener("input", renderResourceTable);
$("manageCreateBtn").addEventListener("click", () => {
  if (activeResource === "myInfo") openEditor(resourceConfigs.myInfo.template(), "edit");
  else openEditor(null, "create");
});
$("editorForm").addEventListener("submit", saveEditor);
$("editorCloseBtn").addEventListener("click", closeEditor);
$("editorDeleteBtn").addEventListener("click", () => editingRow && deleteResourceRow(editingRow));
$("webV3ShareForm").addEventListener("submit", submitWebV3Share);
$("webV3ShareCloseBtn").addEventListener("click", closeWebV3ShareModal);
$("webV3ShareCopyBtn").addEventListener("click", () => $("webV3ShareUrl").value && copyText($("webV3ShareUrl").value));
$("webV3ShareOpenBtn").addEventListener("click", () => $("webV3ShareUrl").value && window.open($("webV3ShareUrl").value, "_blank", "noopener,noreferrer"));
$("exportBackupBtn").addEventListener("click", exportBackup);
$("exportSelectiveBackupBtn").addEventListener("click", exportSelectiveBackup);
$("inspectBackupBtn").addEventListener("click", inspectBackup);
$("backupFile").addEventListener("change", () => setBackupInspect(""));
$("importBackupForm").addEventListener("submit", importBackup);
$("settingsSaveBtn").addEventListener("click", saveServerSettings);
$("settingsUseMountedKeyBtn").addEventListener("click", useMountedServerKey);
$("webV3SettingsSaveBtn").addEventListener("click", saveWebV3Settings);
$("webV3CleanupSessionsBtn").addEventListener("click", cleanupWebV3Sessions);
$("customClientGenerateBtn").addEventListener("click", generateCustomClientOutput);
$("customClientResetBtn").addEventListener("click", () => renderCustomClientBuilder(true));
$("customClientCopyConfigBtn").addEventListener("click", () => $("ccConfigString").value && copyText($("ccConfigString").value));
$("customClientCopyScriptBtn").addEventListener("click", () => $("ccWindowsScript").value && copyText($("ccWindowsScript").value));
$("customClientDownloadPackageBtn").addEventListener("click", downloadCustomClientPackage);
document.querySelectorAll("#customclientsView input, #customclientsView select, #customclientsView textarea").forEach((item) => {
  item.addEventListener("input", generateCustomClientOutput);
  item.addEventListener("change", generateCustomClientOutput);
});
$("showMyAddressBook").addEventListener("click", () => {
  state.addressBookMode = "mine";
  renderAddressBook();
});
$("showAllAddressBook").addEventListener("click", () => {
  state.addressBookMode = "all";
  renderAddressBook();
});
document.querySelectorAll("[data-view]").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));
document.querySelectorAll("[data-view-jump]").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.viewJump)));
document.querySelectorAll("[data-resource]").forEach((item) => item.addEventListener("click", () => switchResource(item.dataset.resource)));
document.querySelectorAll("[data-resource-shortcut]").forEach((item) => item.addEventListener("click", () => switchResource(item.dataset.resourceShortcut)));
document.addEventListener("click", async (event) => {
  const oauthBtn = event.target.closest("[data-oauth-op]");
  if (oauthBtn) {
    await startOauthLogin(oauthBtn.dataset.oauthOp);
    return;
  }
  const editBtn = event.target.closest("[data-edit-row]");
  if (editBtn) {
    openEditor(activeRows[Number(editBtn.dataset.editRow)], "edit");
    return;
  }
  const deleteBtn = event.target.closest("[data-delete-row]");
  if (deleteBtn) {
    await deleteResourceRow(activeRows[Number(deleteBtn.dataset.deleteRow)]);
    return;
  }
  const passwordBtn = event.target.closest("[data-password-row]");
  if (passwordBtn) {
    await changeUserPassword(activeRows[Number(passwordBtn.dataset.passwordRow)]);
    return;
  }
  const sendCmdBtn = event.target.closest("[data-send-cmd-row]");
  if (sendCmdBtn) {
    await sendServerCmd(activeRows[Number(sendCmdBtn.dataset.sendCmdRow)]);
    return;
  }
  const openBtn = event.target.closest("[data-open-webclient]");
  if (openBtn) {
    openWebClient(openBtn.dataset.openWebclient);
    return;
  }
  const openWebV3Btn = event.target.closest("[data-open-web-v3]");
  if (openWebV3Btn) {
    openWebV3(openWebV3Btn.dataset.openWebV3);
    return;
  }
  const copyDeployBtn = event.target.closest("[data-copy-deploy]");
  if (copyDeployBtn) {
    const target = $(copyDeployBtn.dataset.copyDeploy);
    if (target?.value) {
      await copyText(target.value);
      $("deploymentCopyStatus").textContent = "Copied.";
      window.setTimeout(() => {
        if ($("deploymentCopyStatus")) $("deploymentCopyStatus").textContent = "";
      }, 1800);
    }
    return;
  }
  const appBtn = event.target.closest("[data-open-rustdesk]");
  if (appBtn) {
    openRustDeskApp(appBtn.dataset.openRustdesk);
    return;
  }
  const shareWebV3Btn = event.target.closest("[data-share-web-v3]");
  if (shareWebV3Btn) {
    openWebV3ShareModal(shareWebV3Btn.dataset.shareWebV3, shareWebV3Btn.dataset.rowId || "");
    return;
  }
  const copyWebV3Btn = event.target.closest("[data-copy-web-v3-share]");
  if (copyWebV3Btn) {
    copyWebV3Btn.disabled = true;
    try {
      await copyWebV3Share(copyWebV3Btn.dataset.copyWebV3Share, copyWebV3Btn.dataset.rowId || "");
    } catch (error) {
      alert(error.message);
    } finally {
      copyWebV3Btn.disabled = false;
    }
    return;
  }
  const shareBtn = event.target.closest("[data-share-webclient]");
  if (shareBtn) {
    shareBtn.disabled = true;
    try {
      await shareWebClient(shareBtn.dataset.shareWebclient, false, shareBtn.dataset.rowId || "");
    } catch (error) {
      alert(error.message);
    } finally {
      shareBtn.disabled = false;
    }
    return;
  }
  const copyShareBtn = event.target.closest("[data-copy-share]");
  if (copyShareBtn) {
    copyShareBtn.disabled = true;
    try {
      await shareWebClient(copyShareBtn.dataset.copyShare, true, copyShareBtn.dataset.rowId || "");
    } catch (error) {
      alert(error.message);
    } finally {
      copyShareBtn.disabled = false;
    }
    return;
  }
  const saveBtn = event.target.closest("[data-save-address-book]");
  if (saveBtn) {
    saveBtn.disabled = true;
    try {
      await savePeerToAddressBook(saveBtn.dataset.saveAddressBook);
    } catch (error) {
      alert(error.message);
    } finally {
      saveBtn.disabled = false;
    }
  }
});

boot();
