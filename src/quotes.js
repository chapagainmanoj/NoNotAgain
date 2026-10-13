// Built-in motivational quotes shown on the block page. Attributions are kept to well-sourced
// ones; commonly misattributed quotes are deliberately left out.

export const BUILT_IN_QUOTES = [
    {
        text: 'It is not that we have a short time to live, but that we waste a lot of it.',
        author: 'Seneca',
    },
    { text: 'While we are postponing, life speeds by.', author: 'Seneca' },
    {
        text: 'Begin at once to live, and count each separate day as a separate life.',
        author: 'Seneca',
    },
    {
        text: 'Waste no more time arguing about what a good man should be. Be one.',
        author: 'Marcus Aurelius',
    },
    {
        text: 'The impediment to action advances action. What stands in the way becomes the way.',
        author: 'Marcus Aurelius',
    },
    {
        text: 'First say to yourself what you would be; and then do what you have to do.',
        author: 'Epictetus',
    },
    { text: 'No man is free who is not master of himself.', author: 'Epictetus' },
    {
        text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
        author: 'Will Durant',
    },
    { text: 'Lost time is never found again.', author: 'Benjamin Franklin' },
    { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
    {
        text: "Dost thou love life? Then do not squander time, for that's the stuff life is made of.",
        author: 'Benjamin Franklin',
    },
    {
        text: 'How we spend our days is, of course, how we spend our lives.',
        author: 'Annie Dillard',
    },
    { text: 'Either you run the day or the day runs you.', author: 'Jim Rohn' },
    { text: 'Until we can manage time, we can manage nothing else.', author: 'Peter Drucker' },
    {
        text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.",
        author: 'Stephen Covey',
    },
    { text: 'You can do anything, but not everything.', author: 'David Allen' },
    {
        text: "Focus is a matter of deciding what things you're not going to do.",
        author: 'John Carmack',
    },
    {
        text: "People think focus means saying yes to the thing you've got to focus on. But that's not what it means at all. It means saying no to the hundred other good ideas.",
        author: 'Steve Jobs',
    },
    {
        text: 'Simplicity boils down to two steps: Identify the essential. Eliminate the rest.',
        author: 'Leo Babauta',
    },
    {
        text: 'Amateurs sit and wait for inspiration, the rest of us just get up and go to work.',
        author: 'Stephen King',
    },
    { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
    {
        text: 'Nothing is particularly hard if you divide it into small jobs.',
        author: 'Henry Ford',
    },
    {
        text: 'Do the hard jobs first. The easy jobs will take care of themselves.',
        author: 'Dale Carnegie',
    },
    {
        text: 'You do not rise to the level of your goals. You fall to the level of your systems.',
        author: 'James Clear',
    },
    {
        text: 'Every action you take is a vote for the type of person you wish to become.',
        author: 'James Clear',
    },
    {
        text: 'Motivation is what gets you started. Habit is what keeps you going.',
        author: 'Jim Ryun',
    },
    {
        text: 'The cost of a thing is the amount of what I will call life which is required to be exchanged for it, immediately or in the long run.',
        author: 'Henry David Thoreau',
    },
    { text: 'My experience is what I agree to attend to.', author: 'William James' },
    {
        text: 'The art of being wise is the art of knowing what to overlook.',
        author: 'William James',
    },
    { text: 'Attention is the rarest and purest form of generosity.', author: 'Simone Weil' },
    {
        text: 'Almost everything will work again if you unplug it for a few minutes, including you.',
        author: 'Anne Lamott',
    },
    { text: 'Small deeds done are better than great deeds planned.', author: 'Peter Marshall' },
    { text: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
    { text: 'A year from now you may wish you had started today.', author: 'Karen Lamb' },
    { text: 'If you chase two rabbits, you will not catch either one.', author: 'Russian proverb' },
    {
        text: 'Concentrate all your thoughts upon the work at hand. The sun’s rays do not burn until brought to a focus.',
        author: 'Alexander Graham Bell',
    },
    {
        text: 'Productivity is never an accident. It is always the result of a commitment to excellence.',
        author: 'Paul J. Meyer',
    },
    { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
    {
        text: 'If you spend too much time thinking about a thing, you’ll never get it done.',
        author: 'Bruce Lee',
    },
    {
        text: "It's not always that we need to do more but rather that we need to focus on less.",
        author: 'Nathan W. Morris',
    },
];

// Custom quotes are plain strings; an optional author can follow " — " (e.g. "Keep going — Me").
export function parseCustomQuote(line) {
    const [text, author] = line.split(/\s+[—–-]\s+(?=[^—–-]+$)/);
    return { text: text.trim(), author: author?.trim() || '' };
}

// Picks a random quote from the enabled pools, or null when none are available.
export function pickQuote(settings, random = Math.random) {
    const pool = [
        ...(settings.builtInQuotes ? BUILT_IN_QUOTES : []),
        ...settings.customQuotes.filter((line) => line.trim()).map(parseCustomQuote),
    ];
    return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}
