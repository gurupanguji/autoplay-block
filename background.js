import { loadSettings, buildExcludeMatches } from './src/shared/settings.js';

const SCRIPT_ID = 'autoplay-blocker';
let registrationQueue = Promise.resolve();

function syncRegistration() {
  registrationQueue = registrationQueue.catch(() => {}).then(async () => {
    try {
    const settings = await loadSettings();
    if (!settings.enabled) {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#808080' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    if (!settings.enabled) return;
    const script = {
      id: SCRIPT_ID, js: ['content.js'], matches: ['<all_urls>'],
      excludeMatches: buildExcludeMatches(settings.allowlist), runAt: 'document_start',
      allFrames: true, matchAboutBlank: true, world: 'MAIN', persistAcrossSessions: true,
    };
    try {
      await chrome.scripting.registerContentScripts([script]);
    } catch (error) {
      console.error(error);
      try {
        await chrome.scripting.registerContentScripts([{ ...script, excludeMatches: buildExcludeMatches([]) }]);
      } catch (fallbackError) {
        console.error(fallbackError);
      }
    }
    } catch (error) {
      console.error(error);
    }
  });
  return registrationQueue;
}

chrome.runtime.onInstalled.addListener(syncRegistration);
chrome.runtime.onStartup.addListener(syncRegistration);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') syncRegistration();
});
