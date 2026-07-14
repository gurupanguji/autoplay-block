(function () {
  // Save native methods immediately before any page scripts can modify them
  const originalDefineProperty = Object.defineProperty;
  const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  const originalObjectDefineProperties = Object.defineProperties;
  const originalReflectDefineProperty = typeof Reflect !== 'undefined' ? Reflect.defineProperty : null;
  
  const originalDateNow = Date.now;
  const originalPromiseReject = Promise.reject;
  const originalDOMException = DOMException;
  const originalFunctionToString = Function.prototype.toString;
  const OriginalMutationObserver = MutationObserver;
  const OriginalWeakSet = WeakSet;
  const OriginalWeakMap = WeakMap;

  // Safe apply and call helpers to be completely immune to page scripts overriding Function.prototype.apply/call
  const originalReflectApply = typeof Reflect !== 'undefined' ? Reflect.apply : null;
  const safeApply = originalReflectApply 
    ? (fn, thisArg, args) => originalReflectApply(fn, thisArg, args)
    : Function.prototype.call.bind(Function.prototype.apply);

  const safeCall = originalReflectApply
    ? (fn, thisArg, ...args) => originalReflectApply(fn, thisArg, args)
    : Function.prototype.call.bind(Function.prototype.call);

  // Safe WeakMap and WeakSet helpers
  const originalWeakMapHas = WeakMap.prototype.has;
  const originalWeakMapGet = WeakMap.prototype.get;
  const originalWeakMapSet = WeakMap.prototype.set;
  const originalWeakSetHas = WeakSet.prototype.has;
  const originalWeakSetAdd = WeakSet.prototype.add;

  const safeWeakMapHas = (map, key) => safeCall(originalWeakMapHas, map, key);
  const safeWeakMapGet = (map, key) => safeCall(originalWeakMapGet, map, key);
  const safeWeakMapSet = (map, key, value) => safeCall(originalWeakMapSet, map, key, value);
  const safeWeakSetHas = (set, val) => safeCall(originalWeakSetHas, set, val);
  const safeWeakSetAdd = (set, val) => safeCall(originalWeakSetAdd, set, val);

  // Safe string helper
  const originalToUpperCase = String.prototype.toUpperCase;
  const safeToUpperCase = (str) => safeCall(originalToUpperCase, str);

  // Safe Event helpers
  const originalComposedPath = Event.prototype.composedPath;
  const originalEventTargetDescriptor = originalGetOwnPropertyDescriptor(Event.prototype, 'target');
  const originalEventTargetGet = originalEventTargetDescriptor ? originalEventTargetDescriptor.get : null;
  const originalEventIsTrustedDescriptor = originalGetOwnPropertyDescriptor(Event.prototype, 'isTrusted');
  const originalEventIsTrustedGet = originalEventIsTrustedDescriptor ? originalEventIsTrustedDescriptor.get : null;

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveAttribute = Element.prototype.removeAttribute;
  const originalSetAttribute = Element.prototype.setAttribute;
  const originalAttachShadow = Element.prototype.attachShadow;
  const originalElementQuerySelectorAll = Element.prototype.querySelectorAll;
  const originalDocumentQuerySelectorAll = Document.prototype.querySelectorAll;
  
  const originalPause = HTMLMediaElement.prototype.pause;
  const originalPlay = HTMLMediaElement.prototype.play;
  const originalAutoplayDescriptor = originalGetOwnPropertyDescriptor(HTMLMediaElement.prototype, 'autoplay');

  // Track user interactions to safely allow user-triggered play
  let lastUserInteraction = 0;
  const updateInteraction = (e) => {
    if (e) {
      const isTrusted = originalEventIsTrustedGet ? safeCall(originalEventIsTrustedGet, e) : e.isTrusted;
      if (isTrusted) {
        lastUserInteraction = originalDateNow();
      }
    }
  };

  const interactionEvents = ['click', 'keydown', 'mousedown', 'pointerdown', 'touchend'];
  for (let i = 0; i < interactionEvents.length; i++) {
    safeCall(originalAddEventListener, window, interactionEvents[i], updateInteraction, true);
  }

  function isUserInitiated() {
    return originalDateNow() - lastUserInteraction < 3000;
  }

  // Hide wrapper function source code from signature/toString detection
  const customToStringMap = new OriginalWeakMap();
  const makeNativeToString = (fn, originalFn) => {
    if (!fn || !originalFn) return;
    try {
      const originalString = safeApply(originalFunctionToString, originalFn, []);
      safeWeakMapSet(customToStringMap, fn, originalString);
      const customFnToString = function () { return originalString; };
      safeWeakMapSet(customToStringMap, customFnToString, safeApply(originalFunctionToString, originalFunctionToString, []));
      originalDefineProperty(fn, 'toString', {
        value: customFnToString,
        configurable: true,
        writable: true
      });
    } catch (e) {}
  };

  // Helper to override toString on Function.prototype of child frames
  const overrideToStringOnWindow = (win) => {
    try {
      const winFunctionProto = win.Function.prototype;
      const winOriginalToString = winFunctionProto.toString;
      if (typeof winOriginalToString !== 'function') return;

      const winCustomFunctionToString = function () {
        if (this && (typeof this === 'object' || typeof this === 'function')) {
          if (safeWeakMapHas(customToStringMap, this)) {
            return safeWeakMapGet(customToStringMap, this);
          }
        }
        return safeApply(winOriginalToString, this, arguments);
      };
      safeWeakMapSet(customToStringMap, winCustomFunctionToString, safeApply(originalFunctionToString, winOriginalToString, []));
      originalDefineProperty(winFunctionProto, 'toString', {
        value: winCustomFunctionToString,
        writable: true,
        configurable: true,
        enumerable: false
      });
    } catch (e) {}
  };

  try {
    const customFunctionToString = function () {
      if (this && (typeof this === 'object' || typeof this === 'function')) {
        if (safeWeakMapHas(customToStringMap, this)) {
          return safeWeakMapGet(customToStringMap, this);
        }
      }
      return safeApply(originalFunctionToString, this, arguments);
    };
    safeWeakMapSet(customToStringMap, customFunctionToString, safeApply(originalFunctionToString, originalFunctionToString, []));
    originalDefineProperty(Function.prototype, 'toString', {
      value: customFunctionToString,
      writable: true,
      configurable: true,
      enumerable: false
    });
  } catch (e) {}

  // Cache checked/hooked windows using a WeakSet to completely avoid cross-origin SecurityErrors
  const hookedWindows = new OriginalWeakSet();

  // Helper to neutralize a media element
  function neutralizeElement(el) {
    if (!el) return;
    try {
      try {
        safeCall(originalRemoveAttribute, el, 'autoplay');
      } catch (e) {}

      if (originalAutoplayDescriptor && originalAutoplayDescriptor.set) {
        try {
          safeCall(originalAutoplayDescriptor.set, el, false);
        } catch (e) {}
      }

      try {
        safeCall(originalPause, el);
      } catch (e) {}

      try {
        safeCall(originalAddEventListener, el, 'play', function (e) {
          if (!isUserInitiated()) {
            try {
              safeCall(originalPause, el);
            } catch (err) {}
          }
        }, { capture: true });
      } catch (e) {}
    } catch (e) {}
  }

  // Helper to set up MutationObserver on a target node (DOM or ShadowRoot)
  function observeDOM(root) {
    if (!root) return;
    try {
      const observer = new OriginalMutationObserver((mutations) => {
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
                  } catch (e) {}
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
                      } catch (err) {}
                    }
                  }
                } catch (e) {}
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
      try {
        const observer = new OriginalMutationObserver((mutations) => {
          for (let i = 0; i < mutations.length; i++) {
            const mutation = mutations[i];
            const addedNodes = mutation.addedNodes;
            for (let j = 0; j < addedNodes.length; j++) {
              const node = addedNodes[j];
              if (node.nodeType === 1) {
                const tagName = node.tagName ? safeToUpperCase(node.tagName) : '';
                if (tagName === 'VIDEO' || tagName === 'AUDIO') {
                  neutralizeElement(node);
                } else if (tagName === 'IFRAME' || tagName === 'FRAME' || tagName === 'OBJECT' || tagName === 'EMBED') {
                  try {
                    if (node.contentWindow) {
                      applyOverridesToWindow(node.contentWindow);
                    }
                  } catch (e) {}
                }
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
                      } catch (err) {}
                    }
                  }
                } catch (err) {}
              }
            }
          }
        });
        observer.observe(root, {
          childList: true,
          subtree: true
        });
      } catch (err) {}
    }
  }

  // Apply overrides to a specific window context (main page or iframe)
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

      // 1. Override play (writable and configurable for site compatibility)
      const customPlay = function () {
        if (!(this instanceof win.HTMLMediaElement)) {
          return safeApply(winOriginalPlay, this, arguments);
        }
        if (isUserInitiated()) {
          return safeApply(winOriginalPlay, this, arguments);
        }
        try {
          safeCall(winOriginalPause, this);
        } catch (e) {}
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

      // 2. Override autoplay descriptor (configurable: true for compatibility)
      originalDefineProperty(mediaProto, 'autoplay', {
        get() {
          return false;
        },
        set(value) {
          if (originalAutoplayDescriptor && originalAutoplayDescriptor.set) {
            try {
              safeCall(originalAutoplayDescriptor.set, this, false);
            } catch (e) {}
          }
          try {
            safeCall(originalRemoveAttribute, this, 'autoplay');
          } catch (e) {}
        },
        configurable: true,
        enumerable: true
      });

      // 3. Override setAttribute on Element.prototype (shadowing for safety)
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

      // 4. Override attachShadow
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

      // 5. Override document.createElement and createElementNS
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
        } catch (err) {}
      }

      // 6. Intercept property definitions defensively
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
      } catch (err) {}

      // 7. Virtualize toString on the frame's Function.prototype
      overrideToStringOnWindow(win);

      registerGlobalPlayListener(win);

      if (win.document) {
        try {
          const preExistingVideos = safeCall(originalDocumentQuerySelectorAll, win.document, 'video, audio');
          for (let i = 0; i < preExistingVideos.length; i++) {
            neutralizeElement(preExistingVideos[i]);
          }
        } catch (err) {}
        observeDOM(win.document);
      }

    } catch (e) {}
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
            } catch (err) {}
          }
        }
      }, { capture: true, passive: false });
    } catch (e) {}
  }

  const overrideFrameGetters = (proto) => {
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
    } catch (e) {}

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
    } catch (e) {}
  };

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
  } catch (e) {}

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
        } catch (err) {}
      }
    } catch (e) {}
  };

  scanAndNeutralize();
  safeCall(originalAddEventListener, document, 'DOMContentLoaded', scanAndNeutralize);
})();
