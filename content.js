(function () {
  // Save native Object methods immediately before any page scripts can modify them
  const originalDefineProperty = Object.defineProperty;
  const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

  // Track user interactions to safely allow user-triggered play
  let lastUserInteraction = 0;
  const updateInteraction = (e) => {
    // Only record actual user gestures, filtering out synthetic/programmatic events
    if (e && e.isTrusted) {
      lastUserInteraction = Date.now();
    }
  };

  const interactionEvents = ['click', 'keydown', 'mousedown', 'pointerdown', 'touchend'];
  interactionEvents.forEach(event => {
    window.addEventListener(event, updateInteraction, true);
  });

  // Helper to determine if play is user-initiated.
  // Note: We intentionally avoid navigator.userActivation because browsers carry over
  // activation states from link clicks/reloads, which video players exploit to autoplay on load.
  function isUserInitiated() {
    const recentlyClicked = Date.now() - lastUserInteraction < 3000;
    return recentlyClicked;
  }

  const makeNativeToString = (fn, originalFn) => {
    if (!fn || !originalFn) return;
    try {
      const originalString = originalFn.toString();
      originalDefineProperty(fn, 'toString', {
        value: function () { return originalString; },
        configurable: true,
        writable: true
      });
    } catch (e) {}
  };

  // Helper to neutralize a media element
  function neutralizeElement(el) {
    if (!el) return;
    const win = el.ownerDocument ? el.ownerDocument.defaultView : window;
    if (!win) return;

    try {
      const originalRemoveAttribute = win.Element.prototype.removeAttribute;
      const originalPause = win.HTMLMediaElement.prototype.pause;
      const originalAddEventListener = win.EventTarget.prototype.addEventListener;
      const originalAutoplayDescriptor = originalGetOwnPropertyDescriptor(win.HTMLMediaElement.prototype, 'autoplay');

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
    const win = root.ownerDocument ? root.ownerDocument.defaultView : (root.defaultView || window);
    if (!win) return;

    try {
      const observer = new win.MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
                neutralizeElement(node);
              } else if (node.tagName === 'IFRAME' || node.tagName === 'FRAME' || node.tagName === 'OBJECT' || node.tagName === 'EMBED') {
                try {
                  if (node.contentWindow) {
                    applyOverridesToWindow(node.contentWindow);
                  }
                } catch (e) {}
              } else if (node.nodeType === 1) { // 1 represents Node.ELEMENT_NODE
                try {
                  const originalElementQuerySelectorAll = win.Element.prototype.querySelectorAll;
                  originalElementQuerySelectorAll.call(node, 'video, audio').forEach(neutralizeElement);
                } catch (e) {}
                try {
                  const originalElementQuerySelectorAll = win.Element.prototype.querySelectorAll;
                  originalElementQuerySelectorAll.call(node, 'iframe, frame, object, embed').forEach(frame => {
                    if (frame.contentWindow) {
                      applyOverridesToWindow(frame.contentWindow);
                    }
                  });
                } catch (e) {}
              }
            }
          } else if (mutation.type === 'attributes') {
            const node = mutation.target;
            if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
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
      // Fallback in case attribute observation is not supported on this root
      try {
        const observer = new win.MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
                neutralizeElement(node);
              } else if (node.tagName === 'IFRAME' || node.tagName === 'FRAME' || node.tagName === 'OBJECT' || node.tagName === 'EMBED') {
                try {
                  if (node.contentWindow) {
                    applyOverridesToWindow(node.contentWindow);
                  }
                } catch (e) {}
              } else if (node.nodeType === 1) {
                try {
                  const originalElementQuerySelectorAll = win.Element.prototype.querySelectorAll;
                  originalElementQuerySelectorAll.call(node, 'video, audio').forEach(neutralizeElement);
                } catch (err) {}
                try {
                  const originalElementQuerySelectorAll = win.Element.prototype.querySelectorAll;
                  originalElementQuerySelectorAll.call(node, 'iframe, frame, object, embed').forEach(frame => {
                    if (frame.contentWindow) {
                      applyOverridesToWindow(frame.contentWindow);
                    }
                  });
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
    if (!win || win._autoplayBlockerHooked) return;
    win._autoplayBlockerHooked = true;

    try {
      const mediaProto = win.HTMLMediaElement.prototype;
      const originalPlay = mediaProto.play;
      const originalPause = mediaProto.pause;
      const originalSetAttribute = mediaProto.setAttribute || win.Element.prototype.setAttribute;
      const originalRemoveAttribute = win.Element.prototype.removeAttribute;
      const originalAttachShadow = win.Element.prototype.attachShadow;
      const originalAutoplayDescriptor = originalGetOwnPropertyDescriptor(mediaProto, 'autoplay');

      // 1. Override play
      const customPlay = function () {
        if (isUserInitiated()) {
          return originalPlay.apply(this, arguments);
        }
        try {
          originalPause.call(this);
        } catch (e) {}
        return Promise.reject(
          new DOMException("Autoplay blocked by extension.", "NotAllowedError")
        );
      };
      makeNativeToString(customPlay, originalPlay);
      
      originalDefineProperty(mediaProto, 'play', {
        value: customPlay,
        writable: false,
        configurable: false,
        enumerable: true
      });
      if (win.HTMLVideoElement) {
        originalDefineProperty(win.HTMLVideoElement.prototype, 'play', {
          value: customPlay,
          writable: false,
          configurable: false,
          enumerable: true
        });
      }
      if (win.HTMLAudioElement) {
        originalDefineProperty(win.HTMLAudioElement.prototype, 'play', {
          value: customPlay,
          writable: false,
          configurable: false,
          enumerable: true
        });
      }

      // 2. Override autoplay descriptor
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
        configurable: false,
        enumerable: true
      });

      // 3. Override setAttribute
      const customSetAttribute = function (name, value) {
        if (name && name.toLowerCase() === 'autoplay') {
          return;
        }
        return originalSetAttribute.apply(this, arguments);
      };
      makeNativeToString(customSetAttribute, originalSetAttribute);
      
      originalDefineProperty(mediaProto, 'setAttribute', {
        value: customSetAttribute,
        writable: false,
        configurable: false,
        enumerable: true
      });

      // 4. Override attachShadow
      if (originalAttachShadow) {
        const customAttachShadow = function (init) {
          const shadowRoot = originalAttachShadow.call(this, init);
          if (shadowRoot) {
            observeDOM(shadowRoot);
          }
          return shadowRoot;
        };
        makeNativeToString(customAttachShadow, originalAttachShadow);
        
        originalDefineProperty(win.Element.prototype, 'attachShadow', {
          value: customAttachShadow,
          writable: false,
          configurable: false,
          enumerable: true
        });
      }

      // 5. Override document.createElement and createElementNS to neutralize elements instantly
      if (win.document) {
        try {
          const originalCreateElement = win.document.createElement;
          const customCreateElement = function (tagName) {
            const el = originalCreateElement.apply(this, arguments);
            if (el && tagName && (tagName.toLowerCase() === 'video' || tagName.toLowerCase() === 'audio')) {
              neutralizeElement(el);
            }
            return el;
          };
          makeNativeToString(customCreateElement, originalCreateElement);
          originalDefineProperty(win.document, 'createElement', {
            value: customCreateElement,
            writable: false,
            configurable: false,
            enumerable: true
          });

          const originalCreateElementNS = win.document.createElementNS;
          const customCreateElementNS = function (namespaceURI, qualifiedName) {
            const el = originalCreateElementNS.apply(this, arguments);
            if (el && qualifiedName && (qualifiedName.toLowerCase() === 'video' || qualifiedName.toLowerCase() === 'audio')) {
              neutralizeElement(el);
            }
            return el;
          };
          makeNativeToString(customCreateElementNS, originalCreateElementNS);
          originalDefineProperty(win.document, 'createElementNS', {
            value: customCreateElementNS,
            writable: false,
            configurable: false,
            enumerable: true
          });
        } catch (err) {}
      }

      // 6. Intercept Object.defineProperty and Object.defineProperties to prevent instance shadowing
      try {
        const originalObjectDefineProperty = win.Object.defineProperty;
        const customObjectDefineProperty = function (obj, prop, descriptor) {
          if (obj instanceof win.HTMLMediaElement && (prop === 'play' || prop === 'autoplay')) {
            // Block shadowing native properties directly on media instances
            return obj;
          }
          return originalObjectDefineProperty.apply(this, arguments);
        };
        makeNativeToString(customObjectDefineProperty, originalObjectDefineProperty);
        win.Object.defineProperty = customObjectDefineProperty;
      } catch (err) {}

      // 7. Register global capturing play listener as fail-safe
      registerGlobalPlayListener(win);

      // 8. Scan and neutralize pre-existing media elements in this window context
      if (win.document) {
        try {
          const originalQuerySelectorAll = win.Document.prototype.querySelectorAll || win.document.querySelectorAll;
          originalQuerySelectorAll.call(win.document, 'video, audio').forEach(neutralizeElement);
        } catch (err) {}
        
        // Observe this document for dynamic elements
        observeDOM(win.document);
      }

    } catch (e) {}
  }

  // Register global capturing play listener as fail-safe
  function registerGlobalPlayListener(win) {
    try {
      const originalAddEventListener = win.EventTarget.prototype.addEventListener;
      const originalPause = win.HTMLMediaElement.prototype.pause;

      originalAddEventListener.call(win, 'play', function (e) {
        const path = e.composedPath ? e.composedPath() : [];
        const target = path.length > 0 ? path[0] : e.target;
        
        if (target && (target.tagName === 'VIDEO' || target.tagName === 'AUDIO')) {
          if (!isUserInitiated()) {
            try {
              originalPause.call(target);
            } catch (err) {}
          }
        }
      }, { capture: true, passive: false });
    } catch (e) {}
  }

  // Helper to override contentWindow / contentDocument on frame prototypes defensively
  const overrideFrameGetters = (proto) => {
    if (!proto) return;
    try {
      const descriptorWindow = originalGetOwnPropertyDescriptor(proto, 'contentWindow');
      if (descriptorWindow && descriptorWindow.get) {
        const originalGet = descriptorWindow.get;
        originalDefineProperty(proto, 'contentWindow', {
          get() {
            const win = originalGet.call(this);
            if (win) applyOverridesToWindow(win);
            return win;
          },
          configurable: false,
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
            const doc = originalGet.call(this);
            if (doc && doc.defaultView) applyOverridesToWindow(doc.defaultView);
            return doc;
          },
          configurable: false,
          enumerable: true
        });
      }
    } catch (e) {}
  };

  // 1. Override main window immediately
  applyOverridesToWindow(window);

  // 2. Override contentWindow/contentDocument getters defensively on all potential frame/object elements
  overrideFrameGetters(HTMLIFrameElement.prototype);
  if (typeof HTMLFrameElement !== 'undefined') overrideFrameGetters(HTMLFrameElement.prototype);
  if (typeof HTMLObjectElement !== 'undefined') overrideFrameGetters(HTMLObjectElement.prototype);
  if (typeof HTMLEmbedElement !== 'undefined') overrideFrameGetters(HTMLEmbedElement.prototype);

  // 3. Override window.open defensively to catch clean prototype stealing from popups
  try {
    const originalWindowOpen = window.open;
    originalDefineProperty(window, 'open', {
      value: function () {
        const win = originalWindowOpen.apply(this, arguments);
        if (win) {
          try {
            applyOverridesToWindow(win);
          } catch (e) {}
        }
        return win;
      },
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch (e) {}

  // 4. Scan and neutralize existing elements in the main window
  const scanAndNeutralize = () => {
    try {
      const originalQuerySelectorAll = Document.prototype.querySelectorAll;
      originalQuerySelectorAll.call(document, 'video, audio').forEach(neutralizeElement);
      originalQuerySelectorAll.call(document, 'iframe, frame, object, embed').forEach(frame => {
        if (frame.contentWindow) {
          applyOverridesToWindow(frame.contentWindow);
        }
      });
    } catch (e) {}
  };
  scanAndNeutralize();
  document.addEventListener('DOMContentLoaded', scanAndNeutralize);
})();
