import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from './chrome-mock.js';
import {
    addNote,
    deleteNote,
    exportData,
    getAllNotes,
    getBlock,
    getBlocks,
    getSiteNotes,
    importData,
    planImport,
    planMigration,
    saveBlock,
    updateNote,
} from '../src/storage.js';

let chrome;
beforeEach(() => {
    chrome = installChromeMock();
});

describe('planMigration', () => {
    it('moves 1.x notes to block: keys with normalized domains', () => {
        const plan = planMigration(
            {
                'facebook.com': { text: 'Focus', createdAt: 'a' },
                'https://www.YouTube.com/': { text: 'No videos' },
                garbage: { text: 'x' },
            },
            { bypass_facebook_com: { expireTime: 1 }, other: 1 },
        );
        expect(plan.sync.set).toEqual({
            'block:facebook.com': { show: 'note', text: 'Focus', createdAt: 'a' },
            'block:youtube.com': { show: 'note', text: 'No videos' },
        });
        expect(plan.sync.remove.sort()).toEqual([
            'facebook.com',
            'garbage',
            'https://www.YouTube.com/',
        ]);
        expect(plan.local.remove).toEqual(['bypass_facebook_com']);
    });

    it('leaves 2.0 data alone and never overwrites an existing block', () => {
        const plan = planMigration(
            { 'block:x.com': { text: 'new' }, settings: {}, 'www.x.com': { text: 'old' } },
            {},
        );
        expect(plan.sync.set).toEqual({});
        expect(plan.sync.remove).toEqual(['www.x.com']);
    });
});

describe('blocks', () => {
    it('saves, keeps createdAt on edit, and moves on domain change', async () => {
        await saveBlock('a.com', { text: 'one', show: 'quote' });
        const first = await getBlock('a.com');
        expect(first.show).toBe('quote');

        await saveBlock('b.com', { text: 'two', show: 'bogus' }, 'a.com');
        expect(await getBlock('a.com')).toBeUndefined();
        const moved = await getBlock('b.com');
        expect(moved.show).toBe('note');
        expect(moved.createdAt).toBe(first.createdAt);
        expect(Object.keys(await getBlocks())).toEqual(['b.com']);
    });
});

describe('site notes', () => {
    const url = 'https://www.github.com/org/repo?utm_source=x#readme';

    it('adds, edits and deletes notes for the whole site', async () => {
        expect(await getSiteNotes(url)).toEqual({ hostname: 'github.com', notes: [] });

        await addNote('github.com', 'first');
        await addNote('github.com', 'second');

        // Any page on the site sees the same notes.
        const { notes } = await getSiteNotes('http://github.com/other/page');
        expect(notes.map((n) => n.text)).toEqual(['first', 'second']);

        await updateNote('github.com', notes[0].id, 'edited');
        expect((await getSiteNotes(url)).notes[0].text).toBe('edited');

        await deleteNote('github.com', notes[0].id);
        await deleteNote('github.com', notes[1].id);
        expect(chrome.storage.local.dump()['site:github.com']).toBeUndefined();
    });

    it('keeps subdomains separate', async () => {
        await addNote('github.com', 'main');
        expect((await getSiteNotes('https://gist.github.com/')).notes).toEqual([]);
    });

    it('returns null for browser pages', async () => {
        expect(await getSiteNotes('chrome://extensions')).toBeNull();
    });

    it('lists all notes with their site', async () => {
        await addNote('github.com', 'g');
        await addNote('x.com', 'x');
        const all = await getAllNotes();
        expect(all.map((n) => n.hostname).sort()).toEqual(['github.com', 'x.com']);
    });
});

describe('export and import', () => {
    it('round-trips without duplicating notes', async () => {
        await saveBlock('x.com', { text: 'stop', show: 'both' });
        await addNote('example.com', 'remember');

        const file = JSON.parse(JSON.stringify(await exportData()));
        expect(file.format).toBe('no-not-again');

        installChromeMock();
        expect(await importData(file)).toEqual({ blocks: 1, notes: 1 });
        expect(await importData(file)).toEqual({ blocks: 1, notes: 0 });
        expect((await getSiteNotes('https://example.com/a')).notes).toHaveLength(1);
        expect((await getBlock('x.com')).show).toBe('both');
    });

    it('rejects files that are not exports or come from a newer version', () => {
        expect(() => planImport({ hello: 1 }, {})).toThrow(/not a No Not Again export/);
        expect(() => planImport({ format: 'no-not-again', version: 99 }, {})).toThrow(
            /newer version/,
        );
    });

    it('skips invalid entries and gives notes without ids an id', () => {
        const plan = planImport(
            {
                format: 'no-not-again',
                version: 2,
                blocks: { 'not a domain': { text: 'x' }, 'ok.com': { text: 'y' } },
                notes: {
                    'evil:key': { notes: [{ id: '1', text: 'x' }] },
                    'page:old.com/a': { notes: [{ id: '3', text: 'old page note' }] },
                    'site:ok.com': { notes: [{ text: 'no id' }, { id: '2', text: 5 }] },
                },
            },
            {},
        );
        expect(Object.keys(plan.sync)).toEqual(['block:ok.com']);
        expect(Object.keys(plan.local)).toEqual(['site:ok.com']);
        expect(plan.local['site:ok.com'].notes).toHaveLength(1);
        expect(plan.local['site:ok.com'].notes[0].id).toBeTruthy();
    });
});
