const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getFilters: () => ipcRenderer.invoke('get-filters'),
  saveFilters: (filters) => ipcRenderer.send('save-filters', filters),
  resetFilters: () => ipcRenderer.send('reset-filters'),
  closeWindow: () => ipcRenderer.send('close-window'),
  openExternal: (url) => ipcRenderer.send('open-external-link', url),
  getTranslations: () => ipcRenderer.invoke('get-translations', [
      'ad_filter_config_title',
      'enabled',
      'filter_name',
      'filter_url',
      'add_new_filter',
      'more_filters',
      'save',
      'cancel',
      'delete',
      'reset'
  ])
});