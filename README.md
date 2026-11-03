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

5. **Protected Overrides**
   Hooks (`play`, `autoplay`, `setAttribute`, `attachShadow`, `contentWindow`, `contentDocument`) are installed as configurable, writable properties on purpose, because non-configurable locks break legitimate sites. Page attempts to redefine `play` or `autoplay` on media elements are intercepted via `Object.defineProperty`, `defineProperties`, and `Reflect.defineProperty`.

6. **Absolute Fail-Safe Capturing Listener**
   A global `play` event capturing listener is registered at the `window` level of all hooked contexts. When any video or audio element begins playing:
   - It captures the event first (before any page scripts can execute event prevention).
   - It resolves the target via `e.composedPath()[0]` to traverse Shadow DOM boundaries.
   - It pauses the element if the play action is not user-initiated.

7. **Strict Trusted User Interaction Filter**
   We listen for physical interactions (`click`, `keydown`, `mousedown`, `pointerdown`, `touchend`) on the window and record a timestamp only if `e.isTrusted === true`, filtering out script-dispatched programmatic events. We ignore `navigator.userActivation.isActive` to prevent the browser from carrying over activation states from navigation clicks or reloads.

## Controls

- **Toolbar popup**: a global on/off switch, and a per-site switch for the current tab. Reload the tab to apply a change. The badge shows `OFF` when blocking is globally disabled.
- **Options page**: add or remove allowlisted sites. An entry such as `example.com` also covers its subdomains. Built-in exclusions are listed read-only.
- **Built-in exclusions**: Google Meet, Microsoft Teams, Zoom, Discord, Slack (`app.slack.com`), Webex, Whereby, and Jitsi (`meet.jit.si`), where blocking breaks calls. Edit `DEFAULT_EXCLUDED_HOSTS` in `src/shared/settings.js` to change them.

Settings live in `chrome.storage.sync`. The background service worker registers the content script with `chrome.scripting` and passes the allowlist as `excludeMatches`, so excluded sites never get the script at all. `declarativeNetRequest` is not used: it can only block or modify network requests, and cannot stop a content script from running.

## Installation

1. `pnpm install && pnpm build` (`content.js` is generated from `src/content/`).
2. Open `chrome://extensions/` in Chrome or another Chromium browser and enable **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. After rebuilding, click the reload icon on the extension card.

## Development

- `pnpm build`: bundle `src/content/index.js` into `content.js` and sync the manifest version from `package.json`.
- `pnpm test`: unit tests for the settings helpers and a bundle check.
- Bump the version with `pnpm version <patch|minor|major> --no-git-tag-version`, then `pnpm build`.
- Swallowed errors are logged with `console.debug` and an `[autoplay-blocker]` prefix. Enable the **Verbose** level in DevTools to see them.

## Known limitations

- Sites that rely on muted autoplay for core features (some feeds and previews) will show paused videos. Allow those sites from the popup.
- Sites that detect altered native functions may misbehave. Allow them, and please open an issue.
- User activation is honored for `ACTIVATION_WINDOW_MS` (3 seconds) after a trusted click, key, or touch.
- Chrome and Chromium only for now. Firefox would need MV3 `world: "MAIN"` support (Firefox 128+) and `browser_specific_settings`; it has not been tested.
- Changes to the allowlist apply to pages loaded after the change.

## Files in this Repository

- `manifest.json`: MV3 config (version is generated).
- `background.js`: service worker that registers the content script and applies the allowlist.
- `src/content/`: content script source modules. `content.js`: generated bundle, committed so Load unpacked works.
- `src/shared/settings.js`: host normalization, exclusion patterns, storage helpers.
- `src/popup/`, `src/options/`: toolbar popup and options page.
- `scripts/`: build and agent delegation helpers. `tests/`: unit tests.
