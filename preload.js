const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getFilters: () => ipcRenderer.invoke('get-filters'),
  saveFilters: (filters) => ipcRenderer.send('save-filters', filters),
  resetFilters: () => ipcRenderer.send('reset-filters'),
  closeWindow: () => ipcRenderer.send('close-window'),
  getTranslations: () => ipcRenderer.invoke('get-translations', [
      'ad_filter_config_title',
      'enabled',
      'filter_name',
      'filter_url',
      'add_new_filter',
      'save',
      'cancel',
      'delete',
      'reset'
  ])
});