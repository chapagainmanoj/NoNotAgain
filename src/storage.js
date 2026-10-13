// Storage layout and data access.
//
// sync  (small, follows the user across devices)
//   block:<domain>   { text, show: 'note' | 'quote' | 'both', createdAt, updatedAt }
//   settings         { customQuotes: string[], builtInQuotes: boolean }
// local (larger, this device only)
//   bypass:<domain>  { expireTime, createdAt }
//   site:<hostname>  { notes: Note[] }   hostname without "www."; one list of notes per site
// Note = { id, text, createdAt, updatedAt }

import { domainFromUrl, normalizeDomain } from './domain.js';

export const SHOW_OPTIONS = ['note', 'quote', 'both'];
export const DEFAULT_SETTINGS = { customQuotes: [], builtInQuotes: true };
export const EXPORT_FORMAT = 'no-not-again';
export const EXPORT_VERSION = 2;

const BLOCK = 'block:';
const BYPASS = 'bypass:';
const SITE = 'site:';
const SETTINGS = 'settings';

export const blockKey = (domain) => BLOCK + domain;
export const bypassKey = (domain) => BYPASS + domain;
export const siteKey = (hostname) => SITE + hostname;

export const isNoteKey = (key) => key.startsWith(SITE);

function withPrefix(items, prefix) {
    const out = {};
    for (const [key, value] of Object.entries(items)) {
        if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
    }
    return out;
}

function newId() {
    return crypto.randomUUID();
}

// ---- Blocking rules (sync) ----

export async function getBlocks() {
    return withPrefix(await chrome.storage.sync.get(null), BLOCK);
}

export async function getBlock(domain) {
    const key = blockKey(domain);
    return (await chrome.storage.sync.get(key))[key];
}

export async function saveBlock(domain, { text, show }, previousDomain) {
    const now = new Date().toISOString();
    const previous =
        (await getBlock(domain)) || (previousDomain && (await getBlock(previousDomain)));
    await chrome.storage.sync.set({
        [blockKey(domain)]: {
            text,
            show: SHOW_OPTIONS.includes(show) ? show : 'note',
            createdAt: previous?.createdAt || now,
            updatedAt: now,
        },
    });
    // The domain was changed while editing: drop the rule stored under the old one.
    if (previousDomain && previousDomain !== domain) await removeBlock(previousDomain);
}

export async function removeBlock(domain) {
    await chrome.storage.sync.remove(blockKey(domain));
    await chrome.storage.local.remove(bypassKey(domain));
}

// ---- Bypasses (local) ----

export async function getBypasses() {
    return withPrefix(await chrome.storage.local.get(null), BYPASS);
}

export async function getBypass(domain) {
    const key = bypassKey(domain);
    return (await chrome.storage.local.get(key))[key];
}

export async function setBypass(domain, duration) {
    const now = Date.now();
    await chrome.storage.local.set({
        [bypassKey(domain)]: { expireTime: now + duration, createdAt: now },
    });
}

export async function removeBypasses(domains) {
    if (domains.length) await chrome.storage.local.remove(domains.map(bypassKey));
}

// ---- Settings (sync) ----

export async function getSettings() {
    const { [SETTINGS]: settings } = await chrome.storage.sync.get(SETTINGS);
    return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(changes) {
    await chrome.storage.sync.set({ [SETTINGS]: { ...(await getSettings()), ...changes } });
}

// ---- Site notes (local) ----

// The site and its notes for a tab's URL, or null for non-web pages.
export async function getSiteNotes(url) {
    const hostname = domainFromUrl(url);
    if (!hostname) return null;
    const key = siteKey(hostname);
    const { [key]: entry } = await chrome.storage.local.get(key);
    return { hostname, notes: entry?.notes || [] };
}

async function writeNotes(hostname, notes) {
    const key = siteKey(hostname);
    if (notes.length) {
        await chrome.storage.local.set({ [key]: { notes } });
    } else {
        await chrome.storage.local.remove(key);
    }
}

async function readNotes(hostname) {
    const key = siteKey(hostname);
    return (await chrome.storage.local.get(key))[key]?.notes || [];
}

export async function addNote(hostname, text) {
    const now = new Date().toISOString();
    const note = { id: newId(), text, createdAt: now, updatedAt: now };
    await writeNotes(hostname, [...(await readNotes(hostname)), note]);
}

export async function updateNote(hostname, id, text) {
    const now = new Date().toISOString();
    const notes = (await readNotes(hostname)).map((note) =>
        note.id === id ? { ...note, text, updatedAt: now } : note,
    );
    await writeNotes(hostname, notes);
}

export async function deleteNote(hostname, id) {
    await writeNotes(
        hostname,
        (await readNotes(hostname)).filter((note) => note.id !== id),
    );
}

// Every note on every site, newest first, for the "All notes" view and search.
export async function getAllNotes() {
    const items = await chrome.storage.local.get(null);
    const all = [];
    for (const [key, entry] of Object.entries(items)) {
        if (!isNoteKey(key)) continue;
        const hostname = key.slice(SITE.length);
        for (const note of entry.notes) all.push({ ...note, hostname });
    }
    return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

// ---- Migration from 1.x ----

// 1.x stored each blocking note under its bare domain in sync and bypasses as "bypass_<domain>"
// in local. Returns the writes needed to move them to the 2.0 layout.
export function planMigration(syncItems, localItems) {
    const sync = { set: {}, remove: [] };
    const local = { remove: [] };

    for (const [key, value] of Object.entries(syncItems)) {
        if (key === SETTINGS || key.startsWith(BLOCK)) continue;
        sync.remove.push(key);
        const domain = normalizeDomain(key);
        if (!domain || !value?.text) continue;
        const target = blockKey(domain);
        if (syncItems[target] || sync.set[target]) continue;
        sync.set[target] = { show: 'note', ...value };
    }

    // Bypasses are temporary; old-format ones are dropped rather than converted.
    local.remove = Object.keys(localItems).filter((key) => key.startsWith('bypass_'));

    return { sync, local };
}

export async function migrateFrom1x() {
    const [syncItems, localItems] = await Promise.all([
        chrome.storage.sync.get(null),
        chrome.storage.local.get(null),
    ]);
    const { sync, local } = planMigration(syncItems, localItems);
    if (Object.keys(sync.set).length) await chrome.storage.sync.set(sync.set);
    if (sync.remove.length) await chrome.storage.sync.remove(sync.remove);
    if (local.remove.length) await chrome.storage.local.remove(local.remove);
    return { moved: Object.keys(sync.set).length, removed: sync.remove.length };
}

// ---- Export / import ----

export async function exportData() {
    const [syncItems, localItems] = await Promise.all([
        chrome.storage.sync.get(null),
        chrome.storage.local.get(null),
    ]);
    const notes = {};
    for (const [key, value] of Object.entries(localItems)) {
        if (isNoteKey(key)) notes[key] = value;
    }
    return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        blocks: withPrefix(syncItems, BLOCK),
        settings: syncItems[SETTINGS] || DEFAULT_SETTINGS,
        notes,
    };
}

// Merges an export into the current data. Imported blocking rules replace same-domain ones;
// notes are merged by id so importing the same file twice doesn't duplicate anything.
export function planImport(data, currentLocal) {
    if (data?.format !== EXPORT_FORMAT || typeof data.version !== 'number') {
        throw new Error('This file is not a No Not Again export.');
    }
    if (data.version > EXPORT_VERSION) {
        throw new Error('This file comes from a newer version of No Not Again. Update first.');
    }

    const sync = {};
    for (const [rawDomain, block] of Object.entries(data.blocks || {})) {
        const domain = normalizeDomain(rawDomain);
        if (domain && typeof block?.text === 'string') sync[blockKey(domain)] = block;
    }
    if (data.settings) sync[SETTINGS] = { ...DEFAULT_SETTINGS, ...data.settings };

    const local = {};
    let noteCount = 0;
    for (const [key, entry] of Object.entries(data.notes || {})) {
        if (!isNoteKey(key) || !Array.isArray(entry?.notes)) continue;
        const existing = currentLocal[key] || { notes: [] };
        const ids = new Set(existing.notes.map((note) => note.id));
        const added = entry.notes
            .filter((note) => typeof note?.text === 'string' && !ids.has(note.id))
            .map((note) => (note.id ? note : { ...note, id: newId() }));
        if (!added.length) continue;
        noteCount += added.length;
        local[key] = { ...entry, ...existing, notes: [...existing.notes, ...added] };
    }

    return {
        sync,
        local,
        blockCount: Object.keys(sync).filter((k) => k.startsWith(BLOCK)).length,
        noteCount,
    };
}

export async function importData(data) {
    const currentLocal = await chrome.storage.local.get(null);
    const plan = planImport(data, currentLocal);
    if (Object.keys(plan.sync).length) await chrome.storage.sync.set(plan.sync);
    if (Object.keys(plan.local).length) await chrome.storage.local.set(plan.local);
    return { blocks: plan.blockCount, notes: plan.noteCount };
}
