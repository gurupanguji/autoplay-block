# Exclude Conferencing Sites Design

## Goal

Prevent the autoplay-blocking hooks from running on Google Meet, Microsoft Teams, and Zoom so remote WebRTC video is not paused or rejected by the extension.

## Scope

The extension will exclude these conferencing hosts from content-script injection:

- `meet.google.com` and its subdomains
- `teams.microsoft.com` and its subdomains
- `teams.live.com` and its subdomains
- `teams.cloud.microsoft` and its subdomains
- `zoom.us` and its subdomains
- `zoom.com` and its subdomains

The exclusion will not cover parent domains such as `google.com` or `microsoft.com`, and it will not change behavior on unrelated sites.

## Design

Add a Manifest V3 `exclude_matches` array to the existing content-script declaration. Use exact-host and subdomain match patterns for each conferencing host. Chrome will skip injecting `content.js` when a page URL matches an excluded pattern, so the extension will not modify media prototypes, event listeners, DOM observers, or frame getters on those pages.

This is preferable to a runtime guard because it prevents partial initialization and avoids relying on page JavaScript to determine whether hooks should be removed.

## Validation

Validate that:

1. `manifest.json` remains valid JSON.
2. Every listed conferencing host has an exact-host and subdomain exclusion pattern.
3. Representative conferencing URLs are covered.
4. Nearby unrelated URLs, including `www.google.com`, `teams.microsoft.com.example.com`, and `zoom.us.example.com`, are not accidentally covered.
5. The content script and manifest remain unchanged outside the intended exclusion configuration.

## Non-goals

- Do not change autoplay behavior on other sites.
- Do not modify the media interception implementation.
- Do not add site-specific handling for individual meeting rooms or account pages.
