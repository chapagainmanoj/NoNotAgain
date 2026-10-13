// Domain helpers shared by the background script, popup and note page.

export const NOTE_PAGE = 'note-page.html';
export const MAX_NOTE_LENGTH = 1000; // keeps each note well under sync storage's 8 KB item limit

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

function stripWww(hostname) {
    return hostname.replace(/^www\./, '');
}

// Turns user input such as "https://www.Example.com/path" into "example.com".
// Returns null when the input isn't a usable domain.
export function normalizeDomain(input) {
    const text = String(input ?? '')
        .trim()
        .toLowerCase();
    if (!text) return null;

    let hostname;
    try {
        hostname = new URL(text.includes('://') ? text : `http://${text}`).hostname;
    } catch {
        return null;
    }

    hostname = stripWww(hostname.replace(/\.$/, ''));
    return HOSTNAME_RE.test(hostname) ? hostname : null;
}

// Hostname of a web page URL without "www.", or null for non-web pages (chrome://, file://, ...).
export function domainFromUrl(url) {
    try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== 'http:' && protocol !== 'https:') return null;
        return stripWww(hostname.toLowerCase());
    } catch {
        return null;
    }
}

// The note domain that covers a hostname: an exact match or a parent domain.
// The most specific match wins, so "mail.google.com" beats "google.com".
export function findNoteDomain(hostname, noteDomains) {
    if (!hostname) return null;
    let best = null;
    for (const domain of noteDomains) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
            if (!best || domain.length > best.length) best = domain;
        }
    }
    return best;
}

export function isBypassActive(bypass, now = Date.now()) {
    return Boolean(bypass && now < bypass.expireTime);
}

export function bypassKey(domain) {
    return `bypass_${domain}`;
}

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// declarativeNetRequest rules redirecting each domain (and its subdomains) to the note page.
// The original URL is appended after "#" so the note page can send the user back to it.
export function buildRedirectRules(domains, notePageUrl) {
    return domains.map((domain, index) => ({
        id: index + 1,
        priority: 1,
        action: {
            type: 'redirect',
            redirect: {
                regexSubstitution: `${notePageUrl}?domain=${encodeURIComponent(domain)}#\\0`,
            },
        },
        condition: {
            regexFilter: `^https?://([^/?#]*\\.)?${escapeRegex(domain)}(:[0-9]+)?([/?#].*)?$`,
            resourceTypes: ['main_frame'],
        },
    }));
}

// Note page URL for a domain, optionally carrying the URL the user was trying to open.
export function notePageUrl(baseUrl, domain, originalUrl) {
    const url = `${baseUrl}?domain=${encodeURIComponent(domain)}`;
    return originalUrl ? `${url}#${originalUrl}` : url;
}

// Reads the domain and original URL back out of a note page URL.
export function parseNotePageUrl(href) {
    const url = new URL(href);
    const domain = normalizeDomain(url.searchParams.get('domain'));
    const hashIndex = href.indexOf('#');
    const original = hashIndex === -1 ? '' : href.slice(hashIndex + 1);
    // Only return to a page on the noted domain, so a crafted link can't redirect elsewhere.
    const sameSite = domain && findNoteDomain(domainFromUrl(original), [domain]);
    return { domain, originalUrl: sameSite ? original : null };
}
