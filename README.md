# Autoplay Blocker Extension

A lightweight, robust, and stealthy Chrome Extension (Manifest V3) that stops autoplaying video and audio elements on all websites, including platforms that use Shadow DOM (such as YouTube).

## How It Works

Traditional autoplay blockers often fail because websites use dynamic element injection, custom media players, or place media elements inside isolated **Shadow DOMs**. This extension solves these issues by intercepting browser-native media behaviors at the prototype level.

### Key Technical Mechanisms

1. **Main World Execution (`world: "MAIN"`)**
   The extension injects `content.js` directly into the page's execution context (the Main World) rather than the standard extension Isolated World. This allows the extension to modify prototype objects (`HTMLMediaElement.prototype`) that the page's own scripts interact with.

2. **Prototype `play()` Interception**
   The extension intercepts `HTMLMediaElement.prototype.play`. When a site attempts to play a video or audio file:
   - It checks if the call was triggered by a genuine user interaction (using `navigator.userActivation` and local event listeners).
   - If user activation is absent, it forces a `.pause()` and rejects the promise with a `NotAllowedError` (`DOMException`), simulating native browser block behaviors.

3. **Disabling Native `autoplay` Property**
   It overrides the `autoplay` property descriptor on `HTMLMediaElement.prototype`. Regardless of what value a site assigns to it, the property getter always returns `false`. This prevents the browser engine from triggering native playback on elements created with `<video autoplay>`.

4. **Shadow DOM Trapping (`attachShadow` Overriding)**
   Modern websites wrap players inside Shadow DOMs to encapsulate styling and prevent extensions from styling or selecting them. The extension overrides `Element.prototype.attachShadow` to capture dynamically created ShadowRoots and attach `MutationObserver` trackers to them, ensuring elements inside Shadow DOMs are neutralized as soon as they appear.

5. **Stealth/Anti-Detection**
   Many websites look for extension-overridden properties by checking their string representation (`Function.prototype.toString()`). The extension overrides `.toString()` on modified methods (`play` and `attachShadow`) to output native representations (e.g. `function play() { [native code] }`), hiding the extension from detection scripts.

6. **Smart User Interaction Window**
   Captures window events (`click`, `keydown`, `mousedown`, `pointerdown`, `touchend`) to register a local interaction timestamp. If a play action occurs within 3 seconds of a physical interaction, it is permitted, keeping desired plays functional.

## Installation

To run this extension locally:

1. Open Google Chrome (or any Chromium-based browser like Helium, Brave, Edge, Opera).
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** in the top-left corner.
5. Select the `autoplay-block` folder directory.
6. The extension is now active and blocking autoplay on all websites!

## Files in this Repository

- **[manifest.json](manifest.json)**: Extension configurations (Manifest V3), registering the content script to load at `document_start` in all frames within the main world.
- **[content.js](content.js)**: The core script that overrides prototypes, watches the DOM, and implements the interaction filters.
- **[.gitignore](.gitignore)**: Prevents OS/IDE metadata from being tracked in git.
