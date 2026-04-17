import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import path from 'path';
import { setupTray } from './tray';
import { setupIPC } from './ipc';
import { DaemonManager } from './daemon';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
export let daemonManager: DaemonManager | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 660,
    minWidth: 440,
    maxWidth: 440,
    minHeight: 500,
    title: 'GPU Co-op',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 13 },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    // Hide to tray instead of closing
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    if (process.env.OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';

  daemonManager = new DaemonManager();
  await daemonManager.start();

  setupIPC();
  createWindow();
  setupTray(mainWindow!);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on all platforms
});

app.on('before-quit', async () => {
  app.isQuitting = true;
  await daemonManager?.stop();
});

// Extend app type
declare global {
  namespace Electron {
    interface App {
      isQuitting: boolean;
    }
  }
}
app.isQuitting = false;
