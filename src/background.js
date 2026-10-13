// Background script for No Not Again
import {
    NOTE_PAGE,
    buildRedirectRules,
    bypassKey,
    domainFromUrl,
    findNoteDomain,
    isBypassActive,
    normalizeDomain,
    notePageUrl,
} from './domain.js';

const DEBUG = false;
const log = (...args) => DEBUG && console.log('[NoNotAgain]', ...args);

const NOTE_PAGE_URL = chrome.runtime.getURL(NOTE_PAGE);
const BYPASS_ALARM_PREFIX = 'bypass-expiry:';

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason === 'update') await migrateNoteKeys();
    rebuildRules();
});

chrome.runtime.onStartup.addListener(() => rebuildRules());

chrome.storage.onChanged.addListener(() => rebuildRules());

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith(BYPASS_ALARM_PREFIX)) rebuildRules();
});

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
    const [notes, local, existingRules] = await Promise.all([
        chrome.storage.sync.get(null),
        chrome.storage.local.get(null),
        chrome.declarativeNetRequest.getDynamicRules(),
    ]);

    const now = Date.now();
    const blocked = [];
    const expiredKeys = [];
    await chrome.alarms.clearAll();

    for (const domain of Object.keys(notes)) {
        const bypass = local[bypassKey(domain)];
        if (isBypassActive(bypass, now)) {
            chrome.alarms.create(BYPASS_ALARM_PREFIX + domain, { when: bypass.expireTime });
        } else {
            if (bypass) expiredKeys.push(bypassKey(domain));
            blocked.push(domain);
        }
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRules.map((rule) => rule.id),
        addRules: buildRedirectRules(blocked, NOTE_PAGE_URL),
    });
    if (expiredKeys.length) await chrome.storage.local.remove(expiredKeys);

    log('Blocking', blocked);
}

// 1.0 saved whatever was typed in the domain box; re-key notes under their normalized domain.
async function migrateNoteKeys() {
    const notes = await chrome.storage.sync.get(null);
    const moved = {};
    const stale = [];
    for (const [key, note] of Object.entries(notes)) {
        const domain = normalizeDomain(key);
        if (domain === key) continue;
        stale.push(key);
        if (domain && !notes[domain]) moved[domain] = note;
    }
    if (Object.keys(moved).length) await chrome.storage.sync.set(moved);
    if (stale.length) await chrome.storage.sync.remove(stale);
    log('Migrated note keys', moved, stale);
}

// Fallback for navigations the redirect rules miss, e.g. right after a bypass expires.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'loading' || !tab.url) return;

    const domain = findNoteDomain(
        domainFromUrl(tab.url),
        Object.keys(await chrome.storage.sync.get(null)),
    );
    if (!domain) return;

    const key = bypassKey(domain);
    const { [key]: bypass } = await chrome.storage.local.get(key);
    if (isBypassActive(bypass)) return;

    log('Fallback redirect for', domain);
    chrome.tabs.update(tabId, { url: notePageUrl(NOTE_PAGE_URL, domain, tab.url) });
});

// The note page asks the background to change state so it can wait for the rules to update
// before navigating back to the site.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handlers = {
        setBypass: () =>
            chrome.storage.local.set({
                [bypassKey(request.domain)]: {
                    expireTime: Date.now() + request.duration,
                    createdAt: Date.now(),
                },
            }),
        deleteNote: () =>
            Promise.all([
                chrome.storage.sync.remove(request.domain),
                chrome.storage.local.remove(bypassKey(request.domain)),
            ]),
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
