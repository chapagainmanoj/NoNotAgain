# NoNotAgain 🛑

**NoNotAgain** is a lightweight Chrome extension that lets you attach a custom note to any website. When you visit a site with a note set, the extension momentarily blocks the site and displays your note helping you stay focused.

---

## Features

- ✅ Set and edit a motivational or reminder note for any website/domain
- 🚫 Automatically interrupts access to the site and shows the note
- 🛠️ Add or remove notes easily through the extension popup

---

## 🧩 Installation (Developer Mode)

1. Clone or download the NoNotAgain folder containing the extension files.
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the `src` folder
5. Voilà! The extension icon should appear click it to add/remind notes

---

## How to Use

1. Click the NoNotAgain icon in the toolbar
2. In the popup, enter a domain (e.g., `example.com`) and your note
3. Save it—next time you open that site, the note page will show briefly
4. To remove a note, simply click “Remove” next to the domain in the popup

---

## Suggested Workflow

- 🎯 Use for productivity: set reminders like “Focus on task, not Instagram.”
- ⏱ Temporarily block sites only when you need to concentrate
- 🔄 Notes are easily updated or deleted via the toolbar popup

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
- Notes are stored in `chrome.storage.sync`; temporary bypasses in `chrome.storage.local`
- Background script uses `declarativeNetRequest` rules to redirect site loads to `note-page.html`
- Popup handles note management (add/edit/remove)
- Note page shows your custom message before redirecting to the site

---

## 📝 LICENSE & CONTRIBUTING

Released under the [MIT License](LICENSE). Feel free to fork, tweak, or contribute enhancements. Pull requests are welcome!

---

Enjoy staying focused with NoNotAgain!
