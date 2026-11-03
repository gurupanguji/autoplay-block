import { dbg } from './natives.js';
import { originalAddEventListener, originalAutoplayDescriptor, originalPause, originalRemoveAttribute, safeCall } from './natives.js';
import { isUserInitiated } from './interaction.js';

export function neutralizeElement(el) {
  if (!el) return;
  try {
    try { safeCall(originalRemoveAttribute, el, 'autoplay'); } catch (e) { dbg('media:remove-autoplay', e); }
    if (originalAutoplayDescriptor && originalAutoplayDescriptor.set) {
      try { safeCall(originalAutoplayDescriptor.set, el, false); } catch (e) { dbg('media:set-autoplay', e); }
    }
    try { safeCall(originalPause, el); } catch (e) { dbg('media:pause', e); }
    try {
      safeCall(originalAddEventListener, el, 'play', function (e) {
        if (!isUserInitiated()) {
          try { safeCall(originalPause, el); } catch (err) { dbg('media:play-pause', err); }
        }
      }, { capture: true });
    } catch (e) { dbg('media:play-listener', e); }
  } catch (e) { dbg('media:neutralize', e); }
}
