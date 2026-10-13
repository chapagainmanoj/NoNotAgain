# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased] - 2.0.0

### Added

- **Site notes**: keep notes for any website; they appear on every page of that site. Stored on
  this device.
- **Side panel** with the current site's notes, inline editing, and search across all notes. Open it from the popup, with Alt+Shift+N, or by right-clicking a page.
- Right-click menu: "Add note" and "Save selection as note".
- Toolbar badge showing how many notes exist for the current site.
- **Motivational quotes** on the block page: each blocked site can show your note, a quote, or both.
  About 40 built-in quotes plus your own (synced).
- Options page: quote settings, JSON export/import, storage usage, keyboard shortcut.
- Extension icons (16, 32, 48, 128 px).
- Development tooling: ESLint, Prettier, Vitest, release zip script, GitHub Actions CI.
- MIT license.

- After bypassing, you return to the exact page you opened, not the site's home page.
- Redirect rules are restored automatically when a bypass expires (new `alarms` permission).
- Existing 1.x notes move to the 2.0 storage layout automatically on update (URLs and `www.`
  names are re-keyed to the bare domain).

### Changed

- New minimal design shared by every page (`theme.css`), with automatic dark mode. The block page
  leads with your note, makes "Go back" the main action and tucks bypass options behind
  "Continue anyway".
- The popup is reorganized around blocking the current site and opening site notes.
- "Delete Note" on the block page is now "Stop Blocking".
- New permissions: `sidePanel`, `contextMenus`. Minimum Chrome version is 116.
- Extension source moved to `src/`; shared logic lives in `src/domain.js` with unit tests.
- Typed domains are normalized (`https://www.Example.com/x` → `example.com`) and validated.
- Notes match subdomains everywhere: the popup on `m.youtube.com` finds the `youtube.com` note.
- Notes are limited to 1,000 characters; a full sync storage shows a clear message.
- The popup explains when a browser page can't be blocked and recognizes the block page.
- Debug logging is off by default.

### Fixed

- Keyboard users can operate the note page buttons; Escape closes the bypass options or goes back.
- Changing a note's domain while editing no longer leaves a duplicate; edits keep `createdAt`.
- Notes and domains are rendered as text, so `<` and `&` display correctly.
- The bypass banner no longer duplicates after saving a note.
- Long domains wrap instead of squeezing the popup buttons.

### Removed

- `tabs` permission (host access already covers reading tab URLs).

## [1.0.1] - 2026-10-13

### Fixed

- Redirect rule now matches the bare domain as well as its subdomains.

### Removed

- Unused `content.js`.

## [1.0] - 2025-07-24

- Initial Chrome Web Store release.
