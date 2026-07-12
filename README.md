# Autoplay Blocker Extension

A lightweight, robust, and stealthy Chrome Extension (Manifest V3) that stops autoplaying video and audio elements on all websites, including platforms that use Shadow DOM (such as YouTube).

## How It Works

Traditional autoplay blockers often fail because websites use dynamic element injection, custom media players, or place media elements inside isolated **Shadow DOMs** or **Child Frames**. This extension solves these issues by intercepting browser-native media behaviors and event paths at the prototype and instance levels.

### Key Technical Mechanisms

1. **Main World Execution (`world: "MAIN"`)**
   The extension injects `content.js` directly into the page's execution context (the Main World) rather than the standard extension Isolated World. This allows the extension to modify prototype objects (`HTMLMediaElement.prototype`) that the page's own scripts interact with.

2. **Recursive Window & Frame Trapping**
   Injected scripts automatically propagate through all frame hierarchies. Using `"match_about_blank": true`, the extension injects into dynamic blank/srcdoc frames. We also defensively override getters on `HTMLIFrameElement`, `HTMLFrameElement`, `HTMLObjectElement`, and `HTMLEmbedElement` prototypes to synchronously lock down child windows before page scripts can steal clean prototypes.

3. **Instance Property Shadowing Prevention**
   Many scripts bypass prototype modifications by defining native methods directly on video element instances (e.g. `Object.defineProperty(video, 'play', { value: nativePlay })`). The extension intercepts `Object.defineProperty` on `HTMLMediaElement` instances to block this shadowing vector.

4. **Instant Creation Traps**
   We override `document.createElement` and `document.createElementNS` to neutralize media elements synchronously at the exact moment they are created in JavaScript memory, preventing players from setting up autoplay configurations before they are returned to the caller script.

5. **Locked Non-Configurable Overrides**
   All prototype hooks (`play`, `autoplay`, `setAttribute`, `attachShadow`, `contentWindow`, `contentDocument`) are defined using non-configurable and non-writable descriptors. Webpages cannot delete, overwrite, or redefine them.

6. **Absolute Fail-Safe Capturing Listener**
   A global `play` event capturing listener is registered at the `window` level of all hooked contexts. When any video or audio element begins playing:
   - It captures the event first (before any page scripts can execute event prevention).
   - It resolves the target via `e.composedPath()[0]` to traverse Shadow DOM boundaries.
   - It pauses the element if the play action is not user-initiated.

7. **Strict Trusted User Interaction Filter**
   We listen for physical interactions (`click`, `keydown`, `mousedown`, `pointerdown`, `touchend`) on the window and record a timestamp only if `e.isTrusted === true`, filtering out script-dispatched programmatic events. We ignore `navigator.userActivation.isActive` to prevent the browser from carrying over activation states from navigation clicks or reloads.

## Installation

To run this extension locally:

1. Open Google Chrome (or any Chromium-based browser).
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** in the top-left corner.
5. Select the `autoplay-block` folder directory.
6. The extension is now active and blocking autoplay on all websites!

## Files in this Repository

- **[manifest.json](manifest.json)**: Extension configurations (Manifest V3), registering the content script to load at `document_start` in all frames, including blank frames.
- **[content.js](content.js)**: The core script that overrides prototypes, hooks frames, traps element creation, and enforces interaction checks.
