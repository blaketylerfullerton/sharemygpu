import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  if (process.env.NODE_ENV === 'development') return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update:available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update:downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err);
  });

  // Check for updates every hour
  setInterval(() => autoUpdater.checkForUpdates(), 60 * 60 * 1000);
  autoUpdater.checkForUpdates().catch(() => {});
}
