# Autoplay Blocker

Chrome MV3 extension that blocks autoplaying audio and video, including in iframes and Shadow DOM.

## Layout
- `src/content/`: ES modules for the MAIN world content script. `content.js` at the repo root is GENERATED. Never edit it by hand.
- `src/shared/settings.js`: pure helpers (host normalization, exclusion patterns) plus storage access. Used by the service worker, popup, and options page.
- `background.js`: service worker. Registers the content script dynamically with `chrome.scripting`, applying the allowlist as `excludeMatches`.
- `src/popup/`, `src/options/`: toolbar popup and options page.
- `scripts/build.mjs`: esbuild bundle plus manifest version sync. `scripts/delegate.sh` and `scripts/review.sh`: agent delegation helpers.
- `tests/`: `node --test` unit tests.

## Commands
- `pnpm install`, `pnpm build`, `pnpm test`
- Load unpacked from the repo root in `chrome://extensions/` after `pnpm build`. Reload the extension after rebuilding.

## Rules
- The version lives in `package.json`. The build writes it into `manifest.json`.
- There is no static `content_scripts` entry in the manifest. The script is registered at runtime. Do not add one, or it will inject twice.
- Do not make hooks non-configurable. It breaks legitimate sites.
- Natives must be captured at module load, before page scripts run. `natives.js` is imported first.
- `declarativeNetRequest` cannot disable content scripts, so it is not used.
- Specs, plans, and notes go in `.superpowers/` (gitignored). `tasks/` and `.orchestration/` are also gitignored.
- Never commit to `main`. Use a branch and a PR.
