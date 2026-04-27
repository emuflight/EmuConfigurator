const { app, BrowserWindow, ipcMain, Menu, screen, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Register signal handlers at the very top to catch Ctrl+C/SIGTERM before anything else.
// In dev mode (yarn dev), these ensure the process exits without leaving
// zombie processes that hold stale single-instance lock files.
process.on('SIGINT', () => {
  console.log('SIGINT received, quitting...');
  if (app) {
    app.quit();
    // Fallback: force-exit after 2s if app.quit() does not terminate the process
    setTimeout(() => process.exit(0), 2000).unref();
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, quitting...');
  if (app) {
    app.quit();
    setTimeout(() => process.exit(0), 2000).unref();
  } else {
    process.exit(0);
  }
});

// Fallback: if the process is about to exit for any reason, log it
process.on('exit', (code) => {
  console.log(`[main.js] Process exiting with code ${code}`);
});

let mainWindow = null;

function safeSendToRenderer(sender, channel, ...args) {
  if (!sender || sender.isDestroyed()) {
    return false;
  }

  try {
    sender.send(channel, ...args);
    return true;
  } catch (e) {
    if (!e.message || !e.message.includes('Object has been destroyed')) {
      console.error(`main.js: error sending ${channel} to renderer:`, e.message);
    }
    return false;
  }
}

function getWindowIconPath() {
  const iconCandidatesByPlatform = {
    linux: [
      path.join(__dirname, 'assets', 'linux', 'icon', 'emu_icon_128.png'),
      path.join(__dirname, 'src', 'images', 'emu_icon_128.png'),
      path.join(__dirname, 'dist', 'images', 'emu_icon_128.png'),
    ],
    win32: [
      path.join(__dirname, 'src', 'images', 'emu_icon.ico'),
      path.join(__dirname, 'dist', 'images', 'emu_icon.ico'),
    ],
    darwin: [
      path.join(__dirname, 'assets', 'osx', 'app-icon.icns'),
    ],
  };

  const candidates = iconCandidatesByPlatform[process.platform] || [];
  for (const iconPath of candidates) {
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }

  return undefined;
}

// Build modes (set by npm scripts in package.json):
//   'dev'           - `yarn dev` sets NODE_ENV=development → devtools menu item (no auto-open)
//   'dev-release'   - `yarn make:debug` sets EMUCFG_BUILD_MODE=dev-release → all menu items including toggle devtools
//   'release'       - `yarn make` (default) → all menu items except toggle devtools (inspect only)
function getBuildMode() {
  if (process.env.NODE_ENV === 'development') return 'dev';
  try {
    // electron-forge extraMetadata bakes buildMode into the packaged package.json
    return require('./package.json').buildMode || 'release';
  } catch (e) {
    return 'release';
  }
}

function setupMenu(buildMode) {
  // Show Developer Tools menu item for dev and dev-release; hide only for release
  const showDevTools = buildMode !== 'release';
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }]
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            const w = BrowserWindow.getFocusedWindow();
            if (w) applyZoom(w, DEFAULT_ZOOM_LEVEL);
          }
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            const w = BrowserWindow.getFocusedWindow();
            if (w) applyZoom(w, _currentZoom + 1);
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const w = BrowserWindow.getFocusedWindow();
            if (w) applyZoom(w, _currentZoom - 1);
          }
        },
        ...(showDevTools ? [
          { type: 'separator' },
          { role: 'toggleDevTools', label: 'Toggle Developer Tools' }
        ] : [])
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        {
          label: 'Maximize',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win && !win.isDestroyed()) {
              if (win.isMinimized()) {
                win.restore();
              }
              if (!win.isMaximized()) {
                win.maximize();
              }
            }
          },
        },
        {
          label: 'Restore Window Size',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            resetWindowToPreferredBounds(win);
          },
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'EmuFlight Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/emuflight/EmuFlight/wiki');
          }
        },
        {
          label: 'EmuFlight GitHub',
          click: async () => {
            await shell.openExternal('https://github.com/emuflight');
          }
        },
        {
          label: 'EmuFlight Discord',
          click: async () => {
            await shell.openExternal('https://discord.gg/BWqgBg3');
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Window size constraints
const MIN_WINDOW_WIDTH = 1024;
const MIN_WINDOW_HEIGHT = 550;
const PREFERRED_WINDOW_WIDTH = 1700;
const PREFERRED_WINDOW_HEIGHT = 1080;

// Zoom level persistence
const CONFIG_DIR = path.join(app.getPath('userData'), 'config');
const APP_CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');  // unified config: zoom, lastDialogFolder, etc.
const ZOOM_CONFIG_FILE = path.join(CONFIG_DIR, 'zoom.json');  // deprecated; kept for backward compatibility
const DEFAULT_ZOOM_LEVEL = 0; // Ctrl+0 actual size
const MIN_ZOOM_LEVEL = -9;
const MAX_ZOOM_LEVEL = 9;

// In-memory zoom level — single source of truth; avoids disk reads on resize
// and eliminates races between the F12 handler and devtools-opened/closed handlers.
let _currentZoom = DEFAULT_ZOOM_LEVEL;

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Load zoom level from config file
function loadZoomLevel() {
  try {
    if (fs.existsSync(ZOOM_CONFIG_FILE)) {
      const data = fs.readFileSync(ZOOM_CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);
      return typeof config.zoomLevel === 'number' ? config.zoomLevel : DEFAULT_ZOOM_LEVEL;
    }
  } catch (e) {
    console.error('Failed to load zoom config:', e);
  }
  return DEFAULT_ZOOM_LEVEL;
}

// Clamp zoom level to valid range [MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL]
function clampZoom(level) {
  const n = Number(level);
  return Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, Number.isNaN(n) ? DEFAULT_ZOOM_LEVEL : n));
}

// Save zoom level to config file
function saveZoomLevel(level) {
  try {
    ensureConfigDir();
    const clampedLevel = clampZoom(level);
    fs.writeFileSync(ZOOM_CONFIG_FILE, JSON.stringify({ zoomLevel: clampedLevel }, null, 2));
  } catch (e) {
    console.error('Failed to save zoom config:', e);
  }
}

// Load unified app config (zoom level, last dialog folder, etc.)
function loadConfig() {
  try {
    if (fs.existsSync(APP_CONFIG_FILE)) {
      const data = fs.readFileSync(APP_CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);
      return {
        zoomLevel: typeof config.zoomLevel === 'number' ? config.zoomLevel : DEFAULT_ZOOM_LEVEL,
        lastDialogFolder: typeof config.lastDialogFolder === 'string' ? config.lastDialogFolder : '',
      };
    }
  } catch (e) {
    console.error('Failed to load app config:', e);
  }
  return { zoomLevel: DEFAULT_ZOOM_LEVEL, lastDialogFolder: '' };
}

// Save unified app config (merges with existing config)
function saveConfig(patch) {
  try {
    ensureConfigDir();
    const existing = loadConfig();
    fs.writeFileSync(APP_CONFIG_FILE, JSON.stringify({ ...existing, ...patch }, null, 2));
  } catch (e) {
    console.error('Failed to save app config:', e);
  }
}

// Apply zoom to webContents.
function setWebContentsZoom(win, level) {
  if (!win || win.isDestroyed() || !win.webContents) return false;
  win.webContents.setZoomLevel(level);
  return true;
}

// Apply and persist a zoom change: clamps, updates in-memory state, sets webContents level, saves to disk.
// All zoom mutations must go through this function to keep _currentZoom consistent.
function applyZoom(win, level) {
  if (!win || win.isDestroyed() || !win.webContents) return;
  const previous = _currentZoom;
  const clamped = clampZoom(level);
  _currentZoom = clamped;
  setWebContentsZoom(win, clamped);
  if (clamped !== previous) {
    saveZoomLevel(clamped);
  }
}

function getInitialWindowBounds() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const workArea = display.workArea;
  const width = Math.min(PREFERRED_WINDOW_WIDTH, workArea.width);
  const height = Math.min(PREFERRED_WINDOW_HEIGHT, workArea.height);

  return {
    width,
    height,
    x: workArea.x + Math.max(0, Math.floor((workArea.width - width) / 2)),
    y: workArea.y + Math.max(0, Math.floor((workArea.height - height) / 2)),
  };
}

function resetWindowToPreferredBounds(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  if (win.isMinimized()) {
    win.restore();
  }

  if (win.isFullScreen()) {
    win.setFullScreen(false);
  }

  if (win.isMaximized()) {
    win.unmaximize();
  }

  win.setBounds(getInitialWindowBounds());
}

// --- Serial port IPC bridge ---
let _serialPort = null; // active serialport instance

// IPC: list serial ports from main process
ipcMain.handle('serial-list-ports', async () => {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    return ports.map(p => p.path);
  } catch (e) {
    console.error('main.js: serialport list failed, trying fs fallback:', e.message);
    try {
      const entries = fs.readdirSync('/dev').filter(f => /^tty(USB|ACM|S)\d+$/.test(f));
      return entries.map(f => '/dev/' + f);
    } catch (fsErr) {
      return [];
    }
  }
});

// IPC: open serial port
ipcMain.handle('serial-connect', async (event, portPath, options) => {
  try {
    const { SerialPort } = require('serialport');
    if (_serialPort && _serialPort.isOpen) {
      await new Promise((resolve) => _serialPort.close((err) => {
        if (err) console.warn('main.js: error closing previous port:', err.message);
        resolve();
      }));
    }
    _serialPort = new SerialPort({
      path: portPath,
      baudRate: options.bitrate || 115200,
      autoOpen: false,
    });
    await new Promise((resolve, reject) => {
      _serialPort.open((err) => err ? reject(err) : resolve());
    });
    // Forward incoming data to renderer
    _serialPort.on('data', (data) => {
      safeSendToRenderer(event.sender, 'serial-data', data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    });
    // Enhanced error handler to prevent uncaught exceptions
    _serialPort.on('error', (err) => {
      console.error('main.js serialport error:', err.message);
      safeSendToRenderer(event.sender, 'serial-error', err.message);
      // Attempt graceful recovery
      if (_serialPort && _serialPort.isOpen) {
        _serialPort.close((err) => {
          if (err) console.error('main.js: error closing serial port after error:', err.message);
          else console.log('main.js: closed serial port after error');
        });
      }
    });
    _serialPort.on('close', () => {
      safeSendToRenderer(event.sender, 'serial-close');
    });
    return { connectionId: 1, bitrate: options.bitrate || 115200 };
  } catch (e) {
    console.error('main.js: serial-connect failed:', e.message);
    return null;
  }
});

// IPC: send data over serial port
ipcMain.handle('serial-send', async (event, bufferData) => {
  if (!_serialPort || !_serialPort.isOpen) return { bytesSent: 0, error: 'not_connected' };
  const buf = Buffer.from(bufferData);
  return new Promise((resolve) => {
    let settled = false;
    // Timeout protection: prevent indefinite hang on native module
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.error('main.js: serial-send timeout after 10s, forcibly resolving');
        resolve({ bytesSent: 0, error: 'timeout' });
      }
    }, 10000);

    try {
      _serialPort.write(buf, (err) => {
        if (settled) return;
        if (err) {
          settled = true;
          clearTimeout(timeoutId);
          console.error('main.js: serial-send write error:', err.message);
          resolve({ bytesSent: 0, error: err.message });
        } else {
          // Resolve immediately after write() callback — matches Chrome serial API behavior.
          // The OS kernel buffers and orders TX; drain() serializes writes and degrades MSP throughput.
          settled = true;
          clearTimeout(timeoutId);
          resolve({ bytesSent: buf.length });
        }
      });
    } catch (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      console.error('main.js: serial-send exception:', e.message);
      resolve({ bytesSent: 0, error: e.message });
    }
  });
});

// IPC: close serial port
ipcMain.handle('serial-disconnect', async () => {
  if (!_serialPort || !_serialPort.isOpen) {
    _serialPort = null;
    return true;
  }
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.error('main.js: serial-disconnect timeout, forcing cleanup');
      _serialPort = null;
      resolve(false);
    }, 5000);

    try {
      _serialPort.close((err) => {
        clearTimeout(timeoutId);
        _serialPort = null;
        resolve(!err);
      });
    } catch (e) {
      clearTimeout(timeoutId);
      console.error('main.js: serial-disconnect exception:', e.message);
      _serialPort = null;
      resolve(false);
    }
  });
});

// IPC: detect DFU USB devices
// IPC: TCP socket (for SITL / MSP-over-TCP connections)
const net = require('net');
const _tcpSockets = new Map();
let _tcpSocketCounter = 0;

ipcMain.handle('tcp-connect', async (event, socketId, host, port) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    _tcpSockets.set(socketId, socket);
    socket.setNoDelay(true);

    // Connection timeout: 10 seconds
    const timeoutMs = 10000;
    let timeoutId = null;
    let resolved = false;

    socket.on('data', (data) => {
      safeSendToRenderer(event.sender, 'tcp-data', socketId, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    });
    socket.on('error', (err) => {
      console.error(`main.js: tcp socket ${socketId} error:`, err.message);
      safeSendToRenderer(event.sender, 'tcp-error', socketId, err.message);
    });
    socket.on('close', () => {
      _tcpSockets.delete(socketId);
      safeSendToRenderer(event.sender, 'tcp-close', socketId);
    });

    const connectionErrorHandler = () => {
      if (!resolved) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve(-102); // CONNECTION_REFUSED
      }
    };

    const handleConnectionTimeout = () => {
      if (!resolved) {
        resolved = true;
        socket.removeListener('error', connectionErrorHandler);
        socket.destroy();
        _tcpSockets.delete(socketId);
        console.error(`main.js: tcp socket ${socketId} connection timeout (${host}:${port})`);
        resolve(-103); // CONNECTION_TIMEOUT
      }
    };

    socket.once('error', connectionErrorHandler);
    timeoutId = setTimeout(handleConnectionTimeout, timeoutMs);

    socket.connect(port, host, () => {
      if (!resolved) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        socket.removeListener('error', connectionErrorHandler);
        resolve(0);
      }
    });
  });
});

ipcMain.handle('tcp-send', async (event, socketId, data) => {
  const socket = _tcpSockets.get(socketId);
  if (!socket || socket.destroyed) return { resultCode: -100 };
  return new Promise((resolve) => {
    socket.write(Buffer.from(data), (err) => {
      resolve(err ? { resultCode: -1 } : { resultCode: 0, bytesSent: data.length });
    });
  });
});

ipcMain.handle('tcp-disconnect', async (event, socketId) => {
  const socket = _tcpSockets.get(socketId);
  if (socket) { socket.destroy(); _tcpSockets.delete(socketId); }
  return true;
});

ipcMain.handle('tcp-allocate', async () => {
  return ++_tcpSocketCounter;
});
const _usbOpenDevices = new Map();

function usbKeyFromDevice(device) {
  return `${device.busNumber}:${device.deviceAddress}`;
}

function findUsbDeviceByKey(key) {
  const { usb } = require('usb');
  return usb.getDeviceList().find((d) => usbKeyFromDevice(d) === key) || null;
}

function ensureUsbDeviceOpen(key) {
  let device = _usbOpenDevices.get(key) || findUsbDeviceByKey(key);
  if (!device) {
    throw new Error(`USB device not found: ${key}`);
  }
  if (!device.interfaces) {
    device.open();
  }
  _usbOpenDevices.set(key, device);
  return device;
}

function toBmRequestType(direction, requestType, recipient) {
  let bm = 0;
  if (direction === 'in') {
    bm |= 0x80;
  }

  if (requestType === 'class') {
    bm |= 0x20;
  } else if (requestType === 'vendor') {
    bm |= 0x40;
  }

  if (recipient === 'interface') {
    bm |= 0x01;
  } else if (recipient === 'endpoint') {
    bm |= 0x02;
  } else if (recipient === 'other') {
    bm |= 0x03;
  }

  return bm;
}

ipcMain.handle('usb-list-dfu', async () => {
  try {
    const { usb } = require('usb');
    const DFU_IDS = [
      { vendorId: 0x0483, productId: 0xDF11 },
      { vendorId: 0x2DAE, productId: 0x0003 },
    ];

    return usb.getDeviceList()
      .filter((d) => {
        const desc = d.deviceDescriptor || {};
        return DFU_IDS.some((id) => id.vendorId === desc.idVendor && id.productId === desc.idProduct);
      })
      .map((d) => ({
        device: usbKeyFromDevice(d),
        vendorId: d.deviceDescriptor.idVendor,
        productId: d.deviceDescriptor.idProduct,
        serialNumber: '',
        manufacturer: '',
        product: '',
      }));
  } catch (e) {
    console.error('usb-list-dfu error:', e.message);
    return [];
  }
});

ipcMain.handle('usb-open-device', async (event, deviceKey) => {
  try {
    ensureUsbDeviceOpen(deviceKey);
    return { success: true };
  } catch (e) {
    console.error('usb-open-device error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('usb-close-device', async (event, deviceKey) => {
  try {
    const device = _usbOpenDevices.get(deviceKey);
    if (device && device.interfaces) {
      device.close();
    }
    _usbOpenDevices.delete(deviceKey);
    return { success: true };
  } catch (e) {
    console.error('usb-close-device error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('usb-claim-interface', async (event, deviceKey, interfaceNumber) => {
  try {
    const device = ensureUsbDeviceOpen(deviceKey);
    const iface = device.interface(interfaceNumber);
    iface.claim();
    return { success: true };
  } catch (e) {
    console.error('usb-claim-interface error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('usb-release-interface', async (event, deviceKey, interfaceNumber) => {
  try {
    const device = ensureUsbDeviceOpen(deviceKey);
    const iface = device.interface(interfaceNumber);
    await new Promise((resolve, reject) => {
      iface.release(true, (err) => (err ? reject(err) : resolve()));
    });
    return { success: true };
  } catch (e) {
    console.error('usb-release-interface error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('usb-get-configuration', async (event, deviceKey) => {
  try {
    const device = ensureUsbDeviceOpen(deviceKey);
    const configDescriptor = device.configDescriptor || {};
    // Flatten ALL interface alternate settings — mirrors Chrome USB API config.interfaces
    // e.g. STM32 DFU has interface 0 with 4 alt settings (Internal Flash, Option Bytes, OTP, Device Info)
    const interfaces = [];
    ((configDescriptor.interfaces) || []).forEach((altSettings) => {
      altSettings.forEach((altSetting) => {
        interfaces.push({
          interfaceNumber: altSetting.bInterfaceNumber,
          alternateSetting: altSetting.bAlternateSetting,
          endpoints: (altSetting.endpoints || []).map((ep) => ({ address: ep.bEndpointAddress })),
        });
      });
    });

    console.log('usb-get-configuration: found', interfaces.length, 'interface alt settings');
    return {
      resultCode: 0,
      configurationValue: configDescriptor.bConfigurationValue || 1,
      interfaces,
    };
  } catch (e) {
    console.error('usb-get-configuration error:', e.message);
    return { resultCode: 1, interfaces: [] };
  }
});

ipcMain.handle('usb-control-transfer', async (event, deviceKey, options) => {
  try {
    const device = ensureUsbDeviceOpen(deviceKey);
    const bmRequestType = toBmRequestType(options.direction, options.requestType, options.recipient);
    const bRequest = options.request;
    const wValue = options.value || 0;
    const wIndex = options.index || 0;

    if (options.direction === 'in') {
      const length = options.length || 0;
      const data = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('USB control transfer timeout'));
        }, 10000);

        device.controlTransfer(bmRequestType, bRequest, wValue, wIndex, length, (err, inData) => {
          clearTimeout(timeoutId);
          if (err) {
            reject(err);
            return;
          }
          resolve(inData || Buffer.alloc(0));
        });
      });

      return { resultCode: 0, bytesTransferred: data.length, data: Array.from(data) };
    }

    const outData = options.data ? Buffer.from(options.data) : Buffer.alloc(0);
    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('USB control transfer timeout'));
      }, 10000);

      device.controlTransfer(bmRequestType, bRequest, wValue, wIndex, outData, (err) => {
        clearTimeout(timeoutId);
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    return { resultCode: 0, bytesTransferred: outData.length };
  } catch (e) {
    if (e.message && e.message.includes('LIBUSB_TRANSFER_STALL')) {
      // STALL is a valid DFU device response (device in dfuERROR, protocol
      // clears it via DFU_CLRSTATUS). Not a fatal error — demote to warn.
      console.warn('usb-control-transfer: device stalled (expected during DFU error recovery)');
    } else {
      console.error('usb-control-transfer error:', e.message);
    }
    return { resultCode: 1, bytesTransferred: 0, data: [] };
  }
});

ipcMain.handle('usb-bulk-transfer', async (event, deviceKey, options) => {
  try {
    const device = ensureUsbDeviceOpen(deviceKey);
    const interfaceNumber = options.interfaceNumber !== undefined ? options.interfaceNumber : 0;
    const iface = device.interfaces[interfaceNumber];
    if (!iface) {
      throw new Error(`Interface ${interfaceNumber} not found on device`);
    }
    const endpointNumber = options.endpoint || 1;
    const endpointAddress = options.direction === 'in' ? (endpointNumber | 0x80) : endpointNumber;
    const endpoint = (iface.endpoints || []).find((ep) => ep.address === endpointAddress);

    if (!endpoint) {
      return { resultCode: 1, bytesTransferred: 0, data: [] };
    }

    const withTransferTimeout = (transferPromiseFactory, timeoutMessage) => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          try {
            if (typeof endpoint.stopPoll === 'function') {
              endpoint.stopPoll(() => {});
            }
          } catch {
            // ignore endpoint stopPoll errors during timeout recovery
          }

          try {
            if (typeof endpoint.clearHalt === 'function') {
              endpoint.clearHalt(() => {});
            }
          } catch {
            // ignore endpoint clearHalt errors during timeout recovery
          }

          reject(new Error(timeoutMessage));
        }, 10000);

        transferPromiseFactory()
          .then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            reject(err);
          });
      });
    };

    if (options.direction === 'in') {
      const data = await withTransferTimeout(() => {
        return new Promise((resolve, reject) => {
          endpoint.transfer(options.length || 64, (err, inData) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(inData || Buffer.alloc(0));
          });
        });
      }, 'USB bulk IN transfer timeout');

      return { resultCode: 0, bytesTransferred: data.length, data: Array.from(data) };
    }

    const outData = options.data ? Buffer.from(options.data) : Buffer.alloc(0);
    await withTransferTimeout(() => {
      return new Promise((resolve, reject) => {
        endpoint.transfer(outData, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    }, 'USB bulk OUT transfer timeout');

    return { resultCode: 0, bytesTransferred: outData.length };
  } catch (e) {
    console.error('usb-bulk-transfer error:', e.message);
    return { resultCode: 1, bytesTransferred: 0, data: [] };
  }
});

ipcMain.handle('usb-reset-device', async (event, deviceKey) => {
  try {
    const device = ensureUsbDeviceOpen(deviceKey);
    await new Promise((resolve, reject) => {
      device.reset((err) => (err ? reject(err) : resolve()));
    });
    return { success: true, resultCode: 0 };
  } catch (e) {
    console.error('usb-reset-device error:', e.message);
    return { success: false, resultCode: 1 };
  }
});

// --- File system dialog IPC bridge ---
const { dialog } = require('electron');

// IPC: show save file dialog
ipcMain.handle('dialog:choose-entry', async (event, options) => {
  const { type, suggestedName, accepts } = options;

  if (type === 'saveFile') {
    const filters = accepts ? accepts.map(a => ({ name: a.description, extensions: a.extensions })) : [];
    return await dialog.showSaveDialog({
      defaultPath: suggestedName,
      filters: filters.length > 0 ? filters : undefined,
    });
  } else if (type === 'openFile') {
    const openFilters = accepts
      ? accepts.filter(a => Array.isArray(a.extensions) && a.extensions.length > 0)
               .map(a => ({ name: a.description, extensions: a.extensions }))
      : [];
    return await dialog.showOpenDialog({
      defaultPath: suggestedName,
      filters: openFilters,
      properties: ['openFile'],
    });
  }
  return { canceled: true };
});

// IPC: write binary content to file (preserves binary data)
// position: byte offset to write at; null means append (legacy) or create (isFirstWrite)
ipcMain.handle('dialog:write-binary-file', async (event, filePath, byteArray, isFirstWrite = true, position = null) => {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const buffer = Buffer.from(byteArray);
  if (isFirstWrite) {
    // Create/truncate and write from the beginning
    await fs.promises.writeFile(filePath, buffer, { flag: 'w' });
  } else if (position !== null && Number.isFinite(position)) {
    // Write at the specified position without truncating (seek-based write)
    const fh = await fs.promises.open(filePath, 'r+');
    try {
      await fh.write(buffer, 0, buffer.length, position);
    } finally {
      await fh.close();
    }
  } else {
    // Append chunk to existing file (legacy behaviour)
    await fs.promises.writeFile(filePath, buffer, { flag: 'a' });
  }
  // Log only on first write (start); suppress per-chunk logs
  if (isFirstWrite) {
    console.log(`[BBL] Downloading blackbox log to: ${filePath}`);
  }
  return buffer.length;
});

// IPC: read file as UTF-8 text (used by fileEntry.file() in preload chromeFileSystem shim)
ipcMain.handle('dialog:read-file', async (event, filePath) => {
  const data = await fs.promises.readFile(filePath);
  return data;
});

// IPC: truncate file to size
ipcMain.handle('dialog:get-file-size', async (_event, filePath) => {
    try {
        const stat = await fs.promises.stat(filePath);
        return stat.size;
    } catch (e) {
        return 0; // file doesn't exist yet
    }
});

ipcMain.handle('dialog:truncate-file', async (event, filePath, size) => {
  try {
    // Ensure the directory exists before truncating
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    // Create file if it doesn't exist, then truncate
    try {
      await fs.promises.truncate(filePath, size);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File doesn't exist, create it as empty
        await fs.promises.writeFile(filePath, Buffer.alloc(size));
      } else {
        throw err;
      }
    }
    console.log(`Truncated ${filePath} to ${size} bytes`);
    return size;
  } catch (e) {
    console.error(`Truncate failed for ${filePath}:`, e.message);
    throw e;
  }
});

function createWindow() {
  const buildMode = getBuildMode();
  setupMenu(buildMode);
  const initialBounds = getInitialWindowBounds();

  const windowIconPath = getWindowIconPath();

  const win = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    x: initialBounds.x,
    y: initialBounds.y,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'dist', 'support', 'preload.js'),
    },
    icon: windowIconPath,
  });

  // Enforce minimum window size multiple ways for cross-platform compatibility
  win.setMinimumSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT);

  // Register F12 as global shortcut to toggle DevTools.
  // Unregister first: if createWindow() is called again (e.g. macOS activate after last window closed),
  // re-registration would fail silently and the old handler would reference a destroyed window.
  // Zoom is preserved by the devtools-opened/devtools-closed handlers via _currentZoom.
  globalShortcut.unregister('F12');
  globalShortcut.register('F12', () => {
    if (!win || win.isDestroyed() || !win.webContents) return;
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools();
    }
  });

  // Active enforcement: if window size falls below minimum after any resize, restore it
  let _resizeZoomTimer = null;
  let _devtoolsZoomTimer = null; // shared between devtools-opened/closed to prevent timer leaks
  const debouncedZoomReapply = () => {
    if (_resizeZoomTimer) clearTimeout(_resizeZoomTimer);
    _resizeZoomTimer = setTimeout(() => {
      if (!win || win.isDestroyed() || !win.webContents) {
        _resizeZoomTimer = null;
        return;
      }
      if (win.webContents.getZoomLevel() !== _currentZoom) {
        win.webContents.setZoomLevel(_currentZoom);
      }
      _resizeZoomTimer = null;
    }, 150);
  };
  
  win.on('resize', () => {
    const [width, height] = win.getSize();
    if (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT) {
      win.setSize(Math.max(width, MIN_WINDOW_WIDTH), Math.max(height, MIN_WINDOW_HEIGHT));
    }
    // Re-apply current zoom: Chromium can silently reset zoom level when window resizes
    debouncedZoomReapply();
  });

  // Also prevent moves that would resize
  win.on('moved', () => {
    const [width, height] = win.getSize();
    if (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT) {
      win.setSize(Math.max(width, MIN_WINDOW_WIDTH), Math.max(height, MIN_WINDOW_HEIGHT));
    }
  });

  win.loadFile(path.join(__dirname, 'dist', 'main.html'));

  // Reapply after window is fully loaded (some platforms need this)
  win.webContents.on('did-finish-load', () => {
    win.setMinimumSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT);
    const [width, height] = win.getSize();
    if (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT) {
      win.setSize(Math.max(width, MIN_WINDOW_WIDTH), Math.max(height, MIN_WINDOW_HEIGHT));
    }
    
    // Load saved zoom level or use default (Ctrl+0 actual size)
    applyZoom(win, loadZoomLevel());
  });
  
  // Save zoom level when it changes (e.g., mouse-wheel / pinch zoom)
  win.webContents.on('zoom-changed', (_event, _direction) => {
    applyZoom(win, win.webContents.getZoomLevel());
  });

  // Intercept new window requests (e.g., target="_blank" links) and open in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in the system default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' }; // Prevent Electron from opening its own window
    }
    // Deny all other URLs (file://, app://, etc.) to avoid Electron's "response must be an object" console error
    return { action: 'deny' };
  });

  // Clear all timers, unregister shortcuts, and release window reference on close
  win.on('closed', () => {
    globalShortcut.unregister('F12');
    if (_resizeZoomTimer) {
      clearTimeout(_resizeZoomTimer);
      _resizeZoomTimer = null;
    }
    if (_devtoolsZoomTimer) {
      clearTimeout(_devtoolsZoomTimer);
      _devtoolsZoomTimer = null;
    }
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  // Re-apply current zoom when DevTools opens/closes (Electron/Chromium can reset zoom on DevTools operations)
  // Both events share _devtoolsZoomTimer so rapid open/close doesn't leak multiple timers.
  win.webContents.on('devtools-opened', () => {
    if (_devtoolsZoomTimer) clearTimeout(_devtoolsZoomTimer);
    _devtoolsZoomTimer = setTimeout(() => {
      applyZoom(win, _currentZoom);
    }, 150);
  });

  win.webContents.on('devtools-closed', () => {
    if (_devtoolsZoomTimer) clearTimeout(_devtoolsZoomTimer);
    _devtoolsZoomTimer = setTimeout(() => {
      applyZoom(win, _currentZoom);
    }, 150);
  });

  // Handle zoom keyboard shortcuts via before-input-event so numpad keys and Shift+Equal
  // (Ctrl++ on US keyboards) work reliably. event.preventDefault() suppresses the menu
  // accelerator so only this handler fires for keyboard-triggered zoom changes.
  // Note: setZoomLevel() does NOT emit 'zoom-changed'; applyZoom() handles _currentZoom
  // update and saveZoomLevel() directly so persistence and resize-recovery work correctly.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return;
    const code = input.code;
    if (code === 'Equal' || code === 'NumpadAdd') {
      // Accepts Ctrl+= and Ctrl++ (Shift+Equal) for zoom in
      event.preventDefault();
      applyZoom(win, _currentZoom + 1);
    } else if (code === 'Minus' || code === 'NumpadSubtract') {
      event.preventDefault();
      applyZoom(win, _currentZoom - 1);
    } else if (code === 'Digit0' || code === 'Numpad0') {
      event.preventDefault();
      applyZoom(win, DEFAULT_ZOOM_LEVEL);
    }
  });

  // Setup context menu for right-click (cut/copy/paste/select all)
  win.webContents.on('context-menu', (_event, _params) => {
    const contextMenu = Menu.buildFromTemplate([
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' }
    ]);
    contextMenu.popup(win);
  });

  // Intercept navigation to external URLs and open them in system browser
  win.webContents.on('will-navigate', (event, url) => {
    const appPath = 'file://' + path.join(__dirname, 'dist');
    if (!url.startsWith(appPath) && (url.startsWith('http://') || url.startsWith('https://'))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Capture renderer console output and kill app on error
  // Electron 41+ uses string levels: 'verbose', 'info', 'warning', 'error'
  // Default (dev): show warnings+errors only. Set VERBOSE=1 to show all.
  // Uses Event<WebContentsConsoleMessageEventParams> object
  win.webContents.on('console-message', (event) => {
    const { level, message, lineNumber, sourceId } = event;
    if (message) {
      // Map string level to numeric priority for comparison
      const levelMap = { 'verbose': 0, 'info': 1, 'warning': 2, 'error': 3 };
      const numericLevel = levelMap[level] !== undefined ? levelMap[level] : (typeof level === 'number' ? level : 1);

      const verbose = process.env.VERBOSE === '1';
      if (verbose || numericLevel >= 2) {
        const tag = numericLevel >= 3 ? '[Renderer ERROR]' : numericLevel >= 2 ? '[Renderer WARN]' : '[Renderer]';
        console.log(`${tag} ${message} (${sourceId || ''}:${lineNumber || ''})`);
      }
      const trimmedMessage = message.trim();
      const undefinedRefPattern = /^[A-Za-z_$][\w$]* is not defined$/;
      const isAppSource = typeof sourceId === 'string' && (
        sourceId.includes('/dist/') ||
        sourceId.includes('/src/') ||
        sourceId.endsWith('main.html')
      );
      if (numericLevel >= 3 && undefinedRefPattern.test(trimmedMessage) && isAppSource) {
        console.error(`Renderer ReferenceError detected: ${trimmedMessage} (${sourceId || ''}:${lineNumber || ''})`);
      }
    }
  });
  win.webContents.on('crashed', () => {
    console.error('Renderer process crashed!');
  });

  mainWindow = win;
}

// Attempt to acquire single-instance lock with retry logic for dev mode.
// In development (yarn dev), Electron Forge's watch process can cause race conditions
// where the old process hasn't released its lock file before the new one starts.
// We retry a few times to handle this gracefully while maintaining lock enforcement.
const isDev = process.env.NODE_ENV === 'development';

function tryAcquireSingleInstanceLock() {
  const lockAcquired = app.requestSingleInstanceLock();

  if (lockAcquired) {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    });

    app.whenReady().then(createWindow);
    return true;
  }

  // Lock acquisition failed — another instance is running
  console.log('[EmuConfigurator] Another instance is already running. Exiting.');
  app.quit();
  return false;
}

const hasSingleInstanceLock = tryAcquireSingleInstanceLock();

// Best-effort cleanup of hardware connections before the process exits.
// The OS will reclaim handles anyway, but explicit cleanup avoids libusb/serialport
// "device still open" warnings and ensures the device is left in a clean state.
let _allowProcessQuit = false;

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function cleanupConnectionsBeforeQuit() {
  const usbCleanupPromises = [];

  for (const [, device] of _usbOpenDevices) {
    const cleanupOneDevice = withTimeout(new Promise((resolve) => {
      let completed = false;
      const finish = () => {
        if (!completed) {
          completed = true;
          resolve();
        }
      };

      const closeDevice = () => {
        try {
          device.close(() => finish());
        } catch {
          try {
            device.close();
          } catch {
            // ignore close errors
          }
          finish();
        }
      };

      try {
        // DFU_CLRSTATUS (USB class request): bmRequestType=0x21, bRequest=0x00,
        // wValue=0, wIndex=0, wLength=0 — clears DFU status bits and returns
        // the device to dfuIDLE so it can be safely closed.
        device.controlTransfer(0x21, 0x00, 0, 0, 0, () => {
          closeDevice();
        });
      } catch {
        closeDevice();
      }
    }), 2000, 'USB cleanup timeout').catch((error) => {
      console.error('USB cleanup error:', error.message);
    });

    usbCleanupPromises.push(cleanupOneDevice);
  }

  await Promise.allSettled(usbCleanupPromises);
  _usbOpenDevices.clear();

  if (_serialPort && _serialPort.isOpen) {
    try {
      const currentPort = _serialPort;
      await withTimeout(new Promise((resolve) => {
        const closePort = () => {
          try {
            currentPort.close(() => resolve());
          } catch {
            resolve();
          }
        };

        currentPort.write(Buffer.from('exit\r'), () => {
          setTimeout(closePort, 100);
        });
      }), 3000, 'Serial cleanup timeout');
    } catch (error) {
      console.error('Serial cleanup error:', error.message);
      try {
        _serialPort.close(() => {});
      } catch {
        // ignore forced close errors
      }
    } finally {
      _serialPort = null;
    }
  }
}

app.on('will-quit', (event) => {
  if (_allowProcessQuit) {
    return;
  }

  event.preventDefault();
  cleanupConnectionsBeforeQuit()
    .catch((error) => {
      console.error('Quit cleanup failed:', error.message);
    })
    .finally(() => {
      _allowProcessQuit = true;
      app.quit();
    });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && hasSingleInstanceLock) {
    createWindow();
  }
});
