const { app, BrowserWindow, session, Menu } = require("electron");
const { StaticNetFilteringEngine } = require("@gorhill/ubo-core");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

let snfe;
let mainWindow;

// Handle startup settings
function handleStartupSettings() {
  const args = process.argv.slice(1);
  
  if (args.includes('--enable-startup')) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    });
    console.log('✓ Startup enabled');
  }
  
  if (args.includes('--disable-startup')) {
    app.setLoginItemSettings({
      openAtLogin: false
    });
    console.log('✓ Startup disabled');
  }
  
  // Check current startup status
  const loginItemSettings = app.getLoginItemSettings();
  console.log(`Startup status: ${loginItemSettings.openAtLogin ? 'Enabled' : 'Disabled'}`);
}

// Create application menu with startup toggle
function createMenu() {
  const loginItemSettings = app.getLoginItemSettings();
  
  const template = [
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Start with Windows',
          type: 'checkbox',
          checked: loginItemSettings.openAtLogin,
          click: (menuItem) => {
            app.setLoginItemSettings({
              openAtLogin: menuItem.checked,
              path: app.getPath('exe')
            });
            console.log(`Startup ${menuItem.checked ? 'enabled' : 'disabled'}`);
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  const blockableResourceTypes = {
    script: true,
    stylesheet: false,
    image: true,
    font: false,
    xhr: true,
    fetch: true,
    websocket: false,
    media: false,
    object: true,
    ping: true,
    csp_report: true,
    preflight: false,
    navigation: false,
    sub_frame: true,
  };

  snfe = await StaticNetFilteringEngine.create();
  console.log("Loading filter lists...");

  const filterLists = [
    {
      name: "easylist",
      url: "https://easylist.to/easylist/easylist.txt",
      description: "EasyList (Ad blocking)",
    },
    {
      name: "easyprivacy",
      url: "https://easylist.to/easylist/easyprivacy.txt",
      description: "EasyPrivacy (Privacy protection)",
    },
    {
      name: "ublock-filters",
      url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
      description: "uBlock filters (Enhanced ad blocking)",
    },
    {
      name: "ublock-privacy",
      url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt",
      description: "uBlock Privacy filters",
    },
    {
      name: "ublock-badware",
      url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt",
      description: "uBlock Badware protection",
    },
  ];

  const lists = [];
  for (const filterList of filterLists) {
    try {
      console.log(`Loading ${filterList.description}...`);
      const response = await fetch(filterList.url);
      if (response.ok) {
        const content = await response.text();
        lists.push({ name: filterList.name, raw: content });
        console.log(`✓ ${filterList.description} loaded successfully`);
      } else {
        console.log(
          `✗ Failed to load ${filterList.description}: ${response.status}`
        );
      }
    } catch (error) {
      console.log(`✗ Error loading ${filterList.description}:`, error.message);
    }
  }

  if (lists.length > 0) {
    await snfe.useLists(lists);
    console.log(
      `Filter engine ready with ${lists.length} filter lists loaded!`
    );
  } else {
    console.log("Warning: No filter lists were loaded successfully");
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  // Create menu after window is created
  createMenu();

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const resourceType = details.resourceType;
    const shouldCheckFilters = blockableResourceTypes[resourceType];

    if (!shouldCheckFilters) {
      return callback({});
    }

    const resourceTypeMapping = {
      script: "script",
      stylesheet: "stylesheet",
      image: "image",
      font: "font",
      xhr: "xmlhttprequest",
      fetch: "fetch",
      websocket: "websocket",
      media: "media",
      object: "object",
      ping: "ping",
      csp_report: "csp_report",
      sub_frame: "sub_frame",
    };

    const uBlockType = resourceTypeMapping[resourceType] || "other";

    const shouldBlock = snfe.matchRequest({
      originURL: details.referrer || details.url,
      url: details.url,
      type: uBlockType,
    });

    if (shouldBlock !== 0) {
      console.log(`Blocked [${resourceType}]:`, details.url);
      return callback({ cancel: true });
    }

    callback({});
  });

  mainWindow.on('close', async (event) => {
    event.preventDefault();
    
    try {
      await mainWindow.webContents.executeJavaScript(`
        try {
          const audio = document.querySelector('audio');
          const video = document.querySelector('video');
          const playButton = document.querySelector('[data-testid="play-pause-button"], .play-pause-button, [aria-label*="pause" i], [title*="pause" i]');
          
          if (audio && !audio.paused) audio.pause();
          if (video && !video.paused) video.pause();
          if (playButton && playButton.getAttribute('aria-label') && playButton.getAttribute('aria-label').toLowerCase().includes('pause')) {
            playButton.click();
          }
        } catch (e) {
          console.log('Could not pause audio:', e);
        }
      `);
      
      mainWindow.destroy();
    } catch (error) {
      console.log('Error pausing audio:', error);
      mainWindow.destroy();
    }
  });

  mainWindow.loadURL("https://music.youtube.com");
}

// Handle startup settings on app start
handleStartupSettings();

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
