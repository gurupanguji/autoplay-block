import { DEFAULT_EXCLUDED_HOSTS, findCoveringEntry, loadSettings, normalizeHost, saveSettings } from '../shared/settings.js';

const toggle = document.querySelector('#global-toggle');
const list = document.querySelector('#allowlist');
const empty = document.querySelector('#empty');
const form = document.querySelector('#add-form');
const input = document.querySelector('#host-input');
const error = document.querySelector('#error');
let settings;
let saving = false;

for (const control of document.querySelectorAll('#global-toggle, #add-form button, #host-input')) {
  control.disabled = true;
}

function render() {
  toggle.checked = settings.enabled;
  list.replaceChildren();
  const entries = [...settings.allowlist].sort((a, b) => a.localeCompare(b));
  empty.hidden = entries.length > 0;
  for (const entry of entries) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = entry;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${entry} from allowlist`);
    remove.addEventListener('click', () => removeEntry(entry));
    item.append(name, remove);
    list.append(item);
  }
}

async function removeEntry(entry) {
  if (!settings) return;
  settings = await saveSettings({ allowlist: settings.allowlist.filter((value) => value !== entry) });
  render();
}

toggle.addEventListener('change', async () => {
  if (!settings) return;
  try { settings = await saveSettings({ enabled: toggle.checked }); }
  catch { toggle.checked = settings.enabled; }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!settings) return;
  if (saving) return;
  const host = normalizeHost(input.value);
  if (!host) { error.textContent = 'Enter a valid hostname or URL.'; input.focus(); return; }
  if (settings.allowlist.includes(host)) { error.textContent = `${host} is already on the allowlist.`; return; }
  const covering = findCoveringEntry(host, settings.allowlist);
  if (covering) { error.textContent = `${host} is already covered by ${covering}.`; return; }
  saving = true;
  try {
    settings = await saveSettings({ allowlist: [...settings.allowlist, host] });
    input.value = '';
    error.textContent = '';
    render();
  } catch { error.textContent = 'Could not save the allowlist.'; }
  finally { saving = false; }
});

for (const host of DEFAULT_EXCLUDED_HOSTS) {
  const item = document.createElement('li');
  item.textContent = host;
  document.querySelector('#defaults').append(item);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || (!changes.enabled && !changes.allowlist)) return;
  loadSettings().then((value) => { settings = value; render(); }).catch(() => {
    error.textContent = 'Could not load settings.';
  });
});

loadSettings().then((value) => {
  settings = value;
  for (const control of document.querySelectorAll('#global-toggle, #add-form button, #host-input')) {
    control.disabled = false;
  }
  render();
}).catch(() => {
  error.textContent = 'Could not load settings.';
});
