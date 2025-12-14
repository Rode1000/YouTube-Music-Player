const { app, session } = require('electron');
const { StaticNetFilteringEngine } = require('@gorhill/ubo-core');
const path = require('path');
const fs = require('fs').promises;

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

let snfe;

const CACHE_DIR = path.join(app.getPath('userData'), 'ytmp-filters');
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const USER_FILTERS_FILE = path.join(app.getPath('userData'), 'user-filters.json');

const defaultFilterLists = [
  { name: 'easylist', url: 'https://easylist.to/easylist/easylist.txt', description: 'EasyList (Ad blocking)', enabled: false },
  { name: 'easyprivacy', url: 'https://easylist.to/easylist/easyprivacy.txt', description: 'EasyPrivacy (Privacy protection)', enabled: false },
  { name: 'ublock-filters', url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt', description: 'uBlock filters (Enhanced ad blocking)', enabled: false },
  { name: 'ublock-privacy', url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt', description: 'uBlock Privacy filters', enabled: false },
  { name: 'ublock-badware', url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt', description: 'uBlock Badware protection', enabled: false },
  { name: 'ublock-unbreak', url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/refs/heads/master/filters/unbreak.txt', description: 'unbreak sites broken as a result of 3rd-party filter lists.', enabled: false },
  { name: 'ublock-Lite-filters', url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/refs/heads/master/filters/ubol-filters.txt', description: 'Filters optimized for uBO Lite', enabled: false }
];

async function ensureCacheDir() {
  try { await fs.mkdir(CACHE_DIR, { recursive: true }); } catch {}
}
function getCacheFilePath(filterName) { return path.join(CACHE_DIR, `${filterName}.txt`); }
function getCacheMetaPath(filterName) { return path.join(CACHE_DIR, `${filterName}.meta.json`); }
async function isCacheValid(filterName) {
  try {
    const metaData = await fs.readFile(getCacheMetaPath(filterName), 'utf8');
    const { timestamp } = JSON.parse(metaData);
    return (Date.now() - timestamp) < CACHE_DURATION;
  } catch { return false; }
}
async function loadFromCache(filterName) {
  try { return await fs.readFile(getCacheFilePath(filterName), 'utf8'); } catch { return null; }
}
async function saveToCache(filterName, content) {
  try {
    await ensureCacheDir();
    await fs.writeFile(getCacheFilePath(filterName), content, 'utf8');
    await fs.writeFile(getCacheMetaPath(filterName), JSON.stringify({ timestamp: Date.now(), filterName }), 'utf8');
  } catch {}
}

async function loadUserFilters() {
  try {
    const data = await fs.readFile(USER_FILTERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(USER_FILTERS_FILE, JSON.stringify(defaultFilterLists, null, 2), 'utf8');
      return defaultFilterLists;
    }
    return defaultFilterLists;
  }
}

async function saveUserFilters(filters) {
  await fs.writeFile(USER_FILTERS_FILE, JSON.stringify(filters, null, 2), 'utf8');
}

async function resetFilters() {
  await fs.writeFile(USER_FILTERS_FILE, JSON.stringify(defaultFilterLists, null, 2), 'utf8');
}

async function downloadFilter(filterList) {
  try {
    const response = await fetch(filterList.url);
    if (response.ok) {
      const content = await response.text();
      await saveToCache(filterList.name, content);
      return content;
    }
    return null;
  } catch { return null; }
}

async function loadFilter(filterList, forceUpdate = false) {
  if (!forceUpdate && await isCacheValid(filterList.name)) {
    const cachedContent = await loadFromCache(filterList.name);
    if (cachedContent) return cachedContent;
  }
  return await downloadFilter(filterList);
}

async function initializeFilterEngine(forceUpdate = false) {
  try {
    if (!snfe) snfe = await StaticNetFilteringEngine.create();
    const allFilterLists = await loadUserFilters();
    const enabledFilterLists = allFilterLists.filter(f => f.enabled);
    const filterPromises = enabledFilterLists.map(f =>
      loadFilter(f, forceUpdate).then(content => content ? { name: f.name, raw: content } : null)
    );
    const results = await Promise.all(filterPromises);
    const validFilters = results.filter(x => x !== null);
    if (validFilters.length > 0) await snfe.useLists(validFilters);
    return validFilters.length > 0;
  } catch { return false; }
}

function setupWebRequestHandler() {
  if (!snfe) return;
  const blockableResourceTypes = {
    script: true, stylesheet: false, image: true, font: false, xhr: true, fetch: true,
    websocket: false, media: false, object: true, ping: true, csp_report: true,
    preflight: false, navigation: false, sub_frame: true
  };
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (!snfe) return callback({});
    const shouldCheck = blockableResourceTypes[details.resourceType];
    if (!shouldCheck) return callback({});
    const map = {
      script: 'script', stylesheet: 'stylesheet', image: 'image', font: 'font',
      xhr: 'xmlhttprequest', fetch: 'fetch', websocket: 'websocket',
      media: 'media', object: 'object', ping: 'ping', csp_report: 'csp_report', sub_frame: 'sub_frame'
    };
    const type = map[details.resourceType] || 'other';
    const shouldBlock = snfe.matchRequest({ originURL: details.referrer || details.url, url: details.url, type });
    if (shouldBlock !== 0) return callback({ cancel: true });
    callback({});
  });
}

module.exports = { initializeFilterEngine, setupWebRequestHandler, getUserFilters: loadUserFilters, saveUserFilters, resetFilters };
