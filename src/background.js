// Background script for No Not Again
import {
    NOTE_PAGE,
    buildRedirectRules,
    domainFromUrl,
    findNoteDomain,
    isBypassActive,
    notePageUrl,
} from './domain.js';
import {
    getBlocks,
    getBypass,
    getBypasses,
    getSiteNotes,
    isNoteKey,
    migrateFrom1x,
    removeBlock,
    removeBypasses,
    setBypass,
} from './storage.js';

const DEBUG = false;
const log = (...args) => DEBUG && console.log('[NoNotAgain]', ...args);

const NOTE_PAGE_URL = chrome.runtime.getURL(NOTE_PAGE);
const BYPASS_ALARM_PREFIX = 'bypass-expiry:';
const WEB_PAGES = ['http://*/*', 'https://*/*'];

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason === 'update') log('Migrated', await migrateFrom1x());
    createContextMenus();
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    rebuildRules();
    updateActiveBadges();
});

chrome.runtime.onStartup.addListener(() => {
    rebuildRules();
    updateActiveBadges();
});

chrome.storage.onChanged.addListener((changes, area) => {
    const keys = Object.keys(changes);
    if (
        (area === 'sync' && keys.some((key) => key.startsWith('block:'))) ||
        (area === 'local' && keys.some((key) => key.startsWith('bypass:')))
    ) {
        rebuildRules();
    }
    if (area === 'local' && keys.some(isNoteKey)) updateActiveBadges();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith(BYPASS_ALARM_PREFIX)) rebuildRules();
});

// ---- Redirect rules ----

// Rebuilds are serialized; changes arriving mid-rebuild trigger one more pass instead of overlapping.
let rebuilding = null;
let rebuildAgain = false;

function rebuildRules() {
    if (rebuilding) {
        rebuildAgain = true;
        return rebuilding;
    }
    rebuilding = (async () => {
        do {
            rebuildAgain = false;
            await applyRules();
        } while (rebuildAgain);
    })()
        .catch((error) => console.error('Failed to update redirect rules:', error))
        .finally(() => {
            rebuilding = null;
        });
    return rebuilding;
}

async function applyRules() {
    const [blocks, bypasses, existingRules] = await Promise.all([
        getBlocks(),
        getBypasses(),
        chrome.declarativeNetRequest.getDynamicRules(),
    ]);

    const now = Date.now();
    const blocked = [];
    const expired = [];
    await chrome.alarms.clearAll();

    for (const domain of Object.keys(blocks)) {
        const bypass = bypasses[domain];
        if (isBypassActive(bypass, now)) {
            chrome.alarms.create(BYPASS_ALARM_PREFIX + domain, { when: bypass.expireTime });
        } else {
            if (bypass) expired.push(domain);
            blocked.push(domain);
        }
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRules.map((rule) => rule.id),
        addRules: buildRedirectRules(blocked, NOTE_PAGE_URL),
    });
    await removeBypasses(expired);

    log('Blocking', blocked);
}

// ---- Tabs: fallback redirect and note badge ----

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!tab.url) return;
    if (changeInfo.url || changeInfo.status === 'complete') updateBadge(tabId, tab.url);
    if (changeInfo.status === 'loading') fallbackRedirect(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab?.url) updateBadge(tabId, tab.url);
});

// For navigations the redirect rules miss, e.g. right after a bypass expires.
async function fallbackRedirect(tabId, url) {
    const domain = findNoteDomain(domainFromUrl(url), Object.keys(await getBlocks()));
    if (!domain || isBypassActive(await getBypass(domain))) return;

    log('Fallback redirect for', domain);
    chrome.tabs.update(tabId, { url: notePageUrl(NOTE_PAGE_URL, domain, url) });
}

// Shows how many notes exist for the tab's site.
async function updateBadge(tabId, url) {
    const count = (await getSiteNotes(url))?.notes.length || 0;
    await chrome.action.setBadgeText({ tabId, text: count ? String(count) : '' }).catch(() => {}); // the tab may have closed meanwhile
    if (count) chrome.action.setBadgeBackgroundColor({ tabId, color: '#6c5ce7' }).catch(() => {});
}

async function updateActiveBadges() {
    const tabs = await chrome.tabs.query({ active: true });
    for (const tab of tabs) if (tab.url) updateBadge(tab.id, tab.url);
}

// ---- Side panel entry points ----

function createContextMenus() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'add-page-note',
            title: 'Add note',
            contexts: ['page'],
            documentUrlPatterns: WEB_PAGES,
        });
        chrome.contextMenus.create({
            id: 'add-selection-note',
            title: 'Save selection as note',
            contexts: ['selection'],
            documentUrlPatterns: WEB_PAGES,
        });
    });
}

// The panel must be opened synchronously inside the user gesture, so the requested action is
// handed over through session storage afterwards; the panel picks it up whenever it's ready.
function openNotesPanel(tab, action) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => console.error(error));
    if (action)
        chrome.storage.session.set({ pendingAction: { ...action, tabId: tab.id, at: Date.now() } });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab) return;
    const actions = {
        'add-page-note': { type: 'add' },
        'add-selection-note': { type: 'add', text: info.selectionText || '' },
    };
    openNotesPanel(tab, actions[info.menuItemId]);
});

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'open-notes' && tab) openNotesPanel(tab);
});

// ---- Messages from the note page ----

// The note page asks the background to change state so it can wait for the rules to update
// before navigating back to the site.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handlers = {
        setBypass: () => setBypass(request.domain, request.duration),
        deleteBlock: () => removeBlock(request.domain),
    };

    const handler = handlers[request.action];
    if (!handler) return false;

    handler()
        .then(() => rebuildRules())
        .then(
            () => sendResponse({ ok: true }),
            (error) => sendResponse({ ok: false, error: error.message }),
        );
    return true; // Keep message channel open for async response
});
