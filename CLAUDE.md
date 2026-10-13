# NoNotAgain

Chrome/Edge MV3 extension: shows a personal note before a site loads. Plain JS, no build step.

## Commands (pnpm — `npm` is aliased to pnpm locally)

- `pnpm check` — lint + format check + tests; run before committing
- `pnpm zip` — store package in `dist/`; fails if `package.json` and `src/manifest.json` versions differ
- `pnpm icons` — re-render `src/icons/*.png` from `assets/icon.svg`

## Layout

- `src/` is exactly what ships; load it unpacked from `chrome://extensions`
- `domain.js` (URL/domain logic), `storage.js` (storage key layout, data access, migration, export/import) and `quotes.js` are the unit-tested modules; pages import them. All scripts are ES modules
- `background.js` builds `declarativeNetRequest` redirect rules to `note-page.html`; a `tabs.onUpdated` fallback catches misses
- Two features: blocking (`popup`, `note-page`; rules in sync storage) and site notes (`sidepanel`; local storage, one list per hostname). `options` = quotes + backup
- Read/write persistent data only through `storage.js`; the key layout is documented at its top

## Design

- All pages load `theme.css` first (color tokens, light/dark, buttons, inputs, toast); page CSS only adds layout. Use the tokens, no hard-coded colors or emoji

## Gotchas

- `privacy-policy.md` is served to the Chrome Web Store from the **`develop`** branch raw URL — don't move, rename, or delete it or that branch
- Store rejects re-uploads with the same version: bump both version fields and `CHANGELOG.md` for every release
- Sync storage limits: 8 KB per item, 100 KB total — only small data (blocks, settings) goes there
- `chrome.sidePanel.open()` must run synchronously inside a user gesture (no `await` before it)
- Render user text with `textContent`, never `innerHTML`
