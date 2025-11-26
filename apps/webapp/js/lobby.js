// webapp/js/lobby.js
import { SOCKET_URL, SOCKET_PATH } from "./config.js";

// =======================================
// BACKEND
// =======================================
const BACKEND_URL = "https://basta-backend-game.onrender.com";
const API_BASE = `${BACKEND_URL}/api`;
const ioPath = "/socket.io";

// =======================================
// Sesión del jugador
// =======================================
const qs = new URLSearchParams(location.search);

const gameCode   = qs.get("code") || localStorage.getItem("gameCode");
const playerId   = Number(localStorage.getItem("playerId"));
const playerName = localStorage.getItem("playerName");
const storedIsHost = localStorage.getItem("isHost");

if (!gameCode || !playerId) {
  location.href = "/index_menu.html";
}

// =======================================
// UI
// =======================================
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

// =======================================
// WebSocket
// =======================================
const socket = io(SOCKET_URL, {
  path: SOCKET_PATH,
  transports: ["websocket", "polling"]
});

// =======================================
// Estado
// =======================================
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

// =======================================
// Helpers
// =======================================
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

// =======================================
// Render UI
// =======================================
function render() {
  lblLobbyStatus.textContent = STATE.game.locked ? "Cerrado" : "Abierto";
  lblCount.textContent = STATE.players.length;

  const amIHost = isHost();
  hostPanel.classList.toggle("hidden", !amIHost);
  waitPanel.classList.toggle("hidden", amIHost);

  // Jugadores
  playersEl.innerHTML = "";
  STATE.players.forEach((p) => {
    const row = document.createElement("div");
    row.className = "player";
    row.innerHTML = `
      <strong>${escapeHtml(p.name)}</strong> ${p.is_host ? "⭐" : ""}
    `;
    playersEl.appendChild(row);
  });

  if (amIHost) {
    selPointLimit.value = STATE.game.pointLimit;
    selRoundLimit.value = STATE.game.roundLimit;
  }

  btnToggleLock.textContent = STATE.game.locked ? "Abrir lobby" : "Cerrar lobby";
}

// =======================================
// API
// =======================================
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

// =======================================
// Estado inicial
// =======================================
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

// =======================================
// Acciones de host
// =======================================
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
    const chosenPointLimit = Number(selPointLimit.value);
    const chosenRoundLimit = Number(selRoundLimit.value);

    await api(`/games/${gameCode}/settings`, {
      method: "POST",
      body: { pointLimit: chosenPointLimit, roundLimit: chosenRoundLimit }
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

// =======================================
// WebSocket Events
// =======================================

// Al conectar, entrar a la sala
socket.on("connect", () => {
  socket.emit("game:join", {
    code: gameCode,
    playerId,
    name: playerName
  });
});

// Evento individual (casi no se usa ya)
socket.on("player:joined", (p) => {
  if (!STATE.players.some((x) => x.id === p.id)) {
    STATE.players.push(p);
    render();
  }
});

// === NUEVO: LOBBY COMPLETO ===
socket.on("lobby:update", ({ players, hostId, locked, pointLimit, roundLimit }) => {
  console.log("LOBBY UPDATE RECIBIDO", players);

  STATE.players = players || [];
  STATE.game.hostId = hostId ?? STATE.game.hostId;
  STATE.game.locked = locked ?? STATE.game.locked;
  STATE.game.pointLimit = pointLimit ?? STATE.game.pointLimit;
  STATE.game.roundLimit = roundLimit ?? STATE.game.roundLimit;

  render();
});

// Jugador salió
socket.on("player:left", ({ playerId: leftId }) => {
  STATE.players = STATE.players.filter(p => p.id !== leftId);
  render();
});

// Lobby lock
socket.on("lobby:lock", ({ locked }) => {
  STATE.game.locked = locked;
  render();
});

// Countdown
socket.on("game:starting", ({ tMinus }) => {
  hostPanel.classList.add("hidden");
  waitPanel.classList.remove("hidden");
  startCountdown(tMinus);
});

// Iniciar partida
socket.on("game:started", ({ gameId }) => {
  localStorage.setItem("gameId", String(gameId));
  location.href = "./ingame.html";
});

// =======================================
// Polling fallback
// =======================================
fetchState().catch(console.error);

setInterval(() => {
  if (!socket.connected) fetchState().catch(() => {});
}, 3000);

// =======================================
// Eventos UI
// =======================================
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
  location.href = "/index_menu.html";
});

btnToggleLock.addEventListener("click", toggleLock);
btnStart.addEventListener("click", startGame);

// =======================================
// Countdown
// =======================================
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
