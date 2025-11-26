// Detecta si estamos dentro de Electron
export const isElectron = (() => {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.process === "object" &&
      window.process.type === "renderer"
    );
  } catch {
    return false;
  }
})();

// URL del backend en Railway (AJUSTA ESTA)
const PROD_API = "https://TU-PROYECTO.up.railway.app";

// URL local (para desarrollo con Node normal)
const LOCAL_API = "http://localhost:3000";

// Si estamos en Electron → siempre usar Railway
// Si estamos en navegador → usar relativo (/api) o localhost según origen
export const API_BASE = isElectron
  ? `${PROD_API}/api`
  : window.location.hostname === "localhost"
  ? `${LOCAL_API}/api`
  : "/api";

// Socket.IO
export const SOCKET_URL = isElectron
  ? PROD_API
  : window.location.hostname === "localhost"
  ? LOCAL_API
  : window.location.origin;

// Debug opcional
console.log("isElectron:", isElectron);
console.log("API_BASE:", API_BASE);
console.log("SOCKET_URL:", SOCKET_URL);
