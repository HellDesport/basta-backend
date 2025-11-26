// webapp/js/diag.js
export function initDiag({
  page,
  apiBase = "",
  wsUrl = "",
  healthUrl = ""
} = {}) {

  // Badge visual
  const css = `
    .diag-badge{position:fixed;right:10px;bottom:10px;background:#111319;color:#cfe3ff;
      border:1px solid #2a3344;border-radius:10px;padding:8px 10px;font:12px/1.2 system-ui;z-index:99999}
    .diag-badge b{color:#8bd1ff}
    .diag-ok{color:#22c55e} .diag-bad{color:#ef4444}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.className = "diag-badge";
  box.innerHTML = `🔍 <b>${page}</b> • API:<span id="dgApi">…</span> • WS:<span id="dgWs">…</span>`;
  document.body.appendChild(box);

  const set = (id, ok) => {
    const el = document.getElementById(id);
    el.className = ok ? "diag-ok" : "diag-bad";
    el.textContent = ok ? "OK" : "FAIL";
  };

  // ======================================================
  // API HEALTHCHECK
  // ======================================================
  fetch(healthUrl)
    .then(r => r.json())
    .then(j => set("dgApi", j?.ok === true))
    .catch(() => set("dgApi", false));

  // ======================================================
  // WebSocket puro (NO POLLING)
  // ======================================================
  try {
    const s = window.io(wsUrl, {
      transports: ["websocket"],
      upgrade: false,
      path: "/socket.io"
    });

    s.on("connect", () => {
      set("dgWs", true);
      s.disconnect();
    });

    s.on("connect_error", () => set("dgWs", false));

  } catch (e) {
    set("dgWs", false);
  }
}
