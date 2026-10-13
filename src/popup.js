// Popup script for No Not Again
import {
    MAX_NOTE_LENGTH,
    NOTE_PAGE,
    bypassKey,
    domainFromUrl,
    findNoteDomain,
    isBypassActive,
    normalizeDomain,
    parseNotePageUrl,
} from './domain.js';

// Domain the current tab's note is (or would be) stored under; null on browser pages.
let currentDomain = null;
// Domain of the note open in the form when editing, so a domain change can remove the old note.
let editingDomain = null;

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
    $('noteText').maxLength = MAX_NOTE_LENGTH;
    setupEventListeners();
    await refresh();
});

async function refresh() {
    await loadCurrentSite();
    await Promise.all([loadAllNotes(), loadBypassStatus()]);
}

// Load current site information
async function loadCurrentSite() {
    const label = $('currentDomain');
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tab?.url || '';
        const hostname = url.startsWith(chrome.runtime.getURL(NOTE_PAGE))
            ? parseNotePageUrl(url).domain
            : domainFromUrl(url);

        const notes = await chrome.storage.sync.get(null);
        const noteDomain = findNoteDomain(hostname, Object.keys(notes));
        currentDomain = noteDomain || hostname;

        label.classList.toggle('unavailable', !currentDomain);
        label.textContent = currentDomain || 'Notes can’t be added to this page';
        $('addNoteBtn').hidden = Boolean(noteDomain);
        $('editNoteBtn').hidden = !noteDomain;
    } catch (error) {
        console.error('Error loading current site:', error);
        currentDomain = null;
        label.textContent = 'Unable to detect';
    }
}

// Load bypass status for current site
async function loadBypassStatus() {
    const status = $('bypassStatus');
    status.hidden = true;
    if (!currentDomain) return;

    try {
        const key = bypassKey(currentDomain);
        const { [key]: bypass } = await chrome.storage.local.get(key);
        if (isBypassActive(bypass)) {
            $('bypassTimeLeft').textContent = `Expires in ${getTimeLeft(bypass.expireTime)}`;
            status.hidden = false;
        }
    } catch (error) {
        console.error('Error loading bypass status:', error);
    }
}

function getTimeLeft(expireTime) {
    const diff = expireTime - Date.now();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `${days}d ${hours}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

async function loadAllNotes() {
    const container = $('notesContainer');
    try {
        const [notes, local] = await Promise.all([
            chrome.storage.sync.get(null),
            chrome.storage.local.get(null),
        ]);
        const domains = Object.keys(notes).sort();

        if (domains.length === 0) {
            container.replaceChildren(el('div', 'empty-state', 'No notes created yet'));
            return;
        }

        container.replaceChildren(
            ...domains.map((domain) => {
                const text = notes[domain].text;
                const preview = text.length > 60 ? text.substring(0, 60) + '...' : text;

                const edit = el('button', 'btn btn-secondary btn-small', 'Edit');
                edit.addEventListener('click', () => showNoteForm('edit', domain));
                const remove = el('button', 'btn btn-danger btn-small', 'Delete');
                remove.addEventListener('click', () => deleteNote(domain));

                const actions = el('div', 'note-actions');
                actions.append(edit, remove);
                const header = el('div', 'note-header');
                header.append(el('span', 'note-domain', domain), actions);

                const item = el('div', 'note-item');
                item.append(header, el('div', 'note-preview', preview));

                const bypass = local[bypassKey(domain)];
                if (isBypassActive(bypass)) {
                    const timeLeft = getTimeLeft(bypass.expireTime);
                    item.append(el('div', 'bypass-badge', `⏰ Bypassed (${timeLeft})`));
                }
                return item;
            }),
        );
    } catch (error) {
        console.error('Error loading notes:', error);
        container.replaceChildren(el('div', 'empty-state', 'Error loading notes'));
    }
}

function setupEventListeners() {
    $('addNoteBtn').addEventListener('click', () => showNoteForm('add', currentDomain));
    $('editNoteBtn').addEventListener('click', () => showNoteForm('edit', currentDomain));

    $('saveBtn').addEventListener('click', saveNote);
    $('cancelBtn').addEventListener('click', hideNoteForm);

    $('noteText').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            saveNote();
        }
    });

    $('removeBypassBtn').addEventListener('click', async () => {
        await chrome.storage.local.remove(bypassKey(currentDomain));
        await refresh();
        showMessage('Bypass removed successfully!', 'success');
    });
}

async function showNoteForm(mode, domain) {
    editingDomain = mode === 'edit' ? domain : null;

    $('formTitle').textContent = mode === 'add' ? 'Add Note' : 'Edit Note';
    $('domainInput').value = domain || '';
    $('noteText').value = '';

    if (mode === 'edit') {
        try {
            const { [domain]: note } = await chrome.storage.sync.get(domain);
            if (note) $('noteText').value = note.text;
        } catch (error) {
            console.error('Error loading note for editing:', error);
        }
    }

    $('noteForm').style.display = 'block';
    $('notesList').style.display = 'none';
    (domain ? $('noteText') : $('domainInput')).focus();
}

function hideNoteForm() {
    $('noteForm').style.display = 'none';
    $('notesList').style.display = 'block';
    editingDomain = null;
}

async function saveNote() {
    const domain = normalizeDomain($('domainInput').value);
    const noteText = $('noteText').value.trim();

    if (!domain) {
        showMessage('Enter a website like example.com', 'error');
        $('domainInput').focus();
        return;
    }

    if (!noteText) {
        showMessage('Please enter a note', 'error');
        $('noteText').focus();
        return;
    }

    try {
        const now = new Date().toISOString();
        const previous =
            (await getNote(domain)) || (editingDomain && (await getNote(editingDomain)));

        await chrome.storage.sync.set({
            [domain]: { text: noteText, createdAt: previous?.createdAt || now, updatedAt: now },
        });

        // The domain was changed while editing: drop the note stored under the old one.
        if (editingDomain && editingDomain !== domain) {
            await chrome.storage.sync.remove(editingDomain);
            await chrome.storage.local.remove(bypassKey(editingDomain));
        }

        hideNoteForm();
        await refresh();
        showMessage('Note saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving note:', error);
        const full = /QUOTA/i.test(error.message);
        showMessage(full ? 'Storage full: delete some notes first' : 'Error saving note', 'error');
    }
}

async function getNote(domain) {
    const { [domain]: note } = await chrome.storage.sync.get(domain);
    return note;
}

async function deleteNote(domain) {
    if (!confirm(`Are you sure you want to delete the note for ${domain}?`)) return;

    try {
        await chrome.storage.sync.remove(domain);
        await chrome.storage.local.remove(bypassKey(domain));
        await refresh();
        showMessage('Note deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting note:', error);
        showMessage('Error deleting note', 'error');
    }
}

function showMessage(text, type) {
    document.querySelector('.message')?.remove();

    const message = el('div', `message ${type}`, text);
    message.setAttribute('role', 'status');
    document.body.appendChild(message);

    setTimeout(() => message.remove(), 3000);
}
