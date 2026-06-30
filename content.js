(function () {
  // Track user interactions to safely allow user-triggered play
  let lastUserInteraction = 0;
  const updateInteraction = () => {
    lastUserInteraction = Date.now();
  };

  const interactionEvents = ['click', 'keydown', 'mousedown', 'pointerdown', 'touchend'];
  interactionEvents.forEach(event => {
    window.addEventListener(event, updateInteraction, true);
  });

  // Helper to determine if play is user-initiated
  function isUserInitiated() {
    const transientActive = navigator.userActivation && navigator.userActivation.isActive;
    const recentlyClicked = Date.now() - lastUserInteraction < 3000;
    return !!(transientActive || recentlyClicked);
  }

  // Preserve native functions for override and toString stealth
  const originalPlay = HTMLMediaElement.prototype.play;
  const originalAttachShadow = Element.prototype.attachShadow;
  const originalAutoplayDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'autoplay');

  const makeNativeToString = (fn, originalFn) => {
    const originalString = originalFn.toString();
    Object.defineProperty(fn, 'toString', {
      value: function () { return originalString; },
      configurable: true,
      writable: true
    });
  };

  // 1. Override HTMLMediaElement.prototype.play
  const customPlay = function () {
    if (isUserInitiated()) {
      return originalPlay.apply(this, arguments);
    }
    
    // Autoplay blocked: force pause and reject play promise
    this.pause();
    return Promise.reject(
      new DOMException("Autoplay blocked by extension.", "NotAllowedError")
    );
  };
  makeNativeToString(customPlay, originalPlay);
  HTMLMediaElement.prototype.play = customPlay;

  // 2. Override autoplay property getter/setter to disable native autoplay
  Object.defineProperty(HTMLMediaElement.prototype, 'autoplay', {
    get() {
      return false; // Always report false to prevent native browser autoplay
    },
    set(value) {
      if (originalAutoplayDescriptor && originalAutoplayDescriptor.set) {
        originalAutoplayDescriptor.set.call(this, false);
      }
      this.removeAttribute('autoplay');
    },
    configurable: true,
    enumerable: true
  });

  // Helper to neutralize a media element
  function neutralizeElement(el) {
    if (!el) return;
    
    // Remove autoplay attribute so browser doesn't try to play it natively
    el.removeAttribute('autoplay');
    el.autoplay = false;

    // Pause immediately in case it has already started playing
    el.pause();

    // Catch any async play attempts
    el.addEventListener('play', function (e) {
      if (!isUserInitiated()) {
        el.pause();
      }
    }, { capture: true });
  }

  // Helper to set up MutationObserver on a target node (DOM or ShadowRoot)
  function observeDOM(root) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
            neutralizeElement(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('video, audio').forEach(neutralizeElement);
          }
        }
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });
  }

  // 3. Observe the main document immediately
  if (document.documentElement) {
    observeDOM(document.documentElement);
  }

  // 4. Override Element.prototype.attachShadow to handle Shadow DOM dynamically
  const customAttachShadow = function (init) {
    const shadowRoot = originalAttachShadow.call(this, init);
    if (shadowRoot) {
      observeDOM(shadowRoot);
    }
    return shadowRoot;
  };
  makeNativeToString(customAttachShadow, originalAttachShadow);
  Element.prototype.attachShadow = customAttachShadow;

  // Scan for any pre-existing elements when DOM is parsed or fully loaded
  const scanAndNeutralize = () => {
    document.querySelectorAll('video, audio').forEach(neutralizeElement);
  };
  scanAndNeutralize();
  document.addEventListener('DOMContentLoaded', scanAndNeutralize);
})();
