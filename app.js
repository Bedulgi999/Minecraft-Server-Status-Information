// ============================
// ✅ 너 서버 고정 설정 (여기만 바꿔)
// ============================
const SERVER_NAME = "My Minecraft Server";
const SERVER_ADDRESS = "YOUR_DOMAIN_OR_PUBLIC_IP:25565"; // 예: play.example.com:25565

// 브릿지 API (선택이지만 "난이도/설정" 보려면 필수)
// 예: https://your-bridge.example.com
const BRIDGE_URL = ""; // 없으면 ""로 둬도 됨
const BRIDGE_TOKEN = ""; // 브릿지에서 설정한 토큰 (없으면 "")

// ============================

const dot = document.getElementById("dot");
const liveText = document.getElementById("liveText");

const serverNameEl = document.getElementById("serverName");
const serverAddrEl = document.getElementById("serverAddr");
const badgeEl = document.getElementById("badge");

const iconEl = document.getElementById("icon");
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

const settingsHint = document.getElementById("settingsHint");

serverNameEl.textContent = SERVER_NAME;
serverAddrEl.textContent = SERVER_ADDRESS;

function esc(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
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

// ✅ 공개 API: mcsrvstat.us (Java)
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

  return {
    online,
    playersOnline,
    playersMax,
    motd,
    version,
    icon,
    latency: null, // 이 API는 ping(ms)를 항상 주진 않음
    source: "mcsrvstat.us"
  };
}

// ✅ 브릿지 API: /settings (server.properties + rcon(선택) 기반)
async function fetchBridgeSettings(){
  if(!BRIDGE_URL) return null;

  const headers = {};
  if (BRIDGE_TOKEN) headers["Authorization"] = `Bearer ${BRIDGE_TOKEN}`;

  const res = await fetch(`${BRIDGE_URL.replace(/\/$/,"")}/settings`, { cache:"no-store", headers });
  if(!res.ok) throw new Error(`bridge failed: ${res.status}`);
  return await res.json();
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

function setSettings(s){
  if(!s){
    settingsHint.textContent = "설정 표시하려면 브릿지 API를 켜고 app.js에 BRIDGE_URL을 넣어줘.";
    return;
  }
  settingsHint.textContent = "브릿지 API 연결됨.";

  difficultyEl.textContent = s.difficulty ?? "-";
  gamemodeEl.textContent = s.gamemode ?? "-";
  whitelistEl.textContent = (s.whitelist ?? "-").toString();
  onlineModeEl.textContent = (s["online-mode"] ?? "-").toString();
  viewDistanceEl.textContent = s["view-distance"] ?? "-";
  simDistanceEl.textContent = s["simulation-distance"] ?? "-";
  maxPlayersEl.textContent = s["max-players"] ?? "-";
  pvpEl.textContent = (s.pvp ?? "-").toString();
}

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

  }catch(e){
    setBadge(false);
    setIcon(null);
    pingEl.textContent = "-";
    versionEl.textContent = "-";
    playersEl.textContent = "- / -";
    fillEl.style.width = "100%";
    motdEl.textContent = `오류: ${e?.message ?? e}`;
    sourceEl.textContent = "error";
    updatedEl.textContent = new Date().toLocaleTimeString();
    setLive("off", "error");
  }

  // settings(브릿지)도 같이 갱신
  try{
    const settings = await fetchBridgeSettings();
    setSettings(settings);
  }catch(e){
    setSettings(null);
  }
}

refresh();
setInterval(refresh, 15000);