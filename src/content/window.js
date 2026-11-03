import { dbg } from './natives.js';
import * as natives from './natives.js';
import { isUserInitiated } from './interaction.js';
import { makeNativeToString, overrideToStringOnWindow } from './tostring.js';
import { neutralizeElement } from './media.js';

const { originalDefineProperty, originalPromiseReject, originalDOMException, OriginalMutationObserver, OriginalWeakSet, originalPause, originalPlay, originalSetAttribute, originalAttachShadow, originalRemoveAttribute, originalAddEventListener, originalAutoplayDescriptor, originalDocumentQuerySelectorAll, originalElementQuerySelectorAll, originalComposedPath, originalEventTargetGet, safeApply, safeCall, safeToUpperCase, safeWeakSetHas, safeWeakSetAdd } = natives;


  const hookedWindows = new OriginalWeakSet();

  function observeDOM(root) {
    if (!root) return;
    let observer;
    try {
      observer = new OriginalMutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
          const mutation = mutations[i];
          if (mutation.type === 'childList') {
            const addedNodes = mutation.addedNodes;
            for (let j = 0; j < addedNodes.length; j++) {
              const node = addedNodes[j];
              if (node.nodeType === 1) { // Node.ELEMENT_NODE
                const tagName = node.tagName ? safeToUpperCase(node.tagName) : '';
                if (tagName === 'VIDEO' || tagName === 'AUDIO') {
                  neutralizeElement(node);
                } else if (tagName === 'IFRAME' || tagName === 'FRAME' || tagName === 'OBJECT' || tagName === 'EMBED') {
                  try {
                    if (node.contentWindow) {
                      applyOverridesToWindow(node.contentWindow);
                    }
                  } catch (e) { dbg('window:frame-hook', e); }
                }
                
                // Optimized single pass descendant query
                try {
                  const elements = safeCall(originalElementQuerySelectorAll, node, 'video, audio, iframe, frame, object, embed');
                  for (let k = 0; k < elements.length; k++) {
                    const el = elements[k];
                    const tag = el.tagName ? safeToUpperCase(el.tagName) : '';
                    if (tag === 'VIDEO' || tag === 'AUDIO') {
                      neutralizeElement(el);
                    } else {
                      try {
                        if (el.contentWindow) {
                          applyOverridesToWindow(el.contentWindow);
                        }
                      } catch (err) { dbg('window:descendant-hook', err); }
                    }
                  }
                } catch (e) { dbg('window:query-descendants', e); }
              }
            }
          } else if (mutation.type === 'attributes') {
            const node = mutation.target;
            if (node.tagName && (safeToUpperCase(node.tagName) === 'VIDEO' || safeToUpperCase(node.tagName) === 'AUDIO')) {
              neutralizeElement(node);
            }
          }
        }
      });

      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['autoplay', 'src']
      });
    } catch (e) {
      try { observer.observe(root, {childList:true, subtree:true}); } catch (err) { dbg('window:observe', err); }
    }
  }

  function applyOverridesToWindow(win) {
    if (!win) return;
    if (safeWeakSetHas(hookedWindows, win)) return;

    try {
      safeWeakSetAdd(hookedWindows, win);
      
      // Test if same-origin / accessible (throws if cross-origin)
      const doc = win.document;
      if (!doc) return;

      const mediaProto = win.HTMLMediaElement.prototype;
      const winOriginalPlay = mediaProto.play || originalPlay;
      const winOriginalPause = mediaProto.pause || originalPause;
      const winOriginalSetAttribute = win.Element.prototype.setAttribute || originalSetAttribute;
      const winOriginalAttachShadow = win.Element.prototype.attachShadow || originalAttachShadow;

      const isMediaOrProto = (obj) => {
        try {
          return (win.HTMLMediaElement && obj instanceof win.HTMLMediaElement) ||
                 (win.HTMLMediaElement && obj === win.HTMLMediaElement.prototype) ||
                 (win.HTMLVideoElement && obj === win.HTMLVideoElement.prototype) ||
                 (win.HTMLAudioElement && obj === win.HTMLAudioElement.prototype);
        } catch (e) {
          return false;
        }
      };

      const customPlay = function () {
        if (!(this instanceof win.HTMLMediaElement)) {
          return safeApply(winOriginalPlay, this, arguments);
        }
        if (isUserInitiated()) {
          return safeApply(winOriginalPlay, this, arguments);
        }
        try {
          safeCall(winOriginalPause, this);
        } catch (e) { dbg('window:pause', e); }
        return safeCall(originalPromiseReject, Promise,
          new originalDOMException("Autoplay blocked by extension.", "NotAllowedError")
        );
      };
      makeNativeToString(customPlay, winOriginalPlay);
      
      originalDefineProperty(mediaProto, 'play', {
        value: customPlay,
        writable: true,
        configurable: true,
        enumerable: true
      });
      if (win.HTMLVideoElement) {
        originalDefineProperty(win.HTMLVideoElement.prototype, 'play', {
          value: customPlay,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }
      if (win.HTMLAudioElement) {
        originalDefineProperty(win.HTMLAudioElement.prototype, 'play', {
          value: customPlay,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }

      originalDefineProperty(mediaProto, 'autoplay', {
        get() {
          return false;
        },
        set(value) {
          if (originalAutoplayDescriptor && originalAutoplayDescriptor.set) {
            try {
              safeCall(originalAutoplayDescriptor.set, this, false);
            } catch (e) { dbg('window:autoplay-descriptor', e); }
          }
          try {
            safeCall(originalRemoveAttribute, this, 'autoplay');
          } catch (e) { dbg('window:remove-autoplay', e); }
        },
        configurable: true,
        enumerable: true
      });

      const customSetAttribute = function (name, value) {
        if (name && typeof name === 'string' && safeToUpperCase(name) === 'AUTOPLAY') {
          if (this instanceof win.HTMLMediaElement) {
            return;
          }
        }
        return safeApply(winOriginalSetAttribute, this, arguments);
      };
      makeNativeToString(customSetAttribute, winOriginalSetAttribute);
      
      originalDefineProperty(win.Element.prototype, 'setAttribute', {
        value: customSetAttribute,
        writable: true,
        configurable: true,
        enumerable: true
      });

      if (winOriginalAttachShadow) {
        const customAttachShadow = function (init) {
          const shadowRoot = safeCall(winOriginalAttachShadow, this, init);
          if (shadowRoot) {
            observeDOM(shadowRoot);
          }
          return shadowRoot;
        };
        makeNativeToString(customAttachShadow, winOriginalAttachShadow);
        
        originalDefineProperty(win.Element.prototype, 'attachShadow', {
          value: customAttachShadow,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }

      if (win.document) {
        try {
          const winOriginalCreateElement = win.document.createElement;
          const customCreateElement = function (tagName) {
            const el = safeApply(winOriginalCreateElement, this, arguments);
            if (el && tagName && typeof tagName === 'string' && (safeToUpperCase(tagName) === 'VIDEO' || safeToUpperCase(tagName) === 'AUDIO')) {
              neutralizeElement(el);
            }
            return el;
          };
          makeNativeToString(customCreateElement, winOriginalCreateElement);
          originalDefineProperty(win.document, 'createElement', {
            value: customCreateElement,
            writable: true,
            configurable: true,
            enumerable: true
          });

          const winOriginalCreateElementNS = win.document.createElementNS;
          const customCreateElementNS = function (namespaceURI, qualifiedName) {
            const el = safeApply(winOriginalCreateElementNS, this, arguments);
            if (el && qualifiedName && typeof qualifiedName === 'string' && (safeToUpperCase(qualifiedName) === 'VIDEO' || safeToUpperCase(qualifiedName) === 'AUDIO')) {
              neutralizeElement(el);
            }
            return el;
          };
          makeNativeToString(customCreateElementNS, winOriginalCreateElementNS);
          originalDefineProperty(win.document, 'createElementNS', {
            value: customCreateElementNS,
            writable: true,
            configurable: true,
            enumerable: true
          });
        } catch (err) { dbg('window:create-element', err); }
      }

      try {
        const winOriginalObjectDefineProperty = win.Object.defineProperty;
        const customObjectDefineProperty = function (obj, prop, descriptor) {
          if (isMediaOrProto(obj) && (prop === 'play' || prop === 'autoplay')) {
            return obj;
          }
          return safeApply(winOriginalObjectDefineProperty, this, arguments);
        };
        makeNativeToString(customObjectDefineProperty, winOriginalObjectDefineProperty);
        win.Object.defineProperty = customObjectDefineProperty;

        const winOriginalObjectDefineProperties = win.Object.defineProperties;
        const customObjectDefineProperties = function (obj, properties) {
          if (isMediaOrProto(obj) && properties) {
            const props = {};
            let modified = false;
            const keys = Object.keys(properties);
            for (let i = 0; i < keys.length; i++) {
              const key = keys[i];
              if (key === 'play' || key === 'autoplay') {
                modified = true;
              } else {
                props[key] = properties[key];
              }
            }
            if (modified) {
              return safeCall(winOriginalObjectDefineProperties, this, obj, props);
            }
          }
          return safeApply(winOriginalObjectDefineProperties, this, arguments);
        };
        makeNativeToString(customObjectDefineProperties, winOriginalObjectDefineProperties);
        win.Object.defineProperties = customObjectDefineProperties;

        const winOriginalReflectDefineProperty = win.Reflect && win.Reflect.defineProperty;
        if (winOriginalReflectDefineProperty) {
          const customReflectDefineProperty = function (target, propertyKey, attributes) {
            if (isMediaOrProto(target) && (propertyKey === 'play' || propertyKey === 'autoplay')) {
              return false;
            }
            return safeApply(winOriginalReflectDefineProperty, this, arguments);
          };
          makeNativeToString(customReflectDefineProperty, winOriginalReflectDefineProperty);
          win.Reflect.defineProperty = customReflectDefineProperty;
        }
      } catch (err) { dbg('window:define-property', err); }

      overrideToStringOnWindow(win);

      registerGlobalPlayListener(win);

      if (win.document) {
        try {
          const preExistingVideos = safeCall(originalDocumentQuerySelectorAll, win.document, 'video, audio');
          for (let i = 0; i < preExistingVideos.length; i++) {
            neutralizeElement(preExistingVideos[i]);
          }
        } catch (err) { dbg('window:initial-media', err); }
        observeDOM(win.document);
      }

    } catch (e) { dbg('window:window-hook', e); }
  }

  function registerGlobalPlayListener(win) {
    try {
      const winOriginalPause = win.HTMLMediaElement.prototype.pause || originalPause;
      safeCall(originalAddEventListener, win, 'play', function (e) {
        const path = originalComposedPath ? safeCall(originalComposedPath, e) : [];
        const target = path.length > 0 ? path[0] : (originalEventTargetGet ? safeCall(originalEventTargetGet, e) : e.target);
        if (target && (target.tagName && (safeToUpperCase(target.tagName) === 'VIDEO' || safeToUpperCase(target.tagName) === 'AUDIO'))) {
          if (!isUserInitiated()) {
            try {
              safeCall(winOriginalPause, target);
            } catch (err) { dbg('window:play', err); }
          }
        }
      }, { capture: true, passive: false });
    } catch (e) { dbg('window:play-listener', e); }
  }

export { applyOverridesToWindow };
