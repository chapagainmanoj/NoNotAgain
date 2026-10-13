import { describe, expect, it } from 'vitest';
import { BUILT_IN_QUOTES, parseCustomQuote, pickQuote } from '../src/quotes.js';

describe('parseCustomQuote', () => {
    it('splits an author after a dash', () => {
        expect(parseCustomQuote('Keep going — Me')).toEqual({ text: 'Keep going', author: 'Me' });
        expect(parseCustomQuote('Finish first - scroll later - Me')).toEqual({
            text: 'Finish first - scroll later',
            author: 'Me',
        });
    });

    it('keeps text without an author', () => {
        expect(parseCustomQuote('Is this worth it?')).toEqual({
            text: 'Is this worth it?',
            author: '',
        });
        expect(parseCustomQuote('well-known')).toEqual({ text: 'well-known', author: '' });
    });
});

describe('pickQuote', () => {
    it('picks from built-in and custom quotes', () => {
        const settings = { builtInQuotes: true, customQuotes: ['Mine'] };
        expect(pickQuote(settings, () => 0)).toEqual(BUILT_IN_QUOTES[0]);
        expect(pickQuote(settings, () => 0.9999)).toEqual({ text: 'Mine', author: '' });
    });

    it('returns null when no quotes are enabled', () => {
        expect(pickQuote({ builtInQuotes: false, customQuotes: ['  '] })).toBeNull();
    });

    it('has non-empty built-in quotes with authors', () => {
        for (const quote of BUILT_IN_QUOTES) {
            expect(quote.text.length).toBeGreaterThan(0);
            expect(quote.author.length).toBeGreaterThan(0);
        }
    });
});
