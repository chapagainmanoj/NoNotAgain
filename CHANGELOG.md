# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Extension icons (16, 32, 48, 128 px).
- Development tooling: ESLint, Prettier, Vitest, release zip script, GitHub Actions CI.
- MIT license.

- After bypassing, you return to the exact page you opened, not the site's home page.
- Redirect rules are restored automatically when a bypass expires (new `alarms` permission).
- Existing notes saved under URLs or `www.` names are re-keyed to the bare domain on update.

### Changed

- Extension source moved to `src/`; shared logic lives in `src/domain.js` with unit tests.
- Typed domains are normalized (`https://www.Example.com/x` → `example.com`) and validated.
- Notes match subdomains everywhere: the popup on `m.youtube.com` finds the `youtube.com` note.
- Notes are limited to 1,000 characters; a full sync storage shows a clear message.
- The popup shows "Notes can't be added to this page" on browser pages and recognizes the note page.
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
