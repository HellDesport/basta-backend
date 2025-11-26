import { app, BrowserWindow, Menu } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // Carga el menú principal
  win.loadFile(path.resolve(__dirname, "app/index_menu.html"));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // Quita barra de menú
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
