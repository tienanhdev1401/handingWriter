'use strict';

const { app, BrowserWindow, protocol, net, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// ── Auto-updater (chỉ dùng trong production) ──────────────────────────────────
// Lazy-require để tránh lỗi khi chạy dev
let autoUpdater = null;
if (app.isPackaged) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    // Tắt log ra console để không làm phiền
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
  } catch (e) {
    console.warn('[updater] electron-updater không khả dụng:', e.message);
  }
}

// ── Custom protocol để serve file tĩnh trong production ──────────────────────
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// ── Biến lưu window chính để dùng trong updater events ───────────────────────
let mainWindow = null;

// ── Create window ─────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 560,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Tạo GIF Nét Chữ Hán',
    backgroundColor: '#0c0c0c',
    show: false,
    autoHideMenuBar: true,
  });

  if (app.isPackaged) {
    mainWindow.loadURL('app://localhost/');
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Setup auto-updater events ─────────────────────────────────────────────────
function setupUpdater() {
  if (!autoUpdater) return;

  // Tìm thấy bản mới → đang tải về tự động
  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Có bản cập nhật mới',
      message: `Phiên bản ${info.version} đã có sẵn.`,
      detail: 'Đang tải về, ứng dụng sẽ thông báo khi tải xong.',
      buttons: ['OK'],
    });
  });

  // Tải xong → hỏi có muốn khởi động lại không
  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Cập nhật sẵn sàng',
      message: `Phiên bản ${info.version} đã tải xong.`,
      detail: 'Khởi động lại ứng dụng để áp dụng bản cập nhật?',
      buttons: ['Khởi động lại ngay', 'Để sau'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  // Lỗi update → im lặng, không làm phiền user
  autoUpdater.on('error', (err) => {
    console.error('[updater] Lỗi:', err.message);
  });

  // Kiểm tra update sau 3 giây để tránh làm chậm startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[updater] Không thể kiểm tra update:', err.message);
    });
  }, 3000);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Register app:// → serve dist/ files
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const filePath = path.join(app.getAppPath(), 'dist', pathname);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();
  setupUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
