// ============================
// ✅ EDIT THESE VALUES
// ============================
const SERVER_NAME = "My Minecraft Server";
const SERVER_ADDRESS = "ring-chose.gl.joinmc.link"; // e.g. play.example.com:25565
const BRIDGE_HTTP = "https://roulette-civic-surrounding-menus.trycloudflare.com"; // Bridge base URL (http/https). Leave empty to disable admin features.
// ============================

const REFRESH_MS = 15000;              // status refresh
const HISTORY_MAX_POINTS = 240;        // 60 minutes @ 15s
const LS_HISTORY_KEY = "mc_player_history_v1";
const LS_ADMIN_KEY = "mc_admin_token_v1";

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
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const reconnectBtn = document.getElementById("reconnectBtn");

const modal = document.getElementById("modal");
const pwInput = document.getElementById("pwInput");
const modalLoginBtn = document.getElementById("modalLoginBtn");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const modalMsg = document.getElementById("modalMsg");

const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

serverNameEl.textContent = SERVER_NAME;
serverAddrEl.textContent = SERVER_ADDRESS;

function setLive(state, text){
  liveText.textContent = text;
  dot.style.background = state === "on" ? "var(--green1)"
                    : state === "off" ? "var(--red1)"
                    : "var(--yellow)";
  dot.style.boxShadow = state === "on"
    ? "0 0 0 2px rgba(0,0,0,.35), 0 0 18px rgba(85,255,85,.25)"
    : state === "off"
    ? "0 0 0 2px rgba(0,0,0,.35), 0 0 18px rgba(255,85,85,.25)"
    : "0 0 0 2px rgba(0,0,0,.35), 0 0 18px rgba(255,211,90,.25)";
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
  // resize canvas to device pixel ratio
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const w = rect.width;
  const h = rect.height;

  // background
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.fillRect(0,0,w,h);

  // grid
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

  // line
  ctx.strokeStyle = "rgba(85,255,85,.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  arr.forEach((p, i)=>{
    const x = padL + (i/(arr.length-1))*plotW;
    const y = padT + (1 - (p.v - minV)/(maxV - minV)) * plotH;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // last value text
  const last = arr[arr.length-1].v;
  ctx.fillStyle = "rgba(215,243,255,.9)";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText(`현재: ${last}명 (max scale: ${maxV})`, 10, h-6);
}

window.addEventListener("resize", ()=> drawChart(loadHistory()));

// ------------------
// Admin: login + fetch settings + WebSocket logs
// ------------------
let adminToken = localStorage.getItem(LS_ADMIN_KEY) || "";
let ws = null;

function setAdminUI(loggedIn){
  adminState.textContent = loggedIn ? "로그인됨" : "로그인 필요";
  loginBtn.disabled = loggedIn;
  logoutBtn.disabled = !loggedIn;
  reconnectBtn.disabled = !loggedIn;
}

function wsUrl(){
  if(!BRIDGE_HTTP) return "";
  const u = new URL(BRIDGE_HTTP);
  u.protocol = (u.protocol === "https:") ? "wss:" : "ws:";
  u.pathname = "/ws/logs";
  u.searchParams.set("token", adminToken);
  return u.toString();
}

function appendLog(line){
  // keep last ~2000 lines for performance
  const lines = logBox.textContent.split("\n");
  lines.push(line);
  if(lines.length > 2000) lines.splice(0, lines.length - 2000);
  logBox.textContent = lines.join("\n");
  logBox.scrollTop = logBox.scrollHeight;
}

function connectLogs(){
  if(!adminToken || !BRIDGE_HTTP) return;
  if(ws) { try{ ws.close(); }catch(_){} ws = null; }
  logHint.textContent = "connecting…";
  ws = new WebSocket(wsUrl());
  ws.onopen = () => { logHint.textContent = "live"; appendLog("---- log stream connected ----"); };
  ws.onmessage = (ev) => {
    try{
      const msg = JSON.parse(ev.data);
      if(msg.type === "log") appendLog(msg.line);
      else if(msg.type === "info") appendLog(`---- ${msg.message} ----`);
    }catch(_){
      appendLog(ev.data);
    }
  };
  ws.onclose = () => { logHint.textContent = "disconnected"; appendLog("---- log stream disconnected ----"); };
  ws.onerror = () => { logHint.textContent = "error"; };
}

async function fetchSettings(){
  if(!adminToken || !BRIDGE_HTTP) return;
  const res = await fetch(`${BRIDGE_HTTP.replace(/\/$/, "")}/settings`, {
    headers: { "Authorization": `Bearer ${adminToken}` },
    cache: "no-store"
  });
  if(!res.ok) throw new Error(`settings failed: ${res.status}`);
  return await res.json();
}

function applySettings(s){
  difficultyEl.textContent = s?.difficulty ?? "-";
  gamemodeEl.textContent = s?.gamemode ?? "-";
  whitelistEl.textContent = (s?.whitelist ?? "-").toString();
  onlineModeEl.textContent = (s?.["online-mode"] ?? "-").toString();
  viewDistanceEl.textContent = s?.["view-distance"] ?? "-";
  simDistanceEl.textContent = s?.["simulation-distance"] ?? "-";
  maxPlayersEl.textContent = s?.["max-players"] ?? "-";
  pvpEl.textContent = (s?.pvp ?? "-").toString();
}

async function login(password){
  if(!BRIDGE_HTTP) throw new Error("BRIDGE_HTTP is empty");
  const res = await fetch(`${BRIDGE_HTTP.replace(/\/$/, "")}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if(!res.ok){
    const t = await res.text().catch(()=> "");
    throw new Error(`login failed (${res.status}) ${t}`);
  }
  const j = await res.json();
  if(!j.token) throw new Error("missing token");
  adminToken = j.token;
  localStorage.setItem(LS_ADMIN_KEY, adminToken);
  setAdminUI(true);
  logBox.textContent = "";
  connectLogs();
  const s = await fetchSettings().catch(()=>null);
  if(s) applySettings(s);
}

function logout(){
  adminToken = "";
  localStorage.removeItem(LS_ADMIN_KEY);
  setAdminUI(false);
  applySettings(null);
  logBox.textContent = "로그인을 하면 실시간 로그가 표시됩니다.";
  logHint.textContent = "WebSocket";
  if(ws){ try{ ws.close(); }catch(_){} ws=null; }
}

// Modal hooks
loginBtn.addEventListener("click", ()=>{ modal.hidden = false; modalMsg.textContent=""; pwInput.value=""; pwInput.focus(); });
modalCancelBtn.addEventListener("click", ()=>{ modal.hidden = true; });
modalLoginBtn.addEventListener("click", async ()=>{
  modalMsg.textContent = "로그인 중…";
  try{
    await login(pwInput.value);
    modal.hidden = true;
  }catch(e){
    modalMsg.textContent = `실패: ${e?.message ?? e}`;
  }
});
logoutBtn.addEventListener("click", logout);
reconnectBtn.addEventListener("click", connectLogs);

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

    motdEl.textContent = st.online ? (st.motd || "") : "서버에 연결할 수 없음(공개 IP/포트포워딩 필요)";
    sourceEl.textContent = st.source;
    updatedEl.textContent = new Date().toLocaleTimeString();
    setLive(st.online ? "on" : "off", st.online ? "live" : "offline");

    // update history (playersOnline when online, else 0)
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

  // refresh settings if logged in
  if(adminToken && BRIDGE_HTTP){
    const s = await fetchSettings().catch(()=>null);
    if(s) applySettings(s);
  }
}

(function init(){
  // draw history at start
  const hist = loadHistory();
  drawChart(hist.length ? hist : [{t:Date.now(), v:0}]);

  setAdminUI(!!adminToken && !!BRIDGE_HTTP);
  if(adminToken && BRIDGE_HTTP){
    logBox.textContent = "";
    connectLogs();
    fetchSettings().then(applySettings).catch(()=>applySettings(null));
  }else{
    applySettings(null);
  }

  refresh();
  setInterval(refresh, REFRESH_MS);
})();
