# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nyao Error Logs is an Electron-based macOS application for viewing and monitoring PHP error logs in real-time. It runs as a standard macOS application in the Dock and provides native macOS notifications for new errors. The app uses a terminal-style monospace font and focuses on minimalistic, distraction-free error viewing.

## Commands

### Development
```bash
pnpm start          # Start development server with hot reload (webpack-dev-server on port 8080)
pnpm run prod       # Build and run production version with Electron
```

### Build & Package
```bash
pnpm run build      # Build production bundle and package as Electron app
pnpm run postpackage # Package app (runs automatically after build) - creates builds in ./builds/
```

### Testing
```bash
pnpm test           # Run Playwright tests (starts dev server automatically on port 8080)
```

**Note**: This project uses pnpm as the package manager, not npm or yarn.

## Architecture

### Electron Main Process (Root Directory)
- **main.js**: Main Electron entry point - creates BrowserWindow, sets up IPC handlers, manages tray icon and menus
- **watchlog.js**: File watcher for log files - uses fs.watch with debouncing, sends IPC events to renderer
- **parseLogFile.js**: Core log parsing logic - handles PHP error log format including dates, messages, and stack traces
- **windowManager.js**: Manages the main window reference globally
- **sendNotification.js**: System notifications for new errors when window is minimized
- **logger.js**: Winston-based logging for the Electron app
- **servicePath.js**: Paths to external services (e.g., VS Code)

### React Renderer Process (src/)
- **src/index.js**: React app entry point - renders App component into DOM
- **src/components/App.js**: Main React component - displays log list, handles filtering/search, manages modal for stack traces
- **src/components/DebouncedSearch.js**: Search input with debouncing
- **src/components/style.scss**: Main styles (compiled to style.css)
- **src/utils/date.js**: Date formatting utilities

### Data Flow
1. `watchlog.js` monitors the log file using fs.watch
2. On changes, `parseLogFile.js` reads and parses new log entries from the last processed position
3. Parsed entries (with id, date, type, message, stacktrace) sent via IPC to renderer
4. `App.js` receives log entries, updates state, and renders the UI
5. User can click on entries to view stack traces in a modal
6. Stack trace lines with file paths can be clicked to open in VS Code

### Log Entry Structure
Each log entry has:
- `id`: UUID for the entry
- `date`: Parsed JavaScript Date object
- `type`: 'error', 'warning', or 'notice' (based on PHP log level)
- `message`: The error message text
- `stacktrace`: Array of stack trace lines, each with `index`, `detail`, `fileName`, `lineNumber`

### IPC Events
- **Renderer → Main**: `watch-another-file`, `open-file-in-vscode`, `open-file-dialog`, `empty-file`
- **Main → Renderer**: `log-update`, `log-reset`, `selected-file`

## Testing

- Uses Playwright for E2E testing
- Test files in `tests/` directory
- Test log files in `tests/logs/`
- Dev server must be running on port 8080 for tests
- Playwright config starts webpack-dev-server automatically via webServer option

## Webpack Configuration

Three webpack configs:
- **webpack.dev.config.js**: Development with hot reload
- **webpack.build.config.js**: Production build
- **webpack.test.config.js**: Testing configuration

## Key Implementation Details

### Log File Parsing
- Supports both `#N` style and `PHP N.` style stack traces
- Uses readline interface with fs.createReadStream for efficient streaming
- Tracks file position between reads to only process new content
- Filters out Xdebug connection messages

### Window Behavior
- Closing the window minimizes it to the Dock instead of quitting
- Window can be reopened by clicking the Dock icon
- App can be quit via application menu or Cmd+Q
- Shows native macOS notifications for all new errors/warnings
- macOS-specific: traffic light positioning, dock icon, app menu
- Default log path: `~/sites/ai/logs/php/error.log` (can be changed via File > Open)

### UI/UX Features
- **Font**: SF Mono Regular 12px (monospace, terminal-style)
- **Old Errors**: Entries older than 1 day are grayed out (30% opacity)
- **Status Bar**: Bottom bar shows the full path of the current log file being monitored
- **Minimalist Design**: Reduced header padding, focused on error content
- **Actions**: All action buttons (File, Refresh, Copy, Remove, Clear) positioned on the right side of header

### React State Management
- No external state library - uses React hooks (useState, useEffect, useRef)
- Maintains both `originalLogData` (all entries) and `logData` (filtered entries)
- Search/filter performed on original data to preserve all entries
