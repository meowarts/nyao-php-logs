import './style.scss';

import React, { useCallback, useEffect, useState, useRef } from 'react';
const { ipcRenderer, clipboard } = window.require('electron');

import StacktraceIcon from '../assets/stacktrace.png';
import FileIcon from '../assets/file.png';
import CopyIcon from '../assets/copy.png';
import RemoveIcon from '../assets/remove.png';
import ClearIcon from '../assets/clear.png';
import EmptyIcon from '../assets/empty.png';
import RefreshIcon from '../assets/refresh.png';
import DebouncedSearch from './DebouncedSearch';
import { getRelativeDay, getTimeOnly } from '../utils/date';

function App() {
  const scrollRef = useRef(null);
  const [originalLogData, setOriginalLogData] = useState({ path: null, entries: [] });
  const [logData, setLogData] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedEntries, setCopiedEntries] = useState([]);
  const [rawMode, setRawMode] = useState(false);

  useEffect(() => {
    ipcRenderer.on('log-update', (event, { logPath, logEntries }) => {
      setOriginalLogData((prevData) => {
        const newEntries = [...prevData.entries, ...logEntries];
        return { path: logPath, entries: newEntries };
      });
      setIsLoading(false);
    });

    ipcRenderer.on('log-reset', (event, { logPath }) => {
      setIsLoading(true);
      setOriginalLogData({ path: logPath, entries: [] });
      setLogData([]);
      setSelectedEntry(null);
    });

    ipcRenderer.on('selected-file', (event, filePath) => {
      ipcRenderer.send('watch-another-file', filePath);
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      ipcRenderer.removeAllListeners('log-update');
      ipcRenderer.removeAllListeners('selected-file');
      ipcRenderer.removeAllListeners('log-reset');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setLogData(originalLogData.entries);
  }, [originalLogData.entries]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logData]);

  useEffect(() => {
    if (!selectedEntry) {
      setShowModal(false);
    }
  }, [selectedEntry]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'c' && selectedEntries.length > 0) {
        event.preventDefault();
        copySelectedEntries();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntries, copySelectedEntries]);

  const filteredData = useCallback((value) => {
    setSelectedEntry(null);

    if (value === '') {
      setLogData(originalLogData.entries);
      return;
    }
    const filtered = originalLogData.entries.filter((entry) => {
      return entry.message.toLowerCase().includes(value.toLowerCase())
        || entry.stacktrace.join('').toLowerCase().includes(value.toLowerCase());
    });
    setLogData(filtered);
  }, [originalLogData.entries]);

  const openFileInVSCode = useCallback(({ fileName, lineNumber }) => {
    if (!fileName || !lineNumber) {
      return;
    }
    ipcRenderer.send('open-file-in-vscode', { fileName, lineNumber });
  }, []);

  const showStatusMessage = useCallback((message) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(null), 2000);
  }, []);

  const isSameEntry = useCallback((entry1, entry2) => {
    return !!entry1 && !!entry2 && entry1.id === entry2.id;
  }, []);

  const isEntrySelected = useCallback((entry) => {
    return selectedEntries.some(e => e.id === entry.id);
  }, [selectedEntries]);

  const isEntryCopied = useCallback((entry) => {
    return copiedEntries.includes(entry.id);
  }, [copiedEntries]);

  const handleLogClick = useCallback((entry, event, index) => {
    const isCmdOrCtrl = event.metaKey || event.ctrlKey;
    const isShift = event.shiftKey;

    // Prevent text selection
    if (isCmdOrCtrl || isShift) {
      event.preventDefault();
    }

    if (isCmdOrCtrl) {
      // Toggle selection
      setSelectedEntries(prev => {
        const isSelected = prev.some(e => e.id === entry.id);
        if (isSelected) {
          return prev.filter(e => e.id !== entry.id);
        } else {
          return [...prev, entry];
        }
      });
      setLastSelectedIndex(index);
      setSelectedEntry(entry);
    } else if (isShift && lastSelectedIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeEntries = logData.slice(start, end + 1);
      setSelectedEntries(rangeEntries);
      setSelectedEntry(entry);
    } else {
      // Normal single selection
      setShowModal(false);
      setSelectedEntry(entry);
      setSelectedEntries([entry]);
      setLastSelectedIndex(index);
    }
  }, [lastSelectedIndex, logData]);

  const handleContextMenu = useCallback((event, entry) => {
    event.preventDefault();

    // If right-clicked entry is not in selection, select only it
    const isInSelection = selectedEntries.some(e => e.id === entry.id);
    if (!isInSelection) {
      setSelectedEntry(entry);
      setSelectedEntries([entry]);
    }

    const { Menu, MenuItem } = window.require('@electron/remote');
    const menu = new Menu();

    const entriesToAffect = isInSelection ? selectedEntries : [entry];

    menu.append(new MenuItem({
      label: `Copy ${entriesToAffect.length > 1 ? `${entriesToAffect.length} entries` : 'entry'}`,
      click: () => {
        const text = entriesToAffect.map(e => {
          const timestamp = getTimeOnly(e.date);
          const relativeDay = getRelativeDay(e.date);
          return `[${relativeDay}] ${timestamp} - ${e.message}`;
        }).join('\n\n');
        clipboard.writeText(text);
        setCopiedEntries(entriesToAffect.map(e => e.id));
        setTimeout(() => setCopiedEntries([]), 1000);
      }
    }));

    menu.append(new MenuItem({
      label: `Remove ${entriesToAffect.length > 1 ? `${entriesToAffect.length} entries` : 'entry'}`,
      click: () => {
        setOriginalLogData((prevData) => ({
          ...prevData,
          entries: prevData.entries.filter((e) => !entriesToAffect.some(sel => sel.id === e.id))
        }));
        setSelectedEntry(null);
        setSelectedEntries([]);
      }
    }));

    menu.popup();
  }, [selectedEntries]);

  const copySelectedEntries = useCallback(() => {
    if (selectedEntries.length === 0) return;

    const text = selectedEntries.map(entry => {
      const timestamp = getTimeOnly(entry.date);
      const relativeDay = getRelativeDay(entry.date);
      return `[${relativeDay}] ${timestamp} - ${entry.message}`;
    }).join('\n\n');

    clipboard.writeText(text);

    // Show green flash effect
    setCopiedEntries(selectedEntries.map(e => e.id));
    setTimeout(() => setCopiedEntries([]), 1000);
  }, [selectedEntries]);

  const hasStacktraces = useCallback((entry) => entry.stacktrace?.length > 0, []);

  const generateClassName = useCallback((...args) => args.filter((v) => v !== '').join(' '), []);

  const isOldEntry = useCallback((entry) => {
    if (!entry.date) return false;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
    return entryDate < oneDayAgo;
  }, []);

  const getRawLogsText = useCallback(() => {
    return logData.map(entry => {
      const timestamp = getTimeOnly(entry.date);
      const relativeDay = getRelativeDay(entry.date);
      let text = `[${relativeDay}] ${timestamp} - [${entry.type.toUpperCase()}] ${entry.message}`;

      if (entry.stacktrace && entry.stacktrace.length > 0) {
        text += '\n' + entry.stacktrace.map(st => `  ${st.detail}`).join('\n');
      }

      return text;
    }).join('\n');
  }, [logData]);

  return (
    <div className="window">
      {/* <div className="aside"> Add sidebar content here </div> */}
      <div className="main">
        <div className="actionBar">
          <label className="label">Nyao PHP Logs</label>
          <div className={generateClassName('statusMessage', statusMessage !== null ? 'show' : 'hide')}>
            {statusMessage}
          </div>
        </div>
        <div className='footer'>
          <div className='actions'>
            <button className="iconButton" onClick={() => ipcRenderer.send('open-file-dialog')}>
              <img src={FileIcon} alt="Open file" />
            </button>

            <button className="iconButton"
              onClick={() => {
                ipcRenderer.send('watch-another-file', originalLogData.path);
              }}
            >
              <img src={RefreshIcon} alt="Refresh" />
            </button>

            <button className="iconButton"
              onClick={() => {
                ipcRenderer.send('empty-file', originalLogData.path);
                setOriginalLogData({ ...originalLogData, entries: [] });
                setLogData([]);
                setSelectedEntry(null);
              }}
            >
              <img src={ClearIcon} alt="Clear all" />
            </button>

            <button
              className={generateClassName('textButton', rawMode ? 'active' : '')}
              onClick={() => setRawMode(!rawMode)}
            >
              RAW
            </button>
          </div>

          <DebouncedSearch className="searchTextField" placeholder="Search" onSearch={filteredData} />
        </div>
        <div ref={scrollRef} className={generateClassName('content', 'scrollable', showModal ? 'lock' : '')}>
          {rawMode ? (
            <pre className="rawLogs">
              {logData.length === 0 ? (
                isLoading ? 'Loading...' : 'No logs found.'
              ) : (
                getRawLogsText()
              )}
            </pre>
          ) : (
            <div className={generateClassName('logsContainer', isLoading ? 'loading' : '', logData.length === 0 ? 'empty' : '')}>

              {logData.length === 0 && (
                isLoading
                  ? <span className="loader"></span>
                  : <div className="emptyLogs"><div>No logs found.</div></div>
              )}

              {logData.map((entry, index) => (
                <div key={entry.id}
                  className={generateClassName('logEntry', entry.type, isEntrySelected(entry) ? 'selected' : '', isOldEntry(entry) ? 'old' : '', isEntryCopied(entry) ? 'copied' : '')}
                  onClick={(e) => handleLogClick(entry, e, index)}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                >
                  <div className="timeBadge">{getRelativeDay(entry.date)}</div>
                  <div className="logContent">
                    <div className="timestamp">{getTimeOnly(entry.date)}</div>
                    <div className="message">{entry.message}</div>
                  </div>

                  {hasStacktraces(entry) &&
                    <div className="stackTraceButton" onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntry(entry);
                      setShowModal(true);
                    }}>
                      <img src={StacktraceIcon} width={40} height={40}/>
                    </div>
                  }
                </div>
              ))}
            </div>
          )}

          {/* Modal */}
          <div className={generateClassName('modal', showModal ? 'show' : 'hide')}>
            <div className='stackTraceContent'>
              {selectedEntry?.stacktrace.map(({ detail, fileName, lineNumber, index}) => (
                <div className='stackTrace' key={`${selectedEntry.id}-stacktrace-${index}`}>
                  <div className='fileContainer' onClick={() => openFileInVSCode({ fileName,  lineNumber })}>
                    <span>{index}</span>
                    <div>
                      <span className='file openable'>{fileName}</span>
                      <span>({lineNumber})</span>
                    </div>
                  </div>
                  <div className='detail'>{detail}</div>
                </div>
              ))}
            </div>
            <div className='closeButton clickable' onClick={() => setShowModal(false)}>✕</div>
          </div>

        </div>
        <div className='statusBar'>
          {originalLogData.path || 'No file selected'}
        </div>
      </div>
    </div>
  );
}

export default App;
