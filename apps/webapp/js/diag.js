// webapp/js/diag.js
export function initDiag({ page, apiBase = "", wsUrl = "http://localhost:8080" } = {}) {
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

  // Helpers
  const set = (id, ok, extra="") => {
    const el = document.getElementById(id);
    el.className = ok ? "diag-ok" : "diag-bad";
    el.textContent = ok ? `OK${extra}` : `FAIL${extra}`;
  };

  // API /health
  fetch(`${apiBase}/health`).then(r=>r.json()).then(j=>{
    console.log(`[DIAG][${page}] /health ->`, j);
    set("dgApi", j?.ok === true ? true : false, "");
  }).catch(e=>{
    console.error(`[DIAG][${page}] API error:`, e);
    set("dgApi", false, "");
  });

  // Socket.IO ping-pong
  // asume que ya cargaste /socket.io/socket.io.js en la página
  try{
    const s = window.io(wsUrl, { withCredentials:true });
    s.on("connect", ()=>{
      console.log(`[DIAG][${page}] WS connect id=`, s.id);
      s.emit("ping");
    });
    s.on("pong", ()=>{
      console.log(`[DIAG][${page}] WS pong ✅`);
      set("dgWs", true, "");
      s.disconnect();
    });
    s.on("connect_error", (err)=>{
      console.error(`[DIAG][${page}] WS connect_error:`, err.message);
      set("dgWs", false, "");
    });
  }catch(e){
    console.error(`[DIAG][${page}] WS error:`, e);
    set("dgWs", false, "");
  }

  // utilidades opcionales para pruebas rápidas
  window.$diag = {
    createGame: (hostName) => fetch(`${apiBase}/games`, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ hostName })
    }).then(r=>r.json()).then(x=> (console.log("[DIAG] createGame ->", x), x)),
    joinGame: (code, name) => fetch(`${apiBase}/games/${encodeURIComponent(code)}/join`, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ name })
    }).then(r=>r.json()).then(x=> (console.log("[DIAG] joinGame ->", x), x))
  };
}
