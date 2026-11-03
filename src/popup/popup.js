import { DEFAULT_EXCLUDED_HOSTS, findCoveringEntry, isDefaultExcluded, loadSettings, normalizeHost, saveSettings } from '../shared/settings.js';

const globalToggle = document.querySelector('#global-toggle');
const siteToggle = document.querySelector('#site-toggle');
const hostLabel = document.querySelector('#site-host');
const note = document.querySelector('#site-note');
const status = document.querySelector('#status');
const reloadButton = document.querySelector('#reload-button');
let tab;
let host;
let settings;
let busy = false;

function showSite() {
  siteToggle.disabled = busy || !host || isDefaultExcluded(host);
  if (!host) {
    hostLabel.textContent = 'Not available';
    siteToggle.checked = false;
    note.textContent = 'Site controls are available on http and https pages.';
    return;
  }
  hostLabel.textContent = host;
  const builtin = findCoveringEntry(host, DEFAULT_EXCLUDED_HOSTS);
  const allowed = findCoveringEntry(host, settings.allowlist);
  if (builtin) {
    siteToggle.checked = false;
    note.textContent = 'Built-in exclusion (calls and meetings)';
  } else if (allowed) {
    siteToggle.checked = false;
    note.textContent = `Allowed via ${allowed}`;
  } else {
    siteToggle.checked = true;
    note.textContent = '';
  }
}

async function initialize() {
  [settings] = await Promise.all([loadSettings()]);
  globalToggle.checked = settings.enabled;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tab = activeTab;
  try {
    const url = new URL(activeTab?.url || '');
    host = ['http:', 'https:'].includes(url.protocol) ? normalizeHost(url.hostname) : null;
  } catch { host = null; }
  showSite();
}

function changed() {
  reloadButton.hidden = false;
}

globalToggle.addEventListener('change', async () => {
  try { settings = await saveSettings({ enabled: globalToggle.checked }); changed(); }
  catch { status.textContent = 'Could not save setting.'; globalToggle.checked = settings.enabled; }
});

siteToggle.addEventListener('change', async () => {
  if (!host || busy) return;
  busy = true;
  siteToggle.disabled = true;
  try {
    const covering = findCoveringEntry(host, settings.allowlist);
    const allowlist = siteToggle.checked
      ? settings.allowlist.filter((entry) => entry !== covering)
      : [...settings.allowlist, host];
    settings = await saveSettings({ allowlist });
    changed();
    showSite();
  } catch {
    status.textContent = 'Could not save site setting.';
    showSite();
  } finally { busy = false; showSite(); }
});

reloadButton.addEventListener('click', async () => {
  if (tab?.id !== undefined) await chrome.tabs.reload(tab.id);
  window.close();
});

document.querySelector('#manage-button').addEventListener('click', () => chrome.runtime.openOptionsPage());

initialize().catch(() => {
  host = null;
  status.textContent = 'Could not load settings.';
  showSite();
});
