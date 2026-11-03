export const DEFAULT_EXCLUDED_HOSTS = [
  'meet.google.com', 'teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft',
  'zoom.us', 'zoom.com', 'discord.com', 'app.slack.com', 'webex.com', 'whereby.com', 'meet.jit.si',
];

export const DEFAULT_SETTINGS = { enabled: true, allowlist: [] };

export function normalizeHost(input) {
  if (typeof input !== 'string') return null;
  let value = input.trim();
  if (!value || /\s/.test(value)) return null;
  value = value.replace(/^\*\./, '');
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `http://${value}`);
    let host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (host.startsWith('[') || host.includes(':')) return null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host) || host.length > 253) return null;
    if (host.split('.').some((label) => label.length < 1 || label.length > 63)) return null;
    return host;
  } catch {
    return null;
  }
}

export function hostCovers(entry, host) {
  return host === entry || host.endsWith(`.${entry}`);
}

export function findCoveringEntry(host, entries) {
  return entries.find((entry) => hostCovers(entry, host));
}

export function isDefaultExcluded(host) {
  return Boolean(findCoveringEntry(host, DEFAULT_EXCLUDED_HOSTS));
}

export function buildExcludeMatches(allowlist) {
  const patterns = new Set();
  for (const entry of [...DEFAULT_EXCLUDED_HOSTS, ...(Array.isArray(allowlist) ? allowlist : [])]) {
    const host = normalizeHost(entry);
    if (!host) continue;
    const singleLabel = !host.includes('.');
    const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
    patterns.add(singleLabel || ipv4 ? `*://${host}/*` : `*://*.${host}/*`);
  }
  return [...patterns];
}

function sanitizeSettings(value) {
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SETTINGS.enabled,
    allowlist: [...new Set((Array.isArray(value.allowlist) ? value.allowlist : []).map(normalizeHost).filter(Boolean))],
  };
}

export async function loadSettings() {
  return sanitizeSettings(await chrome.storage.sync.get(DEFAULT_SETTINGS));
}

export async function saveSettings(patch) {
  const settings = sanitizeSettings({ ...await loadSettings(), ...patch });
  await chrome.storage.sync.set(settings);
  return settings;
}
