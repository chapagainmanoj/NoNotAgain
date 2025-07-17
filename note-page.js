let currentDomain = '';
let originalUrl = '';

// Initialize the note page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        currentDomain = urlParams.get('domain');
        originalUrl = urlParams.get('original');

        if (!currentDomain) {
            showError('Invalid domain parameter');
            return;
        }

        document.getElementById('domainName').textContent = currentDomain;

        await loadNoteData();
    } catch (error) {
        console.error('Error initializing note page:', error);
        showError('Failed to load note page');
    }
});

async function loadNoteData() {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'getNoteData',
            domain: currentDomain
        });

        if (response && response.text) {
            displayNote(response);
        } else {
            showError('Note not found');
        }
    } catch (error) {
        console.error('Error loading note data:', error);
        showError('Failed to load note data');
    }
}

// Display the note
function displayNote(noteData) {
    const noteContentDiv = document.getElementById('noteContent');

    noteContentDiv.innerHTML = `
        <div class="note-content">
            <div class="note-text">${noteData.text}</div>
        </div>
        
        <div class="note-actions">
            <button class="btn btn-bypass" id="bypassBtn">Continue for Now</button>
        </div>
        
        <div class="secondary-actions">
            <button class="btn btn-delete btn-small" id="deleteBtn">Delete Note</button>
            <button class="btn btn-back btn-small" id="backBtn">Go Back</button>
        </div>
        
        <div id="bypassOptions" class="bypass-options">
            <h3>How long do you want to bypass this note?</h3>
            <div class="bypass-duration-options">
                <button class="bypass-duration-btn" data-duration="3600000">1 Hour</button>
                <button class="bypass-duration-btn" data-duration="21600000">6 Hours</button>
                <button class="bypass-duration-btn" data-duration="86400000">1 Day</button>
                <button class="bypass-duration-btn" data-duration="604800000">1 Week</button>
            </div>
            <button class="btn btn-cancel btn-small" id="cancelBypassBtn">Cancel</button>
        </div>
    `;

    document.getElementById('bypassBtn').addEventListener('click', showBypassOptions);
    document.getElementById('deleteBtn').addEventListener('click', deleteNote);
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('cancelBypassBtn').addEventListener('click', hideBypassOptions);

    document.querySelectorAll('.bypass-duration-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const duration = parseInt(e.target.dataset.duration);
            setBypass(duration);
        });
    });
}

function continueToSite() {
    if (originalUrl) {
        chrome.runtime.sendMessage({
            action: 'continueToSite',
            originalUrl: originalUrl
        });
    } else {
        window.location.href = `https://${currentDomain}`;
    }
}

function showBypassOptions() {
    const bypassOptions = document.getElementById('bypassOptions');
    bypassOptions.style.display = 'block';

    bypassOptions.scrollIntoView({ behavior: 'smooth' });
}

function hideBypassOptions() {
    const bypassOptions = document.getElementById('bypassOptions');
    bypassOptions.style.display = 'none';
}

// Set temporary bypass for a domain
async function setBypass(duration) {
    try {
        const bypassKey = `bypass_${currentDomain}`;
        const bypassData = {
            expireTime: Date.now() + duration,
            createdAt: Date.now()
        };

        await chrome.storage.local.set({
            [bypassKey]: bypassData
        });

        chrome.runtime.sendMessage({
            action: 'bypassSet',
            domain: currentDomain
        });

        const durationText = getDurationText(duration);
        showBypassConfirmation(durationText);

    } catch (error) {
        console.error('Error setting bypass:', error);
        alert('Error setting bypass. Please try again.');
    }
}

function getDurationText(duration) {
    const hours = duration / (1000 * 60 * 60);
    const days = duration / (1000 * 60 * 60 * 24);
    const weeks = duration / (1000 * 60 * 60 * 24 * 7);

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
    const confirmation = document.createElement('div');
    confirmation.className = 'confirmation-message';
    confirmation.textContent = `✅ Note bypassed for ${duration}`;

    document.body.appendChild(confirmation);

    setTimeout(() => {
        confirmation.remove();
        continueToSite();
    }, 2000);
}

function editNote() {
    chrome.runtime.openOptionsPage();
}

function deleteNote() {
    if (confirm(`Are you sure you want to delete the note for ${currentDomain}?`)) {
        chrome.runtime.sendMessage({
            action: 'deleteNote',
            domain: currentDomain
        });

        setTimeout(() => {
            continueToSite();
        }, 500);
    }
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.close();
    }
}

function showError(message) {
    const noteContentDiv = document.getElementById('noteContent');
    noteContentDiv.innerHTML = `
        <div class="error">
            <h3>Error</h3>
            <p>${message}</p>
            <div class="note-actions" style="margin-top: 20px;">
                <button class="btn btn-back" id="errorBackBtn">Go Back</button>
            </div>
        </div>
    `;

    document.getElementById('errorBackBtn').addEventListener('click', goBack);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        continueToSite();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        goBack();
    }
});