import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import path from 'path';
import { daemonManager } from './index';

let tray: Tray | null = null;

const TRAY_ICONS = {
  green: 'tray-green.png',
  yellow: 'tray-yellow.png',
  red: 'tray-red.png',
  gray: 'tray-gray.png',
} as const;

type TrayColor = keyof typeof TRAY_ICONS;

function getIconPath(color: TrayColor): string {
  const resourcesPath =
    process.env.NODE_ENV === 'development'
      ? path.join(__dirname, '../../resources')
      : path.join(process.resourcesPath, 'resources');
  return path.join(resourcesPath, TRAY_ICONS[color]);
}

export function setupTray(mainWindow: BrowserWindow): void {
  const iconPath = getIconPath('gray');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('GPU Co-op');

  buildContextMenu(mainWindow);

  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function buildContextMenu(mainWindow: BrowserWindow): void {
  if (!tray) return;

  const status = daemonManager?.getStatus();
  const peersOnline = status?.peersOnline ?? 0;
  const jobsRunning = status?.jobsRunning ?? 0;
  const dndEnabled = status?.dndEnabled ?? false;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'GPU Co-op',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show Dashboard',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: `Peers online: ${peersOnline}`,
      enabled: false,
    },
    {
      label: `Jobs running: ${jobsRunning}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Do Not Disturb',
      type: 'checkbox',
      checked: dndEnabled,
      click: (item) => {
        daemonManager?.send({ type: 'set-dnd', enabled: item.checked });
        buildContextMenu(mainWindow);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export function updateTrayIcon(color: TrayColor): void {
  if (!tray) return;
  const iconPath = getIconPath(color);
  const icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) {
    tray.setImage(icon);
  }
}

export function refreshTrayMenu(mainWindow: BrowserWindow): void {
  buildContextMenu(mainWindow);
}
