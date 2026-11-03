import { ACTIVATION_WINDOW_MS, originalAddEventListener, originalDateNow, originalEventIsTrustedGet, safeCall } from './natives.js';

let lastUserInteraction = 0;
const updateInteraction = (e) => {
  if (e) {
    const isTrusted = originalEventIsTrustedGet ? safeCall(originalEventIsTrustedGet, e) : e.isTrusted;
    if (isTrusted) lastUserInteraction = originalDateNow();
  }
};
const interactionEvents = ['click', 'keydown', 'mousedown', 'pointerdown', 'touchend'];
for (let i = 0; i < interactionEvents.length; i++) {
  safeCall(originalAddEventListener, window, interactionEvents[i], updateInteraction, true);
}
export function isUserInitiated() {
  return originalDateNow() - lastUserInteraction < ACTIVATION_WINDOW_MS;
}
