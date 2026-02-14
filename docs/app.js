// ============================
// ✅ EDIT THESE VALUES
// ============================
const SERVER_NAME = "Bedulgi Server";
const SERVER_ADDRESS = "ring-chose.gl.joinmc.link"; // ✅ playit 주소
const BRIDGE_HTTP = "https://checked-approve-communications-configuration.trycloudflare.com"; // ✅ cloudflared가 출력한 주소 (없으면 "" 로)
// ============================

const REFRESH_MS = 15000;
const HISTORY_MAX_POINTS = 240; // 60min @ 15s
const LS_HISTORY_KEY = "mc_player_history_v1";

// UI refs
const dot = document.getElementById("dot");
const liveText = document.getElementById("liveText");
const iconEl = document.getElementById("icon");
const serverNameEl = document.getElementById("serverName");
const serverAddrEl = document.getElementById("serverAddr");
const badgeEl = document.getElementById("badge");
const pingEl = document.getElementById("ping");
const versionEl = document.getElementById("version");
const playersEl = document.getElementById("players");
const fillEl = document.getElementById("fill");
const motdEl = document.getElementById("motd");
const updatedEl = document.getElementById("updated");
const sourceEl = document.getElementById("source");

const difficultyEl = document.getElementById("difficulty");
const gamemodeEl = document.getElementById("gamemode");
const whitelistEl = document.getElementById("whitelist");
const onlineModeEl = document.getElementById("onlineMode");
const viewDistanceEl = document.getElementById("viewDistance");
const simDistanceEl = document.getElementById("simDistance");
const maxPlayersEl = document.getElementById("maxPlayers");
const pvpEl = document.getElementById("pvp");

const logBox = document.getElementById("logBox");
const logHint = document.getElementById("logHint");
const adminState = document.getElementById("adminState");
const reconnectBtn = document.getElementById("reconnectBtn");
const refreshSettingsBtn = document.getElementById("refreshSettingsBtn");

const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

serverNameEl.textContent = SERVER_NAME;
serverAddrEl.textContent = SERVER_ADDRESS;

function setLive(state, text){
  liveText.textContent = text;
  dot.style.background = state === "on" ? "var(--green1)"
                    : state === "off" ? "var(--red1)"
                    : "var(--yellow)";
}
function pct(online, max){
  if(!online || !max) return 0;
  return Math.max(0, Math.min(100, (online / max) * 100));
}
function setBadge(online){
  if(online){
    badgeEl.className = "badge on";
    badgeEl.textContent = "ONLINE";
    fillEl.className = "fill";
  }else{
    badgeEl.className = "badge off";
    badgeEl.textContent = "OFFLINE";
    fillEl.className = "fill off";
  }
}
function setIcon(icon){
  if(icon){
    iconEl.innerHTML = `<img src="${icon}" alt="icon">`;
  }else{
    iconEl.textContent = "?";
  }
}

async function fetchPublicStatus(){
  const encoded = encodeURIComponent(SERVER_ADDRESS);
  const url = `https://api.mcsrvstat.us/3/${encoded}`;
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`public api failed: ${res.status}`);
  const j = await res.json();

  const online = !!j.online;
  const playersOnline = online ? j?.players?.online ?? null : null;
  const playersMax = online ? j?.players?.max ?? null : null;

  let motd = "";
  if (online){
    if (Array.isArray(j?.motd?.clean)) motd = j.motd.clean.join("\n");
    else if (Array.isArray(j?.motd?.raw)) motd = j.motd.raw.join("\n");
  }

  const version = online ? (j?.version ?? "") : "";
  const icon = online && typeof j?.icon === "string" && j.icon.startsWith("data:image") ? j.icon : null;

  return { online, playersOnline, playersMax, motd, version, icon, latency: null, source: "mcsrvstat.us" };
}

// ------------------
// Player history graph (localStorage)
// ------------------
function loadHistory(){
  try{
    const raw = localStorage.getItem(LS_HISTORY_KEY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr)) return [];
    return arr.filter(p => p && typeof p.t === "number" && typeof p.v === "number");
  }catch(_){
    return [];
  }
}
function saveHistory(arr){
  localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(arr.slice(-HISTORY_MAX_POINTS)));
}
function pushHistory(value){
  const arr = loadHistory();
  arr.push({ t: Date.now(), v: Number(value) || 0 });
  saveHistory(arr);
  drawChart(arr);
}
function drawChart(arr){
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.fillRect(0,0,w,h);

  ctx.strokeStyle = "rgba(255,255,255,.06)";
  ctx.lineWidth = 1;
  const gridY = 4;
  for(let i=1;i<gridY;i++){
    const y = (h/gridY)*i;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
  }

  if(arr.length < 2){
    ctx.fillStyle = "rgba(143,179,194,.9)";
    ctx.font = "12px ui-monospace, Menlo, monospace";
    ctx.fillText("데이터 수집 중…", 10, 18);
    return;
  }

  const values = arr.map(p=>p.v);
  const maxV = Math.max(1, ...values);
  const minV = 0;

  const padL = 10, padR = 10, padT = 10, padB = 18;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  ctx.strokeStyle = "rgba(85,255,85,.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  arr.forEach((p, i)=>{
    const x = padL + (i/(arr.length-1))*plotW;
    const y = padT + (1 - (p.v - minV)/(maxV - minV)) * plotH;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  const last = arr[arr.length-1].v;
  ctx.fillStyle = "rgba(215,243,255,.9)";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText(`현재: ${last}명 (max scale: ${maxV})`, 10, h-6);
}

window.addEventListener("resize", ()=> drawChart(loadHistory()));

// ------------------
// Bridge: settings + websocket logs (NO LOGIN)
// ------------------
let ws = null;

function bridgeWsUrl(){
  if(!BRIDGE_HTTP) return "";
  const u = new URL(BRIDGE_HTTP);
  u.protocol = (u.protocol === "https:") ? "wss:" : "ws:";
  u.pathname = "/ws/logs";
  u.search = "";
  return u.toString();
}

function appendLog(line){
  const lines = logBox.textContent.split("\n");
  lines.push(line);
  if(lines.length > 2000) lines.splice(0, lines.length - 2000);
  logBox.textContent = lines.join("\n");
  logBox.scrollTop = logBox.scrollHeight;
}

function connectLogs(){
  if(!BRIDGE_HTTP){
    logHint.textContent = "disabled";
    adminState.textContent = "BRIDGE_HTTP 비어있음";
    return;
  }
  if(ws) { try{ ws.close(); }catch(_){} ws = null; }
  logHint.textContent = "connecting…";
  adminState.textContent = "Bridge 연결 중…";
  logBox.textContent = "";

  ws = new WebSocket(bridgeWsUrl());
  ws.onopen = () => {
    logHint.textContent = "live";
    adminState.textContent = "Bridge 연결됨";
    appendLog("---- log stream connected ----");
  };
  ws.onmessage = (ev) => appendLog(ev.data);
  ws.onclose = () => { logHint.textContent = "disconnected"; appendLog("---- log stream disconnected ----"); };
  ws.onerror = () => { logHint.textContent = "error"; };
}

async function fetchSettings(){
  if(!BRIDGE_HTTP) return null;
  const res = await fetch(`${BRIDGE_HTTP.replace(/\/$/, "")}/settings`, { cache: "no-store" });
  if(!res.ok) throw new Error(`settings failed: ${res.status}`);
  return await res.json();
}

function applySettings(s){
  const get = (k) => (s && s[k] !== undefined && s[k] !== null) ? String(s[k]) : "-";
  difficultyEl.textContent = get("difficulty");
  gamemodeEl.textContent = get("gamemode");
  whitelistEl.textContent = get("whitelist");
  onlineModeEl.textContent = get("online-mode");
  viewDistanceEl.textContent = get("view-distance");
  simDistanceEl.textContent = get("simulation-distance");
  maxPlayersEl.textContent = get("max-players");
  pvpEl.textContent = get("pvp");
}

// buttons
reconnectBtn.addEventListener("click", connectLogs);
refreshSettingsBtn.addEventListener("click", async ()=>{
  adminState.textContent = "설정 불러오는 중…";
  try{
    const s = await fetchSettings();
    applySettings(s);
    adminState.textContent = "설정 갱신 완료";
  }catch(e){
    adminState.textContent = `설정 오류: ${e?.message ?? e}`;
  }
});

// ------------------
// Main refresh loop
// ------------------
async function refresh(){
  setLive("mid", "fetching…");
  try{
    const st = await fetchPublicStatus();
    setBadge(st.online);
    setIcon(st.icon);

    pingEl.textContent = st.online ? (st.latency ?? "-") : "-";
    versionEl.textContent = st.online ? (st.version || "-") : "-";

    const po = st.online ? (st.playersOnline ?? "-") : "-";
    const pm = st.online ? (st.playersMax ?? "-") : "-";
    playersEl.textContent = `${po} / ${pm}`;

    const percent = st.online ? pct(Number(st.playersOnline ?? 0), Number(st.playersMax ?? 0)) : 100;
    fillEl.style.width = `${st.online ? percent : 100}%`;

    motdEl.textContent = st.online ? (st.motd || "") : "서버에 연결할 수 없음(주소/터널 확인)";
    sourceEl.textContent = st.source;
    updatedEl.textContent = new Date().toLocaleTimeString();
    setLive(st.online ? "on" : "off", st.online ? "live" : "offline");

    pushHistory(st.online ? Number(st.playersOnline ?? 0) : 0);
  }catch(e){
    setBadge(false); setIcon(null);
    pingEl.textContent = "-";
    versionEl.textContent = "-";
    playersEl.textContent = "- / -";
    fillEl.style.width = "100%";
    motdEl.textContent = `오류: ${e?.message ?? e}`;
    sourceEl.textContent = "error";
    updatedEl.textContent = new Date().toLocaleTimeString();
    setLive("off", "error");
    pushHistory(0);
  }

  // refresh settings occasionally
  if(BRIDGE_HTTP){
    fetchSettings().then(applySettings).catch(()=>{});
  }
}

(function init(){
  const hist = loadHistory();
  drawChart(hist.length ? hist : [{t:Date.now(), v:0}]);

  if(BRIDGE_HTTP){
    connectLogs();
    fetchSettings().then(applySettings).catch(e=>{
      adminState.textContent = `Bridge 오류: ${e?.message ?? e}`;
      applySettings(null);
    });
  }else{
    adminState.textContent = "Bridge 비활성화(BRIDGE_HTTP=\"\")";
    applySettings(null);
  }

  refresh();
  setInterval(refresh, REFRESH_MS);
})();