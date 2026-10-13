import { describe, expect, it } from 'vitest';
import {
    buildRedirectRules,
    domainFromUrl,
    findNoteDomain,
    isBypassActive,
    normalizeDomain,
    notePageUrl,
    parseNotePageUrl,
} from '../src/domain.js';

const BASE = 'chrome-extension://abc/note-page.html';

describe('normalizeDomain', () => {
    it.each([
        ['facebook.com', 'facebook.com'],
        ['  Facebook.COM ', 'facebook.com'],
        ['www.facebook.com', 'facebook.com'],
        ['https://www.facebook.com/', 'facebook.com'],
        ['http://m.facebook.com/some/path?q=1#x', 'm.facebook.com'],
        ['facebook.com/feed', 'facebook.com'],
        ['facebook.com.', 'facebook.com'],
        ['example.co.uk:8080', 'example.co.uk'],
        ['bücher.de', 'xn--bcher-kva.de'],
    ])('%j -> %j', (input, expected) => {
        expect(normalizeDomain(input)).toBe(expected);
    });

    it.each([
        '',
        '   ',
        null,
        undefined,
        'facebook',
        'localhost',
        'a b.com',
        '*.facebook.com',
        '||x^',
    ])('rejects %j', (input) => {
        expect(normalizeDomain(input)).toBeNull();
    });
});

describe('domainFromUrl', () => {
    it('returns the hostname without www for web pages', () => {
        expect(domainFromUrl('https://www.YouTube.com/watch?v=1')).toBe('youtube.com');
        expect(domainFromUrl('http://m.youtube.com')).toBe('m.youtube.com');
    });

    it.each(['chrome://extensions', 'chrome://newtab/', 'file:///tmp/a.html', 'about:blank', ''])(
        'returns null for %j',
        (url) => {
            expect(domainFromUrl(url)).toBeNull();
        },
    );
});

describe('findNoteDomain', () => {
    const domains = ['google.com', 'mail.google.com', 'x.com'];

    it('matches exact domains and subdomains', () => {
        expect(findNoteDomain('x.com', domains)).toBe('x.com');
        expect(findNoteDomain('news.google.com', domains)).toBe('google.com');
    });

    it('prefers the most specific domain', () => {
        expect(findNoteDomain('inbox.mail.google.com', domains)).toBe('mail.google.com');
    });

    it('does not match lookalike domains', () => {
        expect(findNoteDomain('notx.com', domains)).toBeNull();
        expect(findNoteDomain('x.com.evil.net', domains)).toBeNull();
        expect(findNoteDomain(null, domains)).toBeNull();
    });
});

describe('isBypassActive', () => {
    it('is active only before the expiry time', () => {
        expect(isBypassActive({ expireTime: 2000 }, 1000)).toBe(true);
        expect(isBypassActive({ expireTime: 1000 }, 2000)).toBe(false);
        expect(isBypassActive(undefined)).toBe(false);
    });
});

describe('buildRedirectRules', () => {
    const [rule] = buildRedirectRules(['face.book.com'], BASE);
    const regex = new RegExp(rule.condition.regexFilter);

    it('redirects main-frame loads to the note page with the original URL after #', () => {
        expect(rule.condition.resourceTypes).toEqual(['main_frame']);
        expect(rule.action.redirect.regexSubstitution).toBe(`${BASE}?domain=face.book.com#\\0`);
    });

    it.each([
        'https://face.book.com',
        'https://face.book.com/',
        'http://www.face.book.com/path?q=1',
        'https://a.b.face.book.com:8443/x',
        'https://face.book.com?x=1',
    ])('matches %s', (url) => {
        expect(regex.test(url)).toBe(true);
    });

    it.each([
        'https://facexbook.com/',
        'https://notface.book.com/',
        'https://face.book.com.evil.net/',
        'https://evil.net/?u=face.book.com',
    ])('does not match %s', (url) => {
        expect(regex.test(url)).toBe(false);
    });

    it('gives each rule a unique positive id', () => {
        const ids = buildRedirectRules(['a.com', 'b.com', 'c.com'], BASE).map((r) => r.id);
        expect(new Set(ids).size).toBe(3);
        expect(Math.min(...ids)).toBeGreaterThan(0);
    });
});

describe('note page URLs', () => {
    it('round-trips the domain and original URL, including its own query and hash', () => {
        const original = 'https://www.reddit.com/r/all?sort=new&t=day#top';
        const parsed = parseNotePageUrl(notePageUrl(BASE, 'reddit.com', original));
        expect(parsed).toEqual({ domain: 'reddit.com', originalUrl: original });
    });

    it('works without an original URL', () => {
        expect(parseNotePageUrl(notePageUrl(BASE, 'reddit.com'))).toEqual({
            domain: 'reddit.com',
            originalUrl: null,
        });
    });

    it('ignores an original URL on a different site', () => {
        const parsed = parseNotePageUrl(`${BASE}?domain=reddit.com#https://evil.net/`);
        expect(parsed.originalUrl).toBeNull();
    });

    it('ignores non-web original URLs', () => {
        const parsed = parseNotePageUrl(`${BASE}?domain=reddit.com#javascript:alert(1)`);
        expect(parsed.originalUrl).toBeNull();
    });

    it('rejects an invalid domain parameter', () => {
        expect(parseNotePageUrl(`${BASE}?domain=%3Cscript%3E`).domain).toBeNull();
    });
});
