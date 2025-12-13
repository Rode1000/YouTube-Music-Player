const { app, BrowserWindow, Menu, Tray, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require('path');
const fs = require('fs').promises;
const { initializeFilterEngine: initFiltersExternal, setupWebRequestHandler: setupWRExternal, getUserFilters: getFiltersExternal, saveUserFilters: saveFiltersExternal, resetFilters: resetFiltersExternal } = require('./adblock/filters');
const { injectVideoAdSkipper } = require('./adblock/videoAdSkipper');


let mainWindow;
let tray;
let minimizeToTray = false;
let openLastSong = false;
let resumePlayback = false;
let lastUrl = "https://music.youtube.com";
let aboutWindow;

// Video ad skipping settings
let videoAdSkipperEnabled = true;
let VideoAdSkipSpeed = 2;
let VideoAdSkipInterval = 200;

// Auto continue still listening settings
let autoContinueListeningInterval = 500;

// Support for multiple languages
const i18n = {};

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

const { version: APP_VERSION } = require('./package.json');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

// Icon
const iconPath = process.platform === 'win32' 
  ? path.join(__dirname, 'assets', 'icon.ico')
  : path.join(__dirname, 'assets', 'icon.png');

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}



async function loadConfig() {
  try {
    const configData = await fs.readFile(CONFIG_FILE, 'utf8');
    const config = JSON.parse(configData);
    
    minimizeToTray = config.minimizeToTray || false;
    videoAdSkipperEnabled = config.videoAdSkipperEnabled !== false;
    VideoAdSkipSpeed = config.VideoAdSkipSpeed || 2;
    openLastSong = config.openLastSong !== undefined ? config.openLastSong : true;
    lastUrl = openLastSong ? (config.lastUrl || "https://music.youtube.com") : "https://music.youtube.com";
    resumePlayback = config.resumePlayback || false;
    
    console.log(`Config loaded - Minimize to tray: ${minimizeToTray}, Video ad skipper: ${videoAdSkipperEnabled}, Video ad skip speed: ${VideoAdSkipSpeed}, Last URL: ${lastUrl}, Open last song: ${openLastSong}, Resume playback: ${resumePlayback}`);
    return config;
  } catch (error) {
    console.log('Using default config settings');
    return {};
  }
}

async function saveConfig() {
  try {
    const config = {
      minimizeToTray: minimizeToTray,
      videoAdSkipperEnabled: videoAdSkipperEnabled,
      VideoAdSkipSpeed: VideoAdSkipSpeed,
      lastUrl: lastUrl,
      openLastSong: openLastSong,
      resumePlayback: resumePlayback
    };
    
    await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    
    console.log('Config saved');
  } catch (error) {
    console.log('Error saving config:', error.message);
  }
}

// Load a specific language file
async function loadLanguage(lang) {
  // Try to load the language file from the 'locales' directory
  const langPath = path.join(__dirname, 'locales', `${lang}.json`);
  try {
    const data = await fs.readFile(langPath, 'utf8');
    // Parse the JSON data and merge it with the existing i18n object
    Object.assign(i18n, JSON.parse(data));
    console.log(`Language loaded: ${lang}`);
  } catch (error) {
    console.error(`Error loading language file for ${lang}:`, error.message);
    // Fallback to English if the requested language is not available
    if (lang !== 'en') {
      console.log('Falling back to English...');
      await loadLanguage('en');
    }
  }
}

// Get the translated string for a given key
function t(key, ...args) {
  const text = i18n[key] || key;
  return text.replace(/{(\d+)}/g, (match, number) => {
    return typeof args[number] !== 'undefined' ? args[number] : match;
  });
}


function createSettingsWindow() {
  const settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    parent: mainWindow,
    modal: true,
    show: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'settings-filters/sf-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });
  
  // Set the menu to null for the settings window
  settingsWindow.setMenu(null);

  settingsWindow.loadFile(path.join(__dirname, 'settings-filters/settings-filters.html'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  return settingsWindow;
}

function createAboutWindow() {
  aboutWindow = new BrowserWindow({
    width: 450,
    height: 450,
    parent: mainWindow,
    modal: true,
    show: false,
    resizable: false,
    icon: iconPath,
    title: t('about_app'),
    webPreferences: {
      preload: path.join(__dirname, 'about/about-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Remove the menu bar for the about window
  aboutWindow.setMenu(null);

  // Load the new about.html file
  aboutWindow.loadFile(path.join(__dirname, 'about/about.html'));

  // Show the window once it is ready
  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

const { ipcMain } = require('electron');

ipcMain.handle('get-filters', async () => {
  return await getFiltersExternal();
});

ipcMain.handle('get-translations', (event, keys) => {
  const translations = {};
  keys.forEach(key => {
      translations[key] = t(key);
  });
  return translations;
});

ipcMain.on('save-filters', async (event, newFilters) => {
  await saveFiltersExternal(newFilters);
  await initFiltersExternal(true);
});

ipcMain.on('reset-filters', async (event) => {
  try {
      await resetFiltersExternal();
      console.log('User filters reset to default successfully.');
      await initFiltersExternal(true);
  } catch (error) {
      console.log('Error resetting user filters:', error.message);
  }
});

ipcMain.handle('get-about-info', () => {
  return {
    appName: t('app_name'),
    appVersion: APP_VERSION,
    appDescription: t('about_app_description'),
    githubUrl: 'https://github.com/nubsuki/YouTube-Music-Player',
    translations: {
        accept: t('accept'),
        version: t('version_label', APP_VERSION),
        github_link: t('github_link_text')
    }
  };
});

// Handle video ad skipper settings
ipcMain.handle('get-ad-skipper-settings', () => {
  return {
    enabled: videoAdSkipperEnabled,
    speed: VideoAdSkipSpeed
  };
});

ipcMain.on('save-ad-skipper-settings', async (event, settings) => {
  videoAdSkipperEnabled = settings.enabled;
  VideoAdSkipSpeed = settings.speed;
  await saveConfig();
  console.log(`Video ad skipper settings updated: Enabled=${videoAdSkipperEnabled}, Speed=${VideoAdSkipSpeed}x`);
});

ipcMain.on('open-external-link', (event, url) => {
  shell.openExternal(url)
    .catch(error => console.error('Error opening external link:', error));
});

ipcMain.on('resize-about-window', (event, width, height) => {
  if (aboutWindow) {
    // Set the size and adjust content bounds (important for different OS)
    aboutWindow.setSize(width, height, true);

    // Center the window after resizing
    aboutWindow.center();
  }
});



function createTray() {
  if (tray) return;
    
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: t('show'),
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: t('quit'),
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip(t('app_name'));
  
  // Double-click to show/hide
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  console.log('System tray created');
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
    console.log('System tray removed');
  }
}

function toggleTrayBehavior(enabled) {
  minimizeToTray = enabled;
  
  if (enabled) {
    createTray();
  } else {
    destroyTray();
  }
  
  saveConfig();
  createMenu();
  console.log(`Minimize to tray: ${enabled ? 'Enabled' : 'Disabled'}`);
}

function toggleReOpenBehavior(enabled) {
  openLastSong = enabled;
  saveConfig();
  createMenu();
  console.log(`Open last song: ${enabled ? 'Enabled' : 'Disabled'}`);
}

function toggleResumeBehavior(enabled) {
  resumePlayback = enabled;
  saveConfig();
  createMenu();
  console.log(`Resume playback: ${enabled ? 'Enabled' : 'Disabled'}`);
}

// Load all filters in parallel

function handleStartupSettings() {
  const args = process.argv.slice(1);
  
  if (args.includes('--enable-startup')) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    });
    console.log('Startup enabled');
  }
  
  if (args.includes('--disable-startup')) {
    app.setLoginItemSettings({
      openAtLogin: false
    });
    console.log('Startup disabled');
  }
  
  const loginItemSettings = app.getLoginItemSettings();
  console.log(`Startup status: ${loginItemSettings.openAtLogin ? 'Enabled' : 'Disabled'}`);
}

function createMenu() {
  const loginItemSettings = app.getLoginItemSettings();
  
  const template = [
    {
      label: t('settings'),
      submenu: [
        {
          label: t('start_with_windows'),
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
          label: t('minimize_to_tray'),
          type: 'checkbox',
          checked: minimizeToTray,
          click: (menuItem) => {
            toggleTrayBehavior(menuItem.checked);
          }
        },
        // Show tray option only when enabled
        ...(minimizeToTray ? [{
          label: t('hide_to_tray'),
          accelerator: 'Ctrl+H',
          click: () => {
            mainWindow.hide();
          }
        }] : []),
        { type: 'separator' },
        {
          label: t('reopen_last_song'),
          type: 'checkbox',
          checked: openLastSong,
          click: (menuItem) => {
            toggleReOpenBehavior(menuItem.checked);
          }
        },
        ...(openLastSong ? [{
          label: t('resume_playback'),
          type: 'checkbox',
          checked: resumePlayback,
          click: (menuItem) => {
            toggleResumeBehavior(menuItem.checked);
          }
        }] : []),
        { type: 'separator' },
        {
          label: t('ad_filter_settings'),
          click: () => {
            createSettingsWindow();
          }
        },
        {
          label: t('update_ad_filters'),
          click: async () => {
            console.log('Manually updating filters...');
            const success = await initFiltersExternal(true);
            console.log(success ? 'Filters updated!' : 'Filter update failed');
            
            console.log('Restarting...');
            app.relaunch();
            app.quit();
          }
        },
        { type: 'separator' },
        {
          label: t('quit'),
          accelerator: 'Ctrl+Q',
          click: () => {
            app.isQuiting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: t('help'),
      submenu: [
        {
          label: t('check_for_updates'),
          click: async () => {
            try {
              // Check for updates 
              const result = await autoUpdater.checkForUpdates();
              
              if (result && result.updateInfo && result.updateInfo.version !== APP_VERSION) {
                // Update available
                const updateResult = await dialog.showMessageBox(mainWindow, {
                  type: 'question',
                  title: t('update_available'),
                  message: t('a_new_version_q', result.updateInfo.version),
                  buttons: [t('download_now'), t('not_now')],
                  defaultId: 0,
                  cancelId: 1
                });

                if (updateResult.response === 0) {
                  // show progress dialog
                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: t('downloading_update'),
                    message: t('downloading_in_background'),
                    buttons: [t('ok')]
                  });
                  
                  // Start download
                  autoUpdater.downloadUpdate();
                }
              } else {
                // No updates available
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: t('no_updates_available'),
                  message: t('no_updates_available_message'),
                  buttons: [t('ok')]
                });
              }
            } catch (error) {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: t('update_error'),
                message: t('error_d', error.message),
                buttons: [t('ok')]
              });
            }
          }
        },
        {
          label: t('about'),
          click: () => {
            createAboutWindow();
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}


async function createWindow() {
  await loadConfig();

  // Get system locale and load language
  const userLocale = app.getLocale().split('-')[0];
  await loadLanguage(userLocale);

  if (minimizeToTray) {
    createTray();
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  // Enable F12 and Ctrl+Shift+i for DevTools - for Advanced Users
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || 
        (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  createMenu();

  // Load filters in background
  initFiltersExternal().then((success) => {
    console.log(success ? 'Ad blocking active' : 'Ad blocking failed');
    if (success) {
      setupWRExternal();
    }
  });

  // Handle close button based on tray setting
  mainWindow.on('close', async (event) => {
    if (!app.isQuiting && minimizeToTray) {
      // Hide to tray, keep music playing
      event.preventDefault();
      mainWindow.hide();
      console.log('App minimized to tray');
      
      if (tray && !mainWindow.trayNotificationShown) {
        tray.displayBalloon({
          iconType: 'info',
          title: 'YouTube Music',
          content: t('notify_tray')
        });
        mainWindow.trayNotificationShown = true;
      }
    } else {
      // Pause music and close
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
        let currentUrl = mainWindow.webContents.getURL();
        
        // Only save URL/time parameter if 'openLastSong' is enabled
        if (openLastSong) {
          // Only add time parameter if 'resumePlayback' is enabled AND it's a watch page
          if (resumePlayback && currentUrl.includes('music.youtube.com/watch')) {
            
            // Execute script to get current time in seconds
            const currentTimeValue = await mainWindow.webContents.executeJavaScript(`
                // Get the 'value' attribute of the progress bar slider, which is the time in seconds
                document.querySelector('#progress-bar > #sliderContainer > div > #sliderBar')?.getAttribute('value');
            `);

            // Convert the value to an integer
            const timeInSeconds = parseInt(currentTimeValue, 10);

            // Check if the time is a valid positive number
            if (!isNaN(timeInSeconds) && timeInSeconds > 0) {
              // Use URL object for clean parameter management
              try {
                const urlObject = new URL(currentUrl);
                urlObject.searchParams.set('t', timeInSeconds);
                currentUrl = urlObject.toString();
              } catch (e) {
                console.log('Error modifying URL with time parameter:', e.message);
              }
            }
          }
        } else {
          // If openLastSong is disabled, force default URL for next launch
          currentUrl = "https://music.youtube.com";
        }

        lastUrl = currentUrl;
        await saveConfig();
        console.log(`URL saved: ${lastUrl}`);
        mainWindow.destroy();
        app.quit();
      } catch (error) {
        console.log('Error pausing audio:', error);
        mainWindow.destroy();
        app.quit();
      }
    }
  });

  const youtubeMusicDomain = 'music.youtube.com';

  let finalUrlToLoad = `https://${youtubeMusicDomain}`;
  
  try {
    const parsedUrl = new URL(lastUrl);
    if (parsedUrl.hostname === youtubeMusicDomain) {
      if (openLastSong && !resumePlayback) {
        parsedUrl.searchParams.delete('t');
      } else if (!openLastSong) {
        parsedUrl.pathname = '/';
        parsedUrl.search = '';
      }
      finalUrlToLoad = parsedUrl.toString();
    } else {
      console.warn(`Attempted to load an invalid URL: ${lastUrl}. Defaulting to ${finalUrlToLoad}`);
    }
  } catch (e) {
    console.error(`Error parsing lastUrl "${lastUrl}":`, e.message);
  }

  mainWindow.loadURL(finalUrlToLoad);
  console.log(`Loading URL: ${finalUrlToLoad}`);
  
  // Hide cast buttons
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
    console.log('Cast buttons hidden');

injectVideoAdSkipper(mainWindow.webContents, { enabled: videoAdSkipperEnabled, speed: VideoAdSkipSpeed, interval: VideoAdSkipInterval });

    // Inject JavaScript to auto-continue listening
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const checkInterval = ${autoContinueListeningInterval};
        let lastDismissTime = 0;

        function dismissDialog() {
          try {
            // Prevent rapid re-clicking
            const now = Date.now();
            if (now - lastDismissTime < 2000) return false;
        
            // Multiple dialog selectors
            const dialogSelectors = [
              'tp-yt-paper-dialog.style-scope',
              'ytmusic-you-there-renderer',
              'tp-yt-paper-dialog[role="dialog"]'
            ];
        
            let dialog = null;
            for (const selector of dialogSelectors) {
              const element = document.querySelector(selector);
              if (element && window.getComputedStyle(element).display !== 'none' && element.offsetParent !== null) {
                dialog = element;
                break;
              }
            }
            
            if (!dialog) return false;
        
            // Check dialog content
            const dialogText = dialog.textContent?.toLowerCase() || '';
            const isKeepListeningDialog = dialogText.includes('still listening') || 
                                           dialogText.includes('still there') || 
                                           dialogText.includes('you there');

            if (!isKeepListeningDialog) return false;

            // Multiple button selectors
            const buttonSelectors = [
              'yt-button-renderer.ytmusic-you-there-renderer',
              'tp-yt-paper-button#button',
              '[aria-label*="Yes" i]',
              '[aria-label*="Continue" i]',
              'button'
            ];

            for (const selector of buttonSelectors) {
              const confirmButton = dialog.querySelector(selector);
              if (confirmButton && confirmButton.offsetParent !== null && !confirmButton.disabled) {
                confirmButton.click();
                lastDismissTime = now;
                console.log('Auto-dismissed "Keep listening?" dialog');
                return true;
              }
            }
          } catch (e) {
            console.error('Error in dismissDialog:', e);
          }
          return false;
        }

        // Check periodically
        setInterval(dismissDialog, checkInterval);

        // Watch for dialog appearing
        const observer = new MutationObserver(dismissDialog);
        observer.observe(document.body, { childList: true, subtree: true });

        console.log('Auto-continue listening feature initialized');
      })();
    `);
    
  });
}

handleStartupSettings();


// Updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
});

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater:', err);
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: t('update_error'),
      message: `Error: ${err.message}`,
      buttons: [t('ok')]
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: t('update_ready'),
      message: t('update_ready_message'),
      buttons: [t('restart_now'), t('later')]
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
});

if (gotTheLock) {
  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    if (!minimizeToTray) {
      if (process.platform !== "darwin") {
        app.quit();
      }
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
