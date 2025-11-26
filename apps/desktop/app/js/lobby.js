// ===============================
// lobby.js — versión para ELECTRON
// ===============================

// Socket.IO ES Module desde CDN (¡OBLIGATORIO!)
import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

// ===============================
// BACKEND (Render)
// ===============================
const BACKEND_URL = "https://basta-backend-game.onrender.com";
const API_BASE = `${BACKEND_URL}/api`;
const ioPath = "/socket.io";

// ===============================
// Sesión player
// ===============================
const qs = new URLSearchParams(location.search);

const gameCode   = qs.get("code") || localStorage.getItem("gameCode");
const playerId   = Number(localStorage.getItem("playerId"));
const playerName = localStorage.getItem("playerName");
const storedIsHost = localStorage.getItem("isHost");

if (!gameCode || !playerId) {
  location.href = "../index_menu.html"; // FIX en desktop
}

// ===============================
// UI refs
// ===============================
const $ = (s) => document.querySelector(s);

const playersEl      = $("#players");
const lblCode        = $("#lblCode");
const lblLobbyStatus = $("#lblLobbyStatus");
const lblCount       = $("#lblCount");

const hostPanel      = $("#hostPanel");
const waitPanel      = $("#waitPanel");
const countEl        = $("#countdown");

const btnCopy        = $("#btnCopy");
const btnLeave       = $("#btnLeave");
const btnStart       = $("#btnStart");
const btnToggleLock  = $("#btnToggleLock");

const selPointLimit  = $("#selPointLimit");
const selRoundLimit  = $("#selRoundLimit");

lblCode.textContent = gameCode;

// ===============================
// WebSocket (Render)
// ===============================
const socket = io(BACKEND_URL, {
  path: ioPath,
  transports: ["websocket", "polling"]
});

// ===============================
// Estado
// ===============================
let STATE = {
  game: {
    code: gameCode,
    locked: false,
    hostId: null,
    pointLimit: 1500,
    roundLimit: 7
  },
  players: []
};

// ===============================
// Helpers
// ===============================
function isHost() {
  if (storedIsHost !== null) return storedIsHost === "true";
  return STATE.game.hostId === playerId;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// ===============================
// Render UI
// ===============================
function render() {
  lblLobbyStatus.textContent = STATE.game.locked ? "Cerrado" : "Abierto";
  lblCount.textContent = STATE.players.length;

  const amIHost = isHost();
  hostPanel.classList.toggle("hidden", !amIHost);
  waitPanel.classList.toggle("hidden", amIHost);

  playersEl.innerHTML = "";
  STATE.players.forEach((p) => {
    const div = document.createElement("div");
    div.className = "player";
    div.innerHTML = `
      <strong>${escapeHtml(p.name)}</strong> ${p.is_host ? "⭐" : ""}
    `;
    playersEl.appendChild(div);
  });

  if (amIHost) {
    selPointLimit.value = STATE.game.pointLimit;
    selRoundLimit.value = STATE.game.roundLimit;
  }

  btnToggleLock.textContent = STATE.game.locked ? "Abrir lobby" : "Cerrar lobby";
}

// ===============================
// API Wrapper
// ===============================
async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
  return json;
}

// ===============================
// Estado inicial
// ===============================
async function fetchState() {
  const data = await api(`/games/${encodeURIComponent(gameCode)}`);

  STATE.game = {
    ...data.game,
    pointLimit: data.game.pointLimit ?? 1500,
    roundLimit: data.game.roundLimit ?? 7
  };

  STATE.players = data.players ?? [];

  const me = STATE.players.find((p) => p.id === playerId);
  if (me) localStorage.setItem("isHost", String(me.is_host === 1));

  render();
}

// ===============================
// Acciones del host
// ===============================
async function toggleLock() {
  try {
    await api(`/games/${gameCode}/lock`, {
      method: "POST",
      body: { locked: !STATE.game.locked }
    });
  } catch (err) {
    console.error(err);
  }
}

async function startGame() {
  try {
    await api(`/games/${gameCode}/settings`, {
      method: "POST",
      body: {
        pointLimit: Number(selPointLimit.value),
        roundLimit: Number(selRoundLimit.value)
      }
    });

    await api(`/games/${gameCode}/start`, {
      method: "POST",
      body: { tMinus: 3 }
    });

    setTimeout(async () => {
      await api(`/games/${gameCode}/rounds`, {
        method: "POST",
        body: { durationSec: 60 }
      });
    }, 3000);

  } catch (err) {
    console.error(err);
  }
}

// ===============================
// Socket Events
// ===============================
socket.on("connect", () => {
  socket.emit("game:join", {
    code: gameCode,
    playerId,
    name: playerName
  });
});

socket.on("player:joined", (p) => {
  if (!STATE.players.some((x) => x.id === p.id)) {
    STATE.players.push(p);
    render();
  }
});

socket.on("lobby:lock", ({ locked }) => {
  STATE.game.locked = locked;
  render();
});

socket.on("game:starting", ({ tMinus }) => {
  hostPanel.classList.add("hidden");
  waitPanel.classList.remove("hidden");
  startCountdown(tMinus);
});

socket.on("game:started", ({ gameId }) => {
  localStorage.setItem("gameId", String(gameId));
  location.href = "./ingame.html"; // RUTA CORRECTA EN ELECTRON
});

// ===============================
// Fallback
// ===============================
fetchState().catch(console.error);

setInterval(() => {
  if (!socket.connected) fetchState().catch(() => {});
}, 3000);

// ===============================
// UI Events
// ===============================
btnCopy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(gameCode);
  btnCopy.textContent = "Copiado ✓";
  setTimeout(() => (btnCopy.textContent = "Copiar código"), 1200);
});

btnLeave.addEventListener("click", async () => {
  try {
    await api(`/games/${gameCode}/players/${playerId}/leave`, {
      method: "POST"
    });
  } catch {}
  location.href = "../index_menu.html"; // FIX
});

btnToggleLock.addEventListener("click", toggleLock);
btnStart.addEventListener("click", startGame);

// ===============================
// Cuenta regresiva visual
// ===============================
function startCountdown(from = 3) {
  countEl.classList.remove("hidden");
  let n = from;
  countEl.textContent = n;

  const t = setInterval(() => {
    n--;
    if (n <= 0) {
      clearInterval(t);
      countEl.textContent = "¡Ya!";
      return;
    }
    countEl.textContent = n;
  }, 1000);
}
