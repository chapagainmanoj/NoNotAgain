// Content script for No Not Again
// Enhanced version with "Continue for now" feature

// Extract current domain
function getCurrentDomain() {
    return window.location.hostname.replace(/^www\./, '');
}

// Check for note on page load
async function checkForNote() {
    const domain = getCurrentDomain();

    try {
        const result = await chrome.storage.sync.get([domain]);

        // Check if domain is temporarily bypassed
        const bypassKey = `bypass_${domain}`;
        const bypassResult = await chrome.storage.local.get([bypassKey]);

        if (bypassResult[bypassKey]) {
            const bypassData = bypassResult[bypassKey];
            const now = Date.now();

            // Check if bypass is still valid (default 1 hour)
            if (now < bypassData.expireTime) {
                console.log(`Bypassing note for ${domain} until ${new Date(bypassData.expireTime).toLocaleString()}`);
                return; // Don't show note
            } else {
                // Bypass expired, remove it
                await chrome.storage.local.remove([bypassKey]);
            }
        }

        if (result[domain] && !document.querySelector('.note-blocker-overlay')) {
            showNotePage(domain, result[domain]);
        }
    } catch (error) {
        console.error('Error checking for note:', error);
    }
}

// Show note page overlay
function showNotePage(domain, noteData) {
    // Prevent multiple overlays
    if (document.querySelector('.note-blocker-overlay')) return;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'note-blocker-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    overlay.innerHTML = `
        <div style="
            background: rgba(255, 255, 255, 0.95);
            padding: 40px;
            border-radius: 20px;
            max-width: 600px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.5s ease-out;
        ">
            <h2 style="color: #2d3436; margin-bottom: 20px; font-size: 2rem;">📝 Note for ${domain}</h2>
            <div style="
                background: rgba(255, 255, 255, 0.8);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                border-left: 4px solid #6c5ce7;
            ">
                <p style="
                    font-size: 1.1rem;
                    line-height: 1.6;
                    color: #2d3436;
                    margin: 0;
                    white-space: pre-wrap;
                ">${noteData.text}</p>
            </div>
            
            <!-- Main action buttons -->
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px;">
                
                <button id="continueForNowBtn" style="
                    background: #fdcb6e;
                    color: #2d3436;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 25px;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-weight: bold;
                ">Continue for Now</button>
            </div>
            
            <!-- Secondary action buttons -->
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                
                <button id="deleteBtn" style="
                    background: #ff7675;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 25px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-weight: bold;
                ">Delete Note</button>
            </div>
            
            <!-- Bypass duration options (initially hidden) -->
            <div id="bypassOptions" style="
                display: none;
                margin-top: 20px;
                padding: 20px;
                background: rgba(253, 203, 110, 0.1);
                border-radius: 10px;
                border: 2px solid #fdcb6e;
            ">
                <h3 style="color: #2d3436; margin-bottom: 15px; font-size: 1.1rem;">How long do you want to bypass this note?</h3>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 15px;">
                    <button class="bypass-duration-btn" data-duration="3600000" style="
                        background: #fdcb6e;
                        color: #2d3436;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-weight: bold;
                    ">1 Hour</button>
                    
                    <button class="bypass-duration-btn" data-duration="21600000" style="
                        background: #fdcb6e;
                        color: #2d3436;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-weight: bold;
                    ">6 Hours</button>
                    
                    <button class="bypass-duration-btn" data-duration="86400000" style="
                        background: #fdcb6e;
                        color: #2d3436;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-weight: bold;
                    ">1 Day</button>
                    
                    <button class="bypass-duration-btn" data-duration="604800000" style="
                        background: #fdcb6e;
                        color: #2d3436;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-weight: bold;
                    ">1 Week</button>
                </div>
                <button id="cancelBypassBtn" style="
                    background: #636e72;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-weight: bold;
                ">Cancel</button>
            </div>
        </div>
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-50px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .note-blocker-overlay button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }
        .bypass-duration-btn:hover {
            background: #e17055 !important;
            color: white !important;
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(overlay);

    // Add event listeners
    setupEventListeners(overlay, domain);
}

// Setup event listeners for the overlay
function setupEventListeners(overlay, domain) {

    // Show bypass options
    document.getElementById('continueForNowBtn').addEventListener('click', () => {
        const bypassOptions = document.getElementById('bypassOptions');
        bypassOptions.style.display = bypassOptions.style.display === 'none' ? 'block' : 'none';
    });

    // Handle bypass duration selection
    document.querySelectorAll('.bypass-duration-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const duration = parseInt(btn.dataset.duration);
            await setTemporaryBypass(domain, duration);

            // Show confirmation message
            showBypassConfirmation(btn.textContent, overlay);
        });
    });

    // Cancel bypass selection
    document.getElementById('cancelBypassBtn').addEventListener('click', () => {
        document.getElementById('bypassOptions').style.display = 'none';
    });

    // Delete note
    document.getElementById('deleteBtn').addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete the note for ${domain}?`)) {
            chrome.storage.sync.remove([domain]);
            overlay.remove();
        }
    });
}

// Set temporary bypass for a domain
async function setTemporaryBypass(domain, duration) {
    const bypassKey = `bypass_${domain}`;
    const bypassData = {
        expireTime: Date.now() + duration,
        createdAt: Date.now()
    };

    await chrome.storage.local.set({
        [bypassKey]: bypassData
    });
}

// Show bypass confirmation
function showBypassConfirmation(duration, overlay) {
    const confirmation = document.createElement('div');
    confirmation.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #00b894;
        color: white;
        padding: 20px 30px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        z-index: 1000000;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        animation: fadeInOut 2s ease-out;
    `;

    confirmation.textContent = `✅ Note bypassed for ${duration}`;

    // Add animation for confirmation
    const confirmStyle = document.createElement('style');
    confirmStyle.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
    `;
    document.head.appendChild(confirmStyle);

    document.body.appendChild(confirmation);

    // Remove confirmation and overlay after animation
    setTimeout(() => {
        confirmation.remove();
        overlay.remove();
    }, 2000);
}

// Check for note when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForNote);
} else {
    checkForNote();
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showNote') {
        showNotePage(request.domain, request.noteData);
    }
});