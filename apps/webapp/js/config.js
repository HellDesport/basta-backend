// ===============================
// Detectar si estamos dentro de Electron
// ===============================
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
// BACKEND REAL (Render)
// ===============================
export const BACKEND_URL = "https://basta-backend-game.onrender.com";

// ===============================
// API
// ===============================
export const API_BASE = `${BACKEND_URL}/api`;

// ===============================
// SOCKET.IO
// ===============================
export const SOCKET_URL = BACKEND_URL;
export const SOCKET_PATH = "/socket.io";

// ===============================
// Debug
// ===============================
console.log("isElectron:", isElectron);
console.log("BACKEND_URL:", BACKEND_URL);
console.log("API_BASE:", API_BASE);
console.log("SOCKET_URL:", SOCKET_URL);
