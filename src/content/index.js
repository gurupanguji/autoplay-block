import { dbg } from './natives.js';
import * as natives from './natives.js';
import { neutralizeElement } from './media.js';
import { applyOverridesToWindow } from './window.js';
import { overrideFrameGetters } from './frames.js';

const { originalDefineProperty, originalAddEventListener, originalDocumentQuerySelectorAll, safeApply, safeCall } = natives;

// 1. Initialize main window
applyOverridesToWindow(window);

// 2. Setup frame getters
overrideFrameGetters(HTMLIFrameElement.prototype);
if (typeof HTMLFrameElement !== 'undefined') overrideFrameGetters(HTMLFrameElement.prototype);
if (typeof HTMLObjectElement !== 'undefined') overrideFrameGetters(HTMLObjectElement.prototype);
if (typeof HTMLEmbedElement !== 'undefined') overrideFrameGetters(HTMLEmbedElement.prototype);

// 3. Override window.open defensively
try {
  const originalWindowOpen = window.open;
  originalDefineProperty(window, 'open', {
    value: function () {
      try {
        const win = safeApply(originalWindowOpen, this, arguments);
        if (win) {
          applyOverridesToWindow(win);
        }
        return win;
      } catch (e) {
        return safeApply(originalWindowOpen, this, arguments);
      }
    },
    writable: true,
    configurable: true,
    enumerable: true
  });
} catch (e) { dbg('index:window-open', e); }

// 4. Initial scan & DOMContentLoaded hooking
const scanAndNeutralize = () => {
  try {
    const elements = safeCall(originalDocumentQuerySelectorAll, document, 'video, audio');
    for (let i = 0; i < elements.length; i++) {
      neutralizeElement(elements[i]);
    }
    const frames = safeCall(originalDocumentQuerySelectorAll, document, 'iframe, frame, object, embed');
    for (let i = 0; i < frames.length; i++) {
      try {
        const frame = frames[i];
        if (frame.contentWindow) {
          applyOverridesToWindow(frame.contentWindow);
        }
      } catch (err) { dbg('index:frame-hook', err); }
    }
  } catch (e) { dbg('index:initial-media', e); }
};

scanAndNeutralize();
safeCall(originalAddEventListener, document, 'DOMContentLoaded', scanAndNeutralize);
