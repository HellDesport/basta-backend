// webapp/js/menu.js
const API_BASE = "/api"; // ajusta si tu backend cuelga en otra ruta/origen

const $ = (sel) => document.querySelector(sel);
const showErr = (id, msg) => {
  const el = $(id);
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
};

// ---- Validaciones ----
const isValidCode = (code) => /^[A-Z0-9]{4,8}$/i.test(code.trim());
const isValidName = (name) => name.trim().length >= 2 && name.trim().length <= 20;

// ---- Storage helpers ----
function persistSession({ game, player, token }) {
  localStorage.setItem("gameCode", game.code);
  localStorage.setItem("gameId", String(game.id));
  localStorage.setItem("playerId", String(player.id));
  localStorage.setItem("playerName", player.name);
  if (token) localStorage.setItem("authToken", token);
}

// ---- API wrappers ----
async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function createGame(hostName) {
  // Esperado: POST /api/games  { hostName }
  return api("/games", { method: "POST", body: { hostName } });
}

async function joinGame(code, name) {
  // Esperado: POST /api/games/:code/join  { name }
  return api(`/games/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: { name },
  });
}

// ---- Wire UI ----
$("#btn-create").addEventListener("click", async () => {
  showErr("#create-error", "");
  const host = $("#host-name").value;

  if (!isValidName(host)) {
    showErr("#create-error", "Pon un nombre (2–20 caracteres).");
    return;
  }

  try {
    const data = await createGame(host.trim());
    persistSession(data);
    // Redirige al lobby, pasando el código por si lo quieres en URL
    window.location.href = `./public/lobby.html?code=${encodeURIComponent(data.game.code)}`;
  } catch (e) {
    showErr("#create-error", e.message);
  }
});

$("#btn-join").addEventListener("click", async () => {
  showErr("#join-error", "");
  const code = $("#join-code").value;
  const name = $("#join-name").value;

  if (!isValidCode(code)) {
    showErr("#join-error", "Código inválido (4–8 caracteres alfanuméricos).");
    return;
  }
  if (!isValidName(name)) {
    showErr("#join-error", "Pon un nombre (2–20 caracteres).");
    return;
  }

  try {
    const data = await joinGame(code.trim().toUpperCase(), name.trim());
    persistSession(data);
    window.location.href = `./public/lobby.html?code=${encodeURIComponent(data.game.code)}`;
  } catch (e) {
    showErr("#join-error", e.message);
  }
});
