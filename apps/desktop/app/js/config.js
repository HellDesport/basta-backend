// Detectar si estamos dentro de Electron
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

// ===============================
// BACKEND REAL EN RAILWAY
// ⬅️ AJUSTA A TU URL VERDADERA
// ===============================
const PROD_API = "https://basta-backend.onrender.com";   // ← ya vi tu URL real en Render
// Si estuvieras en Railway sería algo como:
// const PROD_API = "https://basta-backend.up.railway.app";

// Local para pruebas
const LOCAL_API = "http://localhost:3000";


// ===============================
// API BASE (REST)
// ===============================
export const API_BASE = isElectron
  ? `${PROD_API}/api`           // ejecutable → SIEMPRE server real
  : window.location.hostname === "localhost"
  ? `${LOCAL_API}/api`          // web local → node local
  : "/api";                     // web desplegado → proxy reverse (Render)


// ===============================
// SOCKET.IO BASE
// ===============================
export const SOCKET_URL = isElectron
  ? PROD_API                    // ejecutable → WebSocket del server real
  : window.location.hostname === "localhost"
  ? LOCAL_API                   // web local → WebSocket local
  : window.location.origin;     // web en hosting → WS del mismo origen


// ===============================
// Debug opcional
// ===============================
console.log("isElectron:", isElectron);
console.log("API_BASE:", API_BASE);
console.log("SOCKET_URL:", SOCKET_URL);
