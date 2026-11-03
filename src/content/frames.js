import { dbg } from './natives.js';
import * as natives from './natives.js';
import { applyOverridesToWindow } from './window.js';
const { originalGetOwnPropertyDescriptor, originalDefineProperty, safeCall } = natives;

export const overrideFrameGetters = (proto) => {
    if (!proto) return;
    try {
      const descriptorWindow = originalGetOwnPropertyDescriptor(proto, 'contentWindow');
      if (descriptorWindow && descriptorWindow.get) {
        const originalGet = descriptorWindow.get;
        originalDefineProperty(proto, 'contentWindow', {
          get() {
            try {
              const win = safeCall(originalGet, this);
              if (win) applyOverridesToWindow(win);
              return win;
            } catch (e) {
              return safeCall(originalGet, this);
            }
          },
          configurable: true,
          enumerable: true
        });
      }
    } catch (e) { dbg('frames:contentWindow', e); }

    try {
      const descriptorDoc = originalGetOwnPropertyDescriptor(proto, 'contentDocument');
      if (descriptorDoc && descriptorDoc.get) {
        const originalGet = descriptorDoc.get;
        originalDefineProperty(proto, 'contentDocument', {
          get() {
            try {
              const doc = safeCall(originalGet, this);
              if (doc && doc.defaultView) applyOverridesToWindow(doc.defaultView);
              return doc;
            } catch (e) {
              return safeCall(originalGet, this);
            }
          },
          configurable: true,
          enumerable: true
        });
      }
    } catch (e) { dbg('frames:contentDocument', e); }
  };
