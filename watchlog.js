const fs = require('fs');
const { parseLogFile } = require('./parseLogFile');
const { sendNotification } = require('./sendNotification');

let currentWatcher = null;
let startProcessPosition = 0;
let debounceTimeout = null;

/**
 * Call the log update event on the main window.
 * @param {object} options - The main window object.
 * @param {object} options.mainWindow - The main window object.
 * @param {string} options.logPath - The path to the log file.
 * @param {Array} options.logEntries - The log entries to send.
 */
function callLogUpdate({ mainWindow, logPath, logEntries }) {
  if ( mainWindow && !mainWindow.isDestroyed() ) {
    mainWindow.webContents.send( 'log-update', { logPath, logEntries } );
  }
}

/**
 * Watches the log file for changes and processes new entries.
 * @param {object} mainWindow - The main window object.
 * @param {string} logPath - The path to the log file.
 * @param {boolean} reset - Whether to reset the log position.
 */
async function watchLogFile( mainWindow, logPath, reset = false ) {
  if ( !fs.existsSync( logPath ) ) {
    console.error( 'Log file does not exist:', logPath );
    return;
  }

  if ( reset ) {
    startProcessPosition = 0;
    mainWindow.webContents.send( 'log-reset', { logPath } );
  }

  // Stop watching the previous file if there is an existing watcher
  if ( currentWatcher ) {
    currentWatcher.close();
  }

  // Send initially the logs
  try {
    const { logEntries, lastProcessedPosition } = await parseLogFile({
      logPath,
      streamOptions: { start: startProcessPosition },
    });
    startProcessPosition = lastProcessedPosition;
    callLogUpdate({mainWindow, logPath, logEntries});
  } catch (error) {
    console.error('Error processing log file:', error);
  }

  // Watch for new changes with debouncing and send notifications for
  // new entries if the window is minimized
  currentWatcher = fs.watch( logPath, ( eventType ) => {
    if ( eventType === 'change' ) {
      if ( debounceTimeout ) {
        clearTimeout( debounceTimeout );
      }
      debounceTimeout = setTimeout(async () => {
        try {
          const { logEntries, lastProcessedPosition } = await parseLogFile({
            logPath,
            streamOptions: { start: startProcessPosition },
          });
          startProcessPosition = lastProcessedPosition;
          callLogUpdate({mainWindow, logPath, logEntries});

          // Send notification for new log entries
          if (logEntries.length > 0) {
            const lastEntry = logEntries[logEntries.length - 1];
            console.log('New log entry:', lastEntry.type);
            sendNotification(lastEntry);
          }
        } catch (error) {
          console.error('Error processing log file:', error);
        }
      }, 100 );
    }
  });
}

module.exports = { watchLogFile };
