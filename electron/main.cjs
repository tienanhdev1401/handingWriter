'use strict';

const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// ── Custom protocol để serve file tĩnh trong production ──────────────────────
// Phải đăng ký TRƯỚC khi app.ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true, // cho phép fetch() từ renderer
      corsEnabled: true,
      stream: true,          // cho phép stream file lớn (graphics.txt ~30MB)
    },
  },
]);

// ── Create window ─────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 560,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Tạo GIF Nét Chữ Hán',
    backgroundColor: '#0c0c0c', // khớp với màu nền app
    show: false, // ẩn cho đến khi ready-to-show để tránh flash trắng
    autoHideMenuBar: true, // ẩn menu bar mặc định của Electron
  });

  if (app.isPackaged) {
    // Production: load từ custom protocol (serve file trong dist/)
    win.loadURL('app://localhost/');
  } else {
    // Development: connect vào Vite dev server
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools(); // bật nếu cần debug
  }

  // Chỉ show cửa sổ khi nội dung đã render xong → không bị flash
  win.once('ready-to-show', () => win.show());
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Đăng ký handler cho app:// protocol
  // Tất cả request app://localhost/* → serve từ dist/
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);

    // Root → index.html
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    // Resolve đường dẫn tuyệt đối tới file trong dist/
    const filePath = path.join(app.getAppPath(), 'dist', pathname);

    // Dùng pathToFileURL để xử lý đúng trên cả Windows (backslash) và macOS
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  // macOS: re-create window khi click icon trên dock
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Windows / Linux: thoát khi đóng tất cả cửa sổ
// macOS: giữ app sống trong dock theo convention
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
