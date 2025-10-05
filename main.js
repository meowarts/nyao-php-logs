'use strict';

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
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

  // Minimize window on close instead of quitting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.minimize();
    }
  });

  mainWindow.on('closed', () => {
    setMainWindow(null);
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
  // Create window
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

module.exports = { createWindow };
