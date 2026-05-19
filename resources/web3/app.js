const WEB3_BUILD = "20260519-input-layer1";
console.info("QT Desk Web v3 build", WEB3_BUILD);

const els = {
  shell: document.querySelector(".web3-shell"),
  hud: document.getElementById("hud"),
  hudToggle: document.getElementById("hudToggle"),
  hudPanel: document.getElementById("hudPanel"),
  hudPeerLabel: document.getElementById("hudPeerLabel"),
  infoToggle: document.getElementById("infoToggle"),
  hudClose: document.getElementById("hudClose"),
  peerTitle: document.getElementById("peerTitle"),
  sessionStatus: document.getElementById("sessionStatus"),
  connectBtn: document.getElementById("connectBtn"),
  disconnectBtn: document.getElementById("disconnectBtn"),
  reconnectBtn: document.getElementById("reconnectBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  captureHelpBtn: document.getElementById("captureHelpBtn"),
  qualitySelect: document.getElementById("qualitySelect"),
  scaleSelect: document.getElementById("scaleSelect"),
  fpsSelect: document.getElementById("fpsSelect"),
  displaySelect: document.getElementById("displaySelect"),
  cursorToggle: document.getElementById("cursorToggle"),
  muteToggle: document.getElementById("muteToggle"),
  clipboardToggle: document.getElementById("clipboardToggle"),
  videoCompatToggle: document.getElementById("videoCompatToggle"),
  monitorToggle: document.getElementById("monitorToggle"),
  directYuvToggle: document.getElementById("directYuvToggle"),
  stage: document.getElementById("stage"),
  remoteVideoCanvas: document.getElementById("remoteVideoCanvas"),
  remoteCanvas: document.getElementById("remoteCanvas"),
  qualityMonitor: document.getElementById("qualityMonitor"),
  monitorFps: document.getElementById("monitorFps"),
  monitorRender: document.getElementById("monitorRender"),
  monitorReceived: document.getElementById("monitorReceived"),
  monitorDecoder: document.getElementById("monitorDecoder"),
  monitorGl: document.getElementById("monitorGl"),
  monitorMode: document.getElementById("monitorMode"),
  monitorDropped: document.getElementById("monitorDropped"),
  monitorQuality: document.getElementById("monitorQuality"),
  capturePanel: document.getElementById("capturePanel"),
  captureFrames: document.getElementById("captureFrames"),
  captureRenderer: document.getElementById("captureRenderer"),
  captureVideoMode: document.getElementById("captureVideoMode"),
  captureLastFrame: document.getElementById("captureLastFrame"),
  captureDarkFrames: document.getElementById("captureDarkFrames"),
  captureTransport: document.getElementById("captureTransport"),
  captureAdvice: document.getElementById("captureAdvice"),
  copyCompatBtn: document.getElementById("copyCompatBtn"),
  copySafeBrowserBtn: document.getElementById("copySafeBrowserBtn"),
  copyMpoBtn: document.getElementById("copyMpoBtn"),
  connectPanel: document.getElementById("connectPanel"),
  connectForm: document.getElementById("connectForm"),
  connectPeerId: document.getElementById("connectPeerId"),
  connectPassword: document.getElementById("connectPassword"),
  connectHint: document.getElementById("connectHint"),
  connectPeerName: document.getElementById("connectPeerName"),
  connectSubmitBtn: document.getElementById("connectSubmitBtn"),
  loginBox: document.getElementById("loginBox"),
  loginState: document.getElementById("loginState"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  deviceList: document.getElementById("deviceList"),
  transportPanel: document.getElementById("transportPanel"),
  transportTitle: document.getElementById("transportTitle"),
  transportText: document.getElementById("transportText"),
  transportReconnectBtn: document.getElementById("transportReconnectBtn"),
  transportConnectBtn: document.getElementById("transportConnectBtn"),
  stageOverlay: document.getElementById("stageOverlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  sessionBar: document.getElementById("sessionBar"),
  peerId: document.getElementById("peerId"),
  permissions: document.getElementById("permissions"),
  expiresAt: document.getElementById("expiresAt"),
};

const state = {
  params: readParams(),
  session: null,
  config: null,
  settings: readClientSettings(),
  protocolLoaded: false,
  protocolLoading: null,
  connected: false,
  transportActive: false,
  stableConnection: false,
  connectAttemptStartedAt: 0,
  status: "preparing",
  manualDisconnect: false,
  reconnectAttempts: 0,
  reconnectTimer: null,
  lastDisconnectReason: "",
  lastTransportProblemAt: 0,
  lastTransportClose: "",
  transportCloseCount: 0,
  pendingPassword: "",
  awaitingPassword: false,
  remoteWidth: 1280,
  remoteHeight: 720,
  displays: [],
  framePending: false,
  queuedFrame: null,
  lastFrameAt: 0,
  lastFrameReceiveAt: 0,
  lastFrameRenderAt: 0,
  stallNotified: false,
  darkFrameStreak: 0,
  blackFrameNotified: false,
  targetFrameMs: 1000 / 20,
  droppedFrames: 0,
  yuvRenderer: null,
  yuvRendererMode: "none",
  yuvDirectAvailable: false,
  yuvDirectActive: false,
  legacyCpuYuv: false,
  lastMouseMoveAt: 0,
  mouseMovePending: false,
  queuedMouseMove: null,
  activeKeys: new Set(),
  wheelResidualX: 0,
  wheelResidualY: 0,
  wheelFlushPending: false,
  wheelLastAt: 0,
  wheelLastSignX: 0,
  wheelLastSignY: 0,
  wheelModifiers: null,
  hudOpen: false,
  infoOpen: false,
  captureHelpOpen: false,
  webToken: localStorage.getItem("qt_web3_token") || localStorage.getItem("rd_admin_token") || "",
  webUser: localStorage.getItem("qt_web3_user") || "",
  devices: [],
  addressBookPeers: null,
  hudPosition: readHudPosition(),
  hudButtonPosition: readHudButtonPosition(),
  hudButtonDrag: null,
  suppressNextHudToggle: false,
  hudDrag: null,
  stats: {
    framesReceived: 0,
    framesRendered: 0,
    framesRenderedLast: 0,
    droppedFrames: 0,
    renderMs: 0,
    decoderMs: 0,
    glMs: 0,
    fps: 0,
    lastBrightness: 0,
    darkFrames: 0,
    lastSampleAt: performance.now(),
  },
};

window.onGlobalEvent = handleProtocolEvent;
window.onRgba = handleRgbaFrame;
window.qtDeskSetSetting = (...args) => updateClientSetting(...args);
window.qtDeskStartHudDrag = (event) => startHudDrag(event);
window.qtDeskToggleHud = () => toggleHud();
renderRouteIdentity();
applyClientSettingsToUi();
applyClientSettings();
renderLoginState();

function readParams() {
  const raw = window.location.hash.includes("?")
    ? window.location.hash.slice(window.location.hash.indexOf("?") + 1)
    : window.location.search.slice(1);
  return Object.fromEntries(new URLSearchParams(raw));
}

function renderRouteIdentity() {
  const label = state.params.id || state.params.session_id || (state.params.share_token ? "shared desktop" : "remote desktop");
  els.connectPeerName.textContent = label;
  els.peerTitle.textContent = label === "remote desktop" ? "Web v3" : label;
  els.hudPeerLabel.textContent = label === "remote desktop" ? "Web v3" : label;
  if (state.params.id && els.connectPeerId) els.connectPeerId.value = state.params.id;
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  if (body?.code && body.code !== 0) throw new Error(body.message || "Request failed");
  return body?.data ?? body;
}

function adminBearer() {
  const token = state.webToken || localStorage.getItem("qt_web3_token") || localStorage.getItem("rd_admin_token") || "";
  return token ? `Bearer ${token}` : "";
}

async function loadAddressBookPeers(force = false) {
  if (!force && Array.isArray(state.addressBookPeers)) return state.addressBookPeers;
  const bearer = adminBearer();
  if (!bearer) return [];
  const data = await api("/api/ab", { headers: { Authorization: bearer } });
  let addressBook = data;
  if (typeof addressBook === "string") {
    addressBook = JSON.parse(addressBook || "{}");
  }
  const peers = Array.isArray(addressBook?.peers)
    ? addressBook.peers
    : Array.isArray(addressBook?.list)
      ? addressBook.list
      : [];
  state.addressBookPeers = peers;
  return peers;
}

function findSavedAddressBookCredential(peerId, peers) {
  const match = peers.find((peer) => String(peer.id || peer.Id || "") === String(peerId || ""));
  const password = match?.password || match?.Password || "";
  if (typeof password === "string" && password.trim()) {
    const trimmed = password.trim();
    if (/^\d+(,\d+)*$/.test(trimmed)) return { type: "hashed", value: trimmed };
    return { type: "plain", value: password };
  }
  const hash = match?.hash || match?.Hash || "";
  const decodedHash = decodeAddressBookHash(hash);
  return decodedHash ? { type: "hashed", value: decodedHash } : null;
}

function decodeAddressBookHash(hash) {
  if (typeof hash !== "string" || !hash.trim()) return "";
  try {
    const decoded = window.atob(hash.trim());
    return Array.from(decoded, (ch) => ch.charCodeAt(0)).join(",");
  } catch {
    return "";
  }
}

function seedProtocolStoredPassword(peerId, encodedPassword) {
  if (!peerId || !encodedPassword) return;
  const peers = readProtocolPeers();
  peers[peerId] = {
    ...(peers[peerId] || {}),
    password: encodedPassword,
    remember: true,
    tm: Date.now(),
  };
  localStorage.setItem("peers", JSON.stringify(peers));
}

async function prefillSavedRemotePassword(peerId, { silent = false } = {}) {
  if (!peerId || els.connectPassword.value) return false;
  try {
    const peers = await loadAddressBookPeers();
    const credential = findSavedAddressBookCredential(peerId, peers);
    if (!credential) {
      if (!silent) {
        els.connectHint.textContent = "Signed in. This device has no saved address-book password, so the remote password or remote approval is still required.";
      }
      return false;
    }
    if (credential.type === "hashed") {
      seedProtocolStoredPassword(peerId, credential.value);
      els.connectPassword.value = "";
      state.pendingPassword = "";
    } else {
      els.connectPassword.value = credential.value;
      state.pendingPassword = credential.value;
    }
    if (!silent) {
      els.connectHint.textContent = "Saved address-book credential loaded. Connect when ready.";
    }
    return true;
  } catch (error) {
    if (!silent) els.connectHint.textContent = `Could not load saved password: ${error.message}`;
    return false;
  }
}

function setWebToken(token, user = "") {
  state.webToken = token || "";
  state.webUser = user || state.webUser || "";
  state.addressBookPeers = null;
  if (state.webToken) {
    localStorage.setItem("qt_web3_token", state.webToken);
    if (state.webUser) localStorage.setItem("qt_web3_user", state.webUser);
  } else {
    localStorage.removeItem("qt_web3_token");
    localStorage.removeItem("qt_web3_user");
  }
  renderLoginState();
}

function renderLoginState() {
  const signedIn = Boolean(state.webToken);
  els.loginState.textContent = signedIn ? `Signed in${state.webUser ? ` as ${state.webUser}` : ""}` : "Not signed in";
  els.loginBtn.hidden = signedIn;
  els.logoutBtn.hidden = !signedIn;
  els.loginUsername.disabled = signedIn;
  els.loginPassword.disabled = signedIn;
  if (signedIn) els.loginBox.open = true;
}

function readClientSettings() {
  const defaults = {
    imageQuality: "balanced",
    scale: "adaptive",
    maxFps: 30,
    showRemoteCursor: true,
    mute: true,
    disableClipboard: false,
    videoCompatibility: false,
    directYuv: true,
    lockAfterSessionEnd: false,
    privacyMode: false,
    showMonitor: false,
  };
  try {
    const saved = JSON.parse(localStorage.getItem("qt_desk_web3_settings")) || {};
    const settings = { ...defaults, ...saved };
    if (settings.rendererResetBuild !== WEB3_BUILD) {
      settings.directYuv = true;
      settings.videoCompatibility = false;
      if (settings.imageQuality === "low") settings.imageQuality = "balanced";
      if ((Number(settings.maxFps) || 0) < 30) settings.maxFps = 30;
      settings.rendererResetBuild = WEB3_BUILD;
      localStorage.setItem("qt_desk_web3_settings", JSON.stringify(settings));
    }
    return settings;
  } catch {
    return defaults;
  }
}

function readHudPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem("qt_desk_web3_hud") || "null");
    if (!saved || typeof saved.left !== "number" || typeof saved.top !== "number") return null;
    return saved;
  } catch {
    return null;
  }
}

function readHudButtonPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem("qt_desk_web3_menu") || "null");
    if (!saved || typeof saved.left !== "number" || typeof saved.top !== "number") return null;
    return saved;
  } catch {
    return null;
  }
}

function saveHudPosition() {
  if (!state.hudPosition) {
    localStorage.removeItem("qt_desk_web3_hud");
    return;
  }
  localStorage.setItem("qt_desk_web3_hud", JSON.stringify(state.hudPosition));
}

function saveHudButtonPosition() {
  if (!state.hudButtonPosition) {
    localStorage.removeItem("qt_desk_web3_menu");
    return;
  }
  localStorage.setItem("qt_desk_web3_menu", JSON.stringify(state.hudButtonPosition));
}

function saveClientSettings() {
  localStorage.setItem("qt_desk_web3_settings", JSON.stringify(state.settings));
}

function applyClientSettingsToUi() {
  els.qualitySelect.value = state.settings.imageQuality;
  els.scaleSelect.value = state.settings.scale;
  els.fpsSelect.value = String(state.settings.maxFps);
  els.cursorToggle.checked = Boolean(state.settings.showRemoteCursor);
  els.muteToggle.checked = Boolean(state.settings.mute);
  els.clipboardToggle.checked = Boolean(state.settings.disableClipboard);
  els.videoCompatToggle.checked = Boolean(state.settings.videoCompatibility);
  els.directYuvToggle.checked = Boolean(state.settings.directYuv);
  els.monitorToggle.checked = Boolean(state.settings.showMonitor);
}

function applyClientSettings() {
  state.targetFrameMs = 1000 / Math.max(1, Number(state.settings.maxFps) || 20);
  els.stage.dataset.scale = state.settings.scale;
  setMonitorVisible(Boolean(state.settings.showMonitor));
  els.monitorQuality.textContent = qualityLabel(state.settings.imageQuality);
  applyClientSettingsToUi();
  applyCanvasAspect();
  if (state.session?.peer_id) seedProtocolPeerOptions(state.session.peer_id);
  prepareProtocolConnection();
}

async function bootstrap() {
  showConnectPanel("Preparing the web session...");
  setStatus("preparing", "Preparing session", "Connecting to Web v3 backend");
  clearRemoteCanvas();

  try {
    state.config = await api("/api/web-v3/config");
    let session;
    const typedPeerId = (els.connectPeerId?.value || "").trim();
    if (state.params.session_id) {
      session = await api(`/api/web-v3/session/${encodeURIComponent(state.params.session_id)}`);
    } else if (state.params.share_token) {
      session = await api("/api/web-v3/session", {
        method: "POST",
        body: JSON.stringify({ share_token: state.params.share_token }),
      });
    } else if (state.params.id || typedPeerId) {
      const bearer = adminBearer();
      if (!bearer) throw new Error("Sign in first, or ask admin to allow direct Web v3 mode without login.");
      const peerId = state.params.id || typedPeerId;
      session = await api("/api/web-v3/session", {
        method: "POST",
        headers: { Authorization: bearer },
        body: JSON.stringify({ peer_id: peerId }),
      });
      state.params.id = peerId;
    } else {
      setStatus("preparing", "Choose a device", "Enter a remote ID or sign in to list devices");
      showConnectPanel(state.webToken ? "Enter a remote ID or choose one of your devices." : "Enter a remote ID. Sign in first if direct mode requires login.");
      if (state.webToken) loadWebDevices().catch((error) => {
        els.connectHint.textContent = error.message;
      });
      return;
    }
    state.session = session;
    renderSession(session);
    seedProtocolLocalStorage(session, state.config);
    const loadedSavedPassword = await prefillSavedRemotePassword(session.peer_id, { silent: true });
    setStatus(session.status || "preparing", "Ready to connect", loadedSavedPassword ? "Saved address-book credential loaded" : "Enter the remote password and connect");
    showConnectPanel(loadedSavedPassword ? "Saved address-book credential loaded. Start the web session." : "Enter the remote password, then start the web session.");
  } catch (error) {
    setStatus("error", "Unable to open session", error.message);
    showConnectPanel(error.message);
    clearRemoteCanvas();
  }
}

async function refreshSession() {
  if (!state.session?.session_id) {
    await bootstrap();
    return;
  }
  try {
    const session = await api(`/api/web-v3/session/${encodeURIComponent(state.session.session_id)}/refresh`, { method: "POST" });
    state.session = session;
    renderSession(session);
    setStatus(session.status || "preparing", "Session refreshed", "Waiting for remote transport");
  } catch (error) {
    setStatus("error", "Refresh failed", error.message);
  }
}

async function reconnectRemote() {
  clearReconnectTimer();
  if (state.session?.session_id) {
    await refreshSession();
  }
  await connectRemote();
}

function renderSession(session) {
  const label = session.peer_name || session.peer_id || "Web v3";
  els.peerTitle.textContent = label;
  els.hudPeerLabel.textContent = label;
  els.connectPeerName.textContent = label;
  if (session.peer_id && els.connectPeerId) els.connectPeerId.value = session.peer_id;
  els.peerId.textContent = session.peer_id || "-";
  els.permissions.textContent = Array.isArray(session.permissions) ? session.permissions.join(", ") : "-";
  els.expiresAt.textContent = session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : "-";
}

function seedProtocolLocalStorage(session, config) {
  if (config?.rendezvous_server) localStorage.setItem("custom-rendezvous-server", browserReachableServer(config.rendezvous_server));
  if (config?.public_key) localStorage.setItem("key", config.public_key);
  if (session?.peer_id) {
    localStorage.setItem("remote-id", session.peer_id);
    seedProtocolPeerOptions(session.peer_id);
  }
  const adminToken = state.webToken || localStorage.getItem("qt_web3_token") || localStorage.getItem("rd_admin_token") || "";
  if (adminToken) localStorage.setItem("access_token", adminToken);
  else if (session?.ws_token) localStorage.setItem("access_token", session.ws_token);
}

function seedProtocolPeerOptions(peerId) {
  const peers = readProtocolPeers();
  peers[peerId] = {
    ...(peers[peerId] || {}),
    "image-quality": state.settings.imageQuality,
    "disable-audio": Boolean(state.settings.mute),
    "disable-clipboard": Boolean(state.settings.disableClipboard),
    "show-remote-cursor": Boolean(state.settings.showRemoteCursor),
    "lock-after-session-end": Boolean(state.settings.lockAfterSessionEnd),
    "privacy-mode": Boolean(state.settings.privacyMode),
    "view-style": state.settings.scale === "original" ? "original" : state.settings.scale === "stretch" ? "stretch" : "shrink",
  };
  localStorage.setItem("peers", JSON.stringify(peers));
}

function qualityLabel(value) {
  if (value === "low") return "Fast";
  if (value === "best") return "Quality";
  return "Balanced";
}

function readProtocolPeers() {
  try {
    return JSON.parse(localStorage.getItem("peers")) || {};
  } catch {
    return {};
  }
}

function browserReachableServer(server) {
  const pageHost = window.location.hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(pageHost)) return server;
  const parts = String(server).split(":");
  const port = parts.length > 1 ? parts[parts.length - 1] : "";
  return port ? `${pageHost}:${port}` : server;
}

function setStatus(status, title, text) {
  state.status = status;
  els.sessionStatus.textContent = status;
  els.sessionStatus.classList.toggle("ready", status !== "error");
  els.sessionStatus.classList.toggle("error", status === "error");
  const panelOpen = !els.connectPanel.hidden || !els.transportPanel.hidden;
  els.stageOverlay.style.display = status === "connected" || panelOpen ? "none" : "grid";
  els.overlayTitle.textContent = title;
  els.overlayText.textContent = text;
  if (status === "connected" || status === "connecting" || status === "reconnecting") {
    hideTransportPanel();
  }
  if (status === "connected") {
    hideConnectPanel();
    setHudOpen(false);
  }
}

function clearRemoteCanvas() {
  setDirectYuvMode(false);
  for (const canvas of [els.remoteVideoCanvas, els.remoteCanvas]) {
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function showConnectPanel(message = "", focusPassword = false) {
  hideTransportPanel();
  els.connectPanel.hidden = false;
  els.stage.classList.add("preconnect");
  els.stageOverlay.style.display = "none";
  els.connectHint.textContent = message || "Enter the remote password, then start the web session.";
  if (focusPassword) {
    window.setTimeout(() => els.connectPassword.focus({ preventScroll: true }), 50);
  } else if (!state.session?.peer_id && els.connectPeerId) {
    window.setTimeout(() => els.connectPeerId.focus({ preventScroll: true }), 50);
  }
}

function hideConnectPanel() {
  els.connectPanel.hidden = true;
  els.stage.classList.remove("preconnect");
}

function showTransportPanel(title, text) {
  if (!els.connectPanel.hidden) return;
  els.transportTitle.textContent = title || "Connection interrupted";
  els.transportText.textContent = text || "The remote stream stopped unexpectedly.";
  els.transportPanel.hidden = false;
  els.stageOverlay.style.display = "none";
}

function hideTransportPanel() {
  els.transportPanel.hidden = true;
}

async function loadProtocolRuntime() {
  if (state.protocolLoaded) return;
  if (state.protocolLoading) return state.protocolLoading;
  state.protocolLoading = (async () => {
    installPublicProbeBlocker();
    installProtocolMetricCapture();
    await loadScript("/webclient/ogvjs-1.8.6/ogv.js");
    await loadScript("/webclient/yuv-canvas-1.2.6.js");
    initVisibleYuvRenderer();
    await loadModule("/webclient/js/dist/index.js");
    if (typeof window.init === "function") {
      await window.init();
    }
    state.protocolLoaded = true;
  })();
  return state.protocolLoading;
}

function installProtocolMetricCapture() {
  if (window.__qtDeskConsolePatched) return;
  const nativeLog = console.log.bind(console);
  const nativeWarn = console.warn.bind(console);
  const nativeError = console.error.bind(console);
  console.log = (...args) => {
    captureProtocolMetric(args);
    nativeLog(...args);
  };
  console.warn = (...args) => {
    captureProtocolMetric(args);
    captureProtocolConsoleIssue(args);
    nativeWarn(...args);
  };
  console.error = (...args) => {
    captureProtocolMetric(args);
    captureProtocolConsoleIssue(args);
    nativeError(...args);
  };
  window.__qtDeskConsolePatched = true;
}

function captureProtocolMetric(args) {
  for (const arg of args) {
    const text = String(arg);
    const decoder = text.match(/video decoder:\s*(\d+)/i);
    if (decoder) state.stats.decoderMs = Number(decoder[1]);
    const gl = text.match(/^gl:\s*(\d+)/i);
    if (gl) state.stats.glMs = Number(gl[1]);
  }
}

function captureProtocolConsoleIssue(args) {
  const text = args.map((arg) => String(arg?.message || arg || "")).join(" ");
  if (!text.includes("WebSocket is already in CLOSING or CLOSED state")) return;
  markTransportProblem("The browser transport is closed but the protocol layer is still trying to send data.", { autoReconnect: true });
}

function installPublicProbeBlocker() {
  if (window.__qtDeskWebSocketPatched) return;
  const NativeWebSocket = window.WebSocket;
  const blockedHosts = new Set(["rs-sg.rustdesk.com", "rs-cn.rustdesk.com", "rs-us.rustdesk.com"]);
  const blockedReasons = ["Failed to connect to rendezvous server", "Timeout"];
  window.addEventListener("unhandledrejection", (event) => {
    const reason = String(event.reason || "");
    if (blockedReasons.some((blocked) => reason.includes(blocked)) && (state.protocolLoading || state.protocolLoaded || state.connected)) {
      event.preventDefault();
    }
  });

  class QuietBlockedWebSocket {
    constructor(url) {
      this.url = String(url);
      this.readyState = NativeWebSocket.CLOSED;
      this.binaryType = "arraybuffer";
    }
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return false; }
  }

  function PatchedWebSocket(url, protocols) {
    try {
      const parsed = new URL(String(url));
      if (blockedHosts.has(parsed.hostname) && parsed.port === "21118") {
        return new QuietBlockedWebSocket(url);
      }
      const socket = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
      watchRustDeskSocket(socket, parsed);
      return socket;
    } catch {
      // Fall through to the native constructor.
    }
    return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
  }

  PatchedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
  PatchedWebSocket.OPEN = NativeWebSocket.OPEN;
  PatchedWebSocket.CLOSING = NativeWebSocket.CLOSING;
  PatchedWebSocket.CLOSED = NativeWebSocket.CLOSED;
  PatchedWebSocket.prototype = NativeWebSocket.prototype;
  window.WebSocket = PatchedWebSocket;
  window.__qtDeskWebSocketPatched = true;
}

function watchRustDeskSocket(socket, parsed) {
  if (!["21118", "21119"].includes(parsed.port)) return;
  const endpoint = parsed.port === "21118" ? "rendezvous" : "relay";
  const label = `${endpoint} ${parsed.host}`;
  socket.addEventListener("open", () => {
    state.lastTransportProblemAt = 0;
  });
  socket.addEventListener("error", () => {
    markTransportProblem(`Could not reach the ${label} WebSocket.`, { autoReconnect: false, delayMs: 250 });
  });
  socket.addEventListener("close", (event) => {
    state.transportCloseCount += 1;
    state.lastTransportClose = `${endpoint} ${event.wasClean ? "clean" : "unclean"} ${event.code || "unknown"}`;
    if (isBenignSocketClose(endpoint, event)) return;
    const detail = event.reason || `code ${event.code || "unknown"}`;
    const clean = event.wasClean ? "closed cleanly" : "closed unexpectedly";
    markTransportProblem(`The ${label} WebSocket ${clean} (${detail}).`, { autoReconnect: true, delayMs: 250 });
  });
}

function isBenignSocketClose(endpoint, event) {
  const code = Number(event.code || 0);
  const normalOrEmptyClose = event.wasClean || code === 1000 || code === 1005;
  if (!normalOrEmptyClose) return false;
  if (state.manualDisconnect) return true;
  if (endpoint === "rendezvous" && (state.transportActive || state.connected)) return true;
  if (!state.connected && !state.transportActive && state.stats.framesRendered === 0) return true;
  if (endpoint === "relay" && ["preparing", "connecting", "reconnecting"].includes(state.status) && state.stats.framesRendered === 0) return true;
  return false;
}

function markTransportProblem(reason, options = {}) {
  if (state.manualDisconnect) return;
  const now = performance.now();
  const delayMs = Number(options.delayMs || 0);
  if (delayMs) {
    window.setTimeout(() => markTransportProblem(reason, { ...options, delayMs: 0 }), delayMs);
    return;
  }
  if (state.manualDisconnect) return;
  if (now - state.lastTransportProblemAt < 1000) return;
  state.lastTransportProblemAt = now;
  state.transportActive = false;
  if (options.autoReconnect && canAutoReconnect()) {
    scheduleReconnect("Connection interrupted", reason);
    return;
  }
  state.connected = false;
  setStatus("error", "Connection interrupted", reason);
  showTransportPanel("Connection interrupted", `${reason} The remote session was not stable yet, so QT Desk will not retry automatically.`);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadModule(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function initVisibleYuvRenderer() {
  if (state.yuvRenderer || !window.YUVCanvas || !els.remoteVideoCanvas) return;
  try {
    const useWebGl = Boolean(window.YUVCanvas.WebGLFrameSink?.isAvailable?.());
    state.yuvRenderer = window.YUVCanvas.attach(els.remoteVideoCanvas, { webGL: useWebGl });
    state.yuvRendererMode = useWebGl ? "webgl" : "software";
    state.yuvDirectAvailable = Boolean(state.yuvRenderer?.drawFrame);
    console.info(`QT Desk Web v3: Direct YUV visible renderer using ${state.yuvRendererMode}`);
  } catch (error) {
    console.warn("YUV direct renderer unavailable", error);
    state.yuvRenderer = null;
    state.yuvRendererMode = "none";
    state.yuvDirectAvailable = false;
  }
}

function forceLegacyCpuYuvRenderer() {
  const sink = window.YUVCanvas?.WebGLFrameSink;
  if (!sink || sink.__qtDeskCpuForced) return;
  const original = typeof sink.isAvailable === "function" ? sink.isAvailable.bind(sink) : null;
  sink.__qtDeskOriginalIsAvailable = original;
  sink.isAvailable = () => false;
  sink.__qtDeskCpuForced = true;
  state.legacyCpuYuv = true;
  console.info("QT Desk Web v3: legacy WebClient WebGL readback disabled; using CPU YUV conversion");
}

async function connectRemote() {
  if (!state.session?.peer_id) {
    await bootstrap();
  }
  if (!state.session?.peer_id) return;
  try {
    clearReconnectTimer();
    state.manualDisconnect = false;
    state.stableConnection = false;
    state.connectAttemptStartedAt = performance.now();
    state.pendingPassword = els.connectPassword.value || state.pendingPassword || "";
    state.awaitingPassword = false;
    hideConnectPanel();
    clearRemoteCanvas();
    setStatus("connecting", "Connecting", "Loading RustDesk web transport");
    seedProtocolLocalStorage(state.session, state.config);
    await loadProtocolRuntime();
    if (typeof window.setByName !== "function") {
      throw new Error("RustDesk web transport did not initialize");
    }
    sendProtocolCommand("connect", state.session.peer_id, {
      retries: 20,
      delayMs: 150,
      onRetry: () => setStatus("connecting", "Connecting", "Waiting for the browser transport"),
      onFailed: (error) => {
        const message = friendlyTransportError(error);
        setStatus("error", "Connection failed", message);
        showConnectPanel(message, true);
      },
    });
    prepareProtocolConnection();
    window.setTimeout(prepareProtocolConnection, 500);
    window.setTimeout(prepareProtocolConnection, 1500);
  } catch (error) {
    setStatus("error", "Connection failed", error.message);
    showConnectPanel(error.message);
  }
}

function prepareProtocolConnection() {
  const conn = window.curConn;
  if (!conn) return;
  conn.setDraw?.((frame) => queueYuvFrame(frame));
  syncProtocolOptionsLocal(conn);
}

function syncProtocolOptionsLocal(conn = window.curConn) {
  if (!conn) return;
  conn.setOption?.("image-quality", state.settings.imageQuality);
  conn.setOption?.("disable-audio", Boolean(state.settings.mute));
  conn.setOption?.("disable-clipboard", Boolean(state.settings.disableClipboard));
  conn.setOption?.("show-remote-cursor", Boolean(state.settings.showRemoteCursor));
  conn.setOption?.("lock-after-session-end", Boolean(state.settings.lockAfterSessionEnd));
  conn.setOption?.("privacy-mode", Boolean(state.settings.privacyMode));
}

function canSendLiveProtocolCommand() {
  return Boolean(
    window.curConn &&
    state.connected &&
    state.stableConnection &&
    state.stats.framesRendered > 0 &&
    !state.awaitingPassword &&
    !state.manualDisconnect
  );
}

function sendLiveProtocolSetting(name, value) {
  if (!canSendLiveProtocolCommand()) return;
  const conn = window.curConn;
  if (name === "imageQuality") {
    conn.setImageQuality?.(value);
  }
}

async function loginWeb3() {
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;
  if (!username || !password) {
    els.connectHint.textContent = "Enter username and password first.";
    return;
  }
  els.loginBtn.disabled = true;
  els.connectHint.textContent = "Signing in...";
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        id: "web3",
        uuid: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        deviceInfo: { name: "QT Desk Web v3", os: navigator.platform || "web", type: "web" },
      }),
    });
    const token = data.access_token || data.token || "";
    if (!token) throw new Error("Login succeeded but no access token was returned.");
    setWebToken(token, data.user?.username || username);
    els.loginPassword.value = "";
    els.connectHint.textContent = `Signed in as ${state.webUser || username}. Choose a device or enter an ID.`;
    await loadWebDevices();
    const selectedPeerId = (els.connectPeerId?.value || state.params.id || "").trim();
    if (selectedPeerId) await prefillSavedRemotePassword(selectedPeerId, { silent: false });
  } catch (error) {
    els.connectHint.textContent = error.message;
  } finally {
    els.loginBtn.disabled = false;
  }
}

function logoutWeb3() {
  stopTransportAndReturn("Signed out. Sign in again or enter a share link.");
  setWebToken("", "");
  state.devices = [];
  state.addressBookPeers = null;
  state.session = null;
  state.params.id = "";
  els.connectPeerId.value = "";
  els.deviceList.innerHTML = "";
  els.loginUsername.disabled = false;
  els.loginPassword.disabled = false;
}

function stopTransportAndReturn(message) {
  state.manualDisconnect = true;
  clearReconnectTimer();
  state.reconnectAttempts = 0;
  state.connected = false;
  state.transportActive = false;
  state.stableConnection = false;
  state.awaitingPassword = false;
  if (typeof window.setByName === "function") {
    window.setByName("close", "");
  }
  setStatus("disconnected", "Connection stopped", message || "Connection stopped by user");
  showConnectPanel(message || "Connection stopped. Choose a device or enter an ID.");
}

async function loadWebDevices() {
  const bearer = adminBearer();
  if (!bearer) return;
  const [peers] = await Promise.all([
    api("/api/peers?page=1&pageSize=200", { headers: { Authorization: bearer } }),
    loadAddressBookPeers(true).catch(() => []),
  ]);
  state.devices = Array.isArray(peers) ? peers : Array.isArray(peers?.data) ? peers.data : [];
  renderWebDeviceList();
}

function renderWebDeviceList() {
  if (!els.deviceList) return;
  if (!state.devices.length) {
    els.deviceList.innerHTML = `<p>No accessible devices found.</p>`;
    return;
  }
  els.deviceList.innerHTML = state.devices.map((peer) => {
    const name = peer.info?.device_name || peer.id;
    const meta = [peer.info?.username, peer.info?.os, peer.device_group_name].filter(Boolean).join(" / ");
    const note = peer.same_client_ip ? "Same network/IP as this browser" : peer.last_online_ip ? `Last IP ${peer.last_online_ip}` : "";
    return `
      <button class="device-choice" type="button" data-peer-id="${escapeHtml(peer.id)}">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(peer.id)}${meta ? " - " + escapeHtml(meta) : ""}</span>
        ${note ? `<em>${escapeHtml(note)}</em>` : ""}
      </button>
    `;
  }).join("");
}

function chooseWebDevice(peerId) {
  state.params.id = peerId;
  state.session = null;
  els.connectPeerId.value = peerId;
  els.connectPassword.value = "";
  state.pendingPassword = "";
  els.connectPeerName.textContent = peerId;
  els.peerTitle.textContent = peerId;
  els.hudPeerLabel.textContent = peerId;
  els.connectHint.textContent = "Device selected. Checking saved address-book password...";
  prefillSavedRemotePassword(peerId).catch(() => {});
  els.connectPassword.focus({ preventScroll: true });
}

function disconnectRemote() {
  stopTransportAndReturn("Session closed. Enter the password again when you are ready.");
}

function handleProtocolEvent(raw) {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return;
  }
  if (event.name === "msgbox") {
    handleProtocolMsgbox(event);
  } else if (event.name === "peer_info") {
    handlePeerInfoEvent(event);
  } else if (event.name === "connection_ready") {
    state.transportActive = true;
    state.reconnectAttempts = 0;
    setStatus("connecting", "Relay connected", "Completing secure handshake");
  }
}

function handleProtocolMsgbox(event) {
  const type = event.type || "";
  const title = event.title || "";
  const text = event.text || "";
  if (type === "input-password" || type === "re-input-password") {
    state.awaitingPassword = true;
    if (type === "re-input-password") {
      state.pendingPassword = "";
      els.connectPassword.value = "";
      setStatus("disconnected", "Password required", "The remote password was rejected");
      showConnectPanel("Password incorrect. Try again.", true);
      return;
    }
    const password = state.pendingPassword || els.connectPassword.value || "";
    if (password) {
      sendPasswordToProtocol(password);
    } else {
      setStatus("disconnected", "Password required", "Enter the remote password to continue");
      showConnectPanel("Password required. Enter it here to continue.", true);
    }
    return;
  }
  if (type === "error") {
    if (isNonFatalProtocolNoise(title, text)) return;
    if (isRemoteRejectedOrCancelled(title, text)) {
      state.transportActive = false;
      state.connected = false;
      state.stableConnection = false;
      setStatus("disconnected", title || "Remote cancelled", text || "The remote side rejected or cancelled the request");
      showConnectPanel("The remote side cancelled or rejected the request. QT Desk will not retry automatically.");
      return;
    }
    if (shouldAutoReconnect(title, text)) {
      scheduleReconnect(title, text);
      return;
    }
    state.transportActive = false;
    state.connected = false;
    setStatus("error", title || "Connection error", text || "Remote connection failed");
    return;
  }
  if (!type) {
    state.transportActive = true;
    setStatus("connecting", "Handshake complete", "Waiting for remote image");
    return;
  }
  setStatus(type, title || type, text || "Working");
}

function sendPasswordToProtocol(password) {
  if (!password || typeof window.setByName !== "function") {
    showConnectPanel("Password required. Enter it here to continue.", true);
    return;
  }
  state.pendingPassword = password;
  state.awaitingPassword = false;
  hideConnectPanel();
  setStatus("connecting", "Password queued", "Waiting for the secure channel");
  sendProtocolCommand("login", JSON.stringify({ password, remember: "false" }), {
    retries: 24,
    delayMs: 150,
    onRetry: () => setStatus("connecting", "Password queued", "Waiting for the secure channel"),
    onFailed: (error) => {
      state.awaitingPassword = true;
      setStatus("disconnected", "Password not sent", friendlyTransportError(error));
      showConnectPanel("The connection was not ready yet. Check the password and try Connect again.", true);
    },
  });
}

function sendProtocolCommand(name, payload, options = {}) {
  if (typeof window.setByName !== "function") {
    const error = new Error("RustDesk web transport is not ready yet");
    options.onFailed?.(error);
    if (!options.onFailed) throw error;
    return false;
  }
  try {
    window.setByName(name, payload);
    return true;
  } catch (error) {
    const message = String(error?.message || error || "");
    const retryable = message.includes("CONNECTING") && Number(options.retries || 0) > 0;
    if (retryable) {
      options.onRetry?.(error);
      window.setTimeout(() => {
        if (state.manualDisconnect) return;
        sendProtocolCommand(name, payload, { ...options, retries: Number(options.retries || 0) - 1 });
      }, Number(options.delayMs || 150));
      return false;
    }
    options.onFailed?.(error);
    if (!options.onFailed) throw error;
    return false;
  }
}

function friendlyTransportError(error) {
  const message = String(error?.message || error || "");
  if (message.includes("CONNECTING")) return "The browser transport is still opening. Try again in a moment.";
  if (message.includes("CLOSING") || message.includes("CLOSED")) return "The browser transport has already closed. Reconnect to start a fresh session.";
  return message || "The browser transport is not ready.";
}

function isNonFatalProtocolNoise(title, text) {
  if (!state.connected) return false;
  const message = `${title || ""} ${text || ""}`;
  return [
    "Timeout",
    "Failed to connect to rendezvous server",
    "Failed to connect via rendezvous server",
    "Failed to connect to relay server",
  ].some((needle) => message.includes(needle));
}

function shouldAutoReconnect(title, text) {
  if (state.manualDisconnect || state.reconnectAttempts >= 3) return false;
  if (!canAutoReconnect()) return false;
  if (isRemoteRejectedOrCancelled(title, text)) return false;
  const message = `${title || ""} ${text || ""}`;
  return [
    "Reset by the peer",
    "Connection Error",
    "close",
    "closed",
    "1006",
    "abnormal",
  ].some((needle) => message.toLowerCase().includes(needle.toLowerCase()));
}

function canAutoReconnect() {
  return Boolean(
    state.stableConnection &&
    state.stats.framesRendered > 0 &&
    state.lastFrameRenderAt >= state.connectAttemptStartedAt &&
    !state.awaitingPassword &&
    !state.manualDisconnect
  );
}

function isRemoteRejectedOrCancelled(title, text) {
  const message = `${title || ""} ${text || ""}`.toLowerCase();
  return [
    "cancel",
    "reject",
    "denied",
    "refused",
    "permission",
    "not allowed",
    "closed by the peer",
  ].some((needle) => message.includes(needle));
}

function scheduleReconnect(title, text) {
  clearReconnectTimer();
  if (!canAutoReconnect()) {
    state.connected = false;
    state.transportActive = false;
    const reason = text || title || "Transport closed";
    setStatus("disconnected", "Connection stopped", reason);
    showTransportPanel("Connection stopped", `${reason} Automatic retry is disabled until a remote image has appeared once.`);
    return;
  }
  if (state.reconnectAttempts >= 3) {
    state.connected = false;
    state.transportActive = false;
    const reason = text || title || "Transport closed";
    setStatus("error", "Connection stopped", reason);
    showTransportPanel("Connection stopped", `${reason} Automatic reconnect reached the limit.`);
    return;
  }
  state.connected = false;
  state.transportActive = false;
  state.lastDisconnectReason = text || title || "Transport closed";
  state.reconnectAttempts += 1;
  const delay = Math.min(10000, 1200 * state.reconnectAttempts);
  setStatus(
    "reconnecting",
    `Reconnecting (${state.reconnectAttempts}/3)`,
    `${state.lastDisconnectReason}. Retrying in ${Math.round(delay / 1000)}s`
  );
  state.reconnectTimer = window.setTimeout(async () => {
    state.reconnectTimer = null;
    if (state.manualDisconnect) return;
    try {
      await connectRemote();
    } catch (error) {
      setStatus("error", "Reconnect failed", error.message);
    }
  }, delay);
}

function clearReconnectTimer() {
  if (!state.reconnectTimer) return;
  window.clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;
}

function handlePeerInfoEvent(event) {
  const peerInfo = parseProtocolValue(event.peer_info);
  const display = peerInfo?.displays?.[peerInfo.current_display || 0] || peerInfo?.displays?.[0];
  state.displays = Array.isArray(peerInfo?.displays) ? peerInfo.displays : [];
  renderDisplayOptions(peerInfo?.current_display || 0);
  if (display?.width && display?.height) {
    resizeRemoteCanvas(display.width, display.height);
  }
  if (peerInfo?.hostname || peerInfo?.username) {
    const label = peerInfo.hostname || peerInfo.username;
    els.peerTitle.textContent = label;
    els.hudPeerLabel.textContent = label;
  }
}

function renderDisplayOptions(currentDisplay) {
  if (!state.displays.length) {
    els.displaySelect.disabled = true;
    return;
  }
  els.displaySelect.innerHTML = state.displays
    .map((display, index) => `<option value="${index}">${display.name || index + 1}</option>`)
    .join("");
  els.displaySelect.value = String(currentDisplay || 0);
  els.displaySelect.disabled = state.displays.length <= 1;
}

function parseProtocolValue(value) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function handleRgbaFrame(bytes) {
  if (state.yuvDirectActive) return;
  queueRgbaFrame(bytes);
}

function queueYuvFrame(frame) {
  if (!state.settings.directYuv) return false;
  if (!state.yuvDirectAvailable || !state.yuvRenderer?.drawFrame || !frame?.format) return false;
  state.stats.framesReceived += 1;
  state.lastFrameReceiveAt = performance.now();
  state.stallNotified = false;
  const now = performance.now();
  if (now - state.lastFrameAt < state.targetFrameMs) {
    state.droppedFrames += 1;
    state.stats.droppedFrames += 1;
    return true;
  }
  state.lastFrameAt = now;
  drawYuvFrame(frame);
  return true;
}

function drawYuvFrame(frame) {
  const startedAt = performance.now();
  const format = frame.format || {};
  const width = format.displayWidth || format.width || state.remoteWidth;
  const height = format.displayHeight || format.height || state.remoteHeight;
  resizeRemoteCanvas(width, height);
  setDirectYuvMode(true);
  if (!state.connected) {
    state.connected = true;
    state.transportActive = true;
    state.stableConnection = true;
    state.reconnectAttempts = 0;
    setStatus("connected", "Connected", "Receiving remote frames");
  }
  state.yuvRenderer.drawFrame(frame);
  updateFrameBrightness(sampleYuvBrightness(frame));
  const renderMs = performance.now() - startedAt;
  state.stats.renderMs = state.stats.renderMs ? state.stats.renderMs * 0.85 + renderMs * 0.15 : renderMs;
  state.stats.framesRendered += 1;
  state.lastFrameRenderAt = performance.now();
}

function setDirectYuvMode(active) {
  active = Boolean(active);
  if (state.yuvDirectActive === active) return;
  state.yuvDirectActive = active;
  els.stage.classList.toggle("direct-yuv", state.yuvDirectActive);
  if (state.yuvDirectActive) {
    const ctx = els.remoteCanvas.getContext("2d");
    ctx.clearRect(0, 0, els.remoteCanvas.width, els.remoteCanvas.height);
  }
}

function queueRgbaFrame(bytes) {
  if (!bytes?.length) return;
  setDirectYuvMode(false);
  state.stats.framesReceived += 1;
  state.lastFrameReceiveAt = performance.now();
  state.stallNotified = false;
  const now = performance.now();
  if (state.framePending || now - state.lastFrameAt < state.targetFrameMs) {
    state.droppedFrames += 1;
    state.stats.droppedFrames += 1;
    return;
  }
  state.framePending = true;
  state.queuedFrame = copyFrameBytes(bytes);
  requestAnimationFrame(() => {
    state.framePending = false;
    const frame = state.queuedFrame;
    state.queuedFrame = null;
    if (!frame) return;
    state.lastFrameAt = performance.now();
    drawRgbaFrame(frame);
  });
}

function copyFrameBytes(bytes) {
  if (bytes instanceof Uint8ClampedArray) return new Uint8ClampedArray(bytes);
  if (bytes instanceof Uint8Array) return new Uint8ClampedArray(bytes);
  return new Uint8ClampedArray(bytes);
}

function drawRgbaFrame(bytes) {
  const startedAt = performance.now();
  const canvas = els.remoteCanvas;
  const ctx = canvas.getContext("2d");
  const size = resolveFrameSize(bytes.length);
  if (!size) return;
  resizeRemoteCanvas(size.width, size.height);
  if (!state.connected) {
    state.connected = true;
    state.transportActive = true;
    state.stableConnection = true;
    state.reconnectAttempts = 0;
    setStatus("connected", "Connected", "Receiving remote frames");
  }
  const frameBytes = bytes instanceof Uint8ClampedArray ? bytes : new Uint8ClampedArray(bytes);
  const frame = new ImageData(frameBytes, size.width, size.height);
  ctx.putImageData(frame, 0, 0);
  updateFrameBrightness(sampleRgbaBrightness(frameBytes));
  const renderMs = performance.now() - startedAt;
  state.stats.renderMs = state.stats.renderMs ? state.stats.renderMs * 0.85 + renderMs * 0.15 : renderMs;
  state.stats.framesRendered += 1;
  state.lastFrameRenderAt = performance.now();
}

function sampleRgbaBrightness(bytes) {
  if (!bytes?.length) return null;
  const stride = Math.max(4, Math.floor(bytes.length / 4 / 180) * 4);
  let total = 0;
  let count = 0;
  for (let index = 0; index < bytes.length; index += stride) {
    const alpha = bytes[index + 3];
    if (alpha === 0) continue;
    total += (bytes[index] + bytes[index + 1] + bytes[index + 2]) / 3;
    count += 1;
  }
  return count ? total / count : null;
}

function sampleYuvBrightness(frame) {
  const plane = frame?.y || frame?.yPlane || frame?.planes?.[0];
  const bytes = plane?.bytes || plane?.data || plane;
  if (!bytes?.length) return null;
  const stride = Math.max(1, Math.floor(bytes.length / 180));
  let total = 0;
  let count = 0;
  for (let index = 0; index < bytes.length; index += stride) {
    total += bytes[index];
    count += 1;
  }
  return count ? total / count : null;
}

function updateFrameBrightness(value) {
  if (!Number.isFinite(value)) return;
  state.stats.lastBrightness = value;
  if (value < 8) {
    state.darkFrameStreak += 1;
    state.stats.darkFrames += 1;
  } else {
    state.darkFrameStreak = 0;
    state.blackFrameNotified = false;
  }
}

function resolveFrameSize(byteLength) {
  if (byteLength % 4 !== 0) return null;
  const pixels = byteLength / 4;
  const candidates = [
    { width: state.remoteWidth, height: state.remoteHeight },
    ...state.displays.map((display) => ({ width: display.width, height: display.height })),
    { width: els.remoteCanvas.width, height: els.remoteCanvas.height },
    ...commonFrameSizes(),
  ];
  const match = candidates.find((candidate) => candidate.width > 0 && candidate.height > 0 && candidate.width * candidate.height === pixels);
  if (match) return match;
  const inferredHeight = Math.floor(pixels / state.remoteWidth);
  if (inferredHeight > 0 && inferredHeight * state.remoteWidth === pixels) {
    return { width: state.remoteWidth, height: inferredHeight };
  }
  return null;
}

function commonFrameSizes() {
  return [
    [3840, 2160], [2560, 1440], [2048, 1152], [1920, 1200], [1920, 1080],
    [1680, 1050], [1600, 1200], [1600, 900], [1536, 864], [1440, 900],
    [1366, 768], [1360, 768], [1280, 1024], [1280, 800], [1280, 720],
    [1024, 768], [800, 600],
  ].map(([width, height]) => ({ width, height }));
}

function resizeRemoteCanvas(width, height) {
  if (state.remoteWidth === width && state.remoteHeight === height && els.remoteCanvas.width === width && els.remoteCanvas.height === height) {
    return;
  }
  state.remoteWidth = width;
  state.remoteHeight = height;
  els.remoteCanvas.width = width;
  els.remoteCanvas.height = height;
  els.remoteVideoCanvas.width = width;
  els.remoteVideoCanvas.height = height;
  applyCanvasAspect();
}

function applyCanvasAspect() {
  const width = Math.max(1, Number(state.remoteWidth) || 1280);
  const height = Math.max(1, Number(state.remoteHeight) || 720);
  const ratio = width / height;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || width;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || height;
  let fitWidth = viewportWidth;
  let fitHeight = Math.round(fitWidth / ratio);
  if (fitHeight > viewportHeight) {
    fitHeight = viewportHeight;
    fitWidth = Math.round(fitHeight * ratio);
  }
  let originalWidth = width;
  let originalHeight = height;
  if (originalWidth > viewportWidth || originalHeight > viewportHeight) {
    originalWidth = fitWidth;
    originalHeight = fitHeight;
  }
  document.documentElement.style.setProperty("--canvas-aspect", `${width} / ${height}`);
  document.documentElement.style.setProperty("--canvas-ratio", String(ratio));
  document.documentElement.style.setProperty("--canvas-fit-width", `${Math.max(1, Math.round(fitWidth))}px`);
  document.documentElement.style.setProperty("--canvas-fit-height", `${Math.max(1, Math.round(fitHeight))}px`);
  document.documentElement.style.setProperty("--canvas-original-width", `${Math.max(1, Math.round(originalWidth))}px`);
  document.documentElement.style.setProperty("--canvas-original-height", `${Math.max(1, Math.round(originalHeight))}px`);
}

function sendMouseEvent(event, type) {
  if (!state.connected || typeof window.setByName !== "function") return;
  els.remoteCanvas.focus({ preventScroll: true });
  if (type === "wheel") {
    queueWheelEvent(event);
    event.preventDefault();
    return;
  }
  const payload = createMousePayload(event, type);
  sendMousePayload(payload);
  event.preventDefault();
}

function queueMouseMove(event) {
  if (!state.connected || typeof window.setByName !== "function") return;
  const payload = createMousePayload(event, "move");
  const now = performance.now();
  if (now - state.lastMouseMoveAt >= 16) {
    state.lastMouseMoveAt = now;
    sendMousePayload(payload);
  } else {
    state.queuedMouseMove = payload;
    if (!state.mouseMovePending) {
      state.mouseMovePending = true;
      requestAnimationFrame(() => {
        state.mouseMovePending = false;
        if (!state.queuedMouseMove) return;
        state.lastMouseMoveAt = performance.now();
        sendMousePayload(state.queuedMouseMove);
        state.queuedMouseMove = null;
      });
    }
  }
  event.preventDefault();
}

function createMousePayload(event, type) {
  const rect = els.remoteCanvas.getBoundingClientRect();
  const x = Math.round((event.clientX - rect.left) * (els.remoteCanvas.width / rect.width));
  const y = Math.round((event.clientY - rect.top) * (els.remoteCanvas.height / rect.height));
  return {
    type,
    buttons: mouseButtonName(event),
    x: String(clamp(x, 0, els.remoteCanvas.width - 1)),
    y: String(clamp(y, 0, els.remoteCanvas.height - 1)),
    alt: String(event.altKey),
    ctrl: String(event.ctrlKey),
    shift: String(event.shiftKey),
    command: String(event.metaKey),
  };
}

function queueWheelEvent(event) {
  const now = performance.now();
  if (now - state.wheelLastAt > 180) resetWheelAccumulator();
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 22 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 180 : 1;
  addWheelAxis("X", event.deltaX * unit);
  addWheelAxis("Y", event.deltaY * unit);
  state.wheelLastAt = now;
  state.wheelModifiers = {
    alt: String(event.altKey),
    ctrl: String(event.ctrlKey),
    shift: String(event.shiftKey),
    command: String(event.metaKey),
  };
  if (!state.wheelFlushPending) {
    state.wheelFlushPending = true;
    requestAnimationFrame(flushWheelEvents);
  }
}

function addWheelAxis(axis, delta) {
  if (!delta) return;
  const sign = Math.sign(delta);
  const residualName = axis === "X" ? "wheelResidualX" : "wheelResidualY";
  const signName = axis === "X" ? "wheelLastSignX" : "wheelLastSignY";
  if (state[signName] && sign !== state[signName]) state[residualName] = 0;
  state[signName] = sign;
  state[residualName] += delta;
}

function flushWheelEvents() {
  state.wheelFlushPending = false;
  if (!state.connected || typeof window.setByName !== "function") {
    resetWheelAccumulator();
    return;
  }
  const x = consumeWheelSteps("wheelResidualX");
  const y = consumeWheelSteps("wheelResidualY");
  if (!x && !y) return;
  const modifiers = state.wheelModifiers || {};
  sendMousePayload({
    type: "wheel",
    buttons: "",
    x: String(x),
    y: String(y),
    alt: modifiers.alt || "false",
    ctrl: modifiers.ctrl || "false",
    shift: modifiers.shift || "false",
    command: modifiers.command || "false",
  });
  if (Math.abs(state.wheelResidualX) >= 80 || Math.abs(state.wheelResidualY) >= 80) {
    state.wheelFlushPending = true;
    requestAnimationFrame(flushWheelEvents);
  }
}

function consumeWheelSteps(name) {
  const threshold = 80;
  const value = state[name];
  if (Math.abs(value) < threshold) return 0;
  const sign = Math.sign(value);
  const steps = Math.min(1, Math.trunc(Math.abs(value) / threshold));
  state[name] = value - sign * threshold * steps;
  const maxResidual = threshold * 3;
  if (Math.abs(state[name]) > maxResidual) state[name] = sign * maxResidual;
  return -sign * steps;
}

function resetWheelAccumulator() {
  state.wheelResidualX = 0;
  state.wheelResidualY = 0;
  state.wheelLastSignX = 0;
  state.wheelLastSignY = 0;
}

function sendMousePayload(payload) {
  window.setByName("send_mouse", JSON.stringify({
    type: payload.type,
    buttons: payload.buttons,
    x: payload.x,
    y: payload.y,
    alt: payload.alt,
    ctrl: payload.ctrl,
    shift: payload.shift,
    command: payload.command,
  }));
}

function mouseButtonName(event) {
  if (event.type === "wheel") return "wheel";
  if (event.buttons & 1) return "left";
  if (event.buttons & 2) return "right";
  if (event.buttons & 4) return "wheel";
  if (event.button === 0 && (event.type === "mousedown" || event.type === "mouseup")) return "left";
  if (event.button === 2) return "right";
  if (event.button === 1) return "wheel";
  return "";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sendKeyEvent(event, down) {
  if (!state.connected || typeof window.setByName !== "function") return;
  if (!shouldSendKeyEvent(event)) return;
  if (event.isComposing || event.key === "Process") return;
  if (sendPrintableKey(event, down)) {
    event.preventDefault();
    return;
  }
  const keyId = keyboardEventId(event);
  if (down) {
    if (event.repeat || state.activeKeys.has(keyId)) {
      event.preventDefault();
      return;
    }
    state.activeKeys.add(keyId);
  } else {
    state.activeKeys.delete(keyId);
  }
  window.setByName("input_key", JSON.stringify({
    name: event.key,
    down: String(down),
    press: "false",
    alt: String(event.altKey),
    ctrl: String(event.ctrlKey),
    shift: String(event.shiftKey),
    command: String(event.metaKey),
  }));
  event.preventDefault();
}

function sendPrintableKey(event, down) {
  if (!down) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (typeof event.key !== "string" || event.key.length !== 1) return false;
  window.setByName("input_string", event.key);
  return true;
}

function keyboardEventId(event) {
  return event.code || event.key || "unknown";
}

function shouldSendKeyEvent(event) {
  const target = event.target;
  if (target?.closest?.("input, select, textarea, button, [contenteditable='true']")) return false;
  return document.activeElement === els.remoteCanvas || Boolean(document.fullscreenElement);
}

function canDragHudButton() {
  return window.innerWidth > 720;
}

function defaultHudButtonPosition() {
  const rect = els.hudToggle.getBoundingClientRect();
  return clampHudButtonPosition({
    left: Math.round(rect.left || ((window.innerWidth - rect.width) / 2)),
    top: Math.round(rect.top || (window.innerHeight - rect.height - 14)),
  });
}

function clampHudButtonPosition(position) {
  const rect = els.hudToggle.getBoundingClientRect();
  const width = rect.width || 72;
  const height = rect.height || 36;
  const margin = 8;
  return {
    left: Math.round(clamp(position.left, margin, Math.max(margin, window.innerWidth - width - margin))),
    top: Math.round(clamp(position.top, margin, Math.max(margin, window.innerHeight - height - margin))),
  };
}

function applyHudButtonPosition() {
  if (!canDragHudButton() || !state.hudButtonPosition) {
    els.hud.classList.remove("menu-floating");
    els.hud.style.left = "";
    els.hud.style.top = "";
    els.hud.style.right = "";
    els.hud.style.bottom = "";
    els.hud.style.width = "";
    return;
  }
  state.hudButtonPosition = clampHudButtonPosition(state.hudButtonPosition);
  els.hud.classList.add("menu-floating");
  els.hud.style.left = `${state.hudButtonPosition.left}px`;
  els.hud.style.top = `${state.hudButtonPosition.top}px`;
  els.hud.style.right = "auto";
  els.hud.style.bottom = "auto";
  els.hud.style.width = "auto";
}

function startHudButtonDrag(event) {
  if (!canDragHudButton()) return;
  if (event.button !== undefined && event.button !== 0) return;
  const start = state.hudButtonPosition || defaultHudButtonPosition();
  state.hudButtonDrag = {
    startX: event.clientX,
    startY: event.clientY,
    left: start.left,
    top: start.top,
    moved: false,
  };
  els.hudToggle.classList.add("dragging");
  try {
    els.hudToggle.setPointerCapture?.(event.pointerId);
  } catch {
    // Some synthetic browser events do not support pointer capture.
  }
}

function moveHudButtonDrag(event) {
  if (!state.hudButtonDrag) return;
  const dx = event.clientX - state.hudButtonDrag.startX;
  const dy = event.clientY - state.hudButtonDrag.startY;
  if (!state.hudButtonDrag.moved && Math.hypot(dx, dy) < 4) return;
  state.hudButtonDrag.moved = true;
  state.suppressNextHudToggle = true;
  if (state.hudOpen) setHudOpen(false);
  state.hudButtonPosition = clampHudButtonPosition({
    left: state.hudButtonDrag.left + dx,
    top: state.hudButtonDrag.top + dy,
  });
  applyHudButtonPosition();
  event.preventDefault();
}

function endHudButtonDrag(event) {
  if (!state.hudButtonDrag) return;
  const moved = state.hudButtonDrag.moved;
  state.hudButtonDrag = null;
  els.hudToggle.classList.remove("dragging");
  if (moved) {
    state.suppressNextHudToggle = true;
    saveHudButtonPosition();
    event.preventDefault();
  }
}

function resetHudButtonPosition() {
  state.hudButtonPosition = null;
  saveHudButtonPosition();
  applyHudButtonPosition();
}

function canDragHud() {
  return window.innerWidth > 720;
}

function defaultHudPosition() {
  const rect = els.hudPanel.getBoundingClientRect();
  return clampHudPosition({
    left: Math.round((window.innerWidth - rect.width) / 2),
    top: Math.round(window.innerHeight - rect.height - 54),
  });
}

function clampHudPosition(position) {
  const rect = els.hudPanel.getBoundingClientRect();
  const margin = 10;
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
  return {
    left: Math.round(clamp(position.left, margin, maxLeft)),
    top: Math.round(clamp(position.top, margin, maxTop)),
  };
}

function applyHudPanelPosition() {
  if (!canDragHud() || !state.hudOpen) {
    els.hudPanel.style.left = "";
    els.hudPanel.style.top = "";
    els.hudPanel.style.bottom = "";
    els.hudPanel.style.transform = "";
    return;
  }
  state.hudPosition = clampHudPosition(state.hudPosition || defaultHudPosition());
  els.hudPanel.style.left = `${state.hudPosition.left}px`;
  els.hudPanel.style.top = `${state.hudPosition.top}px`;
  els.hudPanel.style.bottom = "auto";
  els.hudPanel.style.transform = "none";
}

function resetHudPosition() {
  state.hudPosition = null;
  saveHudPosition();
  applyHudPanelPosition();
}

function startHudDrag(event) {
  const heading = event.target.closest(".hud-heading");
  if (!heading || !els.hudPanel.contains(heading)) return;
  if (!state.hudOpen || !canDragHud()) return;
  if (event.target.closest("button, input, select, textarea, label, [contenteditable='true']")) return;
  const rect = els.hudPanel.getBoundingClientRect();
  state.hudDrag = {
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  els.hudPanel.classList.add("dragging");
  window.getSelection?.().removeAllRanges?.();
  event.preventDefault();
  event.stopPropagation();
}

function moveHudDrag(event) {
  if (!state.hudDrag) return;
  state.hudPosition = clampHudPosition({
    left: event.clientX - state.hudDrag.offsetX,
    top: event.clientY - state.hudDrag.offsetY,
  });
  applyHudPanelPosition();
  event.preventDefault();
}

function endHudDrag(event) {
  if (!state.hudDrag) return;
  state.hudDrag = null;
  els.hudPanel.classList.remove("dragging");
  saveHudPosition();
  event.preventDefault();
}

function setHudOpen(open) {
  state.hudOpen = Boolean(open);
  els.hud.classList.toggle("hud-collapsed", !state.hudOpen);
  els.hudToggle.setAttribute("aria-expanded", String(state.hudOpen));
  els.hudToggle.title = state.hudOpen ? "Hide controls" : "Show controls";
  applyHudPanelPosition();
}

function toggleHud() {
  if (state.suppressNextHudToggle) {
    state.suppressNextHudToggle = false;
    return;
  }
  setHudOpen(!state.hudOpen);
}

function setInfoOpen(open) {
  state.infoOpen = Boolean(open);
  els.sessionBar.classList.toggle("open", state.infoOpen);
  els.infoToggle.classList.toggle("active", state.infoOpen);
}

function toggleInfo() {
  setInfoOpen(!state.infoOpen);
}

function bindCheckboxSetting(element, settingName) {
  element.addEventListener("change", () => updateClientSetting(settingName, element.checked));
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await (els.shell || document.documentElement).requestFullscreen?.();
    }
  } catch (error) {
    setStatus("error", "Fullscreen failed", error.message);
  }
}

function syncFullscreenState() {
  const active = Boolean(document.fullscreenElement);
  els.fullscreenBtn.textContent = active ? "Exit Fullscreen" : "Fullscreen";
  els.fullscreenBtn.classList.toggle("active", active);
  applyCanvasAspect();
  if (active) els.remoteCanvas.focus({ preventScroll: true });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[ch]));
}

function submitConnectForm(event) {
  event.preventDefault();
  const peerId = (els.connectPeerId?.value || "").trim();
  if (peerId) {
    state.params.id = peerId;
    state.session = null;
  }
  const password = els.connectPassword.value || "";
  state.pendingPassword = password;
  if (state.awaitingPassword) {
    sendPasswordToProtocol(password);
    return;
  }
  connectRemote();
}

applyHudButtonPosition();
els.connectForm.addEventListener("submit", submitConnectForm);
els.loginBtn.addEventListener("click", loginWeb3);
els.logoutBtn.addEventListener("click", logoutWeb3);
els.deviceList.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-peer-id]");
  if (btn) chooseWebDevice(btn.dataset.peerId);
});
els.connectBtn.addEventListener("click", connectRemote);
els.disconnectBtn.addEventListener("click", disconnectRemote);
els.reconnectBtn.addEventListener("click", reconnectRemote);
els.fullscreenBtn.addEventListener("click", toggleFullscreen);
els.captureHelpBtn.addEventListener("click", () => toggleCaptureHelp());
els.hudToggle.addEventListener("pointerdown", startHudButtonDrag);
els.hudToggle.addEventListener("dblclick", resetHudButtonPosition);
els.hudPanel.addEventListener("pointerdown", startHudDrag);
els.hudPanel.addEventListener("pointermove", moveHudDrag);
els.hudPanel.addEventListener("pointerup", endHudDrag);
els.hudPanel.addEventListener("pointercancel", endHudDrag);
els.hudPanel.addEventListener("mousedown", startHudDrag);
document.addEventListener("mousemove", moveHudDrag);
document.addEventListener("mouseup", endHudDrag);
document.addEventListener("pointermove", moveHudButtonDrag);
document.addEventListener("pointerup", endHudButtonDrag);
document.addEventListener("pointercancel", endHudButtonDrag);
document.addEventListener("pointermove", moveHudDrag);
document.addEventListener("pointerup", endHudDrag);
document.addEventListener("pointercancel", endHudDrag);
els.hudPanel.querySelector(".hud-heading")?.addEventListener("dblclick", resetHudPosition);
els.infoToggle.addEventListener("click", toggleInfo);
els.hudClose.addEventListener("click", () => setHudOpen(false));
els.transportReconnectBtn.addEventListener("click", reconnectRemote);
els.transportConnectBtn.addEventListener("click", () => {
  stopTransportAndReturn("Reconnect cancelled. Choose a device or enter an ID.");
});
els.qualitySelect.addEventListener("change", () => updateClientSetting("imageQuality", els.qualitySelect.value));
els.scaleSelect.addEventListener("change", () => updateClientSetting("scale", els.scaleSelect.value));
els.fpsSelect.addEventListener("change", () => updateClientSetting("maxFps", Number(els.fpsSelect.value)));
bindCheckboxSetting(els.cursorToggle, "showRemoteCursor");
bindCheckboxSetting(els.muteToggle, "mute");
bindCheckboxSetting(els.clipboardToggle, "disableClipboard");
bindCheckboxSetting(els.videoCompatToggle, "videoCompatibility");
bindCheckboxSetting(els.monitorToggle, "showMonitor");
bindCheckboxSetting(els.directYuvToggle, "directYuv");
els.copyCompatBtn.addEventListener("click", () => copyCaptureCommand(false));
els.copySafeBrowserBtn.addEventListener("click", copySafeBrowserCommand);
els.copyMpoBtn.addEventListener("click", () => copyCaptureCommand(true));
els.displaySelect.addEventListener("change", () => {
  if (typeof window.setByName === "function") {
    window.setByName("switch_display", els.displaySelect.value);
  }
});
els.remoteCanvas.addEventListener("mousedown", (event) => sendMouseEvent(event, "down"));
els.remoteCanvas.addEventListener("mouseup", (event) => sendMouseEvent(event, "up"));
els.remoteCanvas.addEventListener("mousemove", queueMouseMove);
els.remoteCanvas.addEventListener("mouseleave", (event) => queueMouseMove(event));
els.remoteCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
els.remoteCanvas.addEventListener("wheel", (event) => sendMouseEvent(event, "wheel"));
window.addEventListener("keydown", (event) => sendKeyEvent(event, true));
window.addEventListener("keyup", (event) => sendKeyEvent(event, false));
window.addEventListener("blur", () => state.activeKeys.clear());
document.addEventListener("pointerdown", (event) => {
  if (!state.hudOpen) return;
  if (els.hud.contains(event.target)) return;
  setHudOpen(false);
});
window.addEventListener("resize", () => {
  applyCanvasAspect();
  applyHudButtonPosition();
  if (state.hudOpen) applyHudPanelPosition();
});
window.visualViewport?.addEventListener("resize", applyCanvasAspect);
document.addEventListener("fullscreenchange", syncFullscreenState);

function updateClientSetting(name, value) {
  state.settings[name] = value;
  let liveQualityValue = name === "imageQuality" ? value : "";
  if (name === "imageQuality") {
    applyQualityProfile(value);
  }
  if (name === "videoCompatibility" && value) {
    state.settings.imageQuality = "best";
    state.settings.maxFps = 60;
    liveQualityValue = "best";
  }
  if (name === "directYuv" && !value) {
    setDirectYuvMode(false);
  }
  if (name === "directYuv" && value && state.protocolLoaded && !state.yuvDirectAvailable) {
    toggleCaptureHelp(true);
    els.captureAdvice.textContent = "Direct YUV is enabled, but this browser/GPU path is not available. Rendering remains on RGBA.";
  }
  saveClientSettings();
  applyClientSettings();
  if (liveQualityValue) sendLiveProtocolSetting("imageQuality", liveQualityValue);
  else sendLiveProtocolSetting(name, value);
  if ((name === "imageQuality" || name === "videoCompatibility") && canSendLiveProtocolCommand() && typeof window.setByName === "function") {
    window.setTimeout(() => window.setByName("refresh", ""), 120);
  }
}

function applyQualityProfile(value) {
  if (value === "low") {
    state.settings.maxFps = Math.min(Number(state.settings.maxFps) || 20, 20);
  } else if (value === "balanced") {
    state.settings.maxFps = 30;
  } else if (value === "best") {
    state.settings.maxFps = 60;
  }
}

function setMonitorVisible(visible) {
  els.qualityMonitor.hidden = !visible;
  els.qualityMonitor.classList.toggle("active", visible);
  if (visible) renderQualityMonitor(true);
}

function renderQualityMonitor(force = false) {
  const now = performance.now();
  const elapsedSeconds = Math.max(0.001, (now - state.stats.lastSampleAt) / 1000);
  const renderedDelta = state.stats.framesRendered - state.stats.framesRenderedLast;
  state.stats.fps = renderedDelta / elapsedSeconds;
  state.stats.framesRenderedLast = state.stats.framesRendered;
  state.stats.lastSampleAt = now;

  if (!state.settings.showMonitor && !force) return;
  els.monitorFps.textContent = state.stats.fps.toFixed(1);
  els.monitorRender.textContent = state.stats.renderMs ? `${state.stats.renderMs.toFixed(1)} ms` : "-";
  els.monitorReceived.textContent = String(state.stats.framesReceived);
  els.monitorDecoder.textContent = state.stats.decoderMs ? `${state.stats.decoderMs} ms` : "-";
  const yuvLabel = state.yuvRendererMode === "software" ? "YUV SW" : state.yuvRendererMode === "webgl" ? "YUV GL" : "YUV";
  els.monitorGl.textContent = state.yuvDirectActive ? yuvLabel : state.legacyCpuYuv && state.stats.framesRendered ? "CPU" : state.stats.glMs ? `${state.stats.glMs} ms` : "-";
  els.monitorMode.textContent = state.yuvDirectActive ? yuvLabel : state.legacyCpuYuv && state.stats.framesRendered ? "CPU RGBA" : state.stats.framesRendered ? "RGBA" : state.connected ? "Waiting" : "Idle";
  els.monitorDropped.textContent = String(state.stats.droppedFrames);
  els.monitorQuality.textContent = qualityLabel(state.settings.imageQuality);
  renderCaptureDiagnostics();
}

function toggleCaptureHelp(force) {
  state.captureHelpOpen = typeof force === "boolean" ? force : !state.captureHelpOpen;
  els.capturePanel.hidden = !state.captureHelpOpen;
  els.captureHelpBtn.classList.toggle("active", state.captureHelpOpen);
  if (state.captureHelpOpen) renderCaptureDiagnostics();
}

function renderCaptureDiagnostics() {
  if (!state.captureHelpOpen) return;
  const lastFrame = Math.max(state.lastFrameReceiveAt, state.lastFrameRenderAt);
  els.captureFrames.textContent = `${state.stats.framesReceived} / ${state.stats.framesRendered}`;
  const yuvLabel = state.yuvRendererMode === "software" ? "YUV direct SW" : state.yuvRendererMode === "webgl" ? "YUV direct GL" : "YUV direct";
  els.captureRenderer.textContent = state.yuvDirectActive ? yuvLabel : state.legacyCpuYuv && state.stats.framesRendered ? "CPU RGBA" : state.stats.framesRendered ? "RGBA" : state.connected ? "Waiting" : "Idle";
  els.captureVideoMode.textContent = state.settings.videoCompatibility ? "On" : "Off";
  els.captureLastFrame.textContent = lastFrame ? `${Math.max(0, Math.round((performance.now() - lastFrame) / 1000))}s ago` : "-";
  els.captureDarkFrames.textContent = `${state.darkFrameStreak} (${Math.round(state.stats.lastBrightness)})`;
  els.captureTransport.textContent = state.lastTransportClose ? `${state.lastTransportClose} / ${state.transportCloseCount}` : "-";
  els.captureAdvice.textContent = captureAdvice(lastFrame);
}

function captureAdvice(lastFrame) {
  if (!state.connected && !state.transportActive) {
    return "Connect first. If the relay closes, use Reconnect after checking the password and network.";
  }
  if (!state.stats.framesReceived) {
    return "No frame has arrived yet. Check remote password, relay reachability, and whether the remote screen is locked.";
  }
  if (state.stats.framesReceived && !state.stats.framesRendered) {
    return "Frames are arriving but not rendering. Reconnect, then try Video mode.";
  }
  if (state.darkFrameStreak >= 12) {
    return "Frames are updating but nearly black. If only browser content is affected, run Fix browser video on the remote Windows PC. DRM/HDCP protected playback can still block capture.";
  }
  const age = lastFrame ? performance.now() - lastFrame : 0;
  if (age > 6000) {
    return "The image is stale. For browser video, use Fix browser video on the remote PC. DRM/HDCP protected video can still stay black.";
  }
  if (state.settings.videoCompatibility) {
    return "Video boost is active. If browser colors are wrong, use Fix browser video on the remote PC, then reopen the browser.";
  }
  if (state.legacyCpuYuv) {
    return "Frames are using the safer CPU renderer. If colors are still wrong only in Web v3, the next suspect is the legacy web decoder path.";
  }
  return "Frames are updating. If only browser windows have wrong colors, use Fix browser video on the remote Windows PC.";
}

async function copyCaptureCommand(disableMpo = false) {
  const command = disableMpo ? buildMpoFixCommand() : buildBrowserColorFixCommand();
  await copyText(command);
  els.captureAdvice.textContent = disableMpo
    ? "MPO fix command copied. Run it as Administrator on the remote Windows PC, restart the browser, then reconnect."
    : "Browser video fix copied. Run it on the remote Windows PC, close all browser windows, reopen the browser, then reconnect.";
}

async function copySafeBrowserCommand() {
  await copyText(buildSafeBrowserCommand());
  els.captureAdvice.textContent = "Safe browser command copied. Run it on the remote Windows PC to launch a temporary no-GPU browser window, then reconnect or refresh the remote view.";
}

function buildBrowserColorFixCommand() {
  return [
    "powershell -NoProfile -ExecutionPolicy Bypass -Command",
    quotePowerShellCommand([
      "$ErrorActionPreference='SilentlyContinue'",
      "$policies=@('HKCU:\\Software\\Policies\\Google\\Chrome','HKCU:\\Software\\Policies\\Microsoft\\Edge','HKCU:\\Software\\Policies\\BraveSoftware\\Brave')",
      "foreach($p in $policies){New-Item -Path $p -Force|Out-Null; New-ItemProperty -Path $p -Name HardwareAccelerationModeEnabled -PropertyType DWord -Value 0 -Force|Out-Null}",
      "$files=@(\"$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Local State\",\"$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Local State\",\"$env:LOCALAPPDATA\\BraveSoftware\\Brave-Browser\\User Data\\Local State\")",
      "foreach($f in $files){if(Test-Path $f){try{$j=Get-Content -LiteralPath $f -Raw|ConvertFrom-Json; if($j){if(-not($j.PSObject.Properties.Name -contains 'hardware_acceleration_mode_enabled')){$j|Add-Member -NotePropertyName hardware_acceleration_mode_enabled -NotePropertyValue $false}else{$j.hardware_acceleration_mode_enabled=$false}; $j|ConvertTo-Json -Depth 100|Set-Content -LiteralPath $f -Encoding UTF8}}catch{}}}",
      "Stop-Process -Name chrome,msedge,brave,opera -Force",
      "Write-Host 'QT Desk browser color/capture fix applied. Reopen the browser, or use Copy safe browser if colors are still corrupted.'"
    ]),
  ].join(" ");
}

function buildSafeBrowserCommand() {
  return [
    "powershell -NoProfile -ExecutionPolicy Bypass -Command",
    quotePowerShellCommand([
      "$ErrorActionPreference='SilentlyContinue'",
      "$url='https://www.nodeseek.com/'",
      "$profile=Join-Path $env:TEMP 'qt-desk-safe-browser-profile'",
      "New-Item -ItemType Directory -Path $profile -Force|Out-Null",
      "$flags=@('--user-data-dir='+$profile,'--new-window','--disable-gpu','--disable-software-rasterizer=false','--disable-direct-composition','--disable-gpu-compositing','--disable-zero-copy','--disable-accelerated-video-decode','--disable-accelerated-video-encode','--disable-features=UseSkiaRenderer,Vulkan,CanvasOopRasterization,HardwareMediaKeyHandling,DirectComposition,DCompPresenter,UseDCompVisualTree','--use-angle=swiftshader',$url)",
      "$pf86=${env:ProgramFiles(x86)}",
      "$candidates=@(\"$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe\",\"$pf86\\Google\\Chrome\\Application\\chrome.exe\",\"$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe\",\"$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe\",\"$pf86\\Microsoft\\Edge\\Application\\msedge.exe\")",
      "$exe=$candidates|Where-Object{Test-Path $_}|Select-Object -First 1",
      "if($exe){Start-Process -FilePath $exe -ArgumentList $flags}else{Write-Host 'Chrome/Edge not found'}"
    ]),
  ].join(" ");
}

function buildMpoFixCommand() {
  return [
    "powershell -NoProfile -ExecutionPolicy Bypass -Command",
    quotePowerShellCommand([
      "$ErrorActionPreference='Stop'",
      "New-Item -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm' -Force|Out-Null",
      "New-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm' -Name OverlayTestMode -PropertyType DWord -Value 5 -Force|Out-Null",
      "Write-Host 'QT Desk MPO fix applied. Restart Windows or sign out/in, then reopen the browser.'"
    ]),
  ].join(" ");
}

function quotePowerShellCommand(parts) {
  return `"${parts.join("; ").replace(/"/g, '\\"')}"`;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  window.prompt("Copy", value);
}

function checkFrameStall() {
  if (!state.connected || state.manualDisconnect || state.stallNotified) return;
  if (state.darkFrameStreak >= 18 && !state.blackFrameNotified) {
    state.blackFrameNotified = true;
    toggleCaptureHelp(true);
    setHudOpen(true);
    setStatus("connected", "Connected", "Remote frames are arriving but look black");
    return;
  }
  const lastFrame = Math.max(state.lastFrameReceiveAt, state.lastFrameRenderAt);
  if (!lastFrame) return;
  const stalledMs = performance.now() - lastFrame;
  if (stalledMs < 6000) return;

  if (state.stats.framesRendered > 0) {
    if (stalledMs >= 30000) {
      state.stallNotified = true;
      const seconds = Math.round(stalledMs / 1000);
      setStatus("connected", "Connected", `Remote image unchanged for ${seconds}s`);
      if (state.captureHelpOpen) renderCaptureDiagnostics();
    }
    return;
  }

  state.stallNotified = true;
  const seconds = Math.round(stalledMs / 1000);
  toggleCaptureHelp(true);
  setHudOpen(true);
  showTransportPanel(
    "Remote image did not render",
    `Frames were expected but no remote image rendered for ${seconds}s. Check the password, remote permission prompt, relay reachability, or try Video mode.`
  );
}

window.setInterval(renderQualityMonitor, 1000);
window.setInterval(checkFrameStall, 1500);

bootstrap();
