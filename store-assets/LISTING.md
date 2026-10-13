# Chrome Web Store listing — v2.0.0

Upload: `dist/no-not-again-2.0.0.zip` (or the zip attached to the `v2.0.0` GitHub release).

## Store listing tab

**Summary** (comes from the manifest, max 132 characters):

> Block distractions with your own words or a motivational quote, and keep notes on any web page.

**Category:** Productivity → Workflow & Planning

**Language:** English

**Description:**

```
Stop drifting to distracting sites, in your own words.

No Not Again puts a short pause in front of the sites you keep opening without meaning to. Instead of a harsh "blocked" screen, you see a note you wrote to yourself, a motivational quote, or both. Go back, or continue for a while. Blocking resumes on its own.

It also keeps notes for any website, so the things you need to remember about a site are right there when you return.

BLOCK DISTRACTIONS
• Block a site in two clicks from the toolbar
• Show your own note, a motivational quote, or both
• About 40 built-in quotes, plus your own
• Continue for 1 hour, 6 hours, a day or a week; blocking comes back automatically
• Subdomains are covered too (blocking youtube.com also covers m.youtube.com)

SITE NOTES
• Open the side panel on any website to add notes for that site
• Notes appear on every page of the site, and the toolbar icon shows how many there are
• Right-click any page to add a note, or save selected text as a note
• Search across all your notes
• Keyboard shortcut: Alt+Shift+N

PRIVATE BY DESIGN
• No account, no analytics, no servers
• Site notes stay on your device; blocked sites and quotes sync through your Chrome profile
• Export and import everything as a file for backup

Open source: https://github.com/chapagainmanoj/NoNotAgain
```

**Graphic assets** (all in this folder):

- Store icon: `src/icons/icon-128.png`
- Screenshots (1280×800): `screenshot-1-block-page.png`, `screenshot-2-site-notes.png`,
  `screenshot-3-popup.png`
- Small promo tile (440×280): `promo-tile-440x280.png`

**Homepage URL:** https://manojc.link/projects/no-not-again

**Support URL:** https://github.com/chapagainmanoj/NoNotAgain/issues

## Privacy practices tab

**Single purpose description:**

```
No Not Again helps people browse with intention by attaching their own notes to websites: it shows the user's note (or a motivational quote) before a site they chose to limit, and keeps the user's notes for any site in the side panel.
```

**Permission justifications:**

| Permission                                    | Justification                                                                                                                                                                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                     | Saves the user's blocked sites, notes, quote settings and temporary bypasses in the browser (sync storage for blocked sites and settings, local storage for site notes).                                                                     |
| `alarms`                                      | Schedules the end of a temporary bypass so blocking turns back on automatically when the time the user chose is up.                                                                                                                          |
| `declarativeNetRequest`                       | Redirects navigations to sites the user chose to block to the extension's own pause page, which shows the user's note. Rules are built only from sites the user added.                                                                       |
| `sidePanel`                                   | Shows the user's notes for the current website in Chrome's side panel.                                                                                                                                                                       |
| `contextMenus`                                | Adds "Add note" and "Save selection as note" to the right-click menu so users can save notes for the current site.                                                                                                                           |
| Host permission (`http://*/*`, `https://*/*`) | Needed for the redirect rules to apply to whichever sites the user chooses to block, and to read the current tab's address to show that site's note count and notes. Page content is never read or modified, and no data leaves the browser. |

**Remote code:** No, I am not using remote code.

**Data usage:**

- Data collected: the extension reads the current tab's address (web history) only to match it
  against the user's blocked sites and notes, entirely on the device. Keep the "Web history" box
  that the 1.0 listing already declared. If a reviewer says local-only processing doesn't count as
  collection, unchecking it is also defensible.
- Certify all three: not sold to third parties; not used for unrelated purposes; not used for
  creditworthiness or lending.

**Privacy policy URL:** https://manojc.link/projects/no-not-again#privacy

## Notes for the reviewer (optional field)

```
Version 2.0 adds site notes (side panel) and motivational quotes on the pause page. To test: click the toolbar icon on any site and choose "Block site", then reload the site to see the pause page. Open the side panel with Alt+Shift+N to add a note. All data is stored with chrome.storage; nothing is sent over the network.
```
