# NoNotAgain

Chrome/Edge MV3 extension: shows a personal note before a site loads. Plain JS, no build step.

## Commands (pnpm — `npm` is aliased to pnpm locally)

- `pnpm check` — lint + format check + tests; run before committing
- `pnpm zip` — store package in `dist/`; fails if `package.json` and `src/manifest.json` versions differ
- `pnpm icons` — re-render `src/icons/*.png` from `assets/icon.svg`

## Layout

- `src/` is exactly what ships; load it unpacked from `chrome://extensions`
- `domain.js` holds shared logic (normalizing, matching, rule building); it's the unit-tested part. All scripts are ES modules
- `background.js` builds `declarativeNetRequest` redirect rules to `note-page.html`; a `tabs.onUpdated` fallback catches misses
- Notes: `chrome.storage.sync`, keyed by bare hostname (no `www.`). Bypasses: `chrome.storage.local` as `bypass_<domain>`

## Gotchas

- `privacy-policy.md` is served to the Chrome Web Store from the **`develop`** branch raw URL — don't move, rename, or delete it or that branch
- Store rejects re-uploads with the same version: bump both version fields and `CHANGELOG.md` for every release
- Sync storage limits: 8 KB per note, 100 KB total
- Render user text with `textContent`, never `innerHTML`
