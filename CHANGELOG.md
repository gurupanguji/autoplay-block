# Changelog

## 2.0.0

- Toolbar popup: pause blocking globally or allow autoplay on the current site.
- Options page: manage the allowlist and see the built-in exclusions.
- Exclusions now live in `chrome.storage.sync` and the content script is registered dynamically (`chrome.scripting`), so the allowlist applies without editing the manifest.
- More built-in exclusions: Discord, Slack, Webex, Whereby, Jitsi (alongside Meet, Teams, Zoom).
- `content.js` is now generated from ES modules in `src/content/` by esbuild.
- Swallowed errors are logged at `console.debug` level with an `[autoplay-blocker]` prefix.
- Added icons and a descriptive manifest description. The manifest version is synced from `package.json` by the build.
- Specs and plans moved to the gitignored `.superpowers/` directory.

## 1.30 and earlier

See git history.
