'use strict';

const { app, BrowserWindow, protocol, net, dialog, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// ── Auto-updater (chỉ dùng trong production) ──────────────────────────────────
let autoUpdater = null;
if (app.isPackaged) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    // Khai báo trực tiếp repository GitHub để chắc chắn luôn tìm đúng bản phát hành
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'tienanhdev1401',
      repo: 'handingWriter'
    });
  } catch (e) {
    console.warn('[updater] electron-updater không khả dụng:', e.message);
  }
}

// ── Đọc/ghi config (lưu vào userData của user) ───────────────────────────────
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('[config] Không thể lưu config:', e.message);
  }
}

// ── Custom app:// protocol ────────────────────────────────────────────────────
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
      // Preload: bridge an toàn giữa renderer và main
      preload: path.join(__dirname, 'preload.cjs'),
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

  // ── Context menu (chuột phải) trên mọi editable element ──────────────────
  mainWindow.webContents.on('context-menu', (_event, params) => {
    // Chỉ hiện khi click vào ô có thể chỉnh sửa hoặc có text được chọn
    if (!params.isEditable && !params.selectionText) return;

    const menu = Menu.buildFromTemplate([
      {
        label: 'Cắt',
        role: 'cut',
        enabled: params.editFlags.canCut,
      },
      {
        label: 'Sao chép',
        role: 'copy',
        enabled: params.editFlags.canCopy,
      },
      {
        label: 'Dán',
        role: 'paste',
        enabled: params.editFlags.canPaste,
      },
      { type: 'separator' },
      {
        label: 'Chọn tất cả',
        role: 'selectAll',
      },
    ]);
    menu.popup({ window: mainWindow });
  });
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

// Trả về thư mục đang được lưu (hoặc null nếu chưa chọn)
ipcMain.handle('get-save-folder', () => {
  const config = loadConfig();
  // Kiểm tra folder vẫn còn tồn tại
  if (config.saveFolder && fs.existsSync(config.saveFolder)) {
    return config.saveFolder;
  }
  return null;
});

// Mở dialog chọn thư mục và lưu vào config
ipcMain.handle('select-save-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Chọn thư mục lưu GIF',
    buttonLabel: 'Chọn thư mục này',
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folder = result.filePaths[0];
    const config = loadConfig();
    config.saveFolder = folder;
    saveConfig(config);
    return folder;
  }
  return null; // User bấm Cancel
});

// Xóa thư mục đã lưu (reset về mặc định)
ipcMain.handle('clear-save-folder', () => {
  const config = loadConfig();
  delete config.saveFolder;
  saveConfig(config);
  return true;
});

// Lưu file GIF ra disk vào thư mục đã chọn
ipcMain.handle('save-gif-file', async (_event, filename, dataArray) => {
  const config = loadConfig();
  const folder = config.saveFolder;

  if (!folder) {
    return { success: false, error: 'Chưa chọn thư mục lưu' };
  }

  if (!fs.existsSync(folder)) {
    // Thư mục đã bị xóa — reset config
    delete config.saveFolder;
    saveConfig(config);
    return { success: false, error: 'Thư mục không còn tồn tại' };
  }

  try {
    const filePath = path.join(folder, filename);
    fs.writeFileSync(filePath, Buffer.from(dataArray));
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Mở Finder/Explorer và highlight file vừa lưu
ipcMain.handle('show-in-folder', (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

// ── Setup auto-updater ────────────────────────────────────────────────────────
function setupUpdater() {
  if (!autoUpdater) return;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Có bản cập nhật mới',
      message: `Phiên bản ${info.version} đã có sẵn.`,
      detail: 'Đang tải về, ứng dụng sẽ thông báo khi tải xong.',
      buttons: ['OK'],
    });
  });

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

  autoUpdater.on('error', (err) => {
    console.error('[updater] Lỗi:', err.message);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[updater] Không thể kiểm tra update:', err.message);
    });
  }, 3000);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
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
