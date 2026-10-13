import { parseNotePageUrl } from './domain.js';
import { pickQuote } from './quotes.js';
import { getBlock, getSettings } from './storage.js';

const { domain: currentDomain, originalUrl } = parseNotePageUrl(window.location.href);

const $ = (id) => document.getElementById(id);

// Initialize the note page
document.addEventListener('DOMContentLoaded', async () => {
    $('errorBackBtn').addEventListener('click', goBack);

    if (!currentDomain) {
        showError('Invalid domain parameter');
        return;
    }

    $('domainName').textContent = currentDomain;

    try {
        const [block, settings] = await Promise.all([getBlock(currentDomain), getSettings()]);
        if (block) {
            displayNote(block, settings);
        } else {
            showError('Note not found');
        }
    } catch (error) {
        console.error('Error loading note data:', error);
        showError('Failed to load note data');
    }
});

// Display the note, a quote, or both, depending on the site's "show" setting
function displayNote(block, settings) {
    const show = block.show || 'note';
    const quote = show !== 'note' ? pickQuote(settings) : null;
    const text = show !== 'quote' || !quote ? block.text : '';

    $('loading').hidden = true;
    $('noteText').textContent =
        text || (quote ? '' : 'You chose to pause before visiting this site.');
    $('noteBox').hidden = !$('noteText').textContent;
    if (quote) {
        $('quoteText').textContent = quote.text;
        $('quoteAuthor').textContent = quote.author ? `— ${quote.author}` : '';
        $('quoteBox').hidden = false;
    }
    $('noteContent').hidden = false;

    $('bypassBtn').addEventListener('click', showBypassOptions);
    $('deleteBtn').addEventListener('click', deleteNote);
    $('backBtn').addEventListener('click', goBack);
    $('cancelBypassBtn').addEventListener('click', hideBypassOptions);

    document.querySelectorAll('.bypass-duration-btn').forEach((btn) => {
        btn.addEventListener('click', () => setBypass(Number(btn.dataset.duration)));
    });
}

function continueToSite() {
    window.location.replace(originalUrl || `https://${currentDomain}`);
}

function showBypassOptions() {
    $('mainActions').hidden = true;
    $('bypassOptions').hidden = false;
    $('bypassOptions').querySelector('.bypass-duration-btn').focus();
}

function hideBypassOptions() {
    $('bypassOptions').hidden = true;
    $('mainActions').hidden = false;
    $('bypassBtn').focus();
}

// The background updates storage and waits for the redirect rules to follow before replying.
async function sendToBackground(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || 'No response from background');
}

// Set temporary bypass for a domain
async function setBypass(duration) {
    try {
        await sendToBackground({ action: 'setBypass', domain: currentDomain, duration });
        showBypassConfirmation(getDurationText(duration));
    } catch (error) {
        console.error('Error setting bypass:', error);
        alert('Error setting bypass. Please try again.');
    }
}

function getDurationText(duration) {
    const hours = duration / (1000 * 60 * 60);
    const days = hours / 24;
    const weeks = days / 7;

    if (weeks >= 1) {
        return `${weeks} Week${weeks > 1 ? 's' : ''}`;
    } else if (days >= 1) {
        return `${days} Day${days > 1 ? 's' : ''}`;
    } else if (hours >= 1) {
        return `${hours} Hour${hours > 1 ? 's' : ''}`;
    } else {
        return 'Some time';
    }
}

function showBypassConfirmation(duration) {
    const confirmation = document.createElement('p');
    confirmation.className = 'confirmation-message';
    confirmation.setAttribute('role', 'status');
    confirmation.textContent = `Unblocked for ${duration.toLowerCase()}. Opening the site…`;
    $('bypassOptions').replaceWith(confirmation);

    setTimeout(continueToSite, 1500);
}

async function deleteNote() {
    if (!confirm(`Stop blocking ${currentDomain}? This removes its block note.`)) return;

    try {
        await sendToBackground({ action: 'deleteBlock', domain: currentDomain });
        continueToSite();
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Error deleting note. Please try again.');
    }
}

async function goBack() {
    if (window.history.length > 1) {
        window.history.back();
        return;
    }
    // Opened in a fresh tab with nothing to go back to: close it.
    const tab = await chrome.tabs.getCurrent();
    if (tab) chrome.tabs.remove(tab.id);
}

function showError(message) {
    $('loading').hidden = true;
    $('noteContent').hidden = true;
    $('errorMessage').textContent = message;
    $('errorBox').hidden = false;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        e.preventDefault();
        if (!$('bypassOptions').hidden) {
            hideBypassOptions();
        } else {
            goBack();
        }
    }
});
