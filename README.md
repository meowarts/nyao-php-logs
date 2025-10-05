# Nyao PHP Logs

A minimalist macOS application for monitoring and viewing PHP error logs in real-time.

![macOS](https://img.shields.io/badge/macOS-13%2B-blue)
![Electron](https://img.shields.io/badge/Electron-Latest-47848F)
![React](https://img.shields.io/badge/React-18-61DAFB)

## Features

- **Real-Time Monitoring**: Automatically watches log files and updates when new errors occur
- **Native Notifications**: Get macOS notifications for new errors and warnings
- **Terminal-Style UI**: Clean, monospace font interface focused on readability
- **Smart Parsing**: Automatically parses PHP error logs including stack traces
- **Stack Trace Navigation**: Click file paths in stack traces to open directly in VS Code
- **Search & Filter**: Quickly find specific errors with built-in search
- **Error Age Indicators**: Visual graying of errors older than 1 day

## Screenshots

The app displays as a standard macOS application with a full window for viewing errors and stack traces.

## Installation

### Prerequisites

- macOS 13 or later
- [pnpm](https://pnpm.io/) package manager

### Setup

```bash
# Clone the repository
git clone https://github.com/meowarts/nyao-php-logs.git
cd nyao-php-logs

# Install dependencies
pnpm install
```

## Usage

### Development Mode

Run the app in development mode with hot reload:

```bash
pnpm start
```

This starts webpack-dev-server on port 8080 and launches the Electron app.

### Production Build

Build and run the production version:

```bash
pnpm run prod
```

### Packaging

Create a distributable macOS app:

```bash
pnpm run build
```

The packaged app will be created in `./builds/Nyao PHP Logs-darwin-arm64/`.

### Testing

Run Playwright E2E tests:

```bash
pnpm test
```

## How It Works

### Log File Monitoring

1. The app watches your PHP error log file using `fs.watch`
2. When changes are detected, only new content is read (efficient streaming)
3. Log entries are parsed into structured data (date, type, message, stack trace)
4. Updates are sent to the UI via Electron IPC
5. Notifications are sent for new errors automatically

### Default Log Path

The app defaults to monitoring `~/sites/ai/logs/php/error.log`. You can change this via **File > Open** in the app menu.

### Error Types

The app recognizes three PHP log levels:
- **Error**: Fatal errors and parse errors
- **Warning**: Runtime warnings
- **Notice**: Runtime notices and deprecated warnings

### Window Behavior

- Closing the window **minimizes** it to the Dock (doesn't quit)
- To quit completely, use the application menu or Cmd+Q

### UI Actions

- **File**: Open a different log file
- **Refresh**: Manually refresh the current log file
- **Copy**: Copy selected error details to clipboard
- **Remove**: Remove selected error from the list
- **Clear**: Clear all entries

## Architecture

### Technology Stack

- **Electron**: Desktop application framework
- **React**: UI rendering
- **Webpack**: Module bundling and build
- **Playwright**: E2E testing
- **Winston**: Application logging
- **SCSS**: Styling

### Project Structure

```
├── main.js                  # Electron main process entry point
├── watchlog.js              # Log file watcher with fs.watch
├── parseLogFile.js          # PHP log parsing logic
├── windowManager.js         # Main window reference management
├── sendNotification.js      # macOS notification handling
├── logger.js                # Winston logger configuration
├── servicePath.js           # External service paths (VS Code)
├── src/
│   ├── index.js             # React app entry point
│   ├── components/
│   │   ├── App.js           # Main React component
│   │   ├── DebouncedSearch.js
│   │   └── style.scss       # Main styles
│   └── utils/
│       └── date.js          # Date formatting utilities
├── tests/                   # Playwright E2E tests
└── webpack.*.config.js      # Webpack configurations
```

### IPC Communication

**Renderer → Main**
- `watch-another-file`: Request to monitor a different log file
- `open-file-in-vscode`: Open file at specific line in VS Code
- `open-file-dialog`: Show file picker dialog
- `empty-file`: Clear the current log file

**Main → Renderer**
- `log-update`: New log entries parsed
- `log-reset`: Log file reset/cleared
- `selected-file`: User selected a new file

## Development

### Code Quality

- Clean, refactored code
- Comments used only when necessary (tricky solutions, important notes)
- Simple solutions preferred over complex ones

### Commit Guidelines

- One-line commit messages in past tense
- Human, simple, concise
- No mention of tools or AI assistance
- Detail only when commit addresses a very specific issue

## Contributing

Contributions are welcome! Please ensure:
- Code is clean and well-tested
- Commits follow the guidelines above
- Use pnpm for package management
- Run tests before submitting PRs

## License

[Add your license here]

## Author

[Add your info here]
