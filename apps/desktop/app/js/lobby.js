// webapp/js/lobby.js
const API_BASE = "/api";
const ioPath = "/socket.io";
const qs = new URLSearchParams(location.search);

// ----------------------------------
// Datos de sesión
// ----------------------------------
const gameCode   = qs.get("code") || localStorage.getItem("gameCode");
const playerId   = Number(localStorage.getItem("playerId"));
const playerName = localStorage.getItem("playerName");
const storedIsHost = localStorage.getItem("isHost");

if (!gameCode || !playerId) {
  location.href = "/index_menu.html";
}

// ----------------------------------
// UI refs
// ----------------------------------
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

// ----------------------------------
// Socket
// ----------------------------------
const socket = io("/", { path: ioPath, transports: ["websocket", "polling"] });

// Estado
let STATE = {
  game: { code: gameCode, locked: false, hostId: null, pointLimit: 1500, roundLimit: 5 },
  players: [],
};

// ----------------------------------
// Helpers
// ----------------------------------
const isHost = () => {
  if (storedIsHost !== null) return storedIsHost === "true";
  return STATE.game.hostId === playerId;
};

function render() {
  lblLobbyStatus.textContent = STATE.game.locked ? "Cerrado" : "Abierto";
  lblCount.textContent = String(STATE.players.length);

  const amIHost = isHost();
  hostPanel.classList.toggle("hidden", !amIHost);
  waitPanel.classList.toggle("hidden", amIHost);

  // jugadores
  playersEl.innerHTML = "";
  STATE.players.forEach((p) => {
    const row = document.createElement("div");
    row.className = "player";

    const isHostTag = p.is_host ? " ⭐" : "";

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(p.name)}</strong>
        <span class="tag">${isHostTag}</span>
      </div>
    `;
    playersEl.appendChild(row);
  });

  // aplicar valores actuales (host lo verá)
  if (amIHost) {
    selPointLimit.value = STATE.game.pointLimit;
    selRoundLimit.value = STATE.game.roundLimit;
  }

  btnToggleLock.textContent = STATE.game.locked ? "Abrir lobby" : "Cerrar lobby";
}

// ----------------------------------
// API Wrapper
// ----------------------------------
async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchState() {
  const data = await api(`/games/${encodeURIComponent(gameCode)}`);

  STATE.game = {
    ...data.game,
    pointLimit: data.game.pointLimit || data.pointLimit || 1500,
    roundLimit: data.game.roundLimit || data.roundLimit || 5
  };

  STATE.players = data.players || [];

  const me = STATE.players.find((p) => p.id === playerId);
  if (me) localStorage.setItem("isHost", String(me.is_host === 1));

  render();
}

// ----------------------------------
// Acciones
// ----------------------------------
async function toggleLock() {
  try {
    const newLocked = !STATE.game.locked;
    await api(`/games/${gameCode}/lock`, {
      method: "POST",
      body: { locked: newLocked },
    });
  } catch (e) {
    console.error(e);
  }
}

async function startGame() {
  try {
    // 1. Primero mandar los límites al backend
    const chosenPointLimit = Number(selPointLimit.value);
    const chosenRoundLimit = Number(selRoundLimit.value);

    await api(`/games/${gameCode}/settings`, {
      method: "POST",
      body: {
        pointLimit: chosenPointLimit,
        roundLimit: chosenRoundLimit
      }
    });

    // 2. Animación visual antes de iniciar
    await api(`/games/${gameCode}/start`, {
      method: "POST",
      body: { tMinus: 3 }
    });

    // 3. Crear la primera ronda real
    setTimeout(async () => {
      await api(`/games/${gameCode}/rounds`, {
        method: "POST",
        body: { durationSec: 60 }
      });
    }, 3000);

  } catch (e) {
    console.error(e);
  }
}

// ----------------------------------
// Websocket events
// ----------------------------------
socket.on("connect", () => {
  socket.emit("game:join", { code: gameCode, playerId, name: playerName });
});

socket.on("player:joined", (p) => {
  STATE.players.push(p);
  render();
});

// WS: lobby cerrado/abierto
socket.on("lobby:lock", ({ locked }) => {
  STATE.game.locked = locked;
  render();
});

// WS: cuando el host inicia la cuenta atrás
socket.on("game:starting", ({ tMinus }) => {
  hostPanel.classList.add("hidden");
  waitPanel.classList.remove("hidden");
  startCountdown(tMinus);
});

// WS: juego empieza → ir a ingame
socket.on("game:started", ({ gameId }) => {
  localStorage.setItem("gameId", String(gameId));
  location.href = "/public/ingame.html";
});

// ----------------------------------
// Fallback polling
// ----------------------------------
fetchState().catch(console.error);
setInterval(() => {
  if (!socket.connected) fetchState().catch(() => {});
}, 3000);

// ----------------------------------
// UI events
// ----------------------------------
btnCopy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(gameCode);
  btnCopy.textContent = "Copiado ✓";
  setTimeout(() => (btnCopy.textContent = "Copiar código"), 1200);
});

btnLeave.addEventListener("click", async () => {
  try {
    await api(`/games/${gameCode}/players/${playerId}/leave`, {
      method: "POST",
    });
  } catch {}
  location.href = "/index_menu.html";
});

btnToggleLock.addEventListener("click", toggleLock);
btnStart.addEventListener("click", startGame);

// ----------------------------------
// Countdown visual
// ----------------------------------
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

// ----------------------------------
// utils
// ----------------------------------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}
