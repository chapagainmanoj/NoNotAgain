# NoNotAgain 🛑

**NoNotAgain** is a lightweight Chrome and Edge extension with two jobs:

- **Block distractions with your own words.** When you open a site you've chosen, it pauses on a
  page showing your note, a motivational quote, or both. Continue for a while, or turn back.
- **Keep notes for any website.** They show up in the side panel whenever you're on that site, and
  the toolbar icon shows how many there are.

Everything stays in your browser. Nothing is sent to a server.

---

## Features

- 🚫 Block a site with a personal note, a motivational quote, or both
- ⏱ Bypass for 1 hour, 6 hours, a day or a week; blocking resumes automatically
- 📝 Site notes in the side panel, with search across all notes
- 🖱 Right-click to add a note or save selected text
- 🔢 Toolbar badge with the note count for the current page
- 💾 Export and import everything as a JSON file

---

## 🧩 Installation (Developer Mode)

1. Clone or download the NoNotAgain folder containing the extension files.
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the `src` folder
5. Voilà! The extension icon should appear click it to add/remind notes

---

## How to Use

**Block a site:** open the site, click the toolbar icon, then **Block Site**. Choose what the block
page shows and write your note.

**Take site notes:** click **Open Notes** in the popup, press Alt+Shift+N, or right-click the page
and choose **Add note**. Notes appear on every page of that site.

**Back up:** Settings → **Export to file**. Site notes are stored only on this device; blocked
sites and your quotes sync through Chrome.

---

## Development

Requires Node 22 and pnpm.

```sh
pnpm install
pnpm check   # lint, format check, tests
pnpm zip     # builds dist/no-not-again-<version>.zip for store upload
pnpm icons   # re-renders src/icons/*.png from assets/icon.svg (needs rsvg-convert)
```

- Extension source lives in `src/` (Manifest V3, no build step)
- Storage layout is documented at the top of `src/storage.js`
- `background.js` keeps `declarativeNetRequest` redirect rules, the badge and context menus in sync
- `popup.*` manages blocked sites, `sidepanel.*` site notes, `options.*` quotes and backup
- `note-page.*` is the block page

---

## 📝 LICENSE & CONTRIBUTING

Released under the [MIT License](LICENSE). Feel free to fork, tweak, or contribute enhancements. Pull requests are welcome!

---

Enjoy staying focused with NoNotAgain!
