const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer process (about.html)
contextBridge.exposeInMainWorld('aboutAPI', {
    // Function to get all required information from the main process
    getAboutInfo: () => ipcRenderer.invoke('get-about-info'),
    // Function to request the main process to open an external link
    openExternal: (url) => ipcRenderer.send('open-external-link', url),
    // Function to send the requested size for auto-sizing
    resizeWindow: (width, height) => ipcRenderer.send('resize-about-window', width, height),
    // Function to close the current window
    closeWindow: () => ipcRenderer.send('close-current-window') // We won't use this, but it's a good practice
});