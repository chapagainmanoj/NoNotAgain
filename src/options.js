// Options page: quotes, export/import, keyboard shortcut.
import { BUILT_IN_QUOTES } from './quotes.js';
import { exportData, getAllNotes, getSettings, importData, saveSettings } from './storage.js';

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
    $('builtInCount').textContent = `${BUILT_IN_QUOTES.length} quotes`;
    await Promise.all([loadQuotes(), loadUsage(), loadShortcut()]);

    $('saveQuotes').addEventListener('click', saveQuotes);
    $('exportBtn').addEventListener('click', exportToFile);
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', importFromFile);
    $('shortcutsLink').addEventListener('click', () =>
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }),
    );
});

function setStatus(id, text, isError = false) {
    const el = $(id);
    el.textContent = text;
    el.classList.toggle('error', isError);
}

// ---- Quotes ----

async function loadQuotes() {
    const settings = await getSettings();
    $('builtInQuotes').checked = settings.builtInQuotes;
    $('customQuotes').value = settings.customQuotes.join('\n');
}

async function saveQuotes() {
    const customQuotes = $('customQuotes')
        .value.split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    try {
        await saveSettings({ builtInQuotes: $('builtInQuotes').checked, customQuotes });
        setStatus('quotesStatus', 'Saved.');
    } catch (error) {
        console.error('Error saving quotes:', error);
        const full = /QUOTA/i.test(error.message);
        setStatus(
            'quotesStatus',
            full ? 'Too many quotes to sync. Remove some.' : 'Could not save.',
            true,
        );
    }
}

// ---- Backup ----

async function loadUsage() {
    const [notes, bytes] = await Promise.all([
        getAllNotes(),
        chrome.storage.local.getBytesInUse(null),
    ]);
    const kb = Math.max(1, Math.round(bytes / 1024));
    $('usage').textContent =
        `${notes.length} site note${notes.length === 1 ? '' : 's'}, using ${kb} KB on this device.`;
}

async function exportToFile() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `no-not-again-${new Date().toISOString().slice(0, 10)}.json`,
    });
    link.click();
    URL.revokeObjectURL(url);
    setStatus('backupStatus', 'Exported.');
}

async function importFromFile(event) {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;

    try {
        const result = await importData(JSON.parse(await file.text()));
        setStatus(
            'backupStatus',
            `Imported ${result.blocks} blocked sites and ${result.notes} notes.`,
        );
        await Promise.all([loadQuotes(), loadUsage()]);
    } catch (error) {
        console.error('Import failed:', error);
        const message =
            error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message;
        setStatus('backupStatus', message, true);
    }
}

// ---- Shortcut ----

async function loadShortcut() {
    const commands = await chrome.commands.getAll();
    const shortcut = commands.find((c) => c.name === 'open-notes')?.shortcut;
    $('shortcut').textContent = shortcut || 'not set';
}
