// webapp/js/ingame.js
import { startConfetti, stopConfetti } from "./confetti.js";

// BACKEND DEPLOYED EN RENDER
const BACKEND_URL = "https://basta-backend-game.onrender.com";
const API_BASE = `${BACKEND_URL}/api`;

/* =======================================================
   SESSION
======================================================= */
const gameCode = localStorage.getItem("gameCode");
const playerId = Number(localStorage.getItem("playerId"));
const playerName = localStorage.getItem("playerName") || "Yo";
const gameId = Number(localStorage.getItem("gameId"));

if (!gameCode || !playerId) {
  location.href = "../index_menu.html";
}

/* =======================================================
   DOM
======================================================= */
const $ = (s) => document.querySelector(s);
const playersEl = $("#players");
const countBadge = $("#countBadge");

const roundLetterEl = $("#roundLetter");
const roundInfoEl = $("#roundInfo");
const roundTimeEl = $("#roundTime");
const roundProgEl = $("#roundProgress");
const catsEl = $("#categories");

const roundCounterEl = $("#roundCounter");
const pointsCounterEl = $("#pointsCounter");

const podiumEl = $("#podium");
const youScoreEl = $("#youScore");
const overlayStart = $("#overlayStart");

const btnSubmit = $("#btnSubmit");
const btnLeave = $("#btnLeave");

/* =======================================================
   SOCKET
======================================================= */
const socket = io(BACKEND_URL, {
  path: "/socket.io",
  transports: ["websocket", "polling"]
});

/* =======================================================
   STATE
======================================================= */
let STATE = {
  gameId,
  players: [],
  scores: [],
  me: { id: playerId, name: playerName, score: 0 },

  gameLimits: {
    roundLimit: 0,
    pointLimit: 0,
    currentRound: 0
  },

  round: {
    id: null,
    letter: "—",
    secs: 0,
    left: 0,
    running: false,
    submitted: false,
    categories: []
  }
};

/* =======================================================
   UTILS
======================================================= */
const pad = (n) => String(n).padStart(2, "0");
const fmt = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

function escapeHtml(s) {
  s = s ?? "";
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function resetRoundState() {
  STATE.round = {
    id: null,
    letter: "—",
    secs: 0,
    left: 0,
    running: false,
    submitted: false,
    categories: []
  };
}

function normalizeScoreEntry(id, value) {
  const numId = Number(id);
  if (!value || typeof value !== "object") {
    return {
      id: numId,
      name: STATE.players.find((p) => p.id === numId)?.name || "Jugador",
      total: Number(value) || 0
    };
  }

  const total = Number(value.total ?? value.score ?? 0) || 0;
  const rawName =
    value.name ||
    value.player?.name ||
    STATE.players.find((p) => p.id === numId)?.name ||
    "Jugador";

  return { id: numId, name: String(rawName), total };
}

/* =======================================================
   RENDER
======================================================= */
function renderPlayers() {
  playersEl.innerHTML = "";
  countBadge.textContent = STATE.players.length;

  const scoreMap = new Map(STATE.scores.map((s) => [s.id, s.total]));

  STATE.players.forEach((p) => {
    const total = scoreMap.get(p.id) ?? p.total ?? p.score ?? 0;
    const safeName =
      typeof p.name === "string" ? p.name : p.name?.name || "Jugador";

    const div = document.createElement("div");
    div.className = "player" + (p.id === STATE.me.id ? " me" : "");
    div.innerHTML = `
      <strong>${escapeHtml(safeName)}</strong>
      <small>${total} pts</small>
    `;
    playersEl.appendChild(div);
  });
}

function renderRoundCounters() {
  const { currentRound, roundLimit, pointLimit } = STATE.gameLimits;
  roundCounterEl.textContent = `Ronda ${currentRound}/${roundLimit}`;
  pointsCounterEl.textContent = `${STATE.me.score} / ${pointLimit} pts`;
}

function renderRound() {
  roundLetterEl.textContent = STATE.round.letter;
  roundInfoEl.textContent = STATE.round.running ? "Ronda en curso" : "Esperando ronda…";
  roundTimeEl.textContent = fmt(STATE.round.left);

  const pct = STATE.round.secs
    ? Math.max(0, Math.min(100, (STATE.round.left / STATE.round.secs) * 100))
    : 0;
  roundProgEl.style.width = `${pct}%`;

  catsEl.innerHTML = "";

  STATE.round.categories.forEach((cat) => {
    const div = document.createElement("div");

    div.className = `
      bg-slate-900/40 
      border border-slate-700 
      rounded-2xl 
      p-4 
      shadow 
      flex flex-col 
      gap-2 
      transform transition 
      animate-fade-up
    `;

    div.innerHTML = `
      <label class="text-sm font-semibold text-slate-300">
        ${escapeHtml(cat.name)}
      </label>

      <input
        data-catid="${cat.id}"
        placeholder="${escapeHtml(cat.placeholder || "Escribe tu respuesta")}"
        autocomplete="off"
        class="
          w-full px-4 py-3
          bg-slate-800/60
          text-slate-200
          border border-slate-700
          rounded-xl
          placeholder-slate-500
          focus:outline-none
          focus:ring-2
          focus:ring-brand-500/50
          focus:border-brand-500
          transition
          shadow-inner
        "
      />
    `;

    catsEl.appendChild(div);
  });

  setTimeout(() => {
    const first = catsEl.querySelector("input");
    if (first) first.focus();
  }, 150);

  renderRoundCounters();
}

function renderPodium() {
  podiumEl.innerHTML = "";

  const cleanScores = STATE.scores
    .map((s) => ({
      id: Number(s.id),
      name: typeof s.name === "string" ? s.name : (s.name?.name || "Jugador"),
      total: Number(s.total) || 0,
    }))
    .filter((s) => s.id && s.name)
    .sort((a, b) => b.total - a.total);

  if (cleanScores.length === 0) {
    youScoreEl.textContent = "0";
    return;
  }

  cleanScores.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = `
      flex justify-between items-center 
      bg-slate-800/60 border border-slate-700 
      py-2 px-3 rounded-xl mb-2
      transition-all duration-300
    `;

    row.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-brand-400 text-sm font-bold">${i + 1}</span>
        <span class="font-semibold text-white">${escapeHtml(p.name)}</span>
      </div>
      <span class="text-slate-300 font-bold">${p.total} pts</span>
    `;

    podiumEl.appendChild(row);
  });

  const my = cleanScores.find((s) => s.id === STATE.me.id)?.total ?? 0;
  STATE.me.score = my;
  youScoreEl.textContent = String(my);
}

function renderAll() {
  renderPlayers();
  renderRound();
  renderPodium();
}

/* =======================================================
   API
======================================================= */
async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchIngame() {
  try {
    const data = await api(`/games/${encodeURIComponent(gameCode)}/ingame`);

    STATE.gameLimits.roundLimit = Number(data.roundLimit ?? 0);
    STATE.gameLimits.pointLimit = Number(data.pointLimit ?? 0);
    STATE.gameLimits.currentRound = Number(data.roundsPlayed ?? 0);

    if (!data.round) {
      resetRoundState();
    } else {
      STATE.round = {
        id: data.round.id,
        letter: data.round.letter,
        secs: Number(data.round.secs),
        left: Number(data.round.left),
        running: Boolean(data.round.running),
        submitted: false,
        categories: data.round.categories || []
      };
    }

    STATE.players = data.players || [];

    if (Array.isArray(data.scores)) {
      STATE.scores = data.scores.map((s) => normalizeScoreEntry(s.id, s));
    } else if (data.scores && typeof data.scores === "object") {
      STATE.scores = Object.entries(data.scores).map(([id, val]) =>
        normalizeScoreEntry(id, val)
      );
    } else {
      STATE.scores = [];
    }

    const mineFromScores = STATE.scores.find((s) => s.id === STATE.me.id);
    const mineFromPlayers = STATE.players.find((p) => p.id === STATE.me.id);

    STATE.me.score =
      mineFromScores?.total ??
      mineFromPlayers?.total ??
      mineFromPlayers?.score ??
      0;

    renderAll();
  } catch (e) {
    console.warn("polling fail", e);
  }
}

/* =======================================================
   SOCKET EVENTS
======================================================= */
socket.on("connect", () => {
  socket.emit("game:join", { code: gameCode, playerId, name: playerName });
});

socket.on("game:closed", () => {
  alert("La partida ha finalizado.");
  location.href = "../index_menu.html";
});

socket.on("player:joined", (p) => {
  if (!STATE.players.some((x) => x.id === p.id)) STATE.players.push(p);
  renderPlayers();
});

socket.on("player:left", ({ id }) => {
  STATE.players = STATE.players.filter((p) => p.id !== id);
  renderPlayers();
});

socket.on("round:progress", ({ submitted, needed }) => {
  const el = document.getElementById("roundProgressText");
  if (!el) return;
  el.textContent = `${submitted} / ${needed} jugadores han enviado`;
  el.style.opacity = "1";
});

/* 🔥 NUEVO: actualizar categorías si llegan aparte */
socket.on("round:categories", (cats) => {
  STATE.round.categories = Array.isArray(cats) ? cats : [];
  renderRound();
});

/* -----------------------------
   RONDA EMPIEZA
----------------------------- */
socket.on("round:started", (p) => {
  const secs = Number(p.durationSec ?? p.secs) || 60;

  STATE.gameLimits.currentRound = Number(
    p.roundNumber ?? STATE.gameLimits.currentRound
  );

STATE.round = {
  id: p.roundId ?? p.id ?? p.round?.id ?? null,
  letter: p.letter,
  secs,
  left: secs,
  running: true,
  submitted: false,
  categories: p.categories || []
};


  const el = document.getElementById("roundProgressText");
  if (el) el.style.opacity = "0";

  btnSubmit.textContent = "¡BASTA!";
  btnSubmit.disabled = false;

  overlayStart.classList.add("hidden");
  renderRound();
});

/* -----------------------------
   RONDA TERMINA (soporta 2 payloads)
----------------------------- */
socket.on("round:ended", (payload) => {
  console.log("ROUND ENDED PAYLOAD:", payload);

  STATE.round.running = false;

  // Puede venir como { scores: [...] }
  // o como { results: { scores, duplicates }, nextInSec }
  let scores = payload.scores;
  if (!scores && payload.results && Array.isArray(payload.results.scores)) {
    scores = payload.results.scores;
  }

  if (scores) {
    if (Array.isArray(scores)) {
      STATE.scores = scores.map((s) => normalizeScoreEntry(s.id, s));
    } else if (typeof scores === "object") {
      STATE.scores = Object.entries(scores).map(([id, val]) =>
        normalizeScoreEntry(id, val)
      );
    }
  }

  const mine = STATE.scores.find((p) => p.id === STATE.me.id);
  STATE.me.score = mine?.total ?? STATE.me.score ?? 0;

  roundInfoEl.textContent = "Ronda finalizada";
  overlayStart.classList.remove("hidden");
  renderAll();
});

/* -----------------------------
   PARTIDA TERMINADA
----------------------------- */
socket.on("game:finished", ({ winner }) => {
  STATE.round.running = false;

  startConfetti();

  overlayStart.innerHTML = `
    <div class="flex flex-col items-center justify-center text-center 
                bg-slate-900/90 backdrop-blur-xl p-10 rounded-3xl border border-slate-700 
                shadow-2xl max-w-sm mx-auto animate-fade-up">

        <div class="text-5xl mb-4">🏆</div>

        <h2 class="text-2xl font-extrabold text-white tracking-wide mb-2">
            ¡Ganador!
        </h2>

        <p class="text-brand-400 text-xl font-bold mb-6">
            ${escapeHtml(winner.name)}
        </p>

        <div class="text-4xl font-black text-white mb-6">
            ${winner.total} <span class="text-sm font-semibold text-slate-400">puntos</span>
        </div>

        <button id="exitBtn"
                class="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r 
                       from-brand-600 to-indigo-600 text-white font-bold shadow-lg 
                       hover:from-brand-500 hover:to-indigo-500 transition active:scale-95">
            Salir
        </button>
    </div>
  `;

  overlayStart.classList.remove("hidden");

  document.getElementById("exitBtn").onclick = () => {
    stopConfetti();
    location.href = "../index_menu.html";
  };
});

/* =======================================================
   ACCIONES
======================================================= */
btnLeave.addEventListener("click", async () => {
  try {
    await api(`/games/${gameCode}/players/${playerId}/leave`, {
      method: "POST"
    });
  } catch {}
  location.href = "../index_menu.html";
});

btnSubmit.addEventListener("click", submitAnswers);

function collectAnswers() {
  const arr = [];
  catsEl.querySelectorAll("input[data-catid]").forEach((i) => {
    arr.push({
      categoryId: Number(i.dataset.catid),
      text: i.value.trim()
    });
  });
  return arr;
}

// Validación mínima: requiere al menos 3 respuestas con texto
function validateAnswers() {
  const inputs = [...catsEl.querySelectorAll("input[data-catid]")];
  const nonEmpty = inputs.filter((i) => i.value.trim() !== "");

  if (nonEmpty.length >= 3) return true;

  // Marcar visualmente (rojo + vibración)
  inputs.forEach((i) => {
    if (!i.value.trim()) {
      i.classList.add("ring-2", "ring-red-600");
      i.style.animation = "shake 0.2s";

      setTimeout(() => {
        i.style.animation = "";
        i.classList.remove("ring-red-600");
      }, 300);
    }
  });

  return false;
}

async function submitAnswers() {
  if (!STATE.round.running || STATE.round.submitted) return;

  // Validar antes de enviar
  if (!validateAnswers()) return;

  STATE.round.submitted = true;

  btnSubmit.textContent = "Enviando...";
  btnSubmit.disabled = true;
  catsEl.querySelectorAll("input").forEach((i) => (i.disabled = true));

  try {
    await api(`/games/${gameCode}/rounds/${STATE.round.id}/answers`, {
      method: "POST",
      body: {
        playerId,
        answers: collectAnswers()
      }
    });

    btnSubmit.textContent = "Enviado ✓";

  } catch (err) {
    console.error("❌ Error enviando respuestas:", err);
    btnSubmit.textContent = "Error";
  }
}

/* =======================================================
   POLLING DE RESCATE
======================================================= */
fetchIngame();
setInterval(() => {
  if (!socket.connected) fetchIngame();
}, 4000);

/* =======================================================
   ENTER = ENVIAR
======================================================= */
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitAnswers();
  }
});

/* =======================================================
   TIMER LOCAL (1 seg)
======================================================= */
setInterval(() => {
  if (!STATE.round.running) return;

  if (Number(STATE.round.left) > 0) {
    STATE.round.left--;
    roundTimeEl.textContent = fmt(STATE.round.left);

    const pct = STATE.round.secs
      ? Math.max(0, Math.min(100, (STATE.round.left / STATE.round.secs) * 100))
      : 0;

    roundProgEl.style.width = `${pct}%`;
  }
}, 1000);
