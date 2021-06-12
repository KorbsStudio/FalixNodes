const glasstron = require('glasstron');
const electron = require('electron');
const {app, BrowserWindow, Menu, protocol, ipcMain, ipcRenderer, globalShortcut, Notification} = require('electron');
const isMac = process.platform === 'darwin' // Not required
const path = require('path');
const url = require('url');
const { remote } = require('electron');
const pty = require("node-pty");
const osUI = require('os-utils');
const os = require("os");
const Pushy = require('pushy-electron');
var shell = os.platform() === "win32" ? "powershell.exe" : "bash"; // Use Powershell instead of Command Prompt
var macshell = os.platform() === "win32" ? "powershell.exe" : "zsh";
electron.app.commandLine.appendSwitch("enable-transparent-visuals"); // For Linux, not required for Windows or macOS. If removed, please remove "--enable-transparent-visuals" from start command in package.json file.

var osvar = process.platform; /* Detecting OS */
if (osvar == 'darwin') {app.whenReady().then(() => {createWindowMac()})
}else if(osvar == 'win32'){app.whenReady().then(() => {createWindowWin()})
}else{app.whenReady().then(() => {setTimeout(() => {createWindowLinux()}, 400)})}
 // Delay for Linux, Electron has a bug where the background stays black instead of transparent on Linux.
 // Issue here: https://github.com/electron/electron/issues/28834
 // Old issue here: https://github.com/electron/electron/issues/15947

function createWindowWin () { /* Windows */
  const mainWindow = new glasstron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 520,
    frame: false,
    show: false,
    transparent: true,
    closable: true,
    maximizable: true,
    minimizable: true,
    nativeWindowOpen: true,
		blur: true,
		blurType: "acrylic", // Usually Acrylic, but mouse lag issue as of now, use Blur Behind for now
    webPreferences: {
      preload: path.join(__dirname, "../../js/electron/preload.js"),
			nodeIntegration: true,
			webviewTag: true,
			devTools: true,
      enableRemoteModule: true,
      contextIsolation: false
    }
  })
  const loadWindow = new BrowserWindow({
    frame: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    transparent: true,
    skipTaskbar: true, // Don't show splash on taskbar
    center: true,
    width: 382,
    height: 382,
    minWidth: 382,
    minHeight: 382,
    resizable: false,
    webPreferences: {
      devTools: false
    }
  })
  mainWindow.setIcon(path.join(__dirname, '../../images/icons/app/256x256.ico'));
  mainWindow.webContents.on('did-finish-load', function() {
    mainWindow.webContents.insertCSS('#titlebar{display: none !important;} button#linux-miner-cpu, button#linux-miner-gpu, button#mac-miner-cpu {display: none !important;} div#linux-miner {display: none !important}') /* Remove Windows Titlebar if OS is Linux */
 })
  loadWindow.loadFile('src/html/splash/index.html');
  mainWindow.loadFile('src/index.html');
  setTimeout(() => { // Show splash for 5 seconds (fixed time) then the main window
    mainWindow.show();
   }, 5000); 
   setTimeout(() => {
    loadWindow.close();
   }, 4000);
  var ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env
  });
  ptyProcess.on('data', function(data) {  
      mainWindow.webContents.send("terminal.incomingData", data);
      console.log("");
  });
  ipcMain.on("terminal.keystroke", (event, key) => {
      ptyProcess.write(key);
  });
  mainWindow.webContents.on('new-window', function(e, url) {
   e.preventDefault();
   require('electron').shell.openExternal(url);
  });
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    downloadStartedNotify()

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        console.log('Download is interrupted but can be resumed')
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          console.log('Download is paused')
        } else {
          console.log(`Received bytes: ${item.getReceivedBytes()}`);
        }
      }
    })
    item.once('done', (event, state) => {
      if (state === 'completed') {
        downloadSuccessNotify();
      } else {
        console.log(`Download failed: ${state}`);
        downloadFailedNotify();
      }
    })
})
mainWindow.webContents.on('did-finish-load', () => {
  Pushy.listen();
});

Pushy.register({ appId: '60c3b90e8abb33b02f642ccf' }).then((deviceToken) => {
}).catch((err) => {
});

Pushy.setNotificationListener((data) => {
    notification = new Notification ({
          title: `${data.title}`,
          body: `${data.message}`
    });
    notification.show();
    notification.on('click', (event, arg)=>{
      console.log("clicked");
      const notiWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true,
          enableRemoteModule: true,
          contextIsolation: false
        }
      })
      notiWindow.loadURL(`${data.url}`)
    })
    
});
if (Pushy.isRegistered()) {
  Pushy.subscribe('push').then(() => {
  }).catch((err) => {
      console.error(err);
  });
}
}

function createWindowMac () { /* Linux */
  const mainWindow = new BrowserWindow({
    backgroundColor: '#162230',
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 520,
    frame: false,
    show: false,
    transparent: false,
    closable: true,
    maximizable: true,
    minimizable: true,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset', // Set the titlebar controls(known as Traffic light buttons on macOS) into app
    webPreferences: {
      nativeWindowOpen: true,
      preload: path.join(__dirname, "preload.js"),
			nodeIntegration: true,
			webviewTag: true,
      devTools: false,
      enableRemoteModule: true,
      contextIsolation: false
    }
  })
  const loadWindow = new BrowserWindow({
    frame: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    transparent: true,
    center: true,
    width: 382,
    height: 382,
    minWidth: 382,
    minHeight: 382,
    resizable: false,
    webPreferences: {
      devTools: false
    }
  })
  loadWindow.loadFile('src/html/splash/index.html');
  mainWindow.loadFile('src/index.html');
  mainWindow.setIcon(path.join(__dirname, '../../images/icons/app/256x256.png'));
  mainWindow.webContents.on('did-finish-load', function() {
    mainWindow.webContents.insertCSS('#titlebar{display: none !important;} button#windows-miner-cpu, button#windows-miner-gpu, button#linux-miner-cpu, button#linux-miner-gpu {display: none !important;} span#beta::after {top: 10px !important;} div#windows-miner {display: none !important}') /* Remove Windows Titlebar if OS is Linux */
 })
 setTimeout(() => {
  mainWindow.show();
 }, 5000);
 setTimeout(() => {
  loadWindow.close();
 }, 4900);
var ptyProcess = pty.spawn(macshell, [], {
	name: "xterm-color",
     cols: 80,
     rows: 30,
     cwd: process.env.HOME,
     env: process.env
 });
 ptyProcess.on('data', function(data) {
     mainWindow.webContents.send("terminal.incomingData", data);
     console.log("");
 });
 ipcMain.on("terminal.keystroke", (event, key) => {
     ptyProcess.write(key);
 });
 mainWindow.webContents.on('new-window', function(e, url) {
	e.preventDefault();
	require('electron').shell.openExternal(url);
 });
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    downloadStartedNotify()

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        console.log('Download is interrupted but can be resumed')
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          console.log('Download is paused')
        } else {
          console.log(`Received bytes: ${item.getReceivedBytes()}`);
        }
      }
    })
    item.once('done', (event, state) => {
      if (state === 'completed') {
        downloadSuccessNotify();
      } else {
        console.log(`Download failed: ${state}`);
        downloadFailedNotify();
      }
    })
})
mainWindow.webContents.on('did-finish-load', () => {
  Pushy.listen();
});

Pushy.register({ appId: '60c3b90e8abb33b02f642ccf' }).then((deviceToken) => {
}).catch((err) => {
});

Pushy.setNotificationListener((data) => {
    notification = new Notification ({
          title: `${data.title}`,
          body: `${data.message}`
    });
    notification.show();
    notification.on('click', (event, arg)=>{
      console.log("clicked");
      const notiWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true,
          enableRemoteModule: true,
          contextIsolation: false
        }
      })
      notiWindow.loadURL(`${data.url}`)
    })
    
});
if (Pushy.isRegistered()) {
  Pushy.subscribe('push').then(() => {
  }).catch((err) => {
      console.error(err);
  });
}
}
function createWindowLinux () { /* Linux */
  const mainWindow = new BrowserWindow({
    backgroundColor: '#162230',
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 520,
    frame: true,
    show: false,
    transparent: false,
    closable: true,
    maximizable: true,
    minimizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      nativeWindowOpen: true,
      preload: path.join(__dirname, "preload.js"),
			nodeIntegration: true,
			webviewTag: true,
      devTools: true,
      enableRemoteModule: true,
      contextIsolation: false
    }
  })
  const loadWindow = new BrowserWindow({
    frame: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    transparent: true,
    center: true,
    width: 382,
    height: 382,
    minWidth: 382,
    minHeight: 382,
    resizable: false,
    webPreferences: {
      devTools: false
    }
  })
  loadWindow.loadFile('src/html/splash/index.html');
  mainWindow.loadFile('src/index.html');
  mainWindow.setIcon(path.join(__dirname, '../../images/icons/app/256x256.png'));
  mainWindow.webContents.on('did-finish-load', function() {
    mainWindow.webContents.insertCSS('#titlebar{display: none !important;} button#windows-miner-cpu, button#windows-miner-gpu, button#mac-miner-cpu {display: none !important;} span#beta::after {top: 10px !important;} div#windows-miner {display: none !important}') /* Remove Windows Titlebar if OS is Linux */
 })
 setTimeout(() => {
  mainWindow.show();
 }, 5000);
 setTimeout(() => {
  loadWindow.close();
 }, 4900);
 var ptyProcess = pty.spawn(shell, [], {
     name: "xterm-color",
     cols: 80,
     rows: 30,
     cwd: process.env.HOME,
     env: process.env
 });
 ptyProcess.on('data', function(data) {
     mainWindow.webContents.send("terminal.incomingData", data);
     console.log("");
 });
 ipcMain.on("terminal.keystroke", (event, key) => {
     ptyProcess.write(key);
 });
 mainWindow.webContents.on('new-window', function(e, url) {
	e.preventDefault();
	require('electron').shell.openExternal(url);
 });
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    downloadStartedNotify()

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        console.log('Download is interrupted but can be resumed')
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          console.log('Download is paused')
        } else {
          console.log(`Received bytes: ${item.getReceivedBytes()}`);
        }
      }
    })
    item.once('done', (event, state) => {
      if (state === 'completed') {
        downloadSuccessNotify();
      } else {
        console.log(`Download failed: ${state}`);
        downloadFailedNotify();
      }
    })
})
mainWindow.webContents.on('did-finish-load', () => {
  Pushy.listen();
});

Pushy.register({ appId: '60c3b90e8abb33b02f642ccf' }).then((deviceToken) => {
}).catch((err) => {
});

Pushy.setNotificationListener((data) => {
    notification = new Notification ({
          title: `${data.title}`,
          body: `${data.message}`
    });
    notification.show();
    notification.on('click', (event, arg)=>{
      console.log("clicked");
      const notiWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true,
          enableRemoteModule: true,
          contextIsolation: false
        }
      })
      notiWindow.loadURL(`${data.url}`)
    })
    
});
if (Pushy.isRegistered()) {
  Pushy.subscribe('push').then(() => {
  }).catch((err) => {
      console.error(err);
  });
}
}
app.on("ready", () => {
  globalShortcut.register("CommandOrControl+W", () => { // Disable Ctrl W hotkey
  });
});
