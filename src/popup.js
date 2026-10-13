// Popup script for No Not Again
import {
    MAX_NOTE_LENGTH,
    NOTE_PAGE,
    domainFromUrl,
    findNoteDomain,
    isBypassActive,
    normalizeDomain,
    parseNotePageUrl,
} from './domain.js';
import {
    getBlock,
    getBlocks,
    getBypass,
    getBypasses,
    getSiteNotes,
    removeBlock,
    removeBypasses,
    saveBlock,
} from './storage.js';

const SHOW_LABELS = {
    note: 'your note',
    quote: 'a motivational quote',
    both: 'your note and a quote',
};

// Domain the current tab's block rule is (or would be) stored under; null on browser pages.
let currentDomain = null;
// Domain of the rule open in the form when editing, so a domain change can remove the old rule.
let editingDomain = null;
let currentTab = null;

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
    $('noteText').maxLength = MAX_NOTE_LENGTH;
    setupEventListeners();
    await refresh();
});

async function refresh() {
    await loadCurrentSite();
    await Promise.all([loadBlockedSites(), loadBypassStatus(), loadPageNotes()]);
}

// Load current site information
async function loadCurrentSite() {
    const label = $('currentDomain');
    try {
        [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = currentTab?.url || '';
        const hostname = url.startsWith(chrome.runtime.getURL(NOTE_PAGE))
            ? parseNotePageUrl(url).domain
            : domainFromUrl(url);

        const blocks = await getBlocks();
        const blockDomain = findNoteDomain(hostname, Object.keys(blocks));
        currentDomain = blockDomain || hostname;

        label.classList.toggle('unavailable', !currentDomain);
        label.textContent = currentDomain || 'Sites can’t be blocked from this page';
        $('addNoteBtn').hidden = Boolean(blockDomain);
        $('editNoteBtn').hidden = !blockDomain;

        const block = blocks[blockDomain];
        $('blockSummary').hidden = !block;
        if (block)
            $('blockSummary').textContent = `Blocked: shows ${SHOW_LABELS[block.show || 'note']}.`;
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
        const bypass = await getBypass(currentDomain);
        if (isBypassActive(bypass)) {
            $('bypassTimeLeft').textContent = `Expires in ${getTimeLeft(bypass.expireTime)}`;
            status.hidden = false;
        }
    } catch (error) {
        console.error('Error loading bypass status:', error);
    }
}

async function loadPageNotes() {
    const site = currentTab?.url ? await getSiteNotes(currentTab.url) : null;
    const total = site?.notes.length || 0;
    $('pageNotesCount').textContent = !site
        ? 'Available on websites'
        : total
          ? `${total} note${total === 1 ? '' : 's'} for ${site.hostname}`
          : 'No notes for this site yet';
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

async function loadBlockedSites() {
    const container = $('notesContainer');
    try {
        const [blocks, bypasses] = await Promise.all([getBlocks(), getBypasses()]);
        const domains = Object.keys(blocks).sort();

        if (domains.length === 0) {
            container.replaceChildren(el('div', 'empty-state', 'No blocked sites yet'));
            return;
        }

        container.replaceChildren(
            ...domains.map((domain) => {
                const block = blocks[domain];
                const text = block.text || `Shows ${SHOW_LABELS[block.show || 'note']}`;
                const preview = text.length > 60 ? text.substring(0, 60) + '...' : text;

                const edit = el('button', 'btn btn-secondary btn-small', 'Edit');
                edit.addEventListener('click', () => showNoteForm('edit', domain));
                const remove = el('button', 'btn btn-danger btn-small', 'Unblock');
                remove.addEventListener('click', () => unblock(domain));

                const actions = el('div', 'note-actions');
                actions.append(edit, remove);
                const header = el('div', 'note-header');
                header.append(el('span', 'note-domain', domain), actions);

                const item = el('div', 'note-item');
                item.append(header, el('div', 'note-preview', preview));

                const bypass = bypasses[domain];
                if (isBypassActive(bypass)) {
                    const timeLeft = getTimeLeft(bypass.expireTime);
                    item.append(el('div', 'bypass-badge', `Unblocked · ${timeLeft} left`));
                }
                return item;
            }),
        );
    } catch (error) {
        console.error('Error loading blocked sites:', error);
        container.replaceChildren(el('div', 'empty-state', 'Error loading blocked sites'));
    }
}

function setupEventListeners() {
    $('addNoteBtn').addEventListener('click', () => showNoteForm('add', currentDomain));
    $('editNoteBtn').addEventListener('click', () => showNoteForm('edit', currentDomain));

    $('saveBtn').addEventListener('click', saveNote);
    $('cancelBtn').addEventListener('click', hideNoteForm);
    $('showSelect').addEventListener('change', updateNoteRequirement);

    $('noteText').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            saveNote();
        }
    });

    $('removeBypassBtn').addEventListener('click', async () => {
        await removeBypasses([currentDomain]);
        await refresh();
        showMessage('Blocking resumed', 'success');
    });

    // sidePanel.open must run inside the click handler, before any await.
    $('openPanelBtn').addEventListener('click', () => {
        chrome.sidePanel.open({ windowId: currentTab.windowId }).then(() => window.close());
    });

    $('optionsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
}

// A note is optional when the block page shows only a quote.
function updateNoteRequirement() {
    const quoteOnly = $('showSelect').value === 'quote';
    $('noteText').placeholder = quoteOnly
        ? 'Optional: shown if no quotes are available'
        : 'Why do you want to stay away from this site?';
}

async function showNoteForm(mode, domain) {
    editingDomain = mode === 'edit' ? domain : null;

    $('formTitle').textContent = mode === 'add' ? 'Block site' : 'Edit block';
    $('domainInput').value = domain || '';
    $('noteText').value = '';
    $('showSelect').value = 'note';

    if (mode === 'edit') {
        try {
            const block = await getBlock(domain);
            if (block) {
                $('noteText').value = block.text;
                $('showSelect').value = block.show || 'note';
            }
        } catch (error) {
            console.error('Error loading block for editing:', error);
        }
    }
    updateNoteRequirement();

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
    const show = $('showSelect').value;

    if (!domain) {
        showMessage('Enter a website like example.com', 'error');
        $('domainInput').focus();
        return;
    }

    if (!noteText && show !== 'quote') {
        showMessage('Please enter a note', 'error');
        $('noteText').focus();
        return;
    }

    try {
        await saveBlock(domain, { text: noteText, show }, editingDomain);
        hideNoteForm();
        await refresh();
        showMessage('Saved!', 'success');
    } catch (error) {
        console.error('Error saving block:', error);
        const full = /QUOTA/i.test(error.message);
        showMessage(full ? 'Storage full: unblock some sites first' : 'Error saving', 'error');
    }
}

async function unblock(domain) {
    if (!confirm(`Stop blocking ${domain}?`)) return;

    try {
        await removeBlock(domain);
        await refresh();
        showMessage(`${domain} unblocked`, 'success');
    } catch (error) {
        console.error('Error unblocking:', error);
        showMessage('Error unblocking', 'error');
    }
}

function showMessage(text, type) {
    document.querySelector('.toast')?.remove();

    const message = el('div', `toast ${type}`, text);
    message.setAttribute('role', 'status');
    document.body.appendChild(message);

    setTimeout(() => message.remove(), 3000);
}
