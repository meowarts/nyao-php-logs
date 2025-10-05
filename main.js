'use strict';

const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const { setMainWindow, getMainWindow } = require('./windowManager');
const path = require('path');
const url = require('url');
const { watchLogFile } = require('./watchlog');
const { exec } = require('child_process');
const fs = require('fs');
const logger = require('./logger');
const servicePath = require('./servicePath');
const remoteMain = require('@electron/remote/main');

remoteMain.initialize();

// Set app name BEFORE app.whenReady()
app.setName('Nyao PHP Logs');

const isDevelopment = process.env.NODE_ENV === 'development';
const isTesting = process.env.TESTING === 'true';
const iconPath = path.join(__dirname, 'src', 'assets', 'code-error.png'); // Icon path for window
const trayIconPath = path.join(__dirname, 'src', 'assets', 'tray-icon.png'); // Icon path for tray

let tray = null;
let recentErrors = [];

function getTimeAgo(date) {
  const errorDate = date instanceof Date ? date : new Date(date);
  const seconds = Math.floor((new Date() - errorDate) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function updateTrayMenuIfNeeded() {
  const mainWindow = getMainWindow();
  if (!mainWindow || !tray) return;

  const menuItems = [
    ...recentErrors.slice(0, 5).map((error, index) => ({
      label: `${error.type.toUpperCase()}: ${error.message.slice(0, 50)}... (${getTimeAgo(error.date)})`,
      click: () => {
        if (process.platform === 'darwin') {
          app.dock.show();
        }
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('selected-log', error);
      }
    })),
    { type: 'separator' },
    {
      label: 'Show App',
      click: () => {
        if (process.platform === 'darwin') {
          app.dock.show();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ];

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}

function createTray() {
  // For macOS tray, we need a template image (16x16 or 32x32 at 2x)
  const image = nativeImage.createFromPath(trayIconPath);
  const resizedImage = image.resize({ width: 18, height: 18 });
  resizedImage.setTemplateImage(true);

  tray = new Tray(resizedImage);
  tray.setToolTip('Nyao PHP Logs');

  tray.on('click', () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    if (mainWindow.isVisible()) {
      mainWindow.hide();
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
    } else {
      if (process.platform === 'darwin') {
        app.dock.show();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Context menu is automatically shown on macOS, but we can update it
  updateTrayMenuIfNeeded();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 20, y: 12 }
  });

  const indexPath = isDevelopment || isTesting ?
    url.format({
      protocol: 'http:',
      host: 'localhost:8080',
      pathname: 'index.html',
      slashes: true
    }) :
    url.format({
      protocol: 'file:',
      pathname: path.join(__dirname, 'dist', 'index.html'),
      slashes: true
    });

  mainWindow.loadURL(indexPath);

  mainWindow.once('ready-to-show', async () => {
    mainWindow.setTitle('Nyao PHP Logs');
    // Show on startup for testing
    mainWindow.show();
    if (isDevelopment) {
      mainWindow.webContents.openDevTools();
    }
    const logPath = isTesting
      ? path.join(__dirname, 'tests', 'logs', 'error.log')
      : path.join(app.getPath('home'), 'sites', 'ai', 'logs', 'php', 'error.log');
    await watchLogFile(mainWindow, logPath);
  });

  setMainWindow(mainWindow);

  // Enable remote module for this window
  remoteMain.enable(mainWindow.webContents);

  // Hide window on close instead of quitting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    setMainWindow(null);
  });

  mainWindow.on('resize', () => {
    if (mainWindow.isMinimized()) {
      mainWindow.hide();
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
    }
  });
}

function openFileDialog() {
  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Log Files', extensions: ['log'] }]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      app.addRecentDocument(result.filePaths[0]);

      const mainWindow = getMainWindow();
      mainWindow.webContents.send('selected-file', result.filePaths[0]);
    }
  }).catch(err => {
    console.error('Failed to open file dialog:', err);
  });
}

app.whenReady().then(() => {
  // Hide dock icon on macOS for tray-only app
  if (process.platform === 'darwin' && !isDevelopment) {
    app.dock.hide();
  }

  // Create tray first
  createTray();

  // Then create window (hidden initially)
  createWindow();

  // Set application menu for macOS
  if (process.platform === 'darwin') {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Nyao PHP Logs',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'File',
        submenu: [
          {
            label: 'Open...',
            accelerator: 'CmdOrCtrl+O',
            click: openFileDialog
          },
          {
            label: 'Open Recent',
            role: 'recentdocuments',
            submenu:[
              {
                label: 'Clear Recently Opened...',
                role: 'clearrecentdocuments',
              }
            ]
          }
        ]
      }
    ]);
    Menu.setApplicationMenu(menu);
  }
});

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('activate', () => {
  const mainWindow = getMainWindow();
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('open-file', (_, path) => {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('selected-file', path);
  }
});

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

ipcMain.on( 'watch-another-file', async ( event, logPath ) => {
  const mainWindow = getMainWindow();
  if ( mainWindow && !mainWindow.isDestroyed() ) {
    await watchLogFile( mainWindow, logPath, true );
  } else {
    console.log( 'MainWindow is not available or has been destroyed.' );
  }
});

ipcMain.on( 'open-file-in-vscode', ( event, { fileName, lineNumber } ) => {
  exec( `${servicePath.vscode}code -g ${fileName}:${lineNumber}`, ( error, stdout, stderr ) => {
    if (error) {
      logger.error(`error: ${error}`);
    }
    if (stderr) {
      logger.error(`stderr: ${stderr}`);
    }
  });
});

ipcMain.on( 'open-file-dialog', openFileDialog );

ipcMain.on( 'empty-file', ( event, filePath ) => {
  fs.writeFileSync( filePath, '' );
});

ipcMain.on( 'error-update', ( event, errors ) => {
  recentErrors = errors;
  updateTrayMenuIfNeeded();
});

module.exports = { createWindow };
