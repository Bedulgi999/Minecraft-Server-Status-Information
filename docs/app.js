// ================================
// 설정 (너가 바꾸는 곳은 여기 2줄만)
// ================================
const SERVER_ADDRESS = "ring-chose.gl.joinmc.link"; // ✅ playit 주소
const BRIDGE_HTTP = "https://high-speed-forms-merely.trycloudflare.com"; // ✅ cloudflared가 출력한 주소 (없으면 "" 로)

// 폴링 간격 (bridge 쪽은 15초 샘플링)
const UI_REFRESH_MS = 5000;
const HISTORY_LIMIT = 360; // 360 points ~ 90분(15s)

// ================================
const $ = (id) => document.getElementById(id);

const el = {
  globalDot: $("globalDot"),
  globalText: $("globalText"),
  badge: $("badge"),
  serverAddr: $("serverAddr"),
  pingVal: $("pingVal"),
  verVal: $("verVal"),
  playerFill: $("playerFill"),
  playerVal: $("playerVal"),
  motdVal: $("motdVal"),
  chart: $("chart"),
  chartFoot: $("chartFoot"),
  bridgeState: $("bridgeState"),
  settingsGrid: $("settingsGrid"),
  logs: $("logs"),
  btnClearLogs: $("btnClearLogs"),
  btnReloadSettings: $("btnReloadSettings"),
  historyHint: $("historyHint"),
};

function setOnlineUI(online) {
  if (online) {
    el.globalDot.style.background = "var(--good)";
    el.globalText.textContent = "online";
    el.badge.textContent = "ONLINE";
    el.badge.style.background = "rgba(69,224,143,.22)";
    el.badge.style.color = "#d6ffe9";
  } else {
    el.globalDot.style.background = "var(--bad)";
    el.globalText.textContent = "offline";
    el.badge.textContent = "OFFLINE";
    el.badge.style.background = "rgba(255,0,0,.22)";
    el.badge.style.color = "#ffd0d0";
  }
}

function safeUrlJoin(base, path) {
  if (!base) return path;
  return base.replace(/\/+$/, "") + path;
}

function wsUrlFor(baseHttp, wsPath) {
  const u = new URL(baseHttp);
  u.protocol = (u.protocol === "https:") ? "wss:" : "ws:";
  u.pathname = wsPath;
  u.search = "";
  return u.toString();
}

async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.json();
}

// ================================
// STATUS (브라우저가 25565 직접 못 때리는 문제 해결: bridge에서 핑)
// ================================
async function refreshStatus() {
  try {
    const status = await fetchJson(safeUrlJoin(BRIDGE_HTTP, "/status"));
    setOnlineUI(!!status.online);

    el.pingVal.textContent = status.latency_ms != null ? `${status.latency_ms} ms` : "-";
    el.verVal.textContent = status.version_name || "-";

    const on = Number(status.players_online || 0);
    const mx = Number(status.players_max || 0);
    el.playerVal.textContent = (mx > 0) ? `${on} / ${mx}` : `${on} / -`;
    el.playerFill.style.width = (mx > 0) ? `${Math.min(100, Math.round((on / mx) * 100))}%` : (on > 0 ? "30%" : "0%");
    el.motdVal.textContent = status.motd || "-";

    el.chartFoot.textContent = `현재: ${on}명`;
    el.bridgeState.textContent = `Bridge: OK (${status.mc_host}:${status.mc_port})`;
  } catch (e) {
    // bridge 자체가 죽었거나 주소가 틀린 경우
    setOnlineUI(false);
    el.bridgeState.textContent = `Bridge: ERROR (${e.message})`;
  }
}

// ================================
// HISTORY
// ================================
function drawHistory(points) {
  const canvas = el.chart;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // background grid
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,.06)";
  for (let i = 0; i <= 10; i++) {
    const y = Math.round((H * i) / 10);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  if (!points || points.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.font = "16px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText("No data", 20, 40);
    return;
  }

  const values = points.map(p => (p.online ? (p.players_online || 0) : 0));
  const maxV = Math.max(1, ...values);

  // line
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(124,255,107,.95)";
  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = (W - 20) * (i / (values.length - 1)) + 10;
    const y = H - 10 - ((H - 20) * (values[i] / maxV));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // max label
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(`max scale: ${maxV}`, 12, H - 12);
}

async function refreshHistory() {
  try {
    const data = await fetchJson(safeUrlJoin(BRIDGE_HTTP, `/history?limit=${HISTORY_LIMIT}`));
    const points = data.points || [];
    const interval = data.interval_sec || 15;
    const mins = Math.round((points.length * interval) / 60);
    el.historyHint.textContent = `최근 ${mins}분 (${interval}s 간격)`;
    drawHistory(points);
  } catch (e) {
    // ignore, status에서 브릿지 에러 표시됨
  }
}

// ================================
// SETTINGS
// ================================
function renderSettings(props) {
  el.settingsGrid.innerHTML = "";
  const order = [
    "difficulty", "gamemode", "white-list", "online-mode",
    "view-distance", "simulation-distance", "max-players", "pvp",
    "server-port", "motd"
  ];
  const keys = order.filter(k => props[k] !== undefined);
  for (const k of keys) {
    const v = props[k];
    const div = document.createElement("div");
    div.className = "set";
    div.innerHTML = `<div class="k">${k.toUpperCase()}</div><div class="v">${(v ?? "-")}</div>`;
    el.settingsGrid.appendChild(div);
  }
}

async function refreshSettings() {
  try {
    const data = await fetchJson(safeUrlJoin(BRIDGE_HTTP, "/settings"));
    renderSettings(data.properties || {});
  } catch (e) {
    // settings는 실패해도 치명적 아님
  }
}

// ================================
// LOGS WS
// ================================
let ws = null;

function appendLog(line) {
  const maxLines = 800;
  const cur = el.logs.textContent.split("\n");
  cur.push(line);
  if (cur.length > maxLines) cur.splice(0, cur.length - maxLines);
  el.logs.textContent = cur.join("\n");
  el.logs.scrollTop = el.logs.scrollHeight;
}

function connectLogs() {
  if (!BRIDGE_HTTP || BRIDGE_HTTP.includes("YOUR_CURRENT_TRYCLOUDFLARE_URL")) {
    appendLog("[ui] BRIDGE_HTTP가 설정되지 않았습니다. app.js 상단의 BRIDGE_HTTP를 바꿔주세요.");
    return;
  }

  const url = wsUrlFor(BRIDGE_HTTP, "/ws/logs");
  ws = new WebSocket(url);

  ws.onopen = () => appendLog("[ui] log ws connected");
  ws.onmessage = (ev) => appendLog(ev.data);
  ws.onclose = () => {
    appendLog("[ui] log ws disconnected (retry in 3s)");
    setTimeout(connectLogs, 3000);
  };
  ws.onerror = () => {
    // onclose에서 재시도
  };
}

// ================================
// INIT
// ================================
function init() {
  el.serverAddr.textContent = SERVER_ADDRESS;

  el.btnClearLogs.addEventListener("click", () => {
    el.logs.textContent = "";
  });

  el.btnReloadSettings.addEventListener("click", async () => {
    await refreshSettings();
    appendLog("[ui] settings reloaded");
  });

  // first load
  refreshStatus();
  refreshHistory();
  refreshSettings();
  connectLogs();

  // periodic refresh
  setInterval(refreshStatus, UI_REFRESH_MS);
  setInterval(refreshHistory, UI_REFRESH_MS * 3);
}

init();