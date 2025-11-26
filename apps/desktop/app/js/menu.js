// webapp/js/menu.js

// ===============================
// BACKEND DEPLOYED EN RENDER
// ===============================
const BACKEND_URL = "https://basta-backend-game.onrender.com";
const API_BASE = `${BACKEND_URL}/api`;

// ------------------------------
// Helpers
// ------------------------------
const $ = (s) => document.querySelector(s);

const showErr = (id, msg) => {
  const el = $(id);
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
};

// ------------------------------
// Validaciones
// ------------------------------
const isValidCode = (code) => /^[A-Z0-9]{4,8}$/i.test(code.trim());
const isValidName = (name) => {
  const s = name.trim();
  return s.length >= 2 && s.length <= 20;
};

// ------------------------------
// Persistencia local
// ------------------------------
function persistSession({ game, player }) {
  localStorage.setItem("gameCode", game.code);
  localStorage.setItem("gameId", String(game.id));
  localStorage.setItem("playerId", String(player.id));
  localStorage.setItem("playerName", player.name);
}

// ------------------------------
// API WRAPPER
// ------------------------------
async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || json.message || `HTTP ${res.status}`);
  }
  return json;
}

// ------------------------------
// ENDPOINTS → versión correcta
// ------------------------------
async function createGame(hostName) {
  return api(`/games`, {
    method: "POST",
    body: { hostName }
  });
}

async function joinGame(gameCode, playerName) {
  return api(`/games/join`, {
    method: "POST",
    body: { gameCode, playerName }
  });
}

// ------------------------------
// EVENTOS UI
// ------------------------------
$("#btn-create").addEventListener("click", async () => {
  showErr("#create-error", "");
  const host = $("#host-name").value.trim();

  if (!isValidName(host)) {
    showErr("#create-error", "Pon un nombre de 2–20 caracteres.");
    return;
  }

  try {
    const data = await createGame(host);

    // player = data.host
    persistSession({
      game: data.game,
      player: data.host
    });

    window.location.href = `./public/lobby.html?code=${encodeURIComponent(
      data.game.code
    )}`;
  } catch (e) {
    showErr("#create-error", e.message);
  }
});

$("#btn-join").addEventListener("click", async () => {
  showErr("#join-error", "");
  const code = $("#join-code").value.trim();
  const name = $("#join-name").value.trim();

  if (!isValidCode(code)) {
    showErr("#join-error", "Código inválido (4–8 caracteres alfanuméricos).");
    return;
  }

  if (!isValidName(name)) {
    showErr("#join-error", "Pon un nombre de 2–20 caracteres.");
    return;
  }

  try {
    const data = await joinGame(code.toUpperCase(), name);

    // player = data.player
    persistSession({
      game: data.game,
      player: data.player
    });

    window.location.href = `./public/lobby.html?code=${encodeURIComponent(
      data.game.code
    )}`;
  } catch (e) {
    showErr("#join-error", e.message);
  }
});
