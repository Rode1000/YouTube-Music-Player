const { app, BrowserWindow, session } = require('electron');
const { StaticNetFilteringEngine } = require('@gorhill/ubo-core');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

let snfe;
let mainWindow;

async function createWindow() {
  // Setup uBO-core
  snfe = await StaticNetFilteringEngine.create();

  console.log('Loading filter lists...');
  
  // Define filter lists to load
  const filterLists = [
    {
      name: 'easylist',
      url: 'https://easylist.to/easylist/easylist.txt',
      description: 'EasyList (Ad blocking)'
    },
    {
      name: 'easyprivacy',
      url: 'https://easylist.to/easylist/easyprivacy.txt',
      description: 'EasyPrivacy (Privacy protection)'
    },
    {
      name: 'ublock-filters',
      url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
      description: 'uBlock filters (Enhanced ad blocking)'
    },
    {
      name: 'ublock-privacy',
      url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt',
      description: 'uBlock Privacy filters'
    },
    {
      name: 'ublock-badware',
      url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt',
      description: 'uBlock Badware protection'
    }
  ];

  // Load all filter lists
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
        console.log(`✗ Failed to load ${filterList.description}: ${response.status}`);
      }
    } catch (error) {
      console.log(`✗ Error loading ${filterList.description}:`, error.message);
    }
  }

  // Apply all loaded filter lists
  if (lists.length > 0) {
    await snfe.useLists(lists);
    console.log(`Filter engine ready with ${lists.length} filter lists loaded!`);
  } else {
    console.log('Warning: No filter lists were loaded successfully');
  }

  // Create browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false, // safer
    },
  });

  // Intercept & block requests
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const shouldBlock = snfe.matchRequest({
      originURL: details.referrer || details.url,
      url: details.url,
      type: 'script',
    });

    if (shouldBlock !== 0) {
      console.log('Blocked:', details.url);
      return callback({ cancel: true });
    }
    callback({});
  });

  // Handle window close event
  mainWindow.on('close', async (event) => {
    try {
      // Pause the audio before closing
      await mainWindow.webContents.executeJavaScript(`
        try {
          // Try to find and pause the audio player
          const audio = document.querySelector('audio');
          const video = document.querySelector('video');
          const playButton = document.querySelector('[data-testid="play-pause-button"], .play-pause-button, [aria-label*="pause" i], [title*="pause" i]');
          
          if (audio && !audio.paused) {
            audio.pause();
          }
          if (video && !video.paused) {
            video.pause();
          }
          if (playButton && playButton.getAttribute('aria-label') && playButton.getAttribute('aria-label').toLowerCase().includes('pause')) {
            playButton.click();
          }
        } catch (e) {
          console.log('Could not pause audio:', e);
        }
      `);
    } catch (error) {
      console.log('Error pausing audio:', error);
    }
  });

  // Load YouTube Music
  mainWindow.loadURL('https://music.youtube.com');
}

// Handle app events
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle before-quit to ensure clean exit
app.on('before-quit', async (event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      await mainWindow.webContents.executeJavaScript(`
        try {
          const audio = document.querySelector('audio');
          const video = document.querySelector('video');
          if (audio) audio.pause();
          if (video) video.pause();
        } catch (e) {
          console.log('Could not pause media:', e);
        }
      `);
    } catch (error) {
      console.log('Error in before-quit:', error);
    }
  }
});
