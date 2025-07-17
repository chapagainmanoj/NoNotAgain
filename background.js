// Background script for No Not Again
let blockedUrls = new Set();

chrome.runtime.onInstalled.addListener(() => {
    console.log('No Not again installed');
    setupRequestInterception();
});

chrome.runtime.onStartup.addListener(() => {
    setupRequestInterception();
});

// Setup request interception
async function setupRequestInterception() {
    const allNotes = await chrome.storage.sync.get(null);
    const domains = Object.keys(allNotes);

    console.log('Setting up request interception for domains:', domains);

    const bypassData = await chrome.storage.local.get(null);
    const currentTime = Date.now();

    const activeDomains = [];
    for (const domain of domains) {
        const bypassKey = `bypass_${domain}`;
        const bypass = bypassData[bypassKey];

        if (bypass && currentTime < bypass.expireTime) {
            console.log(`Domain ${domain} has active bypass, skipping rule`);
            continue;
        } else if (bypass && currentTime > bypass.expireTime) {
            await chrome.storage.local.remove([bypassKey]);
            console.log(`Removed expired bypass for domain: ${domain}`);
        }

        activeDomains.push(domain);
    }

    const rules = activeDomains.map((domain, index) => ({
        id: index + 1,
        priority: 1,
        action: {
            type: "redirect",
            redirect: {
                url: chrome.runtime.getURL("note-page.html") + "?domain=" + encodeURIComponent(domain)
            }
        },
        condition: {
            urlFilter: `*://*.${domain}/*`,
            resourceTypes: ["main_frame"]
        }
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: Array.from({ length: 1000 }, (_, i) => i + 1), // Remove old rules
        addRules: rules
    });

    console.log(`Created ${rules.length} blocking rules for domains:`, activeDomains);
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url && !tab.url.includes('note-page.html')) {
        const domain = extractDomain(tab.url);

        if (domain) {
            const result = await chrome.storage.sync.get([domain]);

            if (result[domain]) {
                const bypassKey = `bypass_${domain}`;
                const bypassData = await chrome.storage.local.get([bypassKey]);
                const currentTime = Date.now();

                if (bypassData[bypassKey] && currentTime < bypassData[bypassKey].expireTime) {
                    console.log('Bypass active for domain:', domain);
                    return; // Don't block
                } else if (bypassData[bypassKey] && currentTime > bypassData[bypassKey].expireTime) {
                    await chrome.storage.local.remove([bypassKey]);
                    console.log('Removed expired bypass for domain:', domain);
                }

                console.log('Fallback blocking for domain:', domain);
                const notePageUrl = chrome.runtime.getURL("note-page.html") +
                    "?domain=" + encodeURIComponent(domain) +
                    "&original=" + encodeURIComponent(tab.url);
                chrome.tabs.update(tabId, { url: notePageUrl });
            }
        }
    }
});

// Extract domain from URL
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '');
    } catch (e) {
        return null;
    }
}

// Listen for storage changes to update rules
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' || namespace === 'local') {
        setupRequestInterception();
    }
});

// Handle messages from popup and note page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'deleteNote') {
        chrome.storage.sync.remove([request.domain]);
        setupRequestInterception();
    } else if (request.action === 'continueToSite') {
        chrome.tabs.update(sender.tab.id, { url: request.originalUrl });
    } else if (request.action === 'getNoteData') {
        chrome.storage.sync.get([request.domain]).then(result => {
            sendResponse(result[request.domain]);
        });
        return true; // Keep message channel open for async response
    } else if (request.action === 'bypassSet') {
        setupRequestInterception();
    }
});