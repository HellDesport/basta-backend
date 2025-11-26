// ===============================
// BACKEND DEPLOYED EN RENDER
// ===============================
const BACKEND_URL = "https://basta-backend-game.onrender.com";
const API_BASE = `${BACKEND_URL}/api`;

// ------------------------------
// Helpers cortos
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
function persistSession({ game, player, token }) {
  localStorage.setItem("gameCode", game.code);
  localStorage.setItem("gameId", String(game.id));
  localStorage.setItem("playerId", String(player.id));
  localStorage.setItem("playerName", player.name);

  if (token) {
    localStorage.setItem("authToken", token);
  }
}

// ------------------------------
// API WRAPPER universal
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
// ENDPOINTS limpìos
// ------------------------------
async function createGame(hostName) {
  return api(`/games`, {
    method: "POST",
    body: { hostName }
  });
}

async function joinGame(code, name) {
  return api(`/games/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: { name }
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
    persistSession(data);

    // 🔥 Ruta correcta para ELECTRON
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
    persistSession(data);

    // 🔥 Ruta corregida para desktop (la web usaba /public/)
    window.location.href = `./public/lobby.html?code=${encodeURIComponent(
      data.game.code
    )}`;
  } catch (e) {
    showErr("#join-error", e.message);
  }
});
