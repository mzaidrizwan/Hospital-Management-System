const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function setupPrintHandlers() {
  // Print bill handler - With system printer
  ipcMain.handle('print-bill', async (event, htmlContent) => {
    try {
      console.log('Print request received');
      
      const win = BrowserWindow.getFocusedWindow();
      if (!win) {
        return { success: false, error: 'No window found' };
      }
      
      // Create print window
      const printWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      
      return new Promise((resolve) => {
        printWindow.webContents.on('did-finish-load', () => {
          // Get available printers
          printWindow.webContents.getPrintersAsync().then(printers => {
            console.log('Available printers:', printers.map(p => p.name));
            
            // Use system print dialog
            printWindow.webContents.print({
              silent: false,  // false = show print dialog
              printBackground: true,
              deviceName: ''  // Empty = default printer
            }, (success, errorType) => {
              if (!success) {
                console.error('Print failed:', errorType);
                resolve({ success: false, error: errorType });
              } else {
                console.log('Print successful');
                resolve({ success: true });
              }
              setTimeout(() => {
                if (!printWindow.isDestroyed()) printWindow.close();
              }, 1000);
            });
          }).catch(err => {
            console.error('Failed to get printers:', err);
            resolve({ success: false, error: err.message });
          });
        });
      });
    } catch (error) {
      console.error('Print error:', error);
      return { success: false, error: error.message };
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: path.join(__dirname, 'public/icon-512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    show: false,
    backgroundColor: '#ffffff',
    title: 'Jinnah Dental Clinic'
  });

  // Allow all permissions
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true); // Allow all
  });

  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  
  let startUrl;
  if (isDev) {
    startUrl = 'http://localhost:5173';
  } else {
    startUrl = `file://${path.join(__dirname, 'dist/index.html')}`;
  }
  
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });
}

app.whenReady().then(() => {
  createWindow();
  setupPrintHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});