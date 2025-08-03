const { app, BrowserWindow, session, Menu } = require("electron");
const { StaticNetFilteringEngine } = require("@gorhill/ubo-core");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

let snfe;
let mainWindow;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Cache settings
const CACHE_DIR = path.join(os.tmpdir(), 'ytmp-filters');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

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

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.log('Error creating cache directory:', error.message);
  }
}

function getCacheFilePath(filterName) {
  return path.join(CACHE_DIR, `${filterName}.txt`);
}

function getCacheMetaPath(filterName) {
  return path.join(CACHE_DIR, `${filterName}.meta.json`);
}

// Check if cache is still valid (less than 24 hours old)
async function isCacheValid(filterName) {
  try {
    const metaPath = getCacheMetaPath(filterName);
    const metaData = await fs.readFile(metaPath, 'utf8');
    const { timestamp } = JSON.parse(metaData);
    return (Date.now() - timestamp) < CACHE_DURATION;
  } catch (error) {
    return false;
  }
}

async function loadFromCache(filterName) {
  try {
    const cacheFilePath = getCacheFilePath(filterName);
    const content = await fs.readFile(cacheFilePath, 'utf8');
    return content;
  } catch (error) {
    return null;
  }
}

async function saveToCache(filterName, content) {
  try {
    const cacheFilePath = getCacheFilePath(filterName);
    const metaPath = getCacheMetaPath(filterName);
    
    await fs.writeFile(cacheFilePath, content, 'utf8');
    await fs.writeFile(metaPath, JSON.stringify({ 
      timestamp: Date.now(),
      filterName 
    }), 'utf8');
    
    console.log(`✓ ${filterName} cached`);
  } catch (error) {
    console.log(`✗ Error caching ${filterName}:`, error.message);
  }
}

async function downloadFilter(filterList) {
  try {
    console.log(`Downloading ${filterList.description}...`);
    const response = await fetch(filterList.url);
    if (response.ok) {
      const content = await response.text();
      await saveToCache(filterList.name, content);
      console.log(`✓ ${filterList.description} downloaded`);
      return content;
    } else {
      console.log(`✗ Failed to download ${filterList.description}: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`✗ Error downloading ${filterList.description}:`, error.message);
    return null;
  }
}

// Load from cache or download if expired/missing
async function loadFilter(filterList, forceUpdate = false) {
  if (!forceUpdate && await isCacheValid(filterList.name)) {
    console.log(`Loading ${filterList.description} from cache...`);
    const cachedContent = await loadFromCache(filterList.name);
    if (cachedContent) {
      console.log(`✓ ${filterList.description} loaded from cache`);
      return cachedContent;
    }
  }
  
  return await downloadFilter(filterList);
}

// Load all filters in parallel
async function loadAllFilters(forceUpdate = false) {
  await ensureCacheDir();
  
  console.log(forceUpdate ? "Force updating filters..." : "Loading filters...");
  
  const filterPromises = filterLists.map(filterList => 
    loadFilter(filterList, forceUpdate).then(content => 
      content ? { name: filterList.name, raw: content } : null
    )
  );
  
  const results = await Promise.all(filterPromises);
  const validFilters = results.filter(result => result !== null);
  
  if (validFilters.length > 0) {
    console.log(`Filter loading complete! ${validFilters.length}/${filterLists.length} lists loaded`);
  } else {
    console.log("Warning: No filter lists loaded");
  }
  
  return validFilters;
}

async function initializeFilterEngine(forceUpdate = false) {
  try {
    if (!snfe) {
      snfe = await StaticNetFilteringEngine.create();
    }
    
    const lists = await loadAllFilters(forceUpdate);
    
    if (lists.length > 0) {
      await snfe.useLists(lists);
      console.log(`Filter engine ready with ${lists.length} lists!`);
      
      if (mainWindow) {
        createMenu();
      }
    }
    
    return lists.length > 0;
  } catch (error) {
    console.log('Error initializing filter engine:', error.message);
    return false;
  }
}

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
  
  const loginItemSettings = app.getLoginItemSettings();
  console.log(`Startup status: ${loginItemSettings.openAtLogin ? 'Enabled' : 'Disabled'}`);
}

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
          label: 'Update Ad Filters',
          click: async () => {
            console.log('Manually updating filters...');
            const success = await initializeFilterEngine(true);
            console.log(success ? 'Filters updated!' : 'Filter update failed');
            
            // Restart to apply updated filters
            console.log('Restarting...');
            app.relaunch();
            app.exit();
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
  // Resource types to block
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

  // Create window immediately for fast startup
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: false,
    icon: process.platform === 'win32' 
      ? path.join(__dirname, 'assets', 'icon.ico')
      : path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
    },
  });

  createMenu();

  // Initialize filters in background
  initializeFilterEngine().then((success) => {
    console.log(success ? '✓ Ad blocking active' : '⚠ Ad blocking failed');
  });

  // Request blocker
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (!snfe) {
      return callback({});
    }
    
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

  // Pause audio/video on close
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
  
  // Hide cast buttons after page loads
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      .ytmusic-player-bar .middle-controls [aria-label*="cast" i],
      .ytmusic-player-bar .middle-controls [aria-label*="connect" i],
      ytmusic-menu-service-item-renderer[aria-label*="connect" i],
      ytmusic-menu-service-item-renderer[aria-label*="cast" i],
      tp-yt-google-cast,
      .ytp-button[aria-label*="cast" i],
      .ytp-button[data-tooltip-target-id*="cast"],
      [data-title*="Cast"],
      [data-title*="Connect"],
      button[aria-label*="Connect to a device"],
      button[aria-label*="Cast"],
      .ytmusic-nav-bar [role="button"][aria-label*="cast" i],
      .ytmusic-nav-bar [role="button"][aria-label*="connect" i],
      .ytmusic-menu-service-item-renderer:has([aria-label*="cast" i]),
      .ytmusic-menu-service-item-renderer:has([aria-label*="connect" i])
      {
        display: none !important;
        visibility: hidden !important;
      }
    `);
    console.log('✓ Cast buttons hidden');
  });
}

handleStartupSettings();

if (gotTheLock) {
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
}
