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
    if (e && e.isTrusted) {
      lastUserInteraction = originalDateNow();
    }
  };

  const interactionEvents = ['click', 'keydown', 'mousedown', 'pointerdown', 'touchend'];
  interactionEvents.forEach(event => {
    originalAddEventListener.call(window, event, updateInteraction, true);
  });

  function isUserInitiated() {
    return originalDateNow() - lastUserInteraction < 3000;
  }

  // Hide wrapper function source code from signature/toString detection
  const customToStringMap = new OriginalWeakMap();
  const makeNativeToString = (fn, originalFn) => {
    if (!fn || !originalFn) return;
    try {
      const originalString = originalFn.toString();
      customToStringMap.set(fn, originalString);
      const customFnToString = function () { return originalString; };
      customToStringMap.set(customFnToString, originalFunctionToString.toString());
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
      const winCustomFunctionToString = function () {
        if (customToStringMap.has(this)) {
          return customToStringMap.get(this);
        }
        return winOriginalToString.apply(this, arguments);
      };
      customToStringMap.set(winCustomFunctionToString, winOriginalToString.toString());
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
      if (customToStringMap.has(this)) {
        return customToStringMap.get(this);
      }
      return originalFunctionToString.apply(this, arguments);
    };
    customToStringMap.set(customFunctionToString, originalFunctionToString.toString());
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
        originalRemoveAttribute.call(el, 'autoplay');
      } catch (e) {}

      if (originalAutoplayDescriptor && originalAutoplayDescriptor.set) {
        try {
          originalAutoplayDescriptor.set.call(el, false);
        } catch (e) {}
      }

      try {
        originalPause.call(el);
      } catch (e) {}

      try {
        originalAddEventListener.call(el, 'play', function (e) {
          if (!isUserInitiated()) {
            try {
              originalPause.call(el);
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
                const tagName = node.tagName ? node.tagName.toUpperCase() : '';
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
                  const elements = originalElementQuerySelectorAll.call(node, 'video, audio, iframe, frame, object, embed');
                  for (let k = 0; k < elements.length; k++) {
                    const el = elements[k];
                    const tag = el.tagName ? el.tagName.toUpperCase() : '';
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
            if (node.tagName && (node.tagName.toUpperCase() === 'VIDEO' || node.tagName.toUpperCase() === 'AUDIO')) {
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
                const tagName = node.tagName ? node.tagName.toUpperCase() : '';
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
                  const elements = originalElementQuerySelectorAll.call(node, 'video, audio, iframe, frame, object, embed');
                  for (let k = 0; k < elements.length; k++) {
                    const el = elements[k];
                    const tag = el.tagName ? el.tagName.toUpperCase() : '';
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
    if (hookedWindows.has(win)) return;

    try {
      hookedWindows.add(win);
      
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
          return winOriginalPlay.apply(this, arguments);
        }
        if (isUserInitiated()) {
          return winOriginalPlay.apply(this, arguments);
        }
        try {
          winOriginalPause.call(this);
        } catch (e) {}
        return originalPromiseReject.call(Promise,
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
              originalAutoplayDescriptor.set.call(this, false);
            } catch (e) {}
          }
          try {
            originalRemoveAttribute.call(this, 'autoplay');
          } catch (e) {}
        },
        configurable: true,
        enumerable: true
      });

      // 3. Override setAttribute on Element.prototype (shadowing for safety)
      const customSetAttribute = function (name, value) {
        if (name && typeof name === 'string' && name.toLowerCase() === 'autoplay') {
          if (this instanceof win.HTMLMediaElement) {
            return;
          }
        }
        return winOriginalSetAttribute.apply(this, arguments);
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
          const shadowRoot = winOriginalAttachShadow.call(this, init);
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
            const el = winOriginalCreateElement.apply(this, arguments);
            if (el && tagName && typeof tagName === 'string' && (tagName.toLowerCase() === 'video' || tagName.toLowerCase() === 'audio')) {
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
            const el = winOriginalCreateElementNS.apply(this, arguments);
            if (el && qualifiedName && typeof qualifiedName === 'string' && (qualifiedName.toLowerCase() === 'video' || qualifiedName.toLowerCase() === 'audio')) {
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
          return winOriginalObjectDefineProperty.apply(this, arguments);
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
              return winOriginalObjectDefineProperties.call(this, obj, props);
            }
          }
          return winOriginalObjectDefineProperties.apply(this, arguments);
        };
        makeNativeToString(customObjectDefineProperties, winOriginalObjectDefineProperties);
        win.Object.defineProperties = customObjectDefineProperties;

        const winOriginalReflectDefineProperty = win.Reflect && win.Reflect.defineProperty;
        if (winOriginalReflectDefineProperty) {
          const customReflectDefineProperty = function (target, propertyKey, attributes) {
            if (isMediaOrProto(target) && (propertyKey === 'play' || propertyKey === 'autoplay')) {
              return false;
            }
            return winOriginalReflectDefineProperty.apply(this, arguments);
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
          const preExistingVideos = originalDocumentQuerySelectorAll.call(win.document, 'video, audio');
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
      originalAddEventListener.call(win, 'play', function (e) {
        const path = e.composedPath ? e.composedPath() : [];
        const target = path.length > 0 ? path[0] : e.target;
        if (target && (target.tagName && (target.tagName.toUpperCase() === 'VIDEO' || target.tagName.toUpperCase() === 'AUDIO'))) {
          if (!isUserInitiated()) {
            try {
              winOriginalPause.call(target);
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
              const win = originalGet.call(this);
              if (win) applyOverridesToWindow(win);
              return win;
            } catch (e) {
              return originalGet.call(this);
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
              const doc = originalGet.call(this);
              if (doc && doc.defaultView) applyOverridesToWindow(doc.defaultView);
              return doc;
            } catch (e) {
              return originalGet.call(this);
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
          const win = originalWindowOpen.apply(this, arguments);
          if (win) {
            applyOverridesToWindow(win);
          }
          return win;
        } catch (e) {
          return originalWindowOpen.apply(this, arguments);
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
      const elements = originalDocumentQuerySelectorAll.call(document, 'video, audio');
      for (let i = 0; i < elements.length; i++) {
        neutralizeElement(elements[i]);
      }
      const frames = originalDocumentQuerySelectorAll.call(document, 'iframe, frame, object, embed');
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
  originalAddEventListener.call(document, 'DOMContentLoaded', scanAndNeutralize);
})();
