// Side panel: notes for the current site, plus search across all notes.
import { MAX_SITE_NOTE_LENGTH } from './domain.js';
import {
    addNote,
    deleteNote,
    getAllNotes,
    getSiteNotes,
    isNoteKey,
    updateNote,
} from './storage.js';

const $ = (id) => document.getElementById(id);

let windowId = null;
let currentTab = null; // { id, url }
let current = null; // { hostname, notes } for currentTab's site
let editing = false; // an inline edit is open; re-renders wait until it closes
let renderPending = false;

document.addEventListener('DOMContentLoaded', async () => {
    windowId = (await chrome.windows.getCurrent()).id;
    document.querySelectorAll('textarea').forEach((t) => (t.maxLength = MAX_SITE_NOTE_LENGTH));

    setupTabs();
    setupAddForm();
    $('search').addEventListener('input', renderAll);
    $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

    await loadActiveTab();
    await handlePendingAction();
});

// ---- Following the active tab ----

async function loadActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    currentTab = tab ? { id: tab.id, url: tab.url || '' } : null;
    await renderCurrent();
}

chrome.tabs.onActivated.addListener((info) => {
    if (info.windowId === windowId) loadActiveTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.windowId !== windowId || !tab.active) return;
    if (changeInfo.url) loadActiveTab();
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.keys(changes).some(isNoteKey)) scheduleRender();
    if (area === 'session' && changes.pendingAction?.newValue) handlePendingAction();
});

function scheduleRender() {
    if (editing) {
        renderPending = true;
        return;
    }
    renderCurrent();
    if (!$('viewAll').hidden) renderAll();
}

// ---- Rendering ----

function formatDate(iso) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function noteElement(note, hostname, target) {
    const item = $('noteTemplate').content.firstElementChild.cloneNode(true);
    item.querySelector('.note-text').textContent = note.text;
    item.querySelector('.note-date').textContent =
        (note.updatedAt !== note.createdAt ? 'Edited ' : '') + formatDate(note.updatedAt);

    if (target) {
        const link = item.querySelector('.note-target');
        link.textContent = target.label;
        link.href = target.url;
        link.title = target.url;
        link.hidden = false;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.update(currentTab?.id, { url: target.url });
        });
    }

    item.querySelector('[data-edit]').addEventListener('click', () =>
        startEdit(item, note, hostname),
    );
    item.querySelector('[data-delete]').addEventListener('click', async () => {
        if (confirm('Delete this note?')) await deleteNote(hostname, note.id);
    });
    return item;
}

function emptyItem(text) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = text;
    return empty;
}

async function renderCurrent() {
    current = currentTab ? await getSiteNotes(currentTab.url) : null;
    $('unavailable').hidden = Boolean(current);
    $('currentNotes').hidden = !current;
    if (!current) return;

    const { hostname, notes } = current;
    $('siteName').textContent = hostname;
    $('noteCount').textContent = notes.length ? `(${notes.length})` : '';
    $('noteList').replaceChildren(
        ...(notes.length
            ? notes.map((note) => noteElement(note, hostname))
            : [emptyItem('No notes for this site yet.')]),
    );
}

async function renderAll() {
    const query = $('search').value.trim().toLowerCase();
    const notes = (await getAllNotes()).filter(
        (note) =>
            !query || note.text.toLowerCase().includes(query) || note.hostname.includes(query),
    );

    const list = $('allList');
    if (!notes.length) {
        list.replaceChildren(emptyItem(query ? 'No notes match your search.' : 'No notes yet.'));
        return;
    }
    list.replaceChildren(
        ...notes.map((note) =>
            noteElement(note, note.hostname, {
                label: note.hostname,
                url: `https://${note.hostname}`,
            }),
        ),
    );
}

// ---- Tabs (This site / All notes) ----

function setupTabs() {
    const show = (all) => {
        $('tabCurrent').classList.toggle('active', !all);
        $('tabAll').classList.toggle('active', all);
        $('tabCurrent').setAttribute('aria-selected', String(!all));
        $('tabAll').setAttribute('aria-selected', String(all));
        $('viewCurrent').hidden = all;
        $('viewAll').hidden = !all;
        if (all) {
            renderAll();
            $('search').focus();
        }
    };
    $('tabCurrent').addEventListener('click', () => show(false));
    $('tabAll').addEventListener('click', () => show(true));
}

// ---- Adding and editing ----

function setupAddForm() {
    const form = $('addForm');
    const textarea = form.querySelector('textarea');

    $('addBtn').addEventListener('click', () => openAddForm());
    form.querySelector('[data-cancel]').addEventListener('click', closeAddForm);
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
        if (e.key === 'Escape') closeAddForm();
    });
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = textarea.value.trim();
        if (!text || !current) return;
        await addNote(current.hostname, text);
        closeAddForm();
    });
}

function openAddForm(text = '') {
    const textarea = $('addForm').querySelector('textarea');
    if (text) textarea.value = text;
    $('addForm').hidden = false;
    textarea.focus();
}

function closeAddForm() {
    $('addForm').querySelector('textarea').value = '';
    $('addForm').hidden = true;
}

function startEdit(item, note, hostname) {
    if (editing) return;
    editing = true;

    const form = document.createElement('form');
    form.className = 'edit-form';
    const textarea = document.createElement('textarea');
    textarea.rows = 4;
    textarea.maxLength = MAX_SITE_NOTE_LENGTH;
    textarea.value = note.text;
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const cancel = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'btn btn-secondary btn-small',
        textContent: 'Cancel',
    });
    const save = Object.assign(document.createElement('button'), {
        type: 'submit',
        className: 'btn btn-primary btn-small',
        textContent: 'Save',
    });
    actions.append(cancel, save);
    form.append(textarea, actions);

    const finish = () => {
        editing = false;
        form.replaceWith(item);
        if (renderPending) {
            renderPending = false;
            scheduleRender();
        }
    };

    cancel.addEventListener('click', finish);
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
        if (e.key === 'Escape') finish();
    });
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = textarea.value.trim();
        if (text && text !== note.text) {
            renderPending = true;
            await updateNote(hostname, note.id, text);
        }
        finish();
    });

    item.replaceWith(form);
    textarea.focus();
}

// ---- Requests from the context menu (handed over by the background) ----

async function handlePendingAction() {
    const { pendingAction: action } = await chrome.storage.session.get('pendingAction');
    if (!action) return;
    await chrome.storage.session.remove('pendingAction');
    if (Date.now() - action.at > 10000) return; // stale request from an earlier click

    // Make sure we're showing the tab the request came from.
    if (action.tabId !== currentTab?.id) await loadActiveTab();
    $('tabCurrent').click();
    if (action.type === 'add' && current) openAddForm(action.text);
}
