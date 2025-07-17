// Popup script for No Not Again
// Enhanced version with bypass management

let currentDomain = '';
let editingDomain = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentSite();
    await loadAllNotes();
    await loadBypassStatus();
    setupEventListeners();
});

// Load current site information
async function loadCurrentSite() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab.url) {
            const url = new URL(tab.url);
            currentDomain = url.hostname.replace(/^www\./, '');
            document.getElementById('currentDomain').textContent = currentDomain;

            const result = await chrome.storage.sync.get([currentDomain]);
            if (result[currentDomain]) {
                document.getElementById('addNoteBtn').style.display = 'none';
                document.getElementById('editNoteBtn').style.display = 'block';
            } else {
                document.getElementById('addNoteBtn').style.display = 'block';
                document.getElementById('editNoteBtn').style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading current site:', error);
        document.getElementById('currentDomain').textContent = 'Unable to detect';
    }
}

// Load bypass status for current site
async function loadBypassStatus() {
    if (!currentDomain) return;

    try {
        const bypassKey = `bypass_${currentDomain}`;
        const result = await chrome.storage.local.get([bypassKey]);

        if (result[bypassKey]) {
            const bypassData = result[bypassKey];
            const now = Date.now();

            if (now < bypassData.expireTime) {
                showBypassStatus(bypassData.expireTime);
            } else {
                await chrome.storage.local.remove([bypassKey]);
            }
        }
    } catch (error) {
        console.error('Error loading bypass status:', error);
    }
}

function showBypassStatus(expireTime) {
    const currentSiteDiv = document.getElementById('currentSite');
    const expireDate = new Date(expireTime);
    const timeLeft = getTimeLeft(expireTime);

    const bypassStatus = document.createElement('div');
    bypassStatus.className = 'bypass-status';
    bypassStatus.innerHTML = `
        <div style="
            background: rgba(253, 203, 110, 0.2);
            padding: 10px;
            border-radius: 8px;
            margin-top: 10px;
            border: 1px solid #fdcb6e;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #e17055;">⏰ Note Bypassed</strong>
                    <div style="font-size: 0.8rem; color: #636e72; margin-top: 4px;">
                        Expires in ${timeLeft}
                    </div>
                </div>
                <button id="removeBypassBtn" class="btn btn-small" style="
                    background: #ff7675;
                    color: white;
                    font-size: 0.7rem;
                    padding: 4px 8px;
                ">Remove</button>
            </div>
        </div>
    `;

    currentSiteDiv.appendChild(bypassStatus);

    document.getElementById('removeBypassBtn').addEventListener('click', async () => {
        await removeBypass(currentDomain);
        bypassStatus.remove();
        showMessage('Bypass removed successfully!', 'success');
    });
}

function getTimeLeft(expireTime) {
    const now = Date.now();
    const diff = expireTime - now;

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

async function removeBypass(domain) {
    const bypassKey = `bypass_${domain}`;
    await chrome.storage.local.remove([bypassKey]);
}

async function loadAllNotes() {
    try {
        const [syncResult, localResult] = await Promise.all([
            chrome.storage.sync.get(null),
            chrome.storage.local.get(null)
        ]);

        const notesContainer = document.getElementById('notesContainer');
        const domains = Object.keys(syncResult);

        if (domains.length === 0) {
            notesContainer.innerHTML = '<div class="empty-state">No notes created yet</div>';
            return;
        }

        const notesWithBypass = domains.map(domain => {
            const note = syncResult[domain];
            const bypassKey = `bypass_${domain}`;
            const bypassData = localResult[bypassKey];

            let bypassStatus = '';
            if (bypassData && Date.now() < bypassData.expireTime) {
                const timeLeft = getTimeLeft(bypassData.expireTime);
                bypassStatus = `
                    <div style="
                        background: rgba(253, 203, 110, 0.3);
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.7rem;
                        color: #e17055;
                        margin-top: 4px;
                        font-weight: bold;
                    ">
                        ⏰ Bypassed (${timeLeft})
                    </div>
                `;
            }

            return { domain, note, bypassStatus };
        });

        notesContainer.innerHTML = notesWithBypass.map(({ domain, note, bypassStatus }) => {
            const preview = note.text.length > 60 ? note.text.substring(0, 60) + '...' : note.text;

            return `
                <div class="note-item">
                    <div class="note-header">
                        <span class="note-domain">${domain}</span>
                        <div class="note-actions">
                            <button class="btn btn-secondary btn-small" data-domain="${domain}" data-action="edit">Edit</button>
                            <button class="btn btn-danger btn-small" data-domain="${domain}" data-action="delete">Delete</button>
                        </div>
                    </div>
                    <div class="note-preview">${preview}</div>
                    ${bypassStatus}
                </div>
            `;
        }).join('');

        document.querySelectorAll('.note-actions button').forEach(button => {
            button.addEventListener('click', (e) => {
                const domain = e.target.dataset.domain;
                const action = e.target.dataset.action;

                if (action === 'edit') {
                    editNote(domain);
                } else if (action === 'delete') {
                    deleteNote(domain);
                }
            });
        });

    } catch (error) {
        console.error('Error loading notes:', error);
        document.getElementById('notesContainer').innerHTML = '<div class="empty-state">Error loading notes</div>';
    }
}

function setupEventListeners() {
    document.getElementById('addNoteBtn').addEventListener('click', () => {
        showNoteForm('add', currentDomain);
    });

    document.getElementById('editNoteBtn').addEventListener('click', () => {
        showNoteForm('edit', currentDomain);
    });

    document.getElementById('saveBtn').addEventListener('click', saveNote);
    document.getElementById('cancelBtn').addEventListener('click', hideNoteForm);

    document.getElementById('noteText').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            saveNote();
        }
    });
}

async function showNoteForm(mode, domain) {
    editingDomain = domain;

    document.getElementById('formTitle').textContent = mode === 'add' ? 'Add Note' : 'Edit Note';
    document.getElementById('domainInput').value = domain;
    document.getElementById('noteText').value = '';

    if (mode === 'edit') {
        try {
            const result = await chrome.storage.sync.get([domain]);
            if (result[domain]) {
                document.getElementById('noteText').value = result[domain].text;
            }
        } catch (error) {
            console.error('Error loading note for editing:', error);
        }
    }

    document.getElementById('noteForm').style.display = 'block';
    document.getElementById('notesList').style.display = 'none';
    document.getElementById('noteText').focus();
}

function hideNoteForm() {
    document.getElementById('noteForm').style.display = 'none';
    document.getElementById('notesList').style.display = 'block';
    editingDomain = null;
}

async function saveNote() {
    const domain = document.getElementById('domainInput').value.trim();
    const noteText = document.getElementById('noteText').value.trim();

    if (!domain) {
        alert('Please enter a website domain');
        return;
    }

    if (!noteText) {
        alert('Please enter a note');
        return;
    }

    try {
        const noteData = {
            text: noteText,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await chrome.storage.sync.set({
            [domain]: noteData
        });

        // Update background script rules
        chrome.runtime.sendMessage({ action: 'updateRules' });

        hideNoteForm();
        await loadCurrentSite();
        await loadAllNotes();
        await loadBypassStatus();

        // Show success message briefly
        showMessage('Note saved successfully!', 'success');

    } catch (error) {
        console.error('Error saving note:', error);
        showMessage('Error saving note', 'error');
    }
}

async function editNote(domain) {
    showNoteForm('edit', domain);
}

async function deleteNote(domain) {
    if (confirm(`Are you sure you want to delete the note for ${domain}?`)) {
        try {
            await chrome.storage.sync.remove([domain]);

            await removeBypass(domain);

            chrome.runtime.sendMessage({ action: 'updateRules' });

            await loadCurrentSite();
            await loadAllNotes();
            await loadBypassStatus();
            showMessage('Note deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting note:', error);
            showMessage('Error deleting note', 'error');
        }
    }
}

function showMessage(text, type) {
    const existing = document.querySelector('.message');
    if (existing) {
        existing.remove();
    }

    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    message.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#00b894' : '#ff7675'};
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.8rem;
        z-index: 1000;
        animation: slideDown 0.3s ease-out;
    `;

    document.body.appendChild(message);

    setTimeout(() => {
        message.remove();
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
`;
document.head.appendChild(style);