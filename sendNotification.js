const { Notification } = require('electron');
const { getMainWindow } = require('./windowManager');

let lastNotification = { type: null, message: null, timestamp: 0 };

/**
 * Suppresses a notification if it was sent same content recently
 * or the log type is not neither error nor warning.
 * @param {string} type one of the log types, 'error' or 'warning'
 * @param {string} message log message
 * @param {number} cooldown time in milliseconds to suppress the notification. default is 3000ms
 * @returns {boolean} whether the notification should be suppressed
 */
function shouldSuppressNotification( type, message, cooldown = 3000 ) {
  const now = Date.now();
  const { type: lastType, message: lastMessage, timestamp } = lastNotification;

  return (
    type === lastType &&
    message === lastMessage &&
    now - timestamp < cooldown
  );
}

/**
 * Formats the log to be displayed in the notification.
 * @param {object} log - The log object.
 * @returns {object} - The formatted log object.
 */
function formatLog( log ) {
  if (!log) {
    return { type: null, message: null };
  }
  const { type, message } = log;
  return {
    type,
    message: message.split('\n')[0],
  };
}

/**
 * Sends a system notification.
 * @param {string} type - The type of log (error, warning, notice).
 * @param {string} message - The log message.
 */
function sendNotification( log ) {
  const { type, message } = formatLog(log);

  console.log('sendNotification called:', { type, message });

  if (shouldSuppressNotification(type, message)) {
    console.log('Notification suppressed');
    return;
  }

  console.log('Creating notification...');
  const notification = new Notification({
    title: `PHP ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    body: message.slice(0, 250), // MacOS notifications are limited to 256 bytes
    silent: false,
  });

  notification.on('click', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      const { app } = require('electron');
      if (process.platform === 'darwin') {
        app.dock.show();
      }
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('selected-log', log);
    }
  });

  notification.show();
  console.log('Notification shown');
  lastNotification = { type, message, timestamp: Date.now() };
}

module.exports = { sendNotification };
